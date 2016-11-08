'use strict';

import $ from 'jquery';

import attachAction from '../delegate/action-trigger-delegate';
const ElementHTMLWiring = require('../wiring/ElementHTMLWiring');
import each from 'lodash.foreach';

export default function aeButton(inPage) {
    const _page = inPage;

    var proto = Object.create(HTMLButtonElement.prototype);
    proto.createdCallback = function() {
        let wirings = [];
        $(this).prop('ae', {
            wirings: wirings
        });

        if ($(this).attr('bind-html')) {
            wirings.push(new ElementHTMLWiring(this));
        }

        wirings.push.apply(wirings);

        $(this).prop('type', 'button');


        if ($(this).attr('bind-enabled')) {
            let path = $(this).attr('bind-enabled');
            let strictBoolean = false;
            if (/!$/.test(path)) {
                path = path.replace(/!$/, '');
                strictBoolean = true;
            }
            const source = $(this).attr('source');
            const setValue = (inValue) => {
                $(this).prop('disabled', strictBoolean ? inValue !== true : !inValue);
            };

            _page
                .getDataSource(source)
                .bindPath(this, path, (inNewValue) => {
                    setValue(inNewValue);
                });
            _page
                .getDataSource(source)
                .resolve(this, path)
                .then((inValue) => {
                    setValue(inValue);
                });
        }

        if ($(this).attr('action')) {
            attachAction.call(this, _page, {
                name: $(this).attr('action'),
                trigger: 'click',
                target: 'self',
                params: (() => {
                    const params = {};
                    $($(this).get(0).attributes).each(function() {
                        if (/^param-/.test(this.name)) {
                            params[this.name.replace('param-', '')] = this.value;
                        }
                    });
                    return params;
                })()
            });
        }



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

    document.registerElement('ae-button', {
        prototype: proto,
        extends: 'button'
    });
}
