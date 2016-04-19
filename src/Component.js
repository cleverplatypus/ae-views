'use strict';

import ObservableObject from './ObservableObject';
import State from './State';
import Bus from './Bus';
import _ from 'lodash';
import $ from 'jquery';

const _findState = function _findState(inStateName) {
    if(!inStateName) {
        return this.states;
    }
    let path = inStateName.split('.');
    let currentState = this.states;
    while (path.length && currentState) {
        let seg = path.shift();
        currentState = currentState.child(seg);
    }
    return currentState;
};

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
};



const _private = new WeakMap();

class Component {

    constructor(inConfig, inInitObj, inConstructor, inPage) {
        _private.set(this, {
            stateWatchers : new Set()
        });
        this.page = inPage;
        this.bus = new Bus(inPage? inPage.bus : null);
        this.name = inConfig.name;
        this.templates = inConfig.templates || {};
        
        this.model = ObservableObject.fromObject({ 
            data: inInitObj, 
            _state: '',
            _nextState : '' });
        for(let templateName in this.templates) {
            if(!/^_/.test(templateName)) {
                this.page.getTemplatingDelegate().register(templateName, this.templates[templateName]);
            }
        }


        _watchState.bind(this)();
        
        inConstructor && inConstructor.bind(this)(); //jshint ignore:line
        this.states = this.states || new State();
        this.currentState = this.states;
    }

    tryState(inState) {
        this.model.prop('_nextState', inState);
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

    getTemplatingDelegate() {
        return this.page.getTemplatingDelegate();
    }

    render(inModel) {
        let defaultTemplate = _.get(this, 'templates._default');
        if(defaultTemplate) {
            const delegate = this.getTemplatingDelegate();
            const model = inModel ? 
                ObservableObject.fromObject(inModel) :
                this.model.prop('data');

            delegate.render(
                defaultTemplate, 
                model , (inError, inHtml) => {
                if(inError) {
                    console.error(inError);
                    return;
                }
                $(this.node).html(inHtml);
            });
        }
    }

    onElementCreated() {

    }

    onElementAttached() {

    }

    onElementDetached() {

    }
}

export default Component;
