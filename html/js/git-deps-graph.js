var SVG_MARGIN = 2,  // space around <svg>, matching #svg-container border
    RECT_MARGIN = 14,  // space in between <rects>
    PADDING =  5,  // space in between <text> label and <rect> border
    EDGE_ROUTING_MARGIN = 3;

var svg_width  = 960, old_svg_width,
    svg_height = 800, old_svg_height;

var color = d3.scale.category20();

var d3cola = cola.d3adaptor();
d3cola
    .flowLayout("y", 150)
    .linkDistance(60)
    //.symmetricDiffLinkLengths(30)
    //.jaccardLinkLengths(100);
    .avoidOverlaps(true);

// d3 visualization elements.  Kept global to aid in-browser debugging.
var container, svg, fg, node, path, tip, tip_template;
var zoom;

// Options will be retrieved from web server
var options;

jQuery(function () {
    d3.json('options', function (error, data) {
        options = data;
    });

    d3.html('tip-template.html', function (error, html) {
        tip_template = html;
    });

    //setup_default_form_values();
    $('form.commitish').submit(function (event) {
        event.preventDefault();
        add_commitish($('.commitish input').val());
    });
});

function setup_default_form_values() {
    $('input[type=text]').each(function () {
        $(this).val($(this).attr('defaultValue'));
        $(this).css({color: 'grey'});
    }).focus(function () {
        if ($(this).val() == $(this).attr('defaultValue')){
            $(this).val('');
            $(this).css({color: 'black'});
        }
    })
    .blur(function () {
        if ($(this).val() == '') {
            $(this).val($(this).attr('defaultValue'));
            $(this).css({color: 'grey'});
        }
    });
}

function resize_window() {
    calculate_svg_size_from_container();
    console.log("new size: " + svg_width + "x" + svg_height);
    fit_svg_to_container();
    redraw(true);
}

function redraw(transition) {
    // if mouse down then we are dragging not panning
    // if (nodeMouseDown)
    //     return;
    (transition ? fg.transition() : fg)
        .attr("transform",
              "translate(" + zoom.translate() + ")" +
              " scale(" + zoom.scale() + ")");
}

function graph_bounds() {
    var x = Number.POSITIVE_INFINITY,
        X = Number.NEGATIVE_INFINITY,
        y = Number.POSITIVE_INFINITY,
        Y = Number.NEGATIVE_INFINITY;
    fg.selectAll(".node").each(function (d) {
        x = Math.min(x, d.x - d.width / 2);
        y = Math.min(y, d.y - d.height / 2);
        X = Math.max(X, d.x + d.width / 2);
        Y = Math.max(Y, d.y + d.height / 2);
    });
    return { x: x, X: X, y: y, Y: Y };
}

function fit_svg_to_container() {
    svg.attr("width", svg_width).attr("height", svg_height);
}

function full_screen_cancel() {
    svg_width = old_svg_width;
    svg_height = old_svg_height;
    fit_svg_to_container();
    //zoom_to_fit();
    resize_window();
}

function full_screen_click() {
    fullScreen(container[0][0], full_screen_cancel);
    fit_svg_to_container();
    resize_window();
    //zoom_to_fit();
}

function zoom_to_fit() {
    var b = graph_bounds();
    var w = b.X - b.x, h = b.Y - b.y;
    var cw = svg.attr("width"), ch = svg.attr("height");
    var s = Math.min(cw / w, ch / h);
    var tx = -b.x * s + (cw/s - w) * s/2,
        ty = -b.y * s + (ch/s - h) * s/2;
    zoom.translate([tx, ty]).scale(s);
    redraw(true);
}

function add_commitish(commitish) {
    if (! svg) {
        init_svg();
    }
    draw_graph(commitish);
}

function calculate_svg_size_from_container() {
    old_svg_width = svg_width;
    old_svg_height = svg_height;
    svg_width  = container[0][0].offsetWidth  - SVG_MARGIN;
    svg_height = container[0][0].offsetHeight - SVG_MARGIN;
}

