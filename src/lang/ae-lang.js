'use strict';

import $ from 'jquery';
import each from 'lodash.foreach';

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

import aeManaged from './ae-managed';
import aeButton from './ae-button';
import aeEach from './ae-each';
import aeState from './ae-state';
import aeAction from './ae-action';
import aeBind from './ae-bind';
import aeRender from './ae-render';
import aeSwitch from './ae-switch';
import aeTextInput from './ae-input';
import aeInput from './ae-input2';
import aeLink from './ae-link';
import registerAeElement from './ae-element';

export default function(inPage) {
    
    each(['div', 'ul', 'li', 'a', 'nav', 'span', 'main', 'section'], (inElementName) => {
        registerAeElement(inPage, inElementName);
    });

    aeButton(inPage);
    aeManaged(inPage);
    aeEach(inPage);
    aeState(inPage);
    aeAction(inPage);
    aeBind(inPage);
    aeRender(inPage);
    aeSwitch(inPage);
    aeTextInput(inPage);
    aeInput(inPage);
    aeLink(inPage);
}

