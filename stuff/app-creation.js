const _ = require('lodash');
const ae = require('ae');
const firebase = require('firebase');
const mainTemplate = require('./templates/main-template');

const bubu = require('./components/bubu');

model.exports = (function(ae) {

	ae.page({
		'hide-strategy' : (inNode) => '.is-hidden',
		name : 'my page',
		components : [
			bubu
		],
		templates : {
			'main-template' : mainTemplate
		}

	}, function() {
		
		this.injectComponent = function injectComponent(inComponent, inNode) {
			return {
				firebase : firebaseAuthenticatedInstance
			};
		};

		this.initialize = function initialize() {
			//firebase auth, then inject component strategy
			//TODO: returns  promise
		}


	});
})(ae);
