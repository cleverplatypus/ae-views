import isArray from 'lodash.isarray';

import microtask from './microtask';
import ObservableObject from './ObservableObject';
import each from 'lodash.foreach';
class Queue {
    constructor() {
        this._notifications = [];
    }

    push(inNotification) {
        this._notifications.push(inNotification);
    }

    drain() {
        microtask(() => {
            for (let notification of this._notifications) {
                notification.listener.trigger(notification.path, notification.change);
            }
            this._notifications = [];
        });
    }
}

const _queue = new Queue();

class Listener {
    constructor(inFullPath, inHandler) {
        const path = inFullPath.toString().split('.');
        const leaf = path[path.length -1];
        if(leaf && /^\[[\w\-,]+\]$/.test(leaf)) {
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
        return !this.observerProperties ||
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

    unlisten() {
        console.warn('unlisten is not implemented');
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
                if (segs.length === 2) {
                    for (let listener of this._childrenListeners.concat(this._descendantListeners)) {
                        if (listener.shouldTrigger(inOriginalPath)) {
                            _queue.push({
                                listener: listener,
                                path: inOriginalPath,
                                change: inChange
                            });
                        }
                    }
                } else if (segs.length > 2) {
                    for (let listener of this._childrenListeners.concat(this._descendantListeners)) {
                        if (listener.shouldTrigger(inOriginalPath)) {
                            _queue.push({
                                listener: listener,
                                path: inOriginalPath,
                                change: inChange
                            });
                        }
                    }
                }
                const child = segs.shift();
                if (this._children[child]) {
                    this._children[child].notify(segs.join('.'), inChange, inOriginalPath);
                }
            } else if (segs.length === 1) {
                for (let listener of this._listeners) {
                    if (listener.shouldTrigger(inOriginalPath)) {
                        _queue.push({
                            listener: listener,
                            path: inOriginalPath,
                            change: inChange
                        });
                    }
                    if(inChange.type === 'add' && inChange.newValue instanceof ObservableObject) {
                        each(inChange.newValue.keys(), (inKey) => {
                            this.notify(inKey, { 
                                type : 'add', 
                                newValue : inChange.newValue.prop(inKey)
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

export default Observer;
