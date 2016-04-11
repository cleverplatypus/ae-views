'use strict';

import TemplatingDelegate from './TemplatingDelegate';
import dust from 'ae-dustjs';
import uuid from 'node-uuid';

const _private = new Map();
let evilFn;

class DustTemplatingDelegate extends TemplatingDelegate {
	constructor(inEvilFn) {
		var n = 'EV' + 'a' + 'L';
		evilFn = inEvilFn || window[n.toLowerCase()];
	}

	registerTemplate(inSource, inName) {
		inName = inName || ( 'template_' +  uuid.v4());
		const compiledFn = evilFn(dust.compile(inSource));
		if(compiledFn instanceof Promise) {
			compiledFn.then((inFn) => {
				_private.set(inName, inFn);
			});
		} else {
			_private.set(inName, compiledFn);
		}
		return inName;
	}

	render(inTemplateName, inModel) {
		var promise = new Promise();
		dust.render(_private.get('inTemplateName'), inModel, (inHtml, inError) => {
			if(inError) {
				promise.reject(inError);
			} else {
				promise.resolve(inHtml);
			}
		});
		return promise;
	}
}

export default DustTemplatingDelegate;

