'use strict';

const $ = require('jquery');

const capitalize = require('lodash.capitalize');
const each = require('lodash.foreach');
const concat = require('lodash.concat');

import attachAction from '../delegate/action-trigger-delegate';
//const Binding = require('../Binding');
import ElementHTMLWiring from '../wiring/ElementHTMLWiring';
import ElementValueWiring from '../wiring/ElementValueWiring';
import TemplateWiring from '../wiring/TemplateWiring';
import SignalWiring from '../wiring/SignalWiring';
import StateWiring from '../wiring/StateWiring';
import AttributeWiring from '../wiring/AttributeWiring';

export default function aeElementDefinition(inApp, inElementName) {

    const _app = inApp;


    var proto = Object.create(document.createElement(inElementName).constructor.prototype);

    proto.createdCallback = function() {
        let wirings = [];
        $(this).prop('ae', {
            wirings: wirings
        });

        if ($(this).attr('state-match')) {
            wirings.push(new StateWiring(this));
        }

        if ($(this).attr('from')) {
            if ($(this).find('>template')) {
                wirings.push(wirings, new TemplateWiring(this));
            } else {
                wirings.push(wirings, new ElementHTMLWiring(this));
            }
        }
        if ($(this).attr('bind-html') || $(this).attr('to-html')) {
            wirings.push(new ElementHTMLWiring(this));
        }

        if ($(this).attr('bind-value') || $(this).attr('to-value')) {
            wirings.push(new ElementValueWiring(this));
        }

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
            wiring.attach(_app);
        });

    };

    proto.detachedCallback = function() {
        const ae = $(this).prop('ae');
        each(ae.wirings, (wiring) => {
            wiring.detach();
        });
    };


    document.registerElement('ae-' + inElementName, {
        prototype: proto,
        extends: inElementName
    });
}
