'use strict';

const $ = require('jquery');
const _ = require('lodash');
import Bus from './Bus';
const Component = require('./Component');
const Page = require('./Page');
const ObservableObject = require('./ObservableObject');


class Binda {
    constructor() {}

    component(inName, inModelPrototype, inSetupFunction) {
        return this.page.registerComponent(inName, inModelPrototype, inSetupFunction);
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

let ae = new Binda();
module.exports = ae;
