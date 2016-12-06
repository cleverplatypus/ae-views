'use strict';
import microtask from './microtask';


import has from 'lodash.has';
import find from 'lodash.find';
import each from 'lodash.foreach';
import get from 'lodash.get';
import ObservableObject from './ObservableObject';

const _private = new WeakMap();
let _willNotify = false;
const _queue = new Map();

const _emit = function() {
    for (let f of _queue.keys()) {
        let info = _queue.get(f);
        for (let i of info) {
            f(i.changes);
        }
    }
    _queue.clear();
    _willNotify = false;
};

class Observer {
    constructor(inParent) {
        _private.set(this, {
            parent: inParent,
            listeners: new Set(),
            childrenListeners: new Set(),
            descendantListeners: new Set(),
            children: {}
        });
    }


    unlisten(inListenerFn, inPath) {
        const _p = _private.get(this);
        for (let listener of _p.listeners) {
            if (listener.handler === inListenerFn) {
                _p.listeners.delete(listener);
            }
        }
        for (let listener of _p.childrenListeners) {
            if (listener.handler === inListenerFn) {
                _p.childrenListeners.delete(listener);
            }
        }
        for (let listener of _p.descendantListeners) {
            if (listener.handler === inListenerFn) {
                _p.descendantListeners.delete(listener);
            }
        }
        each(_p.children, (inChildObserver) => {
            inChildObserver.unlisten(inListenerFn, inPath);
        });
    }

    hasListeners() {
        const _p = _private.get(this);
        return _p.listeners.size > 0 || _p.childrenListeners.size > 0 || _p.descendantListeners.size > 0;
    }

    get allListeners() {
        const _p = _private.get(this);

        return Array.from(_p.listeners)
            .concat(Array.from(_p.childrenListeners))
            .concat(Array.from(_p.descendantListeners));
    }

    listen(inPath, inListener, inOriginalPath) {
        // if (!inPath) {
        //     return;
        // }
        const originalPath = inOriginalPath || inPath;
        const _p = _private.get(this);
        const segs = inPath ? inPath.split('.') : [];
        const propName = segs.shift();
        if (/^\w+$/.test(propName)) {
            _p.children[propName] = _p.children[propName] || new Observer(this);
            if (segs.length) {
                _p.children[propName].listen(segs.join('.'), inListener, originalPath);
            } else {
                _p.listeners.add({
                    handler: function(inChanges) {
                        inListener(originalPath, inChanges);
                    },
                    observedPath: originalPath
                });
            }
        } else if (propName === '*') {
            _p.listeners.add({
                handler: function(inChanges) {
                    inListener(originalPath, inChanges);
                },
                observedPath: originalPath
            });

        } else if (propName === '**') {
            _p.descendantListeners.add({
                handler: function(inChanges) {
                    inListener(originalPath, inChanges);
                },
                observedPath: originalPath
            });
            // _p.listeners.add(inListener);
        } else if (/\[\w+\]/.test(propName)) {
            _p.listeners.add({
                handler: (inChanges) => {
                    inListener(originalPath, inChanges);
                },
                observedPath: originalPath
            });
        }
    }

    resolveChild(inPath) {
        let node = this;
        let subChain = inPath.split('.');
        let prop = '';
        while (subChain.length) {
            prop = subChain.shift();
            node = _private.get(node).children[prop];
        }
        return node;
    }
    notify(inPath, inChange, inOriginalPath) {
        const originalPath = inOriginalPath || inPath;

        const _p = _private.get(this);
        const segs = inPath ? inPath.split('.') : [];
        const propName = segs.shift();
        let shouldTrigger = false;
        const top = inPath.split('.').pop();

        const pushQueue = function(fn, inLocalChange) {
            if (!_queue.has(fn)) {
                _queue.set(fn, []);
            }
            if (find(_queue.get(fn), {
                    originalPath: originalPath
                })) {
                return;
            }
            _queue.get(fn).push({
                path: inPath,
                changes: inLocalChange || inChange,
                originalPath: originalPath
            });
        };
        if (['replace', 'emptied'].indexOf(get(inChange, 'type')) !== -1 &&
            inChange.oldValue instanceof ObservableObject) {
            const descend = (inBaseObserver, inPropChain) => {
                if (inBaseObserver.hasListeners()) {
                    const change = {
                        type: 'pruned'
                    };
                    each(inBaseObserver.allListeners, (listener) => {
                        pushQueue(listener.handler, change);
                        shouldTrigger = true;
                    });

                }
                each(_private.get(inBaseObserver).children, (inChild, inSubProp) => {
                    descend(inChild, inPropChain + '.' + inSubProp);
                });
            };
            const target = this.resolveChild(inPath);
            descend(target, inPath);
        }

        if (propName) {
            if (has(_p.children, propName) && segs.length) {
                _p.children[propName].notify(segs.join('.'), inChange, originalPath);
            }
            if (!segs.length) {
                shouldTrigger = shouldTrigger || _p.listeners.size;
                for (let l of _p.listeners) {
                    pushQueue(l.handler);
                }
            }
            shouldTrigger = shouldTrigger || _p.childrenListeners.size;
            for (let l of _p.childrenListeners) {
                pushQueue(l.handler);
            }
            shouldTrigger = shouldTrigger || _p.descendantListeners.size;
            for (let l of _p.descendantListeners) {
                pushQueue(l.handler);
            }
        } else {
            shouldTrigger = shouldTrigger || _p.listeners.size;
            for (let l of _p.listeners) {
                pushQueue(l.handler);
            }
        }

        if (!_willNotify && shouldTrigger) {
            microtask(_emit, [inPath, inChange]);
            _willNotify = true;
        }

    }

    bubble(path, changes) {

    }

    static target(base, path, changes) {

    }
}
export default Observer;
