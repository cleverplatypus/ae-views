'use strict';

import $ from 'jquery';
import Element from './ae-element';

/**
*   A container for element that change the value of a property based on 
*   selection of its children. It behaves like a radio group.
*   if no path attribute is found, the switch targets the component's state
*/
export default function aeSwitch(inPage) {
    const _page = inPage;
    const _private = new WeakMap();

    const selectHandler = function selectHandler(inSelectedElement) {
        const _p = _private.get(this);
        const val = $(inSelectedElement).data('ae-switch-value');
        $(this).children().removeClass(_p.selectedClass);
        $(inSelectedElement).addClass(_p.selectedClass);
        if(!_p.source) {
            _p.target.tryState(val);
        } else {
            _page.resolveNodeComponent(this);
            _page.getDataSource().setPath(this, _p.source, val);

        }
        //console.log('switch element clicked: ' + $(inSelectedElement).data('ae-switch-value'));
    };
    
    var proto = Object.create(HTMLUListElement.prototype);
    proto.createdCallback = function() {
        _private.set(this, {
            selectedClass: $(this).attr('selected-class') || 'selected',
            source : $(this).attr('path') || null
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
            $(this).off('click', selectHandler).on('click', () => {
                selectHandler.call(that, this);
            });
            if(defaultSwitch) {
                selectHandler.call(that, defaultSwitch);
            }
       });
    };

    proto.detachedCallback = function() {

    };

    document.registerElement('ae-switch', { prototype: proto, extends : 'ul' });
}
