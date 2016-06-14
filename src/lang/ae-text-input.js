import $ from 'jquery';
import Element from './ae-element';
import _ from 'lodash';
import uuid from 'node-uuid';

export default function aeTextInput(inPage) {
    'use strict';
    const _page = inPage;
    let observer;
    document.styleSheets[0].insertRule('ae-text-input' + '{ display: block;}', 1);
    var proto = Object.create(Element.prototype);
    proto.createdCallback = function() {

        observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                switch (mutation.attributeName) {
                    case 'label':
                        $(mutation.target).find('label>span').text($(mutation.target).attr('label'));
                        break;
                    case 'value':
                        $(mutation.target).find('input').attr('value', $(mutation.target).attr('value'));
                        break;
                    case 'label-class':
                        $(mutation.target).find('label').attr('class', $(mutation.target).attr('label-class'));
                        break;
                    case 'input-class':
                        $(mutation.target).find('input').attr('class', $(mutation.target).attr('input-class'));
                        break;
                }
            });
        });

        // configuration of the observer:
        const config = { attributes: true };
        // pass in the target node, as well as the observer options
        observer.observe(this, config);
        const inputType = $(this).attr('type') || 'text';
        let bindingAttrName;
        _.each($(this.attributes), (inAttribute) => {
            if (['from', 'to', 'path'].indexOf(inAttribute.name) !== -1) {
                bindingAttrName = inAttribute.name;
            }
        });
        const bindingNode = bindingAttrName ? `<ae-bind target="next" ${bindingAttrName}="${$(this).attr(bindingAttrName)}"></ae-bind>` : '';
        const labelText = $(this).attr('label');
        const autocomplete = $(this).attr('autocomplete') ? 
            ' autocomplete="' + $(this).attr('autocomplete') + '"' : 
            '';
        const placeholder = $(this).attr('placeholder') || '';
        const inputClass = $(this).attr('input-class') || '';
        const inputName = $(this).attr('name') || 'ae-' + uuid.v4();
        const valueAttr = $(this).attr('value') ? `value="${$(this).attr('value')}` : '';
        const input = `<input name="${inputName}" type="${inputType}" ${autocomplete} class="${inputClass}" placeholder="${placeholder}" ${valueAttr}>`;
        const label = labelText ? `<label for="${inputName}" class="${$(this).attr('label-class') || ''}">${labelText}</label>` : '';

        $(this).append(`${label}${bindingNode}${input}`);
    };

    proto.attachedCallback = function() {

    };

    proto.detachedCallback = function() {
        observer.disconnect();
    };

    document.registerElement('ae-text-input', { prototype: proto });
}
