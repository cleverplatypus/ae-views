'use strict';

import Component from './component';
import _ from 'lodash';
import $ from 'jquery';

import DustTemplatingDelegate from './delegate/DustTemplatingDelegate';
import modelDataSource from './datasource/model-datasource';
const _dataSources = new Map();
import lang from './lang/ae-lang';
let _registry = new WeakMap();
let _templatingDelegate;

const _initializers = [];
const _componentInjectors = [];

let _config;

const callNextInitializer = function() {
    let initializer = _initializers.shift();
    if (!initializer) {
        return;
    }
    let result = initializer.call(this);
    let resultHandler = () => {
        let fn;
        while(fn = _config.components.shift()) {
            fn(this);
        };
        if (_initializers.length) {
            callNextInitializer.call(this);
        } else {
            $(() => {
                this.node = $(this.mountPoint);
                lang(this);
                this.render();
            });
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
        _templatingDelegate = inConfig.templatingDelegate || new DustTemplatingDelegate(inConfig.evilFunction);
        window.ppage = this; //DEBUG
        this.mountPoint = inConfig.mountPoint || 'body';

        // $(this.mountPoint).css('display', 'none !important');

        this.addDataSource('model', modelDataSource(this));
        this.templates = inConfig.templates;
        inConstructor.bind(this)();
        this.currentState = this.states;

        callNextInitializer.call(this);

    }

    getTemplatingDelegate() {
        return _templatingDelegate;
    }

    resolveNodeModel(inNode, inPath) {
        let component = this.resolveNodeComponent(inNode);
        if (inPath && !/^_/.test(inPath.split('.')[0]) &&
            !component.model.prop('data')) {
            return this.resolveNodeModel($(component.node).parent(), inPath);
        }
        return component.model;
    }

    resolveNodeComponent(inNode) {
        //let originalNode = $(inNode).get(0);
        while (!_registry.get(inNode)) {
            inNode = $(inNode).parent().get(0);
            if (!inNode) {
                break;
            }
        }
        if (!_registry.get(inNode)) {
            console.debug('Could not find component in ancestry. Falling back to page component');
            return this;
        }
        return _registry.get(inNode);

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

    render() {
        super.render();
        $(this.mountPoint).css('display', '');
    }

    registerComponent(inConfig, inModelPrototype, inConstructor) {
        this.registerComponentElement({
            config: inConfig,
            modelPrototype: inModelPrototype,
            constructor: inConstructor
        });
    }

    registerComponentElement(inDefinition) {
        var proto = Object.create(HTMLDivElement.prototype);
        var that = this;

        proto.createdCallback = function() {

            let component = new Component(
                inDefinition.config,
                inDefinition.modelPrototype,
                inDefinition.constructor,
                that);
            component.node = this;
            _registry.set(this, component);
            for (let injector of _componentInjectors) {
                injector.call(that, component);
            }
            component.onElementCreated(that);

            //let content = $(this).html();

        };

        proto.attachedCallback = function() {
            let fn = _registry.get(this).onElementAttached;
            if (fn) {
                fn(this);
            }
            _registry.get(this).render();
        };

        proto.detachedCallback = function() {
            let fn = _registry.get(this).onElementDetached;
            if (fn) {
                fn(this);
            }
        };

        document.registerElement(inDefinition.config.name, { prototype: proto });

    }




}


export default Page;
