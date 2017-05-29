'use strict';

const $ = require('jquery');
const each = require('lodash.foreach');
const includes = require('lodash.includes');
const ObservableObject = require('../ObservableObject');

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
        let events = inConfig.event;
        if (!events) {

            switch ($(inElement).get(0).nodeName.toUpperCase()) {
                case 'INPUT':
                    {
                        const type = ($(inElement).attr('type') || 'TEXT').toUpperCase();
                        if (includes(['TEXT', 'EMAIL', 'TEL', 'PASSWORD'], type)) {
                            events = 'change,keyup';
                        } else if (includes(['CHECKBOX', 'RADIO'], type)) {
                            events = 'click';
                        }
                    }
                    break;
                case 'SELECT':
                    events = 'change';
                    break;
                default:
                    events = 'keydown';
            }
        }
        let delayedTimeout;

        const defaultHandler = () => {
            inHandler({
                value: this.getValue(inElement),
                key: $(inElement).attr('name')
            });
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

        each(events.split(','), (eventName) => {
            $(inElement).off(eventName, handler).on(eventName, handler);
        });
    }

    setValue(inElement, inValue, inPropName) {
        inElement = $(inElement);
        if (!$(inElement).get(0)) {
            return;
        }
        const name = inElement.attr('name');
        if ($(inElement).get(0).nodeName.toUpperCase() === 'INPUT') {
            const type = ($(inElement).attr('type') || 'TEXT').toUpperCase();
            switch (type) {
                case 'TEXT':
                case 'EMAIL':
                case 'TEL':
                case 'PASSWORD':
                    if ($(inElement).val() !== inValue) {
                        $(inElement).val(inValue);
                    }
                    break;
                case 'CHECKBOX':
                    $(inElement).prop('checked', inValue === true ||
                        (!!inValue && inValue === inElement.attr('value')));
                    break;
                case 'RADIO':
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
        const targetValue = $(inElement).attr('value');
        if ($(inElement).get(0).nodeName.toUpperCase() === 'INPUT') {
            const type = ($(inElement).attr('type') || 'TEXT').toUpperCase();

            switch (type) {
                case 'TEXT':
                case 'EMAIL':
                case 'TEL':
                case 'PASSWORD':
                    return $(inElement).val();
                case 'CHECKBOX':
                    if ($(inElement).prop('checked')) {
                        return !!targetValue ? targetValue : $(inElement).prop('checked') === true;
                    }
                    return !!targetValue ? null : false;
                case 'RADIO': //jshint ignore:line
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
        } else if ($(inElement).get(0).nodeName.toUpperCase() === 'TEXTAREA') {
            return $(inElement).val();
        } else if ($(inElement).get(0).nodeName.toUpperCase() === 'SELECT') {
            let out = [];
            $(inElement).find('option:selected').each(function() {
                out.push($(this).val());
            });
            if (!$(inElement).prop('multiple')) {
                return out[0];
            }
            return out;
        }
    }

}

module.exports =  new InputValueChangeDelegate();
