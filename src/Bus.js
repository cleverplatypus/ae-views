'use strict';
var Signal = require('signals').Signal;
class Bus {

    constructor(inParentBus) {
        this.parent = () => inParentBus;
        this.signals = {};
    }

    publishAction(inName, inHandler) {
        if (this.parent()) {
            this.parent().exportAction(inName, inHandler);
        } else {
            this.addAction(inName, inHandler)
        }
    }

    triggerAction(inName, ...rest) {
        var signal = this.signals[inName];
        if(!signal) {
            console.warn('Trying to trigger non existing action: ' + inName);
            return;
        }
        signal.dispatch();//TODO: handle params
    }

    addAction(inName, inHandler) {
        this.signals[inName] = new Signal();
        if (inHandler) {
            this.signals[inName].add(inHandler);
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
