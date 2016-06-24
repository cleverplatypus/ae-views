import $ from 'jquery';
import Element from './ae-element';
import { each } from 'lodash';
import uuid from 'node-uuid';
import attachAction from '../delegate/action-trigger-delegate';

export default function aeTextInput(inPage) {
    'use strict';
    const _page = inPage;
    let observer;
    document.styleSheets[0].insertRule('ae-input' + '{ display: block;}', 1);
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

        if ($(this).attr('bind-enabled')) {
            const path = $(this).attr('bind-enabled').replace('!', '');
            const negate = /^!/.test($(this).attr('bind-enabled'));
            const source = $(this).attr('source');
            const setValue = (inValue) => {
                $(this).find('input').prop('disabled',
                    ((inValue === false) && !negate) ||
                    ((inValue !== false) && negate));
            };

            _page
                .getDataSource(source)
                .bindPath(this, path, (inNewValue) => {
                    setValue(inNewValue);
                });
            _page
                .getDataSource(source)
                .resolve(this, path)
                .then((inValue) => {
                    setValue(inValue);
                });
        }


        // configuration of the observer:
        const config = { attributes: true };
        // pass in the target node, as well as the observer options
        observer.observe(this, config);
        const inputType = $(this).attr('type') || 'text';
        if (/^(checkbox|radio)$/.test(inputType.toLowerCase())) {
            const actionName = $(this).attr('action');
            if (actionName) {
                attachAction.call(this, _page, {
                    name: actionName,
                    trigger: 'click',
                    target: 'self'
                });

            }
        }
        let bindingAttrName;
        each($(this.attributes), (inAttribute) => {
            if (['from', 'to', 'path'].indexOf(inAttribute.name) !== -1) {
                bindingAttrName = inAttribute.name;
            }
        });
        let bindingNode = '';
        if (bindingAttrName) {
            const delayAttr = $(this).attr('out-delay') ? `out-delay="${$(this).attr('out-delay')}"` : '';
            bindingNode = bindingAttrName ? `<ae-bind ${delayAttr} target="next" ${bindingAttrName}="${$(this).attr(bindingAttrName)}"></ae-bind>` : '';
        }
        const labelPlacement = $(this).attr('label-placement') || 'left';
        const labelText = $(this).attr('label');
        const autocomplete = $(this).attr('autocomplete') ?
            ' autocomplete="' + $(this).attr('autocomplete') + '"' :
            '';
        const placeholder = $(this).attr('placeholder') || '';
        const inputClass = $(this).attr('input-class') || '';
        const disabled = !($(this).attr('enabled') !== 'false' && true) ? 'disabled' : '';
        const inputName = $(this).attr('name') || 'ae-' + uuid.v4();
        const valueAttr = $(this).attr('value') ? `value="${$(this).attr('value')}` : '';
        const input = `<input name="${inputName}" ${disabled} type="${inputType}" ${autocomplete} class="${inputClass}" placeholder="${placeholder}" ${valueAttr}>`;
        const label = labelText ? `<label for="${inputName}" class="${$(this).attr('label-class') || ''}">${labelText}</label>` : '';

        $(this).append(`${labelPlacement === 'left'? label : ''}${bindingNode}${input}${labelPlacement === 'right'? label : ''}`);
    };

    proto.attachedCallback = function() {

    };

    proto.detachedCallback = function() {
        observer.disconnect();
    };

    document.registerElement('ae-input', { prototype: proto });
}
