'use strict';

import $ from 'jquery';


export default function action(inPage) {
    const _page = inPage;

    var proto = Object.create(HTMLElement.prototype);

    proto.createdCallback = function() {
    	$(this).prop('content', $(this).text());
    };

    proto.attachedCallback = function() {

    };

    proto.detachedCallback = function() {

    };

    document.registerElement('ae-template', { prototype: proto});
}
