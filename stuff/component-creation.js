const aTemplate = require('./templates/a-template');

module.export = function(ae) {

	var _bus, _model, _fRef, _id;

	ae.component('hellfire', {}, function() {
		_fRef = this.app.firebase;
		_bus = this.bus;
		_model = this.model;
		_id = this.id;
		this.templates = {
			aTemplate : aTemplate
		};


		this.render = function render() {
			this.node
		}

		_bus.exportAction('goToHeaven', function() {
			console.log('this is accessible globally');
		});


		_bus.addAction('goToHell', function() {
			console.log('it\'s hot here');
		});

		_model.watch('card.details.*', function(inTarget, inPath, inOldValue) {
			_model.prop('payment_method', 'card');
		});

		_model.change('people', function(inOrig) {
			inOrig.setItemAt(1, 'bla');
			return inOrig;
		});

	});
};


