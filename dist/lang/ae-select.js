'use strict';

import $ from 'jquery';

import keycode from 'keycode';
import attachAction from '../delegate/action-trigger-delegate';
import valueChangeDelegate from '../delegate/value-change-delegate';
import each from 'lodash.foreach';
import SignalWiring from '../wiring/SignalWiring';
import PropertyWiring from '../wiring/PropertyWiring';
import AttributeWiring from '../wiring/AttributeWiring';
import Wiring from '../wiring/Wiring';
import Binding from '../Binding';

let delayedSetTimeout;

class SelectValueWiring extends Wiring {
    constructor(inElement) {
        super();
        this.element = inElement;
        const attrValue = $(this.element).attr('bind-value') || $(this).attr('to-value');
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
                inBinding.setValue($(this.element).find('option:selected').val());
            });
        };

        const delayedChangeHandler = () => {
            if (delayedSetTimeout) {
                clearTimeout(delayedSetTimeout);
            }
            delayedSetTimeout = setTimeout(setProperty, $(this.element).attr('value-out-delay') || 0);
        };
        const changeHandler = () => {
            setProperty();
        };

        $(this.element).off('change').on('change', changeHandler);

        const handler = (inValue) => {
            each($(this.element).find('option'), (inOption) => {
                if(inValue === $(inOption).val()) {
                    $(inOption).prop('selected', true);
                    return true;
                }
            });
        };

        each(this.bindings, (inBinding) => {
            if (inBinding instanceof Binding) {
                inBinding.attach(inApp, handler, this.element);
            }
        });
        setProperty();
    }

    detach() {
        $(this.element).off('change');
        each(this.bindings, (inBinding) => {
            inBinding.detach();
        });
    }

}

export default function aeSelect(inPage) {
    const _page = inPage;
    let observer;

    var proto = Object.create(HTMLSelectElement.prototype);

    proto.createdCallback = function() {

        let wirings = [];
        $(this).prop('ae', {
            wirings: wirings
        });

        const source = $(this).attr('source');

        if ($(this).attr('bind-value') || $(this).attr('to-value')) {
            wirings.push(new SelectValueWiring(this));
        }

        wirings.push.apply(wirings, PropertyWiring.wire(this));

        $.each(this.attributes, (i, attrib) => {
            if (/^signal/.test(attrib.name)) {
                wirings.push(new SignalWiring(this, attrib.name));
            }
        });
        wirings.push.apply(wirings, AttributeWiring.wire(this, ['class', 'id', 'name', 'param', 'data', 'style']));
    };

    proto.attachedCallback = function() {
        const ae = $(this).prop('ae');
        each(ae.wirings, (wiring) => {
            wiring.attach(_page);
        });

    };

    proto.detachedCallback = function() {
        const ae = $(this).prop('ae');
        each(ae.wirings, (wiring) => {
            wiring.detach();
        });
    };



    document.registerElement('ae-select', {
        prototype: proto,
        extends: 'select'
    });
}
