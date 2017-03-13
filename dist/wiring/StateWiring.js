'use strict';

import Wiring from './Wiring';
import Component from '../Component';
import {Signal} from 'signals';

import attachAction from '../delegate/action-trigger-delegate';
import $ from 'jquery';
import microtask from '../microtask';

class StateWiring extends Wiring {

    constructor(inElement) {
        super();
        this.element = inElement;
        this._enterSignal = new Signal();
        this._exitSignal = new Signal();

    }


    attach(inPage) {
        if (!$(this.element).attr('state-match')) {
            return;
        }
        this.page = inPage;
        const component = inPage.resolveNodeComponent(this.element);
        let statefulComponent;
        let isComponent = false;
        if (component.element === this.element) {
            isComponent = true;
            statefulComponent = inPage.resolveNodeComponent($(this.element).parent());
        } else {
            statefulComponent = component;
        }
        const method = $(this.element).attr('state-method') || 'visibility';
        const statePattern = new RegExp($(this.element).attr('state-match') || '^$');
        $(this.element).removeAttr('state-match');
        $(this.element).removeAttr('state-method');
        const watcher = () => {
            $(this.element).prop('willRender', false);
            const currentState = statefulComponent.getCurrentState();
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
                if (isComponent) {
                    component.active = true;
                }

                currentState.rendered();
                this._enterSignal.dispatch();
            } else {
                if (method === 'visibility') {
                    $(this.element).addClass('is-hidden');
                    $(this.element).children().each(function() {
                        $(this.element).addClass('is-hidden');
                    });
                } else {
                    $(this.element).addClass('is-hidden');
                    $(this.element).empty();
                    $(this.element).prop('wasRendered', false);
                }
                if (isComponent) {
                    component.active = false;
                }
                this._exitSignal.dispatch();
            }
        };

        statefulComponent.watchState(() => {
            if (!$(this.element).prop('willRender')) {
                $(this.element).prop('willRender', true);
                microtask(watcher);
            }
        });
        this.content = $(this.element).html();
        watcher();


    }

    detach() {
        if (!$(this.element).attr('state-match')) {
            return;
        }

    }

    get onEnter() {
        return this._enterSignal;
    }

    get onExit() {
        return this._exitSignal;
    }
}

export default StateWiring;
