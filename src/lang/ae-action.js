'use strict';

import $ from 'jquery';
import Element from './ae-element';
import _ from 'lodash';


var typifyParams = function typifyParams(inParams) {
    var out = {};
    _.each(inParams, function(inParamValue, inParamKey) {
        if (!inParamValue) {
            out[inParamKey] = null;
        } else if(_.isString(inParamValue) && /^`.*`$/.test(inParamValue)) {
            out[inParamKey] = inParamValue.replace(/^`/,'').replace(/`$/,'');
        } else if (!isNaN(inParamValue)) {
            out[inParamKey] = Number(inParamValue);
        } else if (/^(true|false)$/.test(inParamValue)) {
            out[inParamKey] = (inParamValue === 'true');
        } else {
            console.warn('using deprecated signal string param format');
            out[inParamKey] = inParamValue; //is a string
        }

    });
    return out;
};

var assembleParams = function(inActionNode) {
    return typifyParams(params);
};


export default function action(inPage) {
    const _page = inPage;

    var proto = Object.create(Element.prototype);

    proto.createdCallback = function() {
        const target = $(this).parent();
        const actionName = $(this).attr('name');
        const component = _page.resolveNodeComponent(target);
        $(target).click(() => {
            component.bus.triggerAction( 
                actionName, 
                target,
                assembleParams());
        });


    };

    proto.attachedCallback = function() {

    };

    proto.detachedCallback = function() {

    };

    document.registerElement('ae-action', { prototype: proto });
};
