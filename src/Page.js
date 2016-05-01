'use strict';

import Component from './component';
import _ from 'lodash';
import $ from 'jquery';

import modelDataSource from './datasource/model-datasource';
const _dataSources = new Map();
import lang from './lang/ae-lang';
import factory from './page-factory';

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
        while (fn = _config.components.shift()) { //jshint ignore:line
            fn(this);
        }
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
        this.mountPoint = inConfig.mountPoint || 'body';
        this.addDataSource('model', modelDataSource(this));
        inConstructor.bind(this)();
        this.currentState = this.states;
        this.page = this;
        callNextInitializer.call(this);

    }


    resolveNodeModel(inNode, inPath) {
        let component = this.resolveNodeComponent(inNode);
        if (inPath && !/^(_state|_nextState)/.test(inPath.split('.')[0]) &&
            !component.model.prop('data')) {
            return this.resolveNodeModel($(component.node).parent(), inPath);
        }
        return component.model;
    }

    resolveNodeComponent(inNode) {
        let node = $(inNode).get(0);
        ;
        while (!_registry.get(node)) {
            node = $(node).parent().get(0);
            if (!node) {
                break;
            }
        }
        if (!_registry.get(node)) {
            console.debug('Could not find component in ancestry. Falling back to page component');
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
            _registry.set(this, component);
            component.node = this;

            for (let injector of _componentInjectors) {
                injector.call(that, component);
            }
            component.onElementCreated && component.onElementCreated.call(component); //jshint ignore:line
        };

        proto.attachedCallback = function() {
            const component = _registry.get(this);
            let fn = component.onElementAttached;
            if (fn) {
                fn(this);
            }
            if (component.config.autoRender !== false) {
                component.render.call(component);
            }
        };

        proto.detachedCallback = function() {
            const component = _registry.get(this);

            let fn = component.onElementDetached;
            if (fn) {
                fn.call(component);
            }
        };

        document.registerElement(inDefinition.config.name, { prototype: proto });
    }

}


export default Page;
