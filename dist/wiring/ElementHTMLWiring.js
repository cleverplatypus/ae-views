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
        const totalVal = val.join('');
        if ($(this.element).html() !== totalVal) {
            $(this.element).html(totalVal);
        }
    });

};

class ElementHTMLWiring extends Wiring {

    constructor(inElement) {
        super();
        this.element = inElement;
        const attrValue = $(this.element).attr('to-html') || $(this.element).attr('bind-html');
        this.bindings = Binding.parse(attrValue);
    }

    attach(inApp) {
        if (inApp) {
            this.app = inApp;
        } else if (!this.app) {
            throw new Error('ElementHTMLWiring: cannot attach to undefined app');
        }
        const component = inApp.resolveNodeComponent(this.element);
        const targetElement = component.element === this.element ? $(this.element).parent() : this.element;

        if (!$(this.element).attr('to-html')) {
            this.observer = new MutationObserver((mutations) => {
                each(this.bindings, (inBinding, inIndex) => {
                    inBinding.setValue($(this.element).html());
                });

            });

            var config = {
                subtree: true,
                childList: true,
                characterData: true,
                attributes: true
            };

            this.observer.observe(this.element, config);
        }
        const handler = (inValue) => {
            setValue.call(this);
        };

        each(this.bindings, (inBinding) => {
            if (inBinding instanceof Binding) {
                inBinding.attach(inApp, handler, targetElement);
            }
        });
    }

    detach() {
        const that = this;
        each(this.bindings, (inBinding) => {
            inBinding.detach();
        });
    }


}
export default ElementHTMLWiring;
