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
import UNRESOLVED from '../symbol/unresolved';
import {includes} from 'lodash';

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
        let target;
        if ($(this).children().length) {
            target = $(this).children().get(0);
        } else {
            const targetAttr = $(this).attr('target');
            if(!targetAttr) {
                target = $(this).parent();
            } else if(targetAttr === 'next') {
                target = $(this).next();
            } else if(/^closest/.test(targetAttr)) {
                const segs = targetAttr.split(/\s+/);
                target = $(this).closest(segs[1]);
            } else if(/^(\.|\#)/.test(targetAttr)) {
                target = $(this).parent().find(targetAttr);
            } else {
                console.warn('Unknown ae-bind target: ' + targetAttr);
            }
        }
        const actionName = $(this).attr('name');
        const component = _page.resolveNodeComponent(target);
        let event;

        let trigger = $(this).attr('trigger') || '';
        switch(trigger) {
            case 'enter':
            case 'esc':
                event = 'keyup';
                break;
            case '':
                event = 'click';
                break;
            default:
                if(/^\w+:/.test(trigger)) {
                    event = trigger.match(/^(\w+)/)[0];
                } else {
                    event = trigger;
                }
        }

        const nodeName = $(target).get(0).nodeName.toUpperCase();

        $(target)[event]((inEvent) => {
            if(trigger === 'enter' && inEvent.keyCode !== 13 ) {
                return;
            }
            if(trigger === 'esc' && inEvent.keyCode !== 27 ) {
                return;
            }
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
