'use strict';
var Signal = require('signals').Signal;
class Bus {

    constructor(inParentBus) {
        this.parent = () => inParentBus;
        this.signals = {};
    }

    publishAction(inName, inHandler) {
        if (this.parent()) {
            this.parent().publishAction(inName, inHandler);
        } else {
            this.addAction(inName, inHandler)
        }
    }

    triggerAction(inName, ...rest) {
        if (!this.signals[inName]) {
            if (this.parent()) {
                this.parent().triggerAction.apply(this.parent(), [inName].concat(rest));
            } else {
                console.warn('Trying to trigger non existing action: ' + inName);
                return;
            }

        } else {
            this.signals[inName].dispatch.apply(null, rest);
        }
    }

    addAction(inName, inHandler, inOnce) {
        this.signals[inName] = new Signal();
        if (inHandler) {
            this.signals[inName]['add' + inOnce ? 'Once' : ''](inHandler);
        }
    }

    onceAction(inName, inHandler) {
        //TODO: to be implemented
    }

    onAction(inName, inHandler) {
        if (!this.signals[inName]) {
            if (this.parent()) {
                this.parent().onAction(inName, inHandler);
            } else {
                console.warn('Registering listener to non existing action: ' + inName);
            }

        }
    }

    offAction(inName, inHandler) {
        //TODO: to be implemented
    }
}

export default Bus;
