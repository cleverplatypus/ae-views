'use strict';

import $ from 'jquery';
import _ from 'lodash';
import Bus from './Bus';
import Component from './Component';
import Page from './Page';
import ObservableObject from './ObservableObject';
import dustTemplatingDelegate from './delegate/dust-templating-delegate';


let _templatingDelegate;
let _componentConfigPreprocessor;

class PageFactory {
    
    getTemplatingDelegate() {
        return _templatingDelegate;
    }

    setComponentConfigPreProcessor(inFn) {
    	Object.defineProperty(this, 'componentConfigPreprocessor', { 
            get : function() { 
                return inFn;
            }
        });
    }

    page(inConfig, inModel, inSetupFunction) {
    	 _templatingDelegate = inConfig.templatingDelegate || dustTemplatingDelegate(inConfig.evilFunction);
        let page = new Page(inConfig, inModel, inSetupFunction);
        return page;
    }
}


export default new PageFactory();
