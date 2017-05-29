'use strict';

const $ = require('jquery');
const Bus = require('./Bus');
const Component = require('./Component');
const Page = require('./Page');
const ObservableObject = require('./ObservableObject');
const dustTemplatingDelegate = require('./delegate/dust-templating-delegate');


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


module.exports =  new PageFactory();
