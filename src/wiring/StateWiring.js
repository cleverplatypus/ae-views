'use strict';

const Wiring = require('./Wiring');
import attachAction from '../delegate/action-trigger-delegate';
import $ from 'jquery';
import microtask from '../microtask';

class StateWiring extends Wiring {

    constructor(inElement) {
        super();
        this.element = inElement;
    }

    attach(inPage) {
        this.page = inPage;
        const component = inPage.resolveNodeComponent(this.element);
        const method = $(this.element).attr('method') || 'visibility';
        const statePattern = new RegExp($(this.element).attr('state-match') || '^$');
        const watcher = () => {
            $(this.element).prop('willRender', false);
            const currentState = component.getCurrentState();
            const matches =
                statePattern.test(currentState.getPath());

            if (matches) {
                if (method === 'visibility') {
                    $(this.element).removeClass('is-hidden');
                    $(this.element).children().each(function() {
                        $(this.element).removeClass('is-hidden');
                    });
                } else {
                    if (!$(this.element).prop('wasRendered')) {
                        $(this.element).removeClass('is-hidden');
                        $(this.element).html(this.content);
                        $(this.element).prop('wasRendered', true);
                    }
                }
                currentState.rendered();
            } else {
                if (method === 'visibility') {
                    $(this.element).addClass('is-hidden');
                    $(this.element).children().each(function() {
                        $(this.element).addClass('is-hidden');
                    });
                } else {
                    $(this.element).empty();
                    $(this.element).prop('wasRendered', false);
                }
            }
        };

        component.watchState(() => {
            if (!$(this.element).prop('willRender')) {
                $(this.element).prop('willRender', true);
                microtask(watcher);
            }
        });
        this.content = $(this.element).html();
        watcher();


    }

    detach() {

    }
}

module.exports = StateWiring;
