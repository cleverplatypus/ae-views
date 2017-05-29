'use strict';

const $ = require('jquery');

const attachAction = require('../delegate/action-trigger-delegate');
const ElementHTMLWiring = require('../wiring/ElementHTMLWiring');
const PropertyWiring = require('../wiring/PropertyWiring');
const StateWiring = require('../wiring/StateWiring');
const AttributeWiring = require('../wiring/AttributeWiring');
const each = require('lodash.foreach');

module.exports =  function aeButton(inPage) {
    const _page = inPage;

    var proto = Object.create(HTMLButtonElement.prototype);
    proto.createdCallback = function() {
        let wirings = [];
        $(this).prop('ae', {
            wirings: wirings
        });

        if ($(this).attr('state-match')) {
            wirings.push(new StateWiring(this));
        }

        if ($(this).attr('bind-html')) {
            wirings.push(new ElementHTMLWiring(this));
        }
        wirings.push.apply(wirings, PropertyWiring.wire(this));


        wirings.push.apply(wirings);
        wirings.push.apply(wirings, AttributeWiring.wire(this, ['class', 'id', 'name', 'param', 'data', 'style']));

        $(this).prop('type', 'button');

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
