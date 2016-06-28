import $ from 'jquery';
import Element from './ae-element';
import microtask from '../microtask';

export default function state(inPage) {
    'use strict';
    const _page = inPage;
    var proto = Object.create(Element.prototype);

    proto.createdCallback = function() {
        const component = _page.resolveNodeComponent(this);
        const method = $(this).attr('method') || 'removal';
        const statePattern = new RegExp($(this).attr('pattern') || '^$');
        const watcher = () => {
            $(this).prop('willRender', false);
            const currentState = component.getCurrentState();
            if (statePattern.test(currentState.getPath())) {
                if (method === 'visibility') {
                    $(this).children().each(function() {
                        $(this).removeClass('is-hidden');
                    });
                } else {
                    if (!$(this).prop('wasRendered')) {
                        $(this).html(this.content);
                        $(this).prop('wasRendered', true);
                    }
                }
                console.log('about to call .rendered on ' + currentState.getPath());
                currentState.rendered();
            } else {
                if (method === 'visibility') {
                    $(this).children().each(function() {
                        $(this).addClass('is-hidden');
                    });
                } else {
                    $(this).empty();
                    $(this).prop('wasRendered', false);
                }
            }
        };

        component.watchState(() => {
            if(!$(this).prop('willRender')) {
                $(this).prop('willRender', true);
                microtask(watcher);
            }
        });
        this.content = $(this).html();
        watcher();

    };

    proto.attachedCallback = function() {


    };

    proto.detachedCallback = function() {

    };

    document.registerElement('ae-state', { prototype: proto });
}
