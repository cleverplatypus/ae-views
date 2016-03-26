require('document-register-element');
//var bubu = require('babel-regenerator-runtime');
//require("babel-core/register");
//require('babel-polyfill');

import {pagefactory, State} from './src/ae';

import $ from 'jquery';
import _ from 'lodash';
import heydoPufu from './heydo-pufu';

import firebaseDatasource  from './firebase-datasource';
import Firebase from 'firebase';
import eucalyptusDataSource from './eucalyptus-datasource';

const firebase =  new Firebase('https://heydokoala.firebaseio.com');

pagefactory.page({
        name: 'mypage',
        mountPoint: '#mount-here',
        components: [heydoPufu],
        templates: {}
    }, {
        test: {
            pup: 'horray!',
            nyeep: 'gork'
        },
        people : [
        	{
        		name : 'pippo',
        		age : 12
        	},
        	{
        		name : 'pluto',
        		age : 2
        	},
        	{
        		name : 'paperino',
        		age : 66
        	}
        ]
    },
    function() {
        this.addDataSource('koala', firebaseDatasource(firebase));
        this.addDataSource('eucalyptus', eucalyptusDataSource());
        
        this.bus.addAction('flabba', function() {
            alert('gasted!');
        });

        

        this.initialize = function() {
            return new Promise((resolve, reject) => {
                firebase.authAnonymously((error, authData) => {
                    if (error) {
                        console.log("Login Failed!", error);
                    } else {
                        this.fRef = firebase;
                        resolve();
                    }
                });
            });

        }

        this.injectComponent = function(inComponent) {
            inComponent.fRef = this.fRef;
        }

    });
