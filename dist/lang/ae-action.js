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


const $ = require('jquery');

const attachAction = require('../delegate/action-trigger-delegate');

let _page;


export default function action(inPage) {

    _page = inPage;

    var proto = Object.create(HTMLElement.prototype);

    proto.createdCallback = function() {

    };

    proto.attachedCallback = function() {
        attachAction.call(this, _page, {
            name: $(this).attr('name'),
            trigger: $(this).attr('trigger'),
            target: $(this).attr('target'),
            params: (() => {
                const params = {};
                $($(this).get(0).attributes).each(function() {
                    if (/^param-/.test(this.name)) {
                        params[this.name.replace('param-', '')] = this.value;
                    }
                });
                return params;
            })()
        });
    };

    proto.detachedCallback = function() {

    };

    document.registerElement('ae-action', { prototype: proto });
}
