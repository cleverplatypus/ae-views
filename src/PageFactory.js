'use strict';

import $ from 'jquery';
import _ from 'lodash';
import Bus from './Bus';
import Component from './Component';
import Page from './Page';
import ObservableObject from './ObservableObject';


class PageFactory {
    constructor() {}

    component(inConfig, inModelPrototype, inSetupFunction) {
        return this.page.registerComponent(inConfig, inModelPrototype, inSetupFunction);
    }

    page(inConfig, inModel, inSetupFunction) {
        this.page = new Page(inConfig, inModel, inSetupFunction);
        this.page.factory = this;
        
        // $(() => {
        //     _.isFunction(this.page.ready) && this.page.ready(); //jshint ignore:line
        //     lang(this.page);
        // });
        return this.page;
    }
}


export default new PageFactory();
