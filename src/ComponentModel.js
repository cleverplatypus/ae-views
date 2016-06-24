'use strict';

import ObservableObject from './ObservableObject';

class ComponentModel extends ObservableObject {
	constructor(inData, inRootProperties) {
		super();
		inRootProperties.data = inData;
		this.fill(inRootProperties);
	}
}

export default ComponentModel;