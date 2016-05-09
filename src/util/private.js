const registry = new Map();

export default function(inClass) {
    'use strict';
    if (!registry.exists(inClass)) {
        const map = new WeakMap();
        registry.set(inClass, map);
    }
    return registry.get(inClass);
}
