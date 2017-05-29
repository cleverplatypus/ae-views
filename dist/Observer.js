const isArray = require('lodash.isarray');

const microtask = require('./microtask');
const ObservableObject = require('./ObservableObject');
const each = require('lodash.foreach');
const find = require('lodash.find');
const remove = require('lodash.remove');

class Queue {
    constructor() {
        this._notifications = [];
    }

    push(inNotification) {
        if (!find(this._notifications, (inItem) => {
                return inNotification.listener.fullPath === inItem.listener.fullPath &&
                    inNotification.listener.handler === inItem.listener.handler;
            })) {
            this._notifications.push(inNotification);
        }
    }

    drain() {
        microtask(() => {
            for (let notification of this._notifications) {
                notification.listener.trigger(notification.path, notification.change);
            }
            window.nots = window.nots || [];
            window.nots.push(this._notifications);
            this._notifications = [];
        });
    }
}

const _queue = new Queue();

class Listener {
    constructor(inFullPath, inHandler) {
        const path = inFullPath.toString().split('.');
        const leaf = path[path.length - 1];
        if (leaf && /^\[[\w\-,]+\]$/.test(leaf)) {
            this.observerProperties = leaf.match(/([\w\-]+)/g);
        }
        this.fullPath = inFullPath;
        this.handler = inHandler;
    }
    trigger(inPath, inChange) {
        if (!this.shouldTrigger(inPath)) {
            throw new Error(inPath + ' should not be in the queue');
        }
        this.handler(inPath, inChange);
    }
    shouldTrigger(inPath) {
        // if(this.fullPath.indexOf(inPath) !== 0) {
        //     return false;
        // }
        return (!this.observerProperties && this.fullPath.indexOf(inPath) !== 0) ||
            (() => {
                const leaf = inPath.split('.').pop();
                for (let prop of this.observerProperties) {
                    if (leaf === prop) {
                        return true;
                    }
                }
                return false;
            })();
    }
}

class Observer {

    constructor(inParent) {
        this._parent = inParent;
        this._listeners = [];
        this._childrenListeners = [];
        this._descendantListeners = [];
        this._children = {};
    }

    /**
     * inPath is optional
     */
    unlisten(inHandler, inPath) {
        const match = (inListener) => {
            return inListener.handler === inHandler &&
            (!inPath || inListener.fullPath === inPath);
        }
        remove(this._childrenListeners, match);
        remove(this._descendantListeners, match);
        remove(this._listeners, match);
        each(this._children, (inChild) => {
            inChild.unlisten(inHandler, inPath);
        })
    }

    dump() {
        const out = {};
        return out;
    }

    listen(inPath, inHandler, inOriginalPath) {
        inOriginalPath = inOriginalPath || inPath;

        if (!inPath) {
            this._listeners.push(new Listener(inOriginalPath, inHandler));
        } else if (/^\[[\w\-,]+\]$/.test(inPath)) {
            /*
            listens to inPath minus [someProp] and only
            triggers if the modified property name === someProp
            */
            this._listeners.push(new Listener(inOriginalPath, inHandler));
        } else if (/^[\w\-]+(?:\..*)*$/.test(inPath)) {
            /*
                if path length > 1 descend properties
            */
            const segs = inPath.split('.');
            const propName = segs.shift();
            this._children[propName] = this._children[propName] || new Observer(this);
            this._children[propName].listen(segs.join('.'), inHandler, inOriginalPath);
        } else if (/^\*$/.test(inPath)) {
            this._childrenListeners.push(new Listener(inOriginalPath, inHandler));
        } else if (/^\*\*$/.test(inPath)) {
            this._descendantListeners.push(new Listener(inOriginalPath, inHandler));
        }
    }

    notify(inPath, inChange, inOriginalPath) {
        inOriginalPath = inOriginalPath || inPath;
        const segs = inPath.split('.');
        if (!inPath || /^\[[\w\-,]+\]$/.test(inPath)) {
            for (let listener of this._listeners) {
                if (listener.shouldTrigger(inPath)) {
                    _queue.push({
                        listener: listener,
                        path: inOriginalPath,
                        change: inChange
                    });
                }
            }
        } else if (/^[\w\-]+(?:\..*)*$/.test(inPath)) {
            if (segs.length >= 2) {
                for (let listener of this._childrenListeners.concat(this._descendantListeners)) {
                    if (listener.shouldTrigger(inOriginalPath)) {
                        _queue.push({
                            listener: listener,
                            path: inOriginalPath,
                            change: inChange
                        });
                    }
                }
                const child = segs.shift();
                if (this._children[child]) {
                    this._children[child].notify(segs.join('.'), inChange, inOriginalPath);
                }
            } else if (segs.length === 1) {
                for (let listener of this._listeners.concat(this._childrenListeners.concat(this._descendantListeners))) {
                    if (listener.shouldTrigger(inOriginalPath)) {
                        _queue.push({
                            listener: listener,
                            path: inOriginalPath,
                            change: inChange
                        });
                    }
                    if (inChange.type === 'add' && inChange.newValue instanceof ObservableObject &&
                        this._childrenListeners.concat(this._descendantListeners).length) {

                        each(inChange.newValue.keys(), (inKey) => {
                            this.notify(inKey, {
                                type: 'add',
                                newValue: inChange.newValue.prop(inKey)
                            }, inOriginalPath.split('.').concat([inKey]).join('.'));
                        });
                    }
                }
            }

        }
        if (!this._parent) {
            _queue.drain(inPath, inChange);
        }
    }
}

module.exports = Observer;
