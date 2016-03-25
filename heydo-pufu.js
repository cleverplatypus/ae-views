//const aTemplate = require('./templates/a-template');
import State from './src/State';

module.exports = function(inPage) {
	const _page = inPage;
	const _factory = _page.factory;

	var _bus, _model, _fRef, _id, _node;

	_factory.component('heydo-pufu', { 
		people : [
        	{
        		name : 'gorgo',
        		age : 12
        	},
        	{
        		name : 'catturami',
        		age : 2
        	},
        	{
        		name : 'fantaman',
        		age : 66
        	}
        ]
	}, function() {
		_fRef = this.fRef;
		_bus = this.bus;
		_model = this.model;
		_id = this.id;
		_node = this.node;

		// this.templates = {
		// 	aTemplate : aTemplate
		// };

		this.states = new State([
        	'zucca',
        	'barucca'
        ]);


		this.render = function render() {
			//return undefined: render default template if any
			//return function if manual rendering
			//return promise: hangs rendering until resolve. resolve param either function or undefined 
			
		}

		// _bus.publishAction('goToHeaven', function() {
		// 	console.log('this is accessible globally');
		// });


		_bus.addAction('goToHell', function() {
			console.log('it\'s hot here');
		});

		// _model.watch('card.details.*', function(inTarget, inPath, inOldValue) {
		// 	_model.prop('payment_method', 'card');
		// });

		// _model.change('people', function(inOrig) {
		// 	inOrig.setItemAt(1, 'bla');
		// 	return inOrig;
		// });

	});
};


