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

	data(inPath, inData, inSilent) {
		if(typeof inPath === 'object') {
			return this.prop('data', inPath, inSilent);
		}
		const path = 'data' + (inPath ? '.' + inPath : '');
		return this.prop(path, inData, inSilent);
	}
}

module.exports = ComponentModel;