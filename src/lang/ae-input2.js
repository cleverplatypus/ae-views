'use strict';

import $ from 'jquery';

import keycode from 'keycode';
import attachAction from '../delegate/action-trigger-delegate';
import valueChangeDelegate from '../delegate/value-change-delegate';
import each from 'lodash.foreach';
import SignalWiring from '../wiring/SignalWiring';

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

        if ($(this).attr('bind-enabled')) {
            const path = $(this).attr('bind-enabled').replace('!', '');
            const negate = /^!/.test($(this).attr('bind-enabled'));
            const source = $(this).attr('source');
            const setValue = (inValue) => {
                $(this).prop('disabled',
                    ((inValue === false) && !negate) ||
                    ((inValue !== false) && negate));
            };
            let watchPath = path.split('.');
            watchPath[watchPath.length - 1] = '[' + watchPath[watchPath.length - 1] + ']';
            watchPath = watchPath.join('.');
            _page
                .getDataSource(source)
                .bindPath(this, watchPath, (inNewValue) => {
                    setValue(inNewValue);
                });
            _page
                .getDataSource(source)
                .resolve(this, path)
                .then((inValue) => {
                    setValue(inValue);
                });
        }

        const pathAppend = $(this).attr('path-append');


        if (fromAttr) {

            const valueResolver = (inValue) => {
                valueChangeDelegate.setValue(target, inValue);
            };
            let watchPath = fromAttr.split('.');
            if (pathAppend) {
                watchPath = watchPath.concat(pathAppend.split('.'));
            }
            watchPath[watchPath.length - 1] = '[' + watchPath[watchPath.length - 1] + ']';
            watchPath = watchPath.join('.');
            dataSource.bindPath(this, watchPath, function(inNewValue, inOldValue) {
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
                let fullPath = toAttr.split('.');
                if (pathAppend) {
                    fullPath = fullPath.concat(pathAppend.split('.'));
                }
                dataSource.setPath(this, fullPath.join('.'), inValue.value == null ? null : inValue.value);
            });
        }

        if ($(this).attr('action')) {
            attachAction.call(this, _page, {
                name: $(this).attr('action')

            });
        }

        const wirings = [];
        $(this).prop('ae', {
            wirings: wirings
        });
        $.each(this.attributes, (i, attrib) => {
            if (/^signal/.test(attrib.name)) {
                wirings.push(new SignalWiring(this, attrib.name));
            }
        });

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



    document.registerElement('ae-input2', {
        prototype: proto,
        extends: 'input'
    });
}
