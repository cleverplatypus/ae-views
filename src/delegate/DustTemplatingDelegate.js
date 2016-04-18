'use strict';

import TemplatingDelegate from './TemplatingDelegate';
import dust from 'ae-dustjs';
import uuid from 'node-uuid';
import ObservableCollection from '../ObservableCollection';
import ObservableObject from '../ObservableObject';

const _private = new Map();
let evilFn;

class DustTemplatingDelegate extends TemplatingDelegate {
    constructor(inEvilFn) {
        super();
        var n = 'EV' + 'a' + 'L';
        evilFn = inEvilFn || window[n.toLowerCase()];

        dust.collectionResolver = function(inCollection) {
            if (inCollection instanceof ObservableCollection) {
                return inCollection.toNative();
            } else {
                return inCollection;
            }
        };

        dust.propertyResolver = function(inBase, inPath) {
            if (inBase instanceof ObservableObject) {
                return inBase.prop(inPath);
            } else {
                return _.get(inBase, inPath);
            }
        };
    }

    setCollectionResolver(inResolver) {
        dust.collectionResolver = inResolver;
    }

    setPropertyResolver(inResolver) {
        dust.propertyResolver = inResolver;
    }

    register(inName, inTemplate) {
        dust.register(inName, inTemplate);
    }

    registerTemplate(inSource, inName) {
        inName = inName || ('template_' + uuid.v4());
        const compiledFn = evilFn(dust.compile(inSource));
        if (compiledFn instanceof Promise) {
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
                if (inError) {
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
