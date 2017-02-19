'use strict';

import Component from './component';
import get from 'lodash.get';
import each from 'lodash.foreach';
import isFunction from 'lodash.isFunction';
import isPlainObject from 'lodash.isPlainObject';
import ObservableObject from './ObservableObject';
import $ from 'jquery';

import modelDataSource from './datasource/model-datasource';
const _dataSources = new Map();
import lang from './lang/ae-lang';
import factory from './page-factory';
import ComponentLifecycle from './ComponentLifecycle';
import privateHash from './util/private';
import LiteUrl from 'lite-url';
import AttributeWiring from './wiring/AttributeWiring';
import PropertyWiring from './wiring/PropertyWiring';
import StateWiring from './wiring/StateWiring';

const _private = privateHash('component');

let _registry = new WeakMap();
let _templatingDelegate;

const _initializers = [];
const _componentInjectors = [];

let _config;

const parseUrl = function parseUrl() {
    _private.get(this).startupParams = new LiteUrl(window.location.href).params;
};

const startPage = function startPage() {
    $(() => {
        this.node = $(this.mountPoint);
        $(this.mountPoint).prop('ae', this);
        lang(this);
        _private.get(this)
            .lifecycleSignal.dispatch('element-created');
        _private.get(this)
            .lifecycleSignal.dispatch('element-attached');
        if (this.config.autoRender !== false) {
            this.invalidate();
        }
    });
};

const callNextInitializer = function() {
    let initializer = _initializers.shift();
    if (!initializer) {
        startPage.call(this);
        return;
    }
    let result = initializer.call(this);
    let resultHandler = () => {
        let fn;
        while (fn = _config.components.shift()) { //jshint ignore:line
            fn(this);
        }
        if (_initializers.length) {
            callNextInitializer.call(this);
        } else {
            startPage.call(this);
        }
    };
    if (result instanceof Promise) {
        result.then(resultHandler);
    } else {
        resultHandler();
    }

};

class Page extends Component {
    constructor(inConfig, inModelPrototype, inConstructor) {
        super(inConfig, inModelPrototype);
        this.page = this;
        _config = inConfig;
        parseUrl.call(this);
        this.mountPoint = inConfig.mountPoint || 'body';
        this.addDataSource('model', modelDataSource(this));
        inConstructor.bind(this)(inConfig);

        callNextInitializer.call(this);
    }

    loadModule(inUrl) {
        return new Promise((resolve, reject) => {
            $.ajax({
                url: inUrl,
                converters: {
                    'text script': (text) => {
                        return text;
                    }
                },
                success: (js_code) => {
                    new Function('inPage', js_code)(this); //jshint ignore:line
                    resolve();
                },
                fail: (inError) => {
                    reject(inError);
                }
            });
        });
    }

    get startupParams() {
        return _private.get(this).startupParams;
    }

    resolveNodeModel(inNode, inModelName) {
        const component = this.resolveNodeComponent(inNode);
        if (inModelName) {
            return component.getModel(inModelName);
        }
        if(component.model) {
            return component.model;
        } else if(!(component instanceof Page)){
            return this.resolveNodeModel($(component.node).parent(), inModelName);
        }
        return null;
    }

    resolveNodeComponent(inNode) {
        let node = $(inNode).get(0);
        while (!_registry.get(node)) {
            node = $(node).parent().get(0);
            if (!node) {
                break;
            }
        }
        if (!_registry.get(node)) {
            if (get(window, 'logLevel') === 'debug') {
                console.debug('Could not find component in ancestry. Falling back to page component');
            }
            return this;
        }
        return _registry.get(node);

    }

    getResolver(inName) {
        return get(_config, 'resolvers.' + inName);
    }


    addDataSource(inName, inInitFunction) {
        _dataSources.set(inName, inInitFunction(this));
    }

    getDataSource(inName) {
        inName = inName || 'model';
        return _dataSources.get(inName);
    }

    registerInitializer(inFn) {
        _initializers.push(inFn);
    }

    registerComponentInjector(inInjectorFn) {
        _componentInjectors.push(inInjectorFn);
    }

    render(inModel) {
        super.render(inModel);
        $(this.mountPoint).css('display', '');
    }

    getTemplate(inName) {
        return _templatingDelegate.getTemplate(inName);
    }

    registerComponent(...args) {

        const constructor = args.pop();
        const config = args.shift();
        const model = args.shift();
        if (!isFunction(constructor) ||
            !isPlainObject(config)) {
            throw new Error('Page.registerComponent() usage: (config : Object, [model : Object|ObservableObject], constructor : Function');
        }
        return this.registerComponentElement({
            config: config,
            modelPrototype: model,
            constructor: constructor
        });
    }



    initState() {
        let hash = window.location.hash = decodeURI(window.location.hash);

        if (/^#>[\w\-]/.test(hash)) {
            hash = hash.replace(/^#>/, '');
            if (this.states.getPath(hash)) {
                this.tryState(hash);
            }
        }
        this.getStartupState = () => hash;

        $(window).on('hashchange', () => {
            if (/^#action:/.test(window.location.hash)) {
                const fakeUrl = new LiteUrl(window.location.hash.replace(/^#action:/, 'http://localhost/'));
                this.bus.triggerAction(fakeUrl.pathname.replace(/\//g, ''), fakeUrl.search);
                window.location.hash = '';
            }
        }).trigger('hashchange');
    }

    registerComponentElement(inDefinition) {
        var proto = Object.create(HTMLDivElement.prototype);
        var that = this;
        let component;
        const name = inDefinition.config.name;

        proto.createdCallback = function() {
            component = new Component(
                inDefinition.config,
                inDefinition.modelPrototype,
                inDefinition.constructor,
                that);
            _registry.set(this, component);
            component.node = this;
            Object.defineProperty(this, 'ae', {
                enumerable: false,
                configurable: false,
                writable: false,
                value: component
            });

            Object.defineProperty(component, 'element', {
                get: () => {
                    return this;
                }
            });
            for (let injector of _componentInjectors) {
                injector.call(that, component);

            }
            const wirings = [];
            _private.get(component).wirings = wirings;
            wirings.push.apply(wirings,
                AttributeWiring.wire(this, ['class', 'id', 'name', 'param', 'data'].concat(get(inDefinition, 'config.bindableAttributes'))));

            wirings.push.apply(wirings, PropertyWiring.wire(this));

            if ($(this).attr('state-match')) {
                _private.get(component).wirings.push(new StateWiring(this));
            }


            _private.get(component)
                .lifecycleSignal.dispatch('element-created');
        };

        proto.attachedCallback = function() {
            const component = _registry.get(this);
            each(_private.get(component).wirings, (wiring) => {
                wiring.attach(component.page);
            });
            if ($(this).attr('from')) {
                const from = $(this).attr('from');
                const model = that.resolveNodeModel($(this).parent());
                component.model.prop('data', ObservableObject.fromObject(model.prop('data' + (from === '.' ? '' : '.' + from))));
            }
            _private.get(component)
                .lifecycleSignal.dispatch('element-attached');

            if (component.config.autoRender !== false) {
                component.render.call(component);
            }
        };

        proto.detachedCallback = function() {
            each(_private.get(component).wirings, (wiring) => {
                wiring.detach();
            });
            _private.get(component)
                .lifecycleSignal.dispatch('element-detached');
            //_private.delete(component);
        };

        document.registerElement(inDefinition.config.name, {
            prototype: proto
        });
        return name;

    }

}


export default Page;
