require('document-register-element');
require('babel-polyfill');


const ae = require('./AEFactory');
const $ = require('jquery');
const _ = require('lodash');
import State from './State';
const heydoPufu = require('./heydo-pufu');

const firebaseDatasource = require('./firebase-datasource');
const firebase = new(require('firebase'))('https://heydokoala.firebaseio.com');
const eucalyptusDataSource = require('./eucalyptus-datasource');


ae.page({
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

        this.states = new State([
        	'zucca',
        	'barucca'
        ]);

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
