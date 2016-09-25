'use strict';

import ObservableObject from './ObservableObject';
import has from 'lodash.has';

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
		const path = 'data' + (inPath ? '.' + inPath : '');
		return this.prop(path, inData);
	}
}

export default ComponentModel;