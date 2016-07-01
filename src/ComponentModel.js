'use strict';

import ObservableObject from './ObservableObject';
import {has} from 'lodash';

class ComponentModel extends ObservableObject {
	constructor(inInitObj) {
		super();

		if(has(inInitObj, 'data')) {
			this.fill(inInitObj);
		} else {
			this.fill({ data : inInitObj});
		}
	}
}

export default ComponentModel;