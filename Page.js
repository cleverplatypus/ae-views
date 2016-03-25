'use strict';
const Bus = require('./Bus');
const Component = require('./Component');
const $ = require('jquery');
const ObservableObject = require('./ObservableObject');
const modelDataSource = require('./model-datasource');
const _dataSources = new Map();
const lang= require('./ae-lang');

class Page extends Component {
    constructor(inConfig, inModelPrototype, inConstructor) {
        super(inConfig.name, inModelPrototype);

        window.ppage = this;
        this.mountPoint = inConfig.mountPoint || 'body';
        const that = this;

        
        $(this.mountPoint).css('display', 'none !important');
        
        this.bus = new Bus();
        this.addDataSource('model', modelDataSource(this));
        this.template = inConfig.templates;
        inConstructor.bind(this)();
        this.currentState = this.states;
        let result = this.initialize.bind(this)();
        let resultHandler = () => {
                _.forEach(inConfig.components, (inComponentFn) => {
                    inComponentFn(this);
                });
                this.render();
            };
        if (result instanceof Promise) {
            result.then(resultHandler);
        } else {
            resultHandler();
        }
        $(() => {
            Object.defineProperty($(this.mountPoint).get(0), 'component', {value : this});
            lang(this);
        });
    }

    resolveNodeComponent(inNode) {
        let originalNode = inNode;
        while(!$(inNode).prop('component')) {
            inNode = $(inNode).parent();
        }
        if(!$(inNode).prop('component')) {
            console.debug('Could not find component in ancestry. Falling back to page component');
            return this;
        }
        return $(inNode).prop('component');

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
        $(this.mountPoint).css('display', null);
        console.log('it is time to render');
    }

    registerComponent(inName, inModelPrototype, inConstructor) {
        this.registerComponentElement({
            name: inName,
            modelPrototype: inModelPrototype,
            constructor: inConstructor
        });
    }

    registerComponentElement(inDefinition) {
        var proto = Object.create(HTMLElement.prototype);



        proto.createdCallback = () => {
            let component = new Component(
                inDefinition.name, 
                inDefinition.modelPrototype, 
                inDefinition.constructor);
                Object.defineProperty(this, 'component', {value : component});
            if (this.injectComponent) {
                this.injectComponent(component);
            }
            component.onElementCreated(this);
            
        }

        proto.attachedCallback = function() {
            let fn = this.component.onElementAttached;
            if (fn) {
                fn(this);
            }
        }

        proto.detachedCallback = function() {
            let fn = this.component.onElementDetached;
            if (fn) {
                fn(this);
            }
        }

        document.registerElement(inDefinition.name, { prototype: proto });

    }




}


module.exports = Page;
