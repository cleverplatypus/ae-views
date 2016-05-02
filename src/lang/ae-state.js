'use strict';

import $ from 'jquery';
import Element from './ae-element';

export default function state(inPage) {
    const _page = inPage;
    var proto = Object.create(Element.prototype);

    proto.createdCallback = function() {
        const component = _page.resolveNodeComponent(this);
        const statePattern = new RegExp($(this).attr('pattern') || '^$');
        const watcher = (inState) => {
            if (statePattern.test(component.getCurrentState())) {
                if (!$(this).prop('wasRendered')) {
                    $(this).html(this.content);
                    $(this).prop('wasRendered', true);
                }
            } else {
                $(this).empty();
                $(this).prop('wasRendered', false);
            }
        }
        component.watchState(watcher);
        this.content = $(this).html();
        watcher(component.currentState);

    };

    proto.attachedCallback = function() {


    };

    proto.detachedCallback = function() {

    };

    document.registerElement('ae-state', { prototype: proto });
};
