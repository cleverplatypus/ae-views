'use strict';

import $ from 'jquery';
import Element from './ae-element';
import {isFunction} from 'lodash';

export default function checkbox(inPage) {
    const _page = inPage;
    let observer;
    var proto = Object.create(Element.prototype);
    proto.createdCallback = function() {
        observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                switch (mutation.attributeName) {
                    case 'label':
                        $(mutation.target).find('label>span').text($(mutation.target).attr('label'));
                        break;
                    case 'label-class':
                        $(mutation.target).find('label').attr('class', $(mutation.target).attr('label-class'));
                        break;
                    case 'value':
                        $(mutation.target).find('input').attr('value', $(mutation.target).attr('value'));
                        break;
                    case 'input-class':
                        $(mutation.target).find('input').attr('class', $(mutation.target).attr('input-class'));
                        break;
                }
            });
        });

        // configuration of the observer:
        var config = { attributes: true };

        // pass in the target node, as well as the observer options
        observer.observe(this, config);

        // later, you can stop observing
        let input = `<input type="checkbox" class="${$(this).attr('input-class') || ''}" value="${$(this).attr('value') || ''}">`;
        let out =
            `<label class="${$(this).attr('label-class') || ''}">${input}<span>${$(this).attr('label') || ''}</span></label>`;
        $(this).append(out);
    };
    proto.valueChangedHook = function(inHandler) {
        const handler = function() {
            inHandler($(this).find('input').attr('value'));
        };
        if (isFunction(inHandler)) {
            $(this).find('input').off('click', handler).on('click', handler);
        }

    };

    proto.attachedCallback = function() {

    };

    proto.detachedCallback = function() {
        observer.disconnect();
    };

    document.registerElement('ae-checkbox', { prototype: proto });
};
