'use strict';

const Wiring = require('./Wiring');
import attachAction from '../delegate/action-trigger-delegate';
import $ from 'jquery';

class SignalWiring extends Wiring {

    constructor(inElement, inAttrName) {
        super();
        this.attributeName = inAttrName;
        this.element = inElement;
    }

    attach(inPage) {
        this.page = inPage;
        let eventName = this.attributeName.replace(/^signal-/, '');
        if(eventName === 'signal') {
            eventName = 'click';
        }
        attachAction.call(this.element, this.page, {
            name: $(this.element).attr(this.attributeName),
            trigger: eventName,
            target: 'self',
            params: (() => {
                const params = {};
                $($(this.element).get(0).attributes).each(function() {
                    if (/^param-/.test(this.name)) {
                        params[this.name.replace('param-', '')] = this.value;
                    }
                });
                return params;
            })()
        });

    }

    detach() {

    }
}

module.exports = SignalWiring;
