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
        if(!this.signals[inName]) {
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
            if (this.parent()) {
                this.parent().onAction(inName, inHandler, inOnce);
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
