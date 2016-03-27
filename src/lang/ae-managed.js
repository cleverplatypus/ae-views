'use strict';

import $ from 'jquery';
import Element from './ae-element';
import _ from 'lodash';

export default function action(inPage) {
    const _page = inPage;

    var proto = Object.create(Element.prototype);

    proto.createdCallback = function() {

    };

    proto.attachedCallback = function() {

    };

    proto.detachedCallback = function() {

    };

    document.registerElement('ae-managed', { prototype: proto });
};
