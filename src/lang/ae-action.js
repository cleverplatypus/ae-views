'use strict';
/**
 * Binds a Bus action to the parent node.
 *
 * Params can be passed through this element's param-xxx attributes
 * The param types are inferred: numbers, booleans, null.
 * It is possible to pass as a param a reference to  the current model's property
 * by using leading tilde followed by the model's path. E.g. param-user_name="~user_profile.name".
 * Using just a tilde will pass the whole model object.
 * To force values to be evaluated as strings, wrap param value in backticks. 
 * E.g. param-string_value="`123`"
 */

 /*
  * IMPROVEMENTS: at the moment only the local data model is always used for model path resolution
  * I should evaluate the option of passing the action handler a Promise, in the case where
  * the path resolution requires an async operation.
  * The application should be informed of a pending operation so it could
  * show a progress panel, where appropriate
  * This involves, aside from passing a Promise to the action handler, 
  * the resolution of all parameters that could protentially make
  * separate async operations
  */ 



import $ from 'jquery';
import Element from './ae-element';
import _ from 'lodash';
import {UNRESOLVED} from '../symbol/unresolved';

let _page;


/* 
 * REFACTOR: move this to library. 
 * Typification should be html node agnostic therefore some kind
 * of delegation should be used or the tilde string handling has to be
 * hanled after returning
 */
var typifyParams = function typifyParams(inActionNode, inParams) {

    var out = {};
    _.each(inParams, function(inParamValue, inParamKey) {
        if (!inParamValue) {
            out[inParamKey] = null;
        } else if (_.isString(inParamValue) && /^~/.test(inParamValue)) {
            let resolvedValue = UNRESOLVED;
             _page.getDataSource()
                .resolve(inActionNode, inParamValue.replace('~', '')).then((inValue) => {
                    resolvedValue = inValue;
                });
            if(resolvedValue === UNRESOLVED) {
                throw new Error('Action parameters must be resolved synchronously');
            }
            out[inParamKey] = resolvedValue;
        } else if (_.isString(inParamValue) && /^`.*`$/.test(inParamValue)) {
            out[inParamKey] = inParamValue.replace(/^`/, '').replace(/`$/, '');
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
    let params = {};
    $($(inActionNode).get(0).attributes).each(function() {
        if (/^param-/.test(this.name)) {
            params[this.name.replace('param-', '')] = this.value;
        }
    });
    return typifyParams(inActionNode, params);
};


export default function action(inPage) {

    _page = inPage;

    var proto = Object.create(Element.prototype);

    proto.createdCallback = function() {
        const target = $(this).parent();
        $(target).attr('onclick', 'return false');
        const actionName = $(this).attr('name');
        const component = _page.resolveNodeComponent(target);
        $(target).click((inEvent) => {
            component.bus.triggerAction(
                actionName,
                inEvent,
                assembleParams(this)
            );
        });


    };

    proto.attachedCallback = function() {

    };

    proto.detachedCallback = function() {

    };

    document.registerElement('ae-action', { prototype: proto });
}
