'use strict';
import _ from ('lodash');

let _config, _model, _constructorFunction

class PageTemplate {
	
	constructor(inConfig, inModel, inConstructor) {
		_config = inConfig;
		_model = inModel;
		_constructorFunction = inConstructor;
	}

	implement(inConfig, inModel, inConstructor) {
		//TODO: merge params with template params. wrap constructor 
	}
}