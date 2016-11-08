'use strict';

const Wiring = require('./Wiring');
import attachAction from '../delegate/action-trigger-delegate';
import $ from 'jquery';

class SignalWiring extends Wiring {

    constructor(inElement) {
        super();
        this.element = inElement;
    }

    attach(inPage) {
        this.page = inPage;

        attachAction.call(this.element, this.page, {
            name: $(this.element).attr('signal'),
            trigger: 'click',
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
