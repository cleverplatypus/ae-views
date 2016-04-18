'use strict';
const _ = require('lodash');

const _private = new WeakMap();
class State {
	constructor(...rest) {
		let name = _.find(rest, (param) => _.isString(param)) || '';
		let children = _.find(rest, (param) => _.isArray(param));
		children = _.map(children, function(inValue) {
			return (inValue instanceof State ? inValue : new State(inValue))
		});
		_private.set(this, {
			name : name,
			children : children
		});
		this.name = name;
		this.children = children;
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
