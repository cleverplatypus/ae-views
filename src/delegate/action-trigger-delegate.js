'use strict';

import $ from 'jquery';
import {get, each, isString } from 'lodash';
import UNRESOLVED from '../symbol/unresolved';
import typifyParams from '../util/typify-parameters';


const resolveTargets = function resolveTargets(inPage, inConfig) {
    let target = {};
    if ($(this).children().length) {
        target.node = $(this).children().get(0);
    } else {
        const targetAttr = inConfig.target;
        if (!targetAttr) {
            target.node = $(this).parent();
        } else if (targetAttr === 'next') {
            target.node = $(this).next();
        } else if (/^closest/.test(targetAttr)) {
            const segs = targetAttr.split(/\s+/);
            target.node = $(this).closest(segs[1]);
        } else if (/^(\.|\#)/.test(targetAttr)) {
            target.node = $(this).parent().find(targetAttr);
        } else if (/^self$/.test(targetAttr)) {
            target.node = $(this);
        } else {
            console.warn('Unknown ae-bind target: ' + targetAttr);
        }
    }
    if (target.node && target.node.length) {
        return target;
    } else if (target.node && !target.node.length) {
        target.pending = true;
        return target;
    }
    return;
};


export default function attachAction(inPage, inConfig) {
    let target = resolveTargets.call(this, inPage, inConfig);
    if (get(this, 'pending') === true) {
        const observer = new MutationObserver((mutations) => {
            attachAction.call(this);
        });
        const observerConfig = {
            subtree: true,
            childList: true
        };
        observer.observe(this.parentNode, observerConfig);
    } else {
        const actionName = inConfig.name;
        each(target.node, (inTargetNode) => {
            const component = inPage.resolveNodeComponent(inTargetNode);
            let event;

            const handler = (inEvent, inTrigger) => {
                if (inTrigger === 'enter' && inEvent.keyCode !== 13) {
                    return;
                }
                if (inTrigger === 'esc' && inEvent.keyCode !== 27) {
                    return;
                }
                component.bus.triggerAction(
                    actionName,
                    inEvent,
                    typifyParams(inPage, inConfig.params)
                );
            };


            for (let trigger of(inConfig.trigger || '').split(',')) {
                switch (trigger) {
                    case 'enter':
                    case 'esc':
                        event = 'keyup';
                        break;
                    case '':
                        event = 'click';
                        break;
                    default:
                        if (/^\w+:/.test(trigger)) {
                            event = trigger.match(/^(\w+)/)[0];
                        } else {
                            event = trigger;
                        }
                }

                const caller = (inEvent) => { //jshint ignore:line
                    handler(inEvent, trigger);
                };

                $(inTargetNode).off(event, caller).on(event, caller);
            }


        });
    }

}
