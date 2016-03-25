'use strict';

const ObservableObject = require('./dist/ObservableObject');

var ob = ObservableObject.fromObject({ z : 'adsfadsfds'});
ob.watch('**', function(inPath, inChanges) {
	console.log('emitted: ' + inPath);
    console.log(JSON.stringify(inChanges));
    console.log(inChanges.newValue);
});

ob.prop('a.b.c.d', {});

ob.prop('a.q', []);
ob.prop('x.b.c.d', {});

setTimeout(function() {
    ob.prop('a.b.c', 'criceto');
}, 100);

setTimeout(function() {
    ob.prop('a.d.e', 'cagnaccio');
}, 300);

