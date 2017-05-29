'use strict';

const isArray = require('lodash.isArray');
const merge = require('lodash.merge');
const mergeWith = require('lodash.mergeWith');
const pageFactory = require('./page-factory');
let _config, _model, _constructorFn;

class MasterPage {

    constructor(inConfig, inModel, inConstructorFn) {
        _config = inConfig;
        _model = inModel;
        _constructorFn = inConstructorFn;
    }

    create(inConfig, inModel, inConstructorFn) {
        //TODO: merge params with template params. wrap constructor

        function customizer(objValue, srcValue) {
            if (isArray(objValue)) {
                return objValue.concat(srcValue);
            }
        }

        const config = {};
        mergeWith(config, _config, inConfig, customizer);

        // const model = {};
        // merge(model, _model, inModel);

        const constructorFn = function() {
            _constructorFn.call(this, config);
            inConstructorFn.call(this);
        };

        return pageFactory.page(config, inModel, constructorFn);
    }
}

export default MasterPage;