function init_svg() {
    container = d3.select('#svg-container');
    calculate_svg_size_from_container();
    svg = container.append('svg')
        .attr('width', svg_width)
        .attr('height', svg_height);
    d3cola.size([svg_width, svg_height]);

    d3.select(window).on('resize', resize_window);

    zoom = d3.behavior.zoom();

    svg.append('rect')
        .attr('class', 'background')
        .attr('width', "100%")
        .attr('height', "100%")
        .call(zoom.on("zoom", redraw))
        .on('dblclick.zoom', zoom_to_fit);

    fg = svg.append('g');
    define_arrow_markers(fg);
}

function update_cola() {
    d3cola
        .nodes(nodes)
        .links(links)
        .constraints(constraints);
}

function draw_graph(commitish) {
    d3.json("deps.json/" + commitish, function (error, data) {
        if (error) {
            var details = JSON.parse(error.responseText);
            noty_error(details.message);
            return;
        }

        var new_data = add_data(data);

        if (! new_data) {
            noty_warn('No new commits or dependencies found!');
            return;
        }

        update_cola();

        new_data_notification(new_data);

        path = fg.selectAll(".link")
            .data(links, link_key);

        path.enter().append('svg:path')
            .attr('class', 'link');

        node = fg.selectAll(".node")
            .data(nodes, function (d) {
                return d.sha1;
            })
          .call(d3cola.drag);

        node.enter().append("g")
            .attr("class", "node");

        draw_nodes(fg, node);
    });
}

// Required for object constancy: http://bost.ocks.org/mike/constancy/ ...
function link_key(link) {
    var source = sha1_of_link_pointer(link.source);
    var target = sha1_of_link_pointer(link.target);
    var key = source + " " + target;
    return key;
}

// ... but even though link sources and targets are initially fed in
// as indices into the nodes array, webcola then replaces the indices
// with references to the node objects.  So we have to deal with both
// cases when ensuring we are uniquely identifying each link.
function sha1_of_link_pointer(pointer) {
    if (typeof(pointer) == 'object')
        return pointer.sha1;
    return nodes[pointer].sha1;
}

function new_data_notification(new_data) {
    var new_nodes = new_data[0];
    var new_deps  = new_data[1];
    var root      = new_data[2];

    var notification =
            '<span class="commit-ref">' +
            root.commitish +
            '</span> resolved as ' + root.sha1;

    notification += "<p>" + new_nodes + " new commit" +
        ((new_nodes == 1) ? '' : 's');
    notification += "; " + new_deps + " new " +
        ((new_nodes == 1) ? 'dependency' : 'dependencies');
    notification += '</p>';

    noty_success(notification);
}

function define_arrow_markers(fg) {
    // define arrow markers for graph links
    fg.append('svg:defs').append('svg:marker')
        .attr('id', 'end-arrow')
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 6)
        .attr('markerWidth', 8)
        .attr('markerHeight', 8)
        .attr('orient', 'auto')
      .append('svg:path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', '#000');
}

function draw_nodes(fg, node) {
    // Initialize tooltip
    tip = d3.tip().attr('class', 'd3-tip').html(tip_html);
    fg.call(tip);
    hide_tip_on_drag = d3cola.drag().on('dragstart', tip.hide);
    node.call(hide_tip_on_drag);

    var rect = node.append("rect")
        .attr("rx", 5).attr("ry", 5);

    var label = node.append("text")
        .text(function (d) { return d.name; })
        .each(function (d) {
            var b = this.getBBox();
            // Calculate width/height of rectangle from text bounding box.
            d.rect_width  = b.width  + 2 * PADDING;
            d.rect_height = b.height + 2 * PADDING;
            // Now set the node width/height as used by cola for
            // positioning.  This has to include the margin
            // outside the rectangle.
            d.width  = d.rect_width  + 2 * RECT_MARGIN;
            d.height = d.rect_height + 2 * RECT_MARGIN;
        });

    position_nodes(rect, label, tip);
}

