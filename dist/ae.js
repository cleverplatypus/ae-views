'use strict';

window.LOG = window.LOG || window.console;


const Component = require('./Component');
const Page = require('./Page');
const State = require('./State');
const pagefactory = require('./page-factory');
const TemplatingDelegate = require('./delegate/TemplatingDelegate');
const MasterPage = require('./MasterPage');
const ObservableObject = require('./ObservableObject');
const UNRESOLVED = require('./symbol/unresolved');
const ComponentModel = require('./ComponentModel');


export {ComponentModel, Component, Page, State, pagefactory, TemplatingDelegate, MasterPage, ObservableObject, UNRESOLVED};
