'use strict';
import Wiring from './Wiring';
import $ from 'jquery';
import Binding from '../Binding';

import get from 'lodash.get';
import each from 'lodash.foreach';
import includes from 'lodash.includes';


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
        $(this.element).html(val.join(' '));
    });

};

class ElementHTMLWiring extends Wiring {

    constructor(inElement) {
        super();
        this.element = inElement;
        const attrValue = $(this.element).attr('bind-html');
        this.bindings = Binding.parse($(this.element).attr('bind-html'), inElement);
    }

    attach(inApp) {
        if (inApp) {
            this.app = inApp;
        } else if (!this.app) {
            throw new Error('AttributeWiring: cannot attach to undefined app');
        }

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
        each(this.bindings, (inBinding) => {
            inBinding.detach();
        });
    }


}
module.exports = ElementHTMLWiring;
