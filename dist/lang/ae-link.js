'use strict';


const $ = require('jquery');

const attachAction = require('../delegate/action-trigger-delegate');
const get = require('lodash.get');

let _page;


export default function link(inPage) {

    _page = inPage;

    var proto = Object.create(HTMLAnchorElement.prototype);

    proto.createdCallback = function() {
        $(this).prop('onclick', () =>{});
        $(this).click((e) => {
            if (!/googlebot/.test((get(window, 'navigator.userAgent') || '').toLowerCase())) {
                e.preventDefault();
            }
        });
    };

    proto.attachedCallback = function() {
        attachAction.call(this, _page, {
            name: $(this).attr('action'),
            trigger: $(this).attr('trigger'),
            target: 'self',
            params: (() => {
                const params = {};
                $($(this).get(0).attributes).each(function() {
                    if (/^param-/.test(this.name)) {
                        if(/^param-.*-json$/.test(this.name)) {
                            params[this.name.replace('param-', '').replace(/-json$/, '')] = JSON.parse(this.value);
                        } else {
                            params[this.name.replace('param-', '')] = this.value;    
                        }
                        
                    }
                });
                return params;
            })()
        });
    };

    proto.detachedCallback = function() {

    };

    document.registerElement('ae-link', { prototype: proto, extends: 'a' });
}
