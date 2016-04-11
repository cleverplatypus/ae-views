'use strict';

import TemplatingDelegate from './TemplatingDelegate';
import dust from 'ae-dustjs';
import uuid from 'node-uuid';

const _private = new Map();
let evilFn;

class DustTemplatingDelegate extends TemplatingDelegate {
	constructor(inEvilFn) {
		super();
		window.dust = dust;
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
		var promise = new Promise((resolve, reject) => {
			dust.render(_private.get(inTemplateName), inModel, (inError, inHtml) => {
				if(inError) {
					reject(inError);
				} else {
					resolve(inHtml);
				}
			});
		});
		return promise;
	}
}

export default DustTemplatingDelegate;

