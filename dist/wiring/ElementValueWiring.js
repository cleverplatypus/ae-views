'use strict';
const Wiring = require('./Wiring');
const $ = require('jquery');
const Binding = require('../Binding');

const get = require('lodash.get');
const each = require('lodash.foreach');
const includes = require('lodash.includes');



const setValue = function setValue(inValue) {
    const val = [];
    const promises = [];

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
        const totalVal = val.join('');
        if ($(this.element).val() !== totalVal) {
            $(this.element).val(totalVal);
        }
    });

};

class ElementValueWiring extends Wiring {

    constructor(inElement) {
        super();
        this.element = inElement;
        const attrValue = $(this.element).attr('to-value') || $(this.element).attr('bind-value');
        this.bindings = Binding.parse(attrValue);
    }

    attach(inApp) {
        if (inApp) {
            this.app = inApp;
        } else if (!this.app) {
            throw new Error('ElementValueWiring: cannot attach to undefined app');
        }
        const component = inApp.resolveNodeComponent(this.element);
        const targetElement = component.element === this.element ? $(this.element).parent() : this.element;

        const setProperty = () => {
            this.delayedSetTimeout = null;
            each(this.bindings, (inBinding, inIndex) => {
                inBinding.setValue($(this.element).val());
            });
        };

        const changeHandler = () => {
            if (this.delayedSetTimeout) {
                clearTimeout(this.delayedSetTimeout);
            }
            this.delayedSetTimeout = setTimeout(setProperty, $(this.element).attr('value-out-delay') || 0);

        };

        $(this.element).off('change').on('change', changeHandler);
        $(this.element).off('keyup').on('keyup', changeHandler);
        $(this.element).off('input').on('input', changeHandler);
        $(this.element).off('focus').on('focus', changeHandler);
        $(this.element).off('blur').on('blur', changeHandler);

        const handler = (inValue) => {
            setValue.call(this);
        };

        each(this.bindings, (inBinding) => {
            if (inBinding instanceof Binding) {
                inBinding.attach(inApp, handler,targetElement);
            }
        });
    }

    detach() {
        $(this.element).off('change');
        each(this.bindings, (inBinding) => {
            inBinding.detach();
        });
    }


}
module.exports = ElementValueWiring;
