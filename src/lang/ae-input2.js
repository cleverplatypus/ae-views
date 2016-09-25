'use strict';

import $ from 'jquery';
import Element from './ae-element';
import keycode from 'keycode';
import attachAction from '../delegate/action-trigger-delegate';
import valueChangeDelegate from '../delegate/value-change-delegate';
import each from 'lodash.foreach';

export default function aeButton(inPage) {
    const _page = inPage;
    let observer;

    var proto = Object.create(HTMLInputElement.prototype);

    proto.createdCallback = function() {

        const source = $(this).attr('source');

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


        let target = this;

        let dataSourceName = $(this).attr('source');
        const path = $(this).attr('path');
        let dataSource = _page.getDataSource(dataSourceName);
        if (!dataSource) {
            throw new Error('Cannot bind to data-source: ' + dataSourceName);
        }
        const usePath = path && !$(this).attr('from') && !$(this).attr('to');
        const toAttr = usePath ? path : $(this).attr('to');
        const fromAttr = usePath ? path : $(this).attr('from');
        let inAttr = $(this).attr('in') || '';



        if (fromAttr) {

            const valueResolver = (inValue) => {
                valueChangeDelegate.setValue(target, inValue);
            };

            dataSource.bindPath(this, fromAttr, function(inNewValue, inOldValue) {
                if (inNewValue !== inOldValue) {
                    valueResolver(inNewValue);
                }
            });

            dataSource.resolve(this, fromAttr).then((inValue) => {
                valueResolver(inValue);
            });
        }

        if (toAttr) {
            const outOptions = {};
            each(this.attributes, (inAttribute) => {
                if (/^out-/.test(inAttribute.name)) {
                    outOptions[inAttribute.name.replace(/^out-/, '')] = inAttribute.value;
                }
            });
            valueChangeDelegate.onValueChange(target, outOptions, (inValue) => {
                dataSource.setPath(this, toAttr, inValue.value == null ? null : inValue.value);
            });
        }

        if ($(this).attr('action')) {
            attachAction.call(this, _page, {
                name: $(this).attr('action')

            });
        }

    };

    proto.attachedCallback = function() {


    };

    proto.detachedCallback = function() {

    };

    document.registerElement('ae-input2', {
        prototype: proto,
        extends: 'input'
    });
}
