'use strict';

const Wiring = require('./Wiring');
const $ = require('jquery');
const Binding = require('../Binding');

const get = require('lodash.get');
const each = require('lodash.foreach');
const includes = require('lodash.includes');


const componentPropertyHandler = function componentPropertyHandler(inAttrName, inValue) {
    const val = [];
    const promises = [];
    const propertyName = this.attrName.replace('prop-', '').replace(/-/g, '.');
    const component = this.app.resolveNodeComponent(this.targetElement);

    each(this.bindings, (inBinding, inIndex) => {
        if (inBinding instanceof Binding) {
            const promise = inBinding.getValue();
            promise.then((inNewValue) => {
                val[inIndex] = inNewValue;
            });
            promises.push(promise);

        }
        val.push(inBinding);
    });
    Promise.all(promises).then(() => {
        this.app.getDataSource().setPath(this.element, propertyName, val.length === 1 ? val[0] : val.join(''));
    });

};

const elementPropertyHandler = function elementPropertyHandler(inAttrName, inValue) {
    const val = [];
    const promises = [];
    const propertyName = this.attrName.replace('prop-', '');
    const propertyClass = typeof $(this.element).prop(propertyName);

    if (propertyClass !== 'string' && this.bindings.length !== 1) {
        throw new Error('Cannot bind property ' + propertyName + ' of type ' + propertyClass + ' to composite bindings');
    }

    each(this.bindings, (inBinding, inIndex) => {
        if (inBinding instanceof Binding) {
            const promise = inBinding.getValue();
            promise.then((inNewValue) => {
                val[inIndex] = inNewValue;
            });
            promises.push(promise);

        }
        val.push(inBinding);
    });
    Promise.all(promises).then(() => {
        if (propertyClass === 'number' && isNaN(val[0])) {
            throw new Error('Cannot assign "' + val[0] + '" to property of type ' + propertyClass);
        }
        if (propertyClass === 'boolean' && typeof val[0] !== 'boolean') {
            throw new Error('Cannot assign "' + val[0] + '" to property of type ' + propertyClass);
        }
        if (propertyClass === 'boolean' || propertyClass === 'number') {
            $(this.element).prop(propertyName, val[0]);
        } else {
            $(this.element).prop(propertyName, val.join(''));
        }
    });

};

class PropertyWiring extends Wiring {

    constructor(inElement, inAttrName, inBindings) {
        super(inElement);
        this.element = inElement;
        this.attrName = inAttrName;
        this.bindings = inBindings;
    }

    binds(inAttrName) {
        return this.attrName === inAttrName || this.bindings.length;
    }

    attach(inApp) {
        if (inApp) {
            this.app = inApp;
        } else if (!this.app) {
            throw new Error('PropertyWiring: cannot attach to undefined app');
        }
        const component = inApp.resolveNodeComponent(this.element);
        this.targetElement = 
            component.element === this.element ? $(this.element).parent() : this.element;
        const handler = (inValue) => {
            if(component.element === this.element) {
                componentPropertyHandler.call(this, this.attrName, inValue);
            } else {
                elementPropertyHandler.call(this, this.attrName, inValue);
            }
        };

        each(this.bindings, (inBinding) => {
            if (inBinding instanceof Binding) {
                inBinding.attach(inApp, handler, this.targetElement);
            }
        });
    }

    detach() {
        each(this.bindings, (inBinding) => {
            if (inBinding instanceof Binding) {
                inBinding.detach();
            }
        });
    }

    static wire(inElement) {
        const wirings = [];
        const attrToRemove = [];
        $.each(inElement.attributes, function(i, attrib) {
            if (/^prop-/.test(attrib.name)) {
                const val = Binding.parse(attrib.value);
                if (val !== attrib.value) {
                    // const propertyName = attrib.name.replace('prop-', '');
                    // const propertyClass = typeof $(inElement).prop(propertyName);
                    // if (propertyClass !== 'string' && val.length !== 1) {
                    //     throw new Error('Cannot bind property ' + propertyName + ' of type ' + propertyClass + ' to composite bindings');
                    // }
                    wirings.push(new PropertyWiring(inElement, attrib.name, val));
                    attrToRemove.push(attrib.name);
                }
            }

        });
        each(attrToRemove, (inName) => {
            $(inElement).removeAttr(inName);
        });
        return wirings;
    }
}

module.exports = PropertyWiring;
