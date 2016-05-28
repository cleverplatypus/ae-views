'use strict';

export default (function() {
    var proto = Object.create(window.HTMLElement.prototype);
    return document.registerElement('ae-element', { prototype: proto });
})();
