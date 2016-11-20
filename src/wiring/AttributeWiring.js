'use strict';

const Wiring = require('./Wiring');
const $ = require('jquery');
const Binding = require('../Binding');

const get = require('lodash.get');
const each = require('lodash.foreach');
const includes = require('lodash.includes');


const _observeClassAttrMutation = function _observeClassAttrMutation(inHandler) {
    //Using mutation observer on class attribute to fire handler
    var classMutationObserver = new MutationObserver(function(mutations) {
        mutations.forEach((mutation) => {
            if (mutation.attributeName === 'class') {
                each(this.bindings, (inBinding, inIndex) => {
                    if (inBinding instanceof Binding) {
                        inBinding.getValue().then((inValue) => {
                            inHandler.call(this, inValue);
                        });
                        return false;
                    }
                });
            }
        });
    });

    var config = {
        attributes: true
    };

    classMutationObserver.observe(this.element, config);

};
const _handleClassAttr = function _handleClassAttr(inValue) {
    const val = [];
    const promises = [];
    $(this.element).attr('class', '');
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
        $(this.element).addClass(val.join(' '));
    });

};

const _handleClassDashAttr = function _handleClassDashAttr(inValue) {

    const className = this.attrName.replace('class-', '');
    if (!!inValue) {
        $(this.element).addClass(className);
    } else {
        $(this.element).removeClass(className);
    }

};

class AttributeWiring extends Wiring {

    constructor(inElement, inAttrName, inBindings) {
        super(inElement);
        this.element = inElement;
        this.attrName = inAttrName;
        this.bindings = inBindings;

        if (/^class-/.test(this.attrName)) {
            if (this.bindings.length > 1) {
                throw new Error(this.attrName + ' binding expect a single truty/falsy binding.');
            }
        }
    }

    attach(inApp) {
        if (inApp) {
            this.app = inApp;
        } else if (!this.app) {
            throw new Error('AttributeWiring: cannot attach to undefined app');
        }

        const handler = (inValue) => {
            if (this.attrName === 'class') {
                _handleClassAttr.call(this, inValue);
            } else if (/^class-/.test(this.attrName)) {
                _handleClassDashAttr.call(this, inValue);
            } else {
                $(this.element).attr(this.attrName, inValue);
            }
        };

        if (/^class-/.test(this.attrName) && this.hasClassBinding) {
            _observeClassAttrMutation.call(this, handler);
        }

        each(this.bindings, (inBinding) => {
            if (inBinding instanceof Binding) {
                inBinding.attach(inApp, handler);
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

    static wire(inElement, inAllowedAttributes) {
        const wirings = [];
        let hasClassBinding = false;
        $.each(inElement.attributes, function(i, attrib) {
            if (!includes(inAllowedAttributes, get(attrib.name.match(/^(\w+)/), 1))) {
                return;
            }
            const val = Binding.parse(attrib.value, inElement);
            if (val !== attrib.value) {
                if (attrib.name === 'class') {
                    hasClassBinding = true;
                }
                wirings.push(new AttributeWiring(inElement, attrib.name, val));
                setTimeout(() => {
                    $(inElement).removeAttr(attrib.name);
                }, 1);
            }

        });
        each(wirings, (inWiring) => {
            inWiring.hasClassBinding = hasClassBinding;
        });
        return wirings;

    }
}

module.exports = AttributeWiring;