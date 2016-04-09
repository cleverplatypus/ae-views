'use strict';

import $ from 'jquery';
import Element from './ae-element';
import _ from 'lodash';

/**
*   A container for element that change the value of a property based on 
*   selection of its children. It behaves like a radio group.
*/
export default function aeSwitch(inPage) {
    const _page = inPage;
    const _private = new WeakMap();

    const selectHandler = function selectHandler() {
        console.log('switch element clicked');
    };
    


    var proto = Object.create(Element.prototype);
    proto.createdCallback = function() {
        _private.set(this, {
            selectedClass: $(this).attr('selected-class') || 'selected';
        });
    };
    
    proto.attachedCallback = function() {
        const that = this;
       $(this).children().forEach(function() {
            //TODO: register click handlers
            $(this).off('click', selectHandler).on('click', () => {
                selectHandler.call(that, this);
            });
       })
    };

    proto.detachedCallback = function() {

    };

    document.registerElement('ae-switch', { prototype: proto });
}
