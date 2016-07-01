'use strict';

import $ from 'jquery';
import Element from './ae-element';
import attachAction from '../delegate/action-trigger-delegate';

export default function aeButton(inPage) {
    const _page = inPage;
    let observer;

    var proto = Object.create(HTMLButtonElement.prototype);
    proto.createdCallback = function() {
        console.log('created ae-button');
        observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                switch (mutation.attributeName) {
                    case 'label':
                        $(mutation.target).text($(mutation.target).attr('label'));
                        break;
                }
            });
        });
        // configuration of the observer:
        var config = { attributes: true };

        // pass in the target node, as well as the observer options
        observer.observe(this, config);


        if ($(this).attr('bind-label')) {
            const path = $(this).attr('bind-label');
            const source = $(this).attr('source');

            _page
                .getDataSource(source)
                .bindPath(this, path, (inNewValue) => {
                    $(this).text(inNewValue);
                });
            _page
                .getDataSource(source)
                .resolve(this, path)
                .then((inValue) => {
                    $(this).text(inValue);
                });
        }

        if ($(this).attr('bind-enabled')) {
            let path = $(this).attr('bind-enabled');
            let strictBoolean = false;
            if(/!$/.test(path)) {
                path = path.replace(/!$/, '');
                strictBoolean = true;
            }
            const source = $(this).attr('source');
            const setValue = (inValue) => {
                $(this).prop('disabled', strictBoolean ? inValue !== true : !inValue);
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

        if ($(this).attr('action')) {
            attachAction.call(this, _page, {
                name: $(this).attr('action'),
                trigger: 'click',
                target: 'self',
                params: (() => {
                    const params = {};
                    $($(this).get(0).attributes).each(function() {
                        if (/^param-/.test(this.name)) {
                            params[this.name.replace('param-', '')] = this.value;
                        }
                    });
                    return params;
                })()
            });
        }



    };

    proto.attachedCallback = function() {
        if ($(this).attr('label')) {
            $(this).html($(this).attr('label'));
        }

    };

    proto.detachedCallback = function() {
        observer.disconnect();
    };

    document.registerElement('ae-button', { prototype: proto, extends : 'button'});
}
