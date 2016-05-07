import $ from 'jquery';
import Element from './ae-element';

export default function state(inPage) {
    'use strict';
    const _page = inPage;
    var proto = Object.create(Element.prototype);

    proto.createdCallback = function() {
        const component = _page.resolveNodeComponent(this);
        const method = $(this).attr('method') || 'removal';
        const statePattern = new RegExp($(this).attr('pattern') || '^$');
        const watcher = (inState) => {
            if (statePattern.test(component.getCurrentState())) {
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
                component.getCurrentState(true).rendered();
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

        component.watchState(watcher);
        this.content = $(this).html();
        watcher(component.currentState);

    };

    proto.attachedCallback = function() {


    };

    proto.detachedCallback = function() {

    };

    document.registerElement('ae-state', { prototype: proto });
}
