'use strict';

import $ from 'jquery';
import _ from 'lodash';
import ObservableObject from '../ObservableObject';

class InputValueChangeDelegate {

    constructor() {

    }

    canOutputValue(inElement) {
        return ((!!inElement) && (
            $(inElement).get(0) instanceof HTMLInputElement ||
            $(inElement).get(0) instanceof HTMLTextAreaElement ||
            $(inElement).get(0) instanceof HTMLSelectElement));
    }

    onValueChange(inElement, inConfig, inHandler) {
        const delay = !isNaN(inConfig.delay) ? Number(inConfig.delay) : null;
        const commitOnly = inConfig.commitOnly === true;
        var eventName = null;
        switch ($(inElement).get(0).nodeName.toUpperCase()) {
            case 'INPUT':
                if (_.includes(['TEXT', 'EMAIL', 'TEL', 'PASSWORD'], $(inElement).attr('type').toUpperCase())) {
                    eventName = (commitOnly ? 'change' : 'keyup');
                } else if (_.includes(['CHECKBOX', 'RADIO'], $(inElement).attr('type').toUpperCase())) {
                    eventName = 'click';
                }
                break;
            case 'SELECT':
                eventName = 'change';
                break;
            default:
                eventName = 'keydown';
        }
        let delayedTimeout;

        const defaultHandler = () => {
            inHandler({ value: this.getValue(inElement), key: $(inElement).attr('name') });
        };

        const timeoutHandler = () => {
            defaultHandler();
        };

        const delayedHandler = () => {
            if (delayedTimeout === undefined || !!delayedTimeout) {
                clearTimeout(delayedTimeout);
                delayedTimeout = setTimeout(timeoutHandler, delay);
            } else {
                delayedTimeout = null;
                timeoutHandler();
            }


        };



        const handler = (!isNaN(delay) ? delayedHandler : defaultHandler);
        inHandler.handler = handler; //??? why this assignment?
        $(inElement).off(eventName, inHandler.handler).on(eventName, handler);
    }

    setValue(inElement, inValue, inValueMode) {
        inElement = $(inElement);
        if (!$(inElement).get(0)) {
            return;
        }
        const name = inElement.attr('name');
        if ($(inElement).get(0).nodeName.toUpperCase() === 'INPUT') {
            switch ($(inElement).attr('type').toLowerCase()) {
                case 'text':
                case 'email':
                case 'tel':
                case 'password':
                    $(inElement).val(inValue);
                    break;
                case 'checkbox':
                    {
                        switch (inValueMode) {
                            case 'property':
                                $(inElement).prop('checked', inValue === (inElement.attr('value') || true));
                                break;
                            case 'collection':
                                throw new Error('collection value-mode is not yet implemented');
                            case 'hash':
                                if (!name) {
                                    throw new Error('Checkbox "hash" value binding requires a name attribute');
                                }
                                /*
                                	checked state is true if the passed value is an ObservableObject
                                	containing a property named after the checkbox name attribute
                                	that's either set to the checkbox value attribute, if present or
                                	boolean true
                                */
                                const propValue = ObservableObject.prop(inValue, name);
                                const rawValue = inElement.attr('value');
                                const elementValue = !!rawValue &&  /^true|false$/.test(rawValue) ? 
                                	Boolean(rawValue) : rawValue;

                                $(inElement).prop(
                                	'checked', 
                                	!!propValue && propValue === elementValue);
                                break;
                            default:
                                throw new Error('Value model can only be any of undefined, property, collection, hash');
                        }

                    }
                    break;
                case 'radio':
                    $(inElement).prop('checked', inValue === inElement.attr('value'));
            }

        } else if ($(inElement).get(0).nodeName.toUpperCase() === 'SELECT') {
            $(inElement).find('option[value=' + inValue + ']').each(function() {
                $(this).prop('checked', inValue === inElement.attr('value'));
            });
        }

    }

    getValue(inElement) {
        if (!$(inElement).get(0)) {
            return;
        }
        if ($(inElement).get(0).nodeName.toUpperCase() === 'INPUT') {
            switch ($(inElement).attr('type').toLowerCase()) {
                case 'text':
                case 'email':
                case 'tel':
                case 'password':
                    return $(inElement).val();
                case 'checkbox':
                    if ($(inElement).prop('checked')) {
                        return { key: $(inElement).attr('name'), value: $(inElement).val() };
                    }
                    return;
                case 'radio': //jshint ignore:line
                    {
                        const form = $(inElement).closest('form').get(0);
                        if (!form) {
                            throw new Error('Input elements must be enclosed in a form');
                        }
                        var selected = $(form).find(`radio[name=${$(inElement).attr('name')}]:checked`).get(0);
                        if (!selected) {
                            return;
                        } else {
                            return $(selected).val();
                        }

                    }
                    break;
            }

        } else if ($(inElement).get(0).nodeName.toUpperCase() === 'SELECT') {
            let out = [];
            $(inElement).find('option:selected').each(function() {
                out.push($(this).text());
            });
            return out;
        }
    }

}

export default new InputValueChangeDelegate();
