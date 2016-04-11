'use strict';

import $ from 'jquery';
import Element from './ae-element';
import _ from 'lodash';

export default function action(inPage) {
    const _page = inPage;

    var proto = Object.create(Element.prototype);

    proto.createdCallback = function() {
        const target = $(this).parent();
        const actionName = $(this).attr('name');
        const component = _page.resolveNodeComponent(target);
        $(target).click(() => {
            component.bus.triggerAction(actionName);
        });


    };

    proto.attachedCallback = function() {

    };

    proto.detachedCallback = function() {

    };

    document.registerElement('ae-action', { prototype: proto });
};
