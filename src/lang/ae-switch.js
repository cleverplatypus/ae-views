'use strict';

import $ from 'jquery';
import Element from './ae-element';
import _ from 'lodash';

export default function switch(inPage) {
    const _page = inPage;
    const _private = new WeakMap();


    var proto = Object.create(Element.prototype);
    proto.createdCallback = function() {
        _private.set(this, {
            selectedClass: $(this).attr('selected-class') || 'selected';
        });
    };
    
    proto.attachedCallback = function() {
       $(this).children().forEach(function() {
            //TODO: register click handlers
       })
    };

    proto.detachedCallback = function() {

    };

    document.registerElement('ae-switch', { prototype: proto });
}
