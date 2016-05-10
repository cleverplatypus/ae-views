'use strict';

import _ from 'lodash';
import {Signal} from 'signals';

const _private = new WeakMap();

class State {
	constructor(...rest) {	
		let name = _.find(rest, (param) => _.isString(param)) || '';
		let children = _.find(rest, (param) => _.isArray(param));
		let parent = _.find(rest, (param) => param instanceof State);

		children = _.map(children, (inValue) => {
			const state = (inValue instanceof State ? inValue : new State(inValue));
			_private.get(state).parent = this;
			return state;
		});

		_private.set(this, {
			name : name,
			children : children,
			parent : parent
		});
		this.name = name;
		this.children = children;
	}

	getPath() {
		const parent =  _private.get(this).parent;
		return (parent && parent.getName() ? parent.getPath() + '.' : '') + _private.get(this).name;
	}


	getName() {
		return _private.get(this).name;
	}

	child(inName) {
		return _.find(_private.get(this).children, (inChild) => inChild.getName() === inName);
	}

	onLeaving(inFn) {
		this.leaving = inFn;
		return this;
	}

	leaving() {
		return Promise.resolve();
	}

	onLeft(inFn) {
		this.left = inFn;
		return this;
	}

	left() {

	}

	onRendered(inFn) {
		this.rendered = inFn;
		return this;
	}

	onEntering(inFn) {
		this.entering = inFn;
		return this;
	}

	entering() {
		return Promise.resolve();
	}

	onEntered(inFn) {
		this.entered = inFn;
		return this;
	}

	rendered() {

	}
	

	entered() {

	}

	didntLeave() {

	}

	matches(inPattern) {
		return (!inPattern && !_private.get(this).name) ||
			(new RegExp(inPattern)).test(_private.get(this).name);
	}
}

export default State;
