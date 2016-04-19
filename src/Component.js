'use strict';

import ObservableObject from './ObservableObject';
import State from './State';
import Bus from './Bus';
import _ from 'lodash';
import $ from 'jquery';
import factory from './page-factory';

const _findState = function _findState(inStateName) {
    if (!inStateName) {
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
            stateWatchers: new Set()
        });
        this.config = inConfig;
        this.page = inPage;
        this.bus = new Bus(inPage ? inPage.bus : null);
        this.name = inConfig.name;
        let templates = inConfig.templates || {};

        this.model = ObservableObject.fromObject({
            data: inInitObj,
            _state: '',
            _nextState: ''
        });
        for (let templateName in templates) {
            let actualTemplateName = templateName === '_default' ?
                '_default.' + this.name :
                templateName;
            factory.getTemplatingDelegate()
                .register(actualTemplateName, templates[templateName]);
        }
        _private.get(this).hasDefaultTemplate = !!templates._default;
        _watchState.bind(this)();
        this.states = this.states || new State();
        this.currentState = this.states;
        inConstructor && inConstructor.bind(this)(); //jshint ignore:line
        
    }

    getCurrentState() {
        return this.model.prop('_state');
    }

    tryState(inState) {
        this.model.prop('_nextState', inState);
    }

    setState(inState) {
        this.currentState = inState;
        this.model.prop('_state', this.model.prop('_nextState'));
        for (let watcher of _private.get(this).stateWatchers) {
            watcher(inState);
        }
    }

    watchState(inWatcherFunction) {
        _private.get(this).stateWatchers.add(inWatcherFunction);
    }

    render(inModel) {
        if (_private.get(this).hasDefaultTemplate) {
            const delegate = factory.getTemplatingDelegate();
            const model = inModel ?
                ObservableObject.fromObject(inModel) :
                this.model.prop('data');

            delegate.render(
                '_default.' + this.name,
                model).then((inHtml) => {
                $(this.node).html(inHtml);
            }).catch((inError) => {
                console.error(inError);
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
