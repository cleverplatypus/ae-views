'use strict';
import Bus from './Bus';
import Component from './component'
import $ from 'jquery';
import ObservableObject from './ObservableObject';
import modelDataSource from './datasource/model-datasource';
const _dataSources = new Map();
import lang from './lang/ae-lang';
let _registry = new WeakMap();

class Page extends Component {
    constructor(inConfig, inModelPrototype, inConstructor) {
        super(inConfig.name, inModelPrototype);

        window.ppage = this;
        this.mountPoint = inConfig.mountPoint || 'body';
        const that = this;


        $(this.mountPoint).css('display', 'none !important');

        //this.bus = new Bus();
        this.addDataSource('model', modelDataSource(this));
        this.template = inConfig.templates;
        inConstructor.bind(this)();
        this.currentState = this.states;
        let result = this.initialize.bind(this)();
        let resultHandler = () => {
            _.forEach(inConfig.components, (inComponentFn) => {
                inComponentFn(this);
            });
            $(() => {
                Object.defineProperty($(this.mountPoint).get(0), 'component', { value: this });
                lang(this);
                this.render();
            });
        };
        if (result instanceof Promise) {
            result.then(resultHandler);
        } else {
            resultHandler();
        }

    }

    resolveNodeModel(inNode, inPath) {
        let component = this.resolveNodeComponent(inNode);
        if (!/^_/.test(inPath.split('.')[0]) &&
            !component.model.prop('data')) {
            return this.resolveNodeModel($(component.node).parent(), inPath);
        }
        return component.model;
    }

    resolveNodeComponent(inNode) {
        let originalNode = $(inNode).get(0);
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



    initialize() {
        return Promise.resolve();
    }

    render() {
        $(this.mountPoint).css('display', '');
        console.log('it is time to render');
    }

    registerComponent(inConfig, inModelPrototype, inConstructor) {
        this.registerComponentElement({
            config : inConfig,
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
            if (that.injectComponent) {
                that.injectComponent(component);
            }
            component.onElementCreated(that);
            let content = $(this).html();
            // $(this).empty();
            // setTimeout( () => {
            //     $(this).html(content);
            // }, 0);

        }

        proto.attachedCallback = function() {
            let fn = _registry.get(this).onElementAttached;
            if (fn) {
                fn(this);
            }
        }

        proto.detachedCallback = function() {
            let fn = _registry.get(this).onElementDetached;
            if (fn) {
                fn(this);
            }
        }

        document.registerElement(inDefinition.name, { prototype: proto });

    }




}


module.exports = Page;
