'use strict';

import $ from 'jquery';
import Element from './ae-element';
import dust from 'ae-dustjs';

export default function render(inPage) {
    const _page = inPage;
    var proto = Object.create(Element.prototype);

    var render = function render() {
        const templateName = $(this).attr('template');
        var attrs = _.transform(this.attributes, function(result, item) {
            item.specified && /^param-/.test(item.name) && (result[item.name.replace('param-', '')] = item.value);
        }, {});

        var compiled = dust.compile('cippirimerlo: {world}');
        var tmpl = dust.loadSource(compiled);
        dust.render(tmpl, { world: attrs['world'] }, (err, out) => {
            $(this).find('>.ae-render-container').html(out);
        });
    };
    proto.createdCallback = function() {
        $(this).append('<div class="ae-render-container"></div>');
    };

    proto.attachedCallback = function() {
        render.bind(this)();
        var observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (/^param-/.test(mutation.attributeName)) {
                    render.bind(this)();
                }
            });
        });

        // configuration of the observer:
        var config = { attributes: true };

        // pass in the target node, as well as the observer options
        observer.observe(this, config);


    };

    proto.detachedCallback = function() {

    };

    document.registerElement('ae-render', { prototype: proto });
};
