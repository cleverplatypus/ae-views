'use strict';

const Signal = require('signals').Signal;
const get = require('lodash.get');
const unset = require('lodash.unset');
const $ = require('jquery');

class Bus {

    constructor(inComponent) {
        this.component = () => inComponent;
        this.signals = {};
    }

    publishAction(inName, inHandler) {
        this.component().page.bus.addAction(inName, inHandler, false, this.component());
    }

    bubbleAction(inName, ...rest) {
        const parentBus = get(this.component().parent(), 'bus');
        if (!parentBus) {
            console.warn(`Cannot bubble action "${inName}" from page`);
            return;
        }
        parentBus.triggerAction.apply(parentBus, [inName].concat(rest));
    }

    bubble() {
        this.shouldBubbleCurrent = true;
    }

    triggerAction(inName, inParams, ...rest) {
        const declarer = get(this, 'signals.' + inName + '.declarer');
        if(declarer && !$(document).has(declarer.node).length) {
            // unset(this, 'signals.' + inName);
            // debugger;
            return;
        }
        inParams = inParams || {};
        if (this.signals[inName]) {
            this.signals[inName].dispatch.apply(null, [inParams].concat(rest));
        }

        if (!this.signals[inName] || this.shouldBubbleCurrent) {
            rest.unshift(inParams);
            rest.unshift(inName);
            this.shouldBubbleCurrent = false;
            this.bubbleAction.apply(this, rest);
        }

    }

    addAction(inName, inHandler, inOnce, inDeclarer) {
        if (this.signals[inName]) {
            this.signals[inName].dispose();
            //console.warn('action ' + inName + ' was overridden');
        }
        this.signals[inName] = new Signal();
        this.signals[inName].declarer = inDeclarer;
        if (inHandler) {
            this.signals[inName]['add' + (inOnce ? 'Once' : '')](inHandler);
        }
    }

    onceAction(inName, inHandler) {
        //TODO: to be implemented
    }

    onAction(inName, inHandler, inOnce) {
        if (!this.signals[inName]) {
            const parentBus = get(this.component().parent(), 'bus');
            if (parentBus) {
                parentBus.onAction(inName, inHandler, inOnce);
            } else {
                this.addAction(inName, inHandler, inOnce);
                // console.warn('Possibly registering listener to non existing action: ' + inName);
                // console.warn('You might want to use addAction or publishAction');
            }
        } else {
            this.signals[inName]['add' + (inOnce ? 'Once' : '')](inHandler);
        }
    }

    offAction(inName, inHandler) {
        //TODO: to be implemented
    }
}

module.exports = Bus;
