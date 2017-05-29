'use strict';

const $ = require('jquery');
const each = require('lodash.foreach');

$.fn.extend({
    getPath: function () {
        var path, node = this;
        while (node.length) {
            var realNode = node[0], name = realNode.localName;
            if (!name) {
                break;
            }
            name = name.toLowerCase();

            var parent = node.parent();

            var sameTagSiblings = parent.children(name);
            if (sameTagSiblings.length > 1) { 
                let allSiblings = parent.children();
                let index = allSiblings.index(realNode) + 1;
                if (index > 1) {
                    name += ':nth-child(' + index + ')';
                }
            }

            path = name + (path ? '>' + path : '');
            node = parent;
        }

        return path;
    }
});

const aeManaged = require('./ae-managed');
const aeRendered = require('./ae-rendered');
const aeButton = require('./ae-button');
const aeEach = require('./ae-each');
const aeState = require('./ae-state');
const aeAction = require('./ae-action');
const aeBind = require('./ae-bind');
const aeRender = require('./ae-render');
const aeSwitch = require('./ae-switch');
const aeInput = require('./ae-input');
const aeCheckbox = require('./ae-checkbox');
const aeTemplate = require('./ae-template');
const aeSelect = require('./ae-select');
const aeLink = require('./ae-link');
const registerAeElement = require('./ae-element');

module.exports =  function(inPage) {
    each(['div', 'i', 'ul', 'li', 'a', 'nav', 'span', 'main', 'section', 'textarea'], (inElementName) => {
        registerAeElement(inPage, inElementName);
    });

    aeButton(inPage);
    aeCheckbox(inPage);
    aeManaged(inPage);
    aeEach(inPage);
    aeState(inPage);
    aeSelect(inPage);
    aeAction(inPage);
    aeBind(inPage);
    aeRender(inPage);
    aeTemplate(inPage);
    aeRendered(inPage);
    aeSwitch(inPage);
    aeInput(inPage);
    aeLink(inPage);
}

