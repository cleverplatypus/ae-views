'use strict';

import Component from './component';
import {get,
    isFunction,
    isPlainObject
} from 'lodash';
import $ from 'jquery';

import modelDataSource from './datasource/model-datasource';
const _dataSources = new Map();
import lang from './lang/ae-lang';
import factory from './page-factory';
import ComponentLifecycle from './ComponentLifecycle';
import privateHash from './util/private';
import LiteUrl from 'lite-url';

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
        lang(this);
        _private.get(this)
            .lifecycleSignal.dispatch('element-created');
        _private.get(this)
            .lifecycleSignal.dispatch('element-attached');
        this.render();
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
        _config = inConfig;
        parseUrl.call(this);
        this.mountPoint = inConfig.mountPoint || 'body';
        this.addDataSource('model', modelDataSource(this));
        inConstructor.bind(this)();
        this.page = this;
        callNextInitializer.call(this);
    }

    startupParam(inParamName) {
        return _private.get(this).startupParams[inParamName];
    }

    resolveNodeModel(inNode, inPath) {
        let component = this.resolveNodeComponent(inNode);
        if (!component.hasModel) {
            return this.resolveNodeModel($(component.node).parent(), inPath);
        }
        return component.model;
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

    registerComponent(...args) {

        const constructor = args.pop();
        const config = args.shift();
        const model = args.shift();
        if (!isFunction(constructor) ||
            !isPlainObject(config)) {
            throw new Error('Page.registerComponent() usage: (config : Object, [model : Object|ObservableObject], constructor : Function');
        }
        this.registerComponentElement({
            config: config,
            modelPrototype: model,
            constructor: constructor
        });
    }

    initState() {
        let hash = window.location.hash;
        if (/^#>[\w\-]/.test(hash)) {
            hash = hash.replace(/^#>/, '');
            if (this.states.getPath(hash)) {
                this.tryState(hash);
            }
        }
    }

    registerComponentElement(inDefinition) {
        var proto = Object.create(HTMLDivElement.prototype);
        var that = this;
        let component;
        const name = inDefinition.config.name;
        console.info('registering component: ' + name);
        document.styleSheets[0].insertRule(name + '{ display: block;}', 1);

        proto.createdCallback = function() {
            component = new Component(
                inDefinition.config,
                inDefinition.modelPrototype,
                inDefinition.constructor,
                that);
            _registry.set(this, component);
            component.node = this;

            for (let injector of _componentInjectors) {
                injector.call(that, component);
            }
            _private.get(component)
                .lifecycleSignal.dispatch('element-created');
        };

        proto.attachedCallback = function() {
            const component = _registry.get(this);
            if($(this).attr('from')) {
                var model = that.resolveNodeModel($(this).parent());
                component.model.prop('data', model.prop('data.' + $(this).attr('from')));
            }
            _private.get(component)
                .lifecycleSignal.dispatch('element-attached');
            if (component.config.autoRender !== false) {
                component.render.call(component);
            }
        };

        proto.detachedCallback = function() {
            _private.get(component)
                .lifecycleSignal.dispatch('element-detached');
        };

        document.registerElement(inDefinition.config.name, {
            prototype: proto
        });
    }

}


export default Page;
