'use strict';

const find = require('lodash.find');
const map = require('lodash.map');
const isString = require('lodash.isString');
const isArray = require('lodash.isArray');

const _private = new WeakMap();

class State {
	constructor(...rest) {	
		let name = find(rest, (param) => isString(param)) || '';
		let children = find(rest, (param) => isArray(param));
		let parent = find(rest, (param) => param instanceof State);

		children = map(children, (inValue) => {
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
		return find(_private.get(this).children, (inChild) => inChild.getName() === inName);
	}

	resolve(inPath) {
		if(!inPath) {
			return;
		}
		const segs = inPath.split('.');
		const child = this.child(segs.shift());
		if(!child) {
			return;
		} else if(segs.length) {
			return child.resolve(segs.join('.'));
		} else {
			return child;
		}
	}

	exposed() {
		this.exposed = true;
		return this;
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

	default() {
		this.is_default = true;
		return this;
	}

	matches(inPattern) {
		return (!inPattern && !_private.get(this).name) ||
			(new RegExp(inPattern)).test(_private.get(this).name);
	}
}

export default State;
