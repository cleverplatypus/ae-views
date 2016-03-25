'use strict';

import $ from 'jquery';
import Element from './ae-element';
import _ from 'lodash';

export default function action(inPage) {
    const _page = inPage;

    var proto = Object.create(Element.prototype);

    proto.createdCallback = function() {
        var target = $(this).parent();
        var actionName = $(this).attr('name');
        var node = $(this);

        while (!$(node).prop('component')) {
            node = $(node).parent();
        }
        $(target).click(() => {
            $(node).prop('component').bus.triggerAction(actionName);
        });


    };

    proto.attachedCallback = function() {

    };

    proto.detachedCallback = function() {

    };

    document.registerElement('ae-action', { prototype: proto });
};
