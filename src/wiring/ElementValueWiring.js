'use strict';
import Wiring from './Wiring';
import $ from 'jquery';
import Binding from '../Binding';

import get from 'lodash.get';
import each from 'lodash.foreach';
import includes from 'lodash.includes';

let delayedSetTimeout;


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
        this.bindings = Binding.parse(attrValue, inElement);
    }

    attach(inApp) {
        if (inApp) {
            this.app = inApp;
        } else if (!this.app) {
            throw new Error('ElementValueWiring: cannot attach to undefined app');
        }

        const setProperty = () => {
            delayedSetTimeout = null;
            each(this.bindings, (inBinding, inIndex) => {
                inBinding.setValue($(this.element).val());
            });
        };

        const changeHandler = () => {
            if (delayedSetTimeout) {
                clearTimeout(delayedSetTimeout);
            }
            delayedSetTimeout = setTimeout(setProperty, $(this.element).attr('value-out-delay') || 0);
        };

        $(this.element).off('change').on('change', changeHandler);
        $(this.element).off('keyup').on('keyup', changeHandler);

        const handler = (inValue) => {
            setValue.call(this);
        };

        each(this.bindings, (inBinding) => {
            if (inBinding instanceof Binding) {
                inBinding.attach(inApp, handler);
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
export default ElementValueWiring;
