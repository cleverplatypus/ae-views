'use strict';

const $ = require('jquery');

const keycode = require('keycode');
const attachAction = require('../delegate/action-trigger-delegate');
const valueChangeDelegate = require('../delegate/value-change-delegate');
const each = require('lodash.foreach');
const SignalWiring = require('../wiring/SignalWiring');
const PropertyWiring = require('../wiring/PropertyWiring');
const AttributeWiring = require('../wiring/AttributeWiring');
const ElementValueWiring = require('../wiring/ElementValueWiring');

module.exports =  function aeButton(inPage) {
    const _page = inPage;
    let observer;

    var proto = Object.create(HTMLTextAreaElement.prototype);

    proto.createdCallback = function() {

        let wirings = [];
        $(this).prop('ae', {
            wirings: wirings
        });

        const source = $(this).attr('source');

        {
            let restrict;
            if ((restrict = $(this).attr('restrict'))) {
                if (/^\[/.test(restrict)) {
                    const re = new RegExp(restrict);
                    $(this).keydown((inEvent) => {
                        switch (inEvent.keyCode) {
                            case keycode('enter'):
                            case keycode('left'):
                            case keycode('up'):
                            case keycode('right'):
                            case keycode('down'):
                            case keycode('del'):
                            case keycode('ins'):
                            case keycode('tab'):
                            case keycode('backspace'):
                                return;

                            default:
                                const char = keycode(inEvent);
                                if (!re.test(char)) {
                                    inEvent.preventDefault();
                                }
                        }

                    });
                }
            }
        }

        if ($(this).attr('bind-value') || $(this).attr('to-value')) {
            wirings.push(new ElementValueWiring(this));
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



    document.registerElement('ae-textarea', {
        prototype: proto,
        extends: 'textarea'
    });
}
