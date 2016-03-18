'use strict';

const ObservableObject = require('./ObservableObject');

var ob = ObservableObject.fromObject({ z : 'adsfadsfds'});
ob.watch('**', function(inPath, inChanges) {
	console.log('emitted: ' + inPath);
    console.log(JSON.stringify(inChanges));
});

ob.prop('a.b.c.d', {});

ob.prop('a.b', {});
ob.prop('x.b.c.d', {});

setTimeout(function() {
    ob.prop('a.b.c', 'criceto');
}, 100);

setTimeout(function() {
    ob.prop('a.d.e', 'cagnaccio');
}, 300);

