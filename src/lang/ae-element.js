'use strict';

export default (function() {
    var proto = Object.create(HTMLElement.prototype);
    return document.registerElement('ae-element', { prototype: proto });
})();
