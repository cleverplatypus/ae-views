'use strict';
import _ from 'lodash';
import pageFactory from './PageFactory';
let _config, _model, _constructorFn

class PageTemplate {

    constructor(inConfig, inModel, inConstructorFn) {
        _config = inConfig;
        _model = inModel;
        _constructorFn = inConstructorFn;
    }

    extend(inConfig, inModel, inConstructorFn) {
        //TODO: merge params with template params. wrap constructor

        function customizer(objValue, srcValue) {
            if (_.isArray(objValue)) {
                return objValue.concat(srcValue);
            }
        }

        const config = {};
        _.mergeWith(config, _config, inConfig, customizer);

        const model = {};
        _.merge(model, _model, inModel);

        const constructorFn = function() {
            _constructorFn.call(this);
            inConstructorFn.call(this);
        };

        return pageFactory.page(config, model, constructorFn);
    }
}

export default PageTemplate;
