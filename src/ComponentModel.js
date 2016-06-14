'use strict';

import ObservableObject from './ObservableObject';

class ComponentModel extends ObservableObject {
	constructor(inData, inRootProperties) {
		super();
		inRootProperties.data = inData;
		inRootProperties._state = inRootProperties._state || '';
		inRootProperties._nextState = inRootProperties._nextState || '';
		this.fill(inRootProperties);
	}
}

export default ComponentModel;