'use strict';

import $ from 'jquery';

import keycode from 'keycode';
import attachAction from '../delegate/action-trigger-delegate';
import valueChangeDelegate from '../delegate/value-change-delegate';
import each from 'lodash.foreach';
import SignalWiring from '../wiring/SignalWiring';
import PropertyWiring from '../wiring/PropertyWiring';
import AttributeWiring from '../wiring/AttributeWiring';
import ElementValueWiring from '../wiring/ElementValueWiring';

export default function aeButton(inPage) {
    const _page = inPage;
    let observer;

    var proto = Object.create(HTMLInputElement.prototype);

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
            wirings.push(new ElementValueWiring(this, (inNewVal) => {
                if (inNewVal === undefined) {
                    if ($(this).prop('type') === 'checkbox') {
                        return $(this).prop('checked');
                    }
                    return $(this).val();
                } else {
                    if ($(this).prop('type') === 'checkbox') {
                        $(this).prop('checked', inNewVal !== false);
                    } else {
                        $(this).val(inNewVal);
                    }
                }
            }));
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



    document.registerElement('ae-input', {
        prototype: proto,
        extends: 'input'
    });
}