function position_nodes(rect, label, tip) {
    rect.attr('width',  function (d, i) { return d.rect_width;  })
        .attr('height', function (d, i) { return d.rect_height; })
        .on('mouseover', tip.show)
        .on('mouseout',  tip.hide);

    // Centre label
    label
        .attr("x", function (d) { return d.rect_width  / 2; })
        .attr("y", function (d) { return d.rect_height / 2; })
        .on('mouseover', tip.show)
        .on('mouseout',  tip.hide);

    d3cola.start(10,20,20);

    d3cola.on("tick", tick_handler);

    // d3cola.on("end", routeEdges);

    // turn on overlap avoidance after first convergence
    // d3cola.on("end", function () {
    //    if (!d3cola.avoidOverlaps()) {
    //        nodes.forEach(function (v) {
    //            v.width = v.height = 10;
    //        });
    //        d3cola.avoidOverlaps(true);
    //        d3cola.start();
    //    }
    // });
}

function tip_html(d) {
    var fragment = $(tip_template).clone();
    var title = fragment.find("p.commit-title");
    title.text(d.title);
    if (d.describe != "") {
        title.append("  <span />");
        var describe = title.children().first();
        describe.addClass("commit-describe commit-ref").text(d.describe);
    }
    fragment.find("span.commit-author").text(d.author_name);
    var date = new Date(d.author_time * 1000);
    fragment.find("time.commit-time")
        .attr('datetime', date.toISOString())
        .text(date);
    var pre = fragment.find(".commit-body pre").text(d.body);

    if (options.debug) {
        var index = node_index[d.sha1];
        var debug = "node index: " + index;
        $.each(constraints, function (i, constraint) {
            if (constraint.parent == d.sha1) {
                var siblings = $.map(constraint.offsets,
                                     function (offset, i) {
                                         return offset.node;
                                     });
                debug += "<br />constrained children: " + siblings.join(", ");
            }
        });
        pre.after(debug);
    }

    // Javascript *sucks*.  There's no way to get the outerHTML of a
    // document fragment, so you have to wrap the whole thing in a
    // single parent and then look that up via children[0].
    return fragment[0].children[0].outerHTML;
}

function tick_handler() {
    node.each(function (d) {
        // cola sets the bounds property which is a Rectangle
        // representing the space which other nodes should not
        // overlap.  The innerBounds property seems to tell
        // cola the Rectangle which is the visible part of the
        // node, minus any blank margin.
        d.innerBounds = d.bounds.inflate(-RECT_MARGIN);
    });

    node.attr("transform", function (d) {
        return "translate(" +
            d.innerBounds.x + "," +
            d.innerBounds.y + ")";
    });

    path.each(function (d) {
        if (isIE()) this.parentNode.insertBefore(this, this);
    });
    path.attr("d", function (d) {
        // Undocumented: https://github.com/tgdwyer/WebCola/issues/52
        cola.vpsc.makeEdgeBetween(
            d,
            d.source.innerBounds,
            d.target.innerBounds,
            // This value is related to but not equal to the
            // distance of arrow tip from object it points at:
            5
        );
        var lineData = [
            { x: d.sourceIntersection.x, y: d.sourceIntersection.y },
            { x: d.arrowStart.x, y: d.arrowStart.y }
        ];
        return lineFunction(lineData);
    });
}

var lineFunction = d3.svg.line()
    .x(function (d) { return d.x; })
    .y(function (d) { return d.y; })
    .interpolate("linear");

var routeEdges = function () {
    d3cola.prepareEdgeRouting(EDGE_ROUTING_MARGIN);
    path.attr("d", function (d) {
        return lineFunction(d3cola.routeEdge(d)
            // // show visibility graph
            //, function (g) {
            //    if (d.source.id === 10 && d.target.id === 11) {
            //        g.E.forEach(function (e) {
            //            vis.append("line").attr("x1", e.source.p.x).attr("y1", e.source.p.y)
            //                .attr("x2", e.target.p.x).attr("y2", e.target.p.y)
            //                .attr("stroke", "green");
            //        });
            //    }
            // }));
        );
    });
    if (isIE()) {
        path.each(function (d) {
            this.parentNode.insertBefore(this, this);
        });
    }
};

function isIE() {
    return (navigator.appName == 'Microsoft Internet Explorer') ||
            ((navigator.appName == 'Netscape') &&
             (new RegExp("Trident/.*rv:([0-9]{1,}[\.0-9]{0,})").exec(navigator.userAgent)
              != null));
}
