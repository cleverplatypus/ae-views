'use strict';

const ObservableObject = require('./ObservableObject');
const has = require('lodash.has');

class ComponentModel extends ObservableObject {
	constructor(inInitObj) {
		super();

		if(has(inInitObj, 'data')) {
			this.fill(inInitObj);
		} else {
			this.fill({ data : inInitObj});
		}
	}

	data(inPath, inData) {
		if(typeof inPath === 'object') {
			return this.prop('data', inPath);
		}
		const path = 'data' + (inPath ? '.' + inPath : '');
		return this.prop(path, inData);
	}
}

module.exports = ComponentModel;