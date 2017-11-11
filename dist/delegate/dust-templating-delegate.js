'use strict';

const TemplatingDelegate = require('./TemplatingDelegate');
const dust = require('dustjs-linkedin');
const uuid = require('node-uuid');
const ObservableObject = require('../ObservableObject');
const get = require('lodash.get');
const each = require('lodash.foreach');
const result = require('lodash.result');
const isFunction = require('lodash.isfunction');
const merge = require('lodash.merge');
const dustHelpers = require('./dust-helpers');
dustHelpers(dust);
const _templates = new Map();
let globalContext;

class DustTemplatingDelegate extends TemplatingDelegate {
    constructor() {
        super();
    }

    logLevel(inLevel) {
        dust.logLevel = inLevel || 'ERROR';
        return this;
    }

    getTemplate(inName) {
        return {
            render(inModel, inParams) {
                return this.render(inName, inModel, inParams);
            }
        };
    }

    updateGlobalContext(inData) {
        globalContext = globalContext || {};
        merge(globalContext,  inData);
    }

    registerExtensions(inExtensions) {
        globalContext = globalContext || {};
        merge(globalContext,  get(inExtensions, 'globalContext'));

        each(get(inExtensions, 'filters'), (inFilter, inName) => {
            dust.filters[inName] = inFilter;
        });
        each(get(inExtensions, 'helpers'), (inHelper, inName) => {
            dust.helpers[inName] = inHelper;
        });
        return this;
    }


    register(inName, inTemplate) {
        _templates.set(inName, inTemplate);
        dust.register(inName, inTemplate);
        return this;
    }


    registerTemplate(inSource, inName) {
        inName = inName || ('template_' + uuid.v4());
        const compiledSrc = dust.compile(inSource).replace(/\bdust\b/g, '');

        const compiledFn = eval(compiledSrc);//jshint ignore:line
        if (compiledFn instanceof Promise) {
            compiledFn.then((inFn) => {
                _templates.set(inName, inFn);
            });
        } else {
            _templates.set(inName, compiledFn);
        }
        return inName;
    }

    render(inTemplateName, inModel, inParams) {
        const template = _templates.get(inTemplateName);
        if (!template) {
            return Promise.reject(`DustTemplatingDelegate: Template with name ${inTemplateName} not found`);
        }
        let model;

        var promise = new Promise((resolve, reject) => {
            const render = () => {
                const glob = isFunction(globalContext) ? globalContext() : (globalContext || {});
                let context = dust.makeBase(glob);
                if (inParams) {
                    context = context.push(inParams);
                }
                context = context.push(model);
                dust.render(template, context, handler);
            };

            const handler = function(inError, inHtml) {
                if (inError) {
                    reject(inError);
                } else {
                    resolve(inHtml);
                }
            };

            if (inModel instanceof ObservableObject) {
                //always resolving lazy properties
                //TODO: make lazy properties resolution optional
                inModel.toNative( true).then((inModel) => {
                    model = inModel;
                    render();
                });
            } else {
                model = inModel;
                render();
            }

        });
        return promise;
    }
}
let instance;

module.exports =  new DustTemplatingDelegate();
