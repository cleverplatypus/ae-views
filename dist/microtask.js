'use strict';

var root = window;

var defer, Observer;

if (root.process && typeof root.process.nextTick === 'function') {
    /* avoid buggy nodejs setImmediate */
    if (root.setImmediate && root.process.versions.node.split('.')[1] > '10') {
        defer = root.setImmediate;
    } else {
        defer = root.process.nextTick;
    }
} else if (root.vertx && typeof root.vertx.runOnLoop === 'function') {
    defer = root.vertx.RunOnLoop;
} else if (root.vertx && typeof root.vertx.runOnContext === 'function') {
    defer = root.vertx.runOnContext;
} else if ((Observer = root.MutationObserver || root.WebKitMutationObserver)) {
    defer = (function(document, Observer, drain) {
        var el = document.createElement('div');
        new Observer(drain).observe(el, {
            attributes: true
        });
        return function() {
            el.setAttribute('x', 'y');
        };
    }(document, Observer, drain));
} else if (typeof root.setTimeout === 'function' && (root.ActiveXObject || !root.postMessage)) {
    /* use setTimeout to avoid buggy IE MessageChannel */
    defer = function(f) {
        root.setTimeout(f, 0);
    };
} else if (root.MessageChannel && typeof root.MessageChannel === 'function') {
    var fifo = [],
        channel = new root.MessageChannel();
    channel.port1.onmessage = function() {
        (fifo.shift())();
    };
    defer = function(f) {
        fifo[fifo.length] = f;
        channel.port2.postMessage(0);
    };
} else if (typeof root.setTimeout === 'function') {
    defer = function(f) {
        root.setTimeout(f, 0);
    };
} else {
    throw new Error('no candidate for defer');
}

let queue = [],
    length = 0; //jshint ignore:line

function microtask(func, args, ctx, err) {
    if (!length) {
        defer(drain);
    }

    queue[length++] = [func, args, ctx, err];
}

function drain() {
    var q = queue,
        l = length;

    queue = [];
    length = 0;

    for (var i = 0; i < l; i++) {
        try {
            q[i][0].apply(q[i][2], q[i][1]);
        } catch (err) {
            if (typeof q[i][3] === 'function') {
                q[i][3](err);
            } else {
                throw err;
            }
        }
    }
}


module.exports = microtask;
