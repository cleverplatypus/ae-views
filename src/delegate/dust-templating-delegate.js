'use strict';

import TemplatingDelegate from './TemplatingDelegate';
import dust from 'ae-dustjs';
import uuid from 'node-uuid';
import ObservableCollection from '../ObservableCollection';
import ObservableObject from '../ObservableObject';

const _templates = new Map();
let evilFn;

class DustTemplatingDelegate extends TemplatingDelegate {
    constructor(inEvilFn) {
        super();
        var n = 'EV' + 'a' + 'L';
        evilFn = inEvilFn || window[n.toLowerCase()];
        dust.helpers.nempty = function(chunk, context, bodies, params) {
            if (context.stack.head instanceof ObservableCollection && context.stack.head.length) {
                chunk.render(bodies.block, context);
            }

            return chunk;
        };

        // const oldGt = dust.helpers.gt;
        // dust.helpers.gt = function(chunk, context, bodies, params) {
        //     console.log(oldGt);
        //        debugger;
        //         return chunk;
        // };

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
            } else if (inBase instanceof ObservableCollection && inPath === 'length') {
                return inBase.length;
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
        _templates.set(inName, inTemplate)
        dust.register(inName, inTemplate);
    }

    registerTemplate(inSource, inName) {
        inName = inName || ('template_' + uuid.v4());
        const compiledSrc = dust.compile(inSource).replace(/\bdust\b/g, '');

        const compiledFn = evilFn(compiledSrc);
        if (compiledFn instanceof Promise) {
            compiledFn.then((inFn) => {
                _templates.set(inName, inFn);
            });
        } else {
            _templates.set(inName, compiledFn);
        }
        return inName;
    }

    render(inTemplateName, inModel) {
        const template = _templates.get(inTemplateName);
        if (!template) {
            return Promise.reject(`DustTemplatingDelegate: Template with name ${inTemplateName} not found`);
        }
        var promise = new Promise((resolve, reject) => {
            dust.render(template, inModel, (inError, inHtml) => {
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
let instance;

export default function(inEvilFn) {
    return (instance ? instance : (instance = new DustTemplatingDelegate(inEvilFn)));
}
