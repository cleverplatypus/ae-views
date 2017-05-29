'use strict';

const $ = require('jquery');


module.exports =  function action(inPage) {
    const _page = inPage;

    var proto = Object.create(HTMLElement.prototype);

    proto.createdCallback = function() {

    };

    proto.attachedCallback = function() {

    };

    proto.detachedCallback = function() {

    };

    document.registerElement('ae-managed', { prototype: proto });
}
