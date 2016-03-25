'use strict';

import ObservableObject from './ObservableObject';
import State from './State';
import Bus from './Bus';

const _findState = function _findState(inStateName) {
    if(!inStateName) {
        return this.states;
    }
    let path = inStateName.split('.');
    let currentState = this.states;
    while (path.length && currentState) {
        let seg = path.shift();
        currentState = currentState.child(seg)
    }
    return currentState;
}

const _watchState = function _watchState() {
    this.model.watch('_nextState', (inPath, inChanges) => {
        let nextState = _findState.bind(this)(inChanges.newValue);
        if (!nextState) {
            console.warn('Changing to unknown state: ' +
                inChanges.newValue);
            return;
        }
        const rollback = (inReason) => {
            inReason && console.debug('Could not change state because: ' + inReason); //jshint ignore:line
            this.model.prop('_nextState', inChanges.oldValue, true);
            currentState.didntLeave();
        };
        let currentState = this.currentState;
        if (currentState) {
            currentState.leaving().then(() => {
                nextState.entering().then(() => {
                    this.setState(nextState);
                    currentState.left();
                    nextState.entered();
                }).catch(rollback);
            }).catch(rollback);
        }
    });
}

const _private = new WeakMap();

class Component {

    constructor(inName, inInitObj, inConstructor, inPage) {
        _private.set(this, {
            stateWatchers : new Set()
        });
        this.page = inPage;
        this.bus = new Bus(inPage);
        this.name = inName;
        
        this.model = ObservableObject.fromObject({ 
            data: inInitObj, 
            _state: '',
            _nextState : '' });
        _watchState.bind(this)();
        
        inConstructor && inConstructor.bind(this)(); //jshint ignore:this
        this.states = this.states || new State();
        this.currentState = this.states;
    }

    setState(inState) {
        this.currentState = inState;
        this.model.prop('_state', inState.getName());
        for(let watcher of _private.get(this).stateWatchers) {
            watcher(inState);
        }
    }

    watchState(inWatcherFunction) {
        _private.get(this).stateWatchers.add(inWatcherFunction);
    }

    onElementCreated() {

    }

    onElementAttached() {

    }

    onElementDetached() {

    }
}

module.exports = Component;
