'use strict';

import TemplatingDelegate from './TemplatingDelegate';
import dust from 'ae-dustjs';
import uuid from 'node-uuid';
import ObservableObject from '../ObservableObject';
import get from 'lodash.get';
import each from 'lodash.foreach';
import result from 'lodash.result';
import isFunction from 'lodash.isfunction';

import dustHelpers from './dust-helpers';
dustHelpers(dust);
const _templates = new Map();
let evilFn;
let globalContext;

class DustTemplatingDelegate extends TemplatingDelegate {
    constructor(inEvilFn) {
        super();
        var n = 'EV' + 'a' + 'L';
        evilFn = inEvilFn || window[n.toLowerCase()];

        dust.collectionResolver = function(inCollection) {
            if (inCollection instanceof ObservableObject && inCollection.isCollection) {
                return inCollection.toNative();
            } else {
                return inCollection;
            }
        };

        dust.propertyResolver = function(inBase, inPath) {
            if (inBase instanceof ObservableObject) {
                if (inBase.isCollection && inPath === 'length') {
                    return inBase.length;
                } else {
                    return inBase.prop(inPath);
                }
            } else {
                return get(inBase, inPath);
            }
        };


    }

    registerExtensions(inExtensions) {
        globalContext = get(inExtensions, 'globalContext');

        each(get(inExtensions, 'filters'), (inFilter, inName) => {
            dust.filters[inName] = inFilter;
        });
        each(get(inExtensions, 'helpers'), (inHelper, inName) => {
            dust.helpers[inName] = inHelper;
        });
    }

    setCollectionResolver(inResolver) {
        dust.collectionResolver = inResolver;
    }

    setPropertyResolver(inResolver) {
        dust.propertyResolver = inResolver;
    }

    register(inName, inTemplate) {
        _templates.set(inName, inTemplate);
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
            if (inModel instanceof ObservableObject) {
                inModel = inModel.toNative(true);
            }
            const handler = function(inError, inHtml) {
                if (inError) {
                    reject(inError);
                } else {
                    resolve(inHtml);
                }
            };

            const glob = isFunction(globalContext) ? globalContext() : ( globalContext || {});
            const context = dust.makeBase(glob).push(inModel);

            dust.render(template, context, handler);
        });
        return promise;
    }
}
let instance;

export default function(inEvilFn) {
    return (instance ? instance : (instance = new DustTemplatingDelegate(inEvilFn)));
}
