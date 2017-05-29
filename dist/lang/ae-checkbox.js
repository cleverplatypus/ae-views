'use strict';

const $ = require('jquery');

const keycode = require('keycode');
const attachAction = require('../delegate/action-trigger-delegate');
const valueChangeDelegate = require('../delegate/value-change-delegate');
const each = require('lodash.foreach');
const SignalWiring = require('../wiring/SignalWiring');
const PropertyWiring = require('../wiring/PropertyWiring');
const AttributeWiring = require('../wiring/AttributeWiring');
const Wiring = require('../wiring/Wiring');
const Binding = require('../Binding');

let delayedSetTimeout;

class CheckboxWiring extends Wiring {
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
                inBinding.setValue($(this.element).prop('checked'));
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

        $(this.element).off('click').on('click', changeHandler);

        const handler = (inValue) => {
            $(this.element).prop('checked', inValue === true);
        };

        each(this.bindings, (inBinding) => {
            if (inBinding instanceof Binding) {
                inBinding.attach(inApp, handler, this.element);
            }
        });
        setProperty();
    }

    detach() {
        $(this.element).off('click');
        each(this.bindings, (inBinding) => {
            inBinding.detach();
        });
    }

}

export default function aeSelect(inPage) {
    const _page = inPage;
    let observer;

    var proto = Object.create(HTMLInputElement.prototype);

    proto.createdCallback = function() {

        let wirings = [];
        $(this).prop('ae', {
            wirings: wirings
        });

        const source = $(this).attr('source');

        if ($(this).attr('bind-value') || $(this).attr('to-value')) {
            wirings.push(new CheckboxWiring(this));
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



    document.registerElement('ae-checkbox', {
        prototype: proto,
        extends: 'input'
    });
}
