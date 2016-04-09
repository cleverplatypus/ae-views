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

    const selectHandler = function selectHandler(inSelectedElement) {
        const _p = _private.get(this);
        const state = $(inSelectedElement).data('ae-switch-value');
        $(this).children().removeClass(_p.selectedClass);
        $(inSelectedElement).addClass(_p.selectedClass);
        if(_p.source === '_state') {
            _p.target.tryState(state);
        }
        console.log('switch element clicked: ' + $(inSelectedElement).data('ae-switch-value'));
    };
    
    var proto = Object.create(Element.prototype);
    proto.createdCallback = function() {
        _private.set(this, {
            selectedClass: $(this).attr('selected-class') || 'selected',
            source : $(this).attr('path') || '_state'
        });
    };
    
    proto.attachedCallback = function() {
        const that = this;
        const _p = _private.get(this);
        _p.target = _page.resolveNodeComponent(this);
        let defaultSwitch;
        $(this).children().each(function() {
            if($(this).data('ae-switch-value') === $(that).attr('default-value')) {
                defaultSwitch = $(this);
            }
            //TODO: register click handlers
            $(this).off('click', selectHandler).on('click', () => {
                selectHandler.call(that, this);
            });
            if(defaultSwitch) {
                selectHandler.call(that, defaultSwitch);
            }
       })
    };

    proto.detachedCallback = function() {

    };

    document.registerElement('ae-switch', { prototype: proto });
}
