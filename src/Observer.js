'use strict';
import microtask from './microtask';

const _queue = new Map();
import {has, find, each} from 'lodash';
let _willNotify = false;

const _private = new WeakMap();

const _emit = function() {
    for (let f of _queue.keys()) {
        let info = _queue.get(f);
        for (let i of info) {
            f(i.path, i.changes);
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
        for(let listener of _p.listeners) {
            if(listener.handler === inListenerFn) {
                _p.listeners.delete(listener);
            }
        }
        for(let listener of _p.childrenListeners) {
            if(listener.handler === inListenerFn) {
                _p.childrenListeners.delete(listener);
            }
        }
        for(let listener of _p.descendantListeners) {
            if(listener.handler === inListenerFn) {
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

    listen(inPath, inListener) {
        if (!inPath) {
            return;
        }
        const _p = _private.get(this);
        const segs = inPath ? inPath.split('.') : [];
        const propName = segs.shift();
        if (/^\w+$/.test(propName)) {
            _p.children[propName] = _p.children[propName] || new Observer(this);
            if (segs.length) {
                _p.children[propName].listen(segs.join('.'), inListener);
            } else {
                _p.listeners.add({ handler : function(inNotifiedPath, inChanges) {
                    if (inNotifiedPath === inPath) {
                        inListener(inNotifiedPath, inChanges);
                    }
                }});
                _private.get(_p.children[propName]).listeners.add({ handler : inListener});
            }
        } else if (propName === '*') {
            //_p.childrenListeners.add(inListener);
            _p.listeners.add({handler : inListener});

        } else if (propName === '**') {
            _p.descendantListeners.add({handler : inListener});
            // _p.listeners.add(inListener);
        } else if( /\[\w+\]/.test(propName)) {
            _p.listeners.add({handler : (inPath, inChanges) => {
                if(inPath === propName.replace(/\W/g, '')) {
                    inListener(inPath, inChanges);
                }
            }});
        }
    }

    notify(inPath, inChanges) {
        const _p = _private.get(this);
        const segs = inPath ? inPath.split('.') : [];
        const propName = segs.shift();
        let shouldTrigger = false;
        const pushQueue = function(fn) {
            if (!_queue.has(fn)) {
                _queue.set(fn, []);
            }
            if(find(_queue.get(fn), { path : inPath})) {
                return;
            }
            _queue.get(fn).push({ path: inPath, changes: inChanges });
        };
        if (propName) {
            if (has(_p.children, propName) && segs.length) {
                _p.children[propName].notify(segs.join('.'), inChanges);
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
            microtask(_emit, [inPath, inChanges]);
            _willNotify = true;
        }

    }

    bubble(path, changes) {

    }

    static target(base, path, changes) {

    }
}
export default Observer;
