'use strict';

import $ from 'jquery';
import _ from 'lodash';
import Bus from './Bus';
import Component from './Component';
import Page from './Page';
import ObservableObject from './ObservableObject';


class PageFactory {
    
    page(inConfig, inModel, inSetupFunction) {
        this.page = new Page(inConfig, inModel, inSetupFunction);
        this.page.factory = this;
        
        return this.page;
    }
}


export default new PageFactory();
