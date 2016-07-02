'use strict';

import {Signal} from 'signals';
import {get} from 'lodash';

class Bus {

    constructor(inComponent) {
        this.component = () => inComponent;
        this.signals = {};
    }

    publishAction(inName, inHandler) {
        this.component().page.bus.addAction(inName, inHandler);
    }

    bubbleAction(inName, ...rest) {
        const parentBus = get(this.component().parent(), 'bus');
        if(!parentBus) {
            console.warn(`Cannot bubble action "${inName}" from page`);
            return;
        }
        parentBus.triggerAction.apply(parentBus, [inName].concat(rest));
    }

    triggerAction(inName, ...rest) {
        if(!this.signals[inName] || 
            this.signals[inName].dispatch.apply(null, rest) === false) {
            rest.unshift(inName);
            this.bubbleAction.apply(this, rest);
        }
    }

    addAction(inName, inHandler, inOnce) {
        if (!this.signals[inName]) {
            this.signals[inName] = new Signal();
        }
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
                console.warn('Possibly registering listener to non existing action: ' + inName);
                console.warn('You might want to use addAction or publishAction');
            }
        } else {
            this.signals[inName]['add' + (inOnce ? 'Once' : '')](inHandler);
        }
    }

    offAction(inName, inHandler) {
        //TODO: to be implemented
    }
}

export default Bus;
