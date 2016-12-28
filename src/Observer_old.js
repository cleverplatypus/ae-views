'use strict';
import microtask from './microtask';


import has from 'lodash.has';
import find from 'lodash.find';
import each from 'lodash.foreach';
import get from 'lodash.get';
import ObservableObject from './ObservableObject';

const ROOT = Symbol('root-observer');

const _private = new WeakMap();
let _willNotify = false;
const _queue = new Map();

const _emit = function() {
    for (let f of _queue.keys()) {
        let info = _queue.get(f);
        for (let i of info) {
            f(i.changes, i.originalPath);
        }
    }
    _queue.clear();
    _willNotify = false;
};

class Observer {
    constructor(inParent, inWatches) {
        _private.set(this, {
            parent: inParent,
            watches: inWatches || ROOT,
            listeners: new Set(),
            childrenListeners: new Set(),
            descendantListeners: new Set(),
            children: {}
        });
    }

    get watches() {
        return _private.get(this).watches;
    }

    get children() {
        return _private.get(this).children;
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
        const originalPath = inOriginalPath || inPath;
        const _p = _private.get(this);
        const segs = inPath ? inPath.split('.') : [];
        const propName = segs.shift() || '';
        if (!propName) {
            _p.listeners.add({
                handler: function(inChanges, inOriginalPath) {
                    if ((new RegExp('^' + inOriginalPath.replace(/\./g, '\\\.') + '\\.?')).test(originalPath)) {
                        inListener(originalPath, inChanges);
                    }
                },
                observedPath: originalPath
            });
        } else {
            const handler = function(inChanges, inOriginalPath) {
                let regexp;
                if(originalPath === '*') {
                    regexp = /[^\.]*$/;
                } else if(originalPath === '**') {
                    regexp = /.*/;
                }
                if ( regexp && regexp.test(originalPath) || (new RegExp(
                        originalPath
                            .replace(/\./g, '\\\.')
                            .replace(/\*\*$/, '\.*$'))).test(inOriginalPath) ||
                    (new RegExp(
                        originalPath
                            .replace(/\./g, '\\\.')
                            .replace(/\*$/, '[^\.]*$'))).test(inOriginalPath)) {
                    inListener(originalPath, inChanges);
                }
            };

            if (propName === '*') {
                _p.childrenListeners.add({
                    handler: handler,
                    observedPath: originalPath
                });
            } else if (propName === '**') {
                _p.descendantListeners.add({
                    handler: handler,
                    observedPath: originalPath
                });
            } else if (/\[\w+\]/.test(propName)) {
                const actualPropName = propName.replace(/\W/g, '');
                _p.listeners.add({
                    handler: function(inChanges, inOriginalPath) {
                        if (originalPath === inOriginalPath &&
                            actualPropName === inChanges.path.split('.').pop()) {
                            inListener(originalPath, inChanges);
                        }
                    },
                    observedPath: originalPath
                });
            } else {
                _p.children[propName] = _p.children[propName] || new Observer(this, propName);
                _p.children[propName].listen(segs.join('.'), inListener, originalPath);
            }
        }
    }

    resolveChild(inPath) {
        let node = this;
        let subChain = inPath.split('.');
        let prop = '';
        while (!!node && subChain.length) {
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
            if (target) {
                descend(target, inPath);
            }
        }
        if (inPath && has(_p.children, propName)) {
            _p.children[propName].notify(segs.join('.'), inChange, originalPath);
        } else {
            shouldTrigger = this.allListeners.length;
            for (let l of _p.listeners) {
                pushQueue(l.handler);
            }
            for (let l of _p.childrenListeners) {
                pushQueue(l.handler);
            }
            for (let l of _p.descendantListeners) {
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
