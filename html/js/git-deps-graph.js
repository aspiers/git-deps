var WIDTH   = 960,
    HEIGHT  = 800,
    MARGIN  = 14,   // space in between <rects>
    PADDING =  5,   // space in between <text> label and <rect> border
    EDGE_ROUTING_MARGIN = 3;

var color = d3.scale.category20();

var d3cola = cola.d3adaptor()
    .avoidOverlaps(true)
    .size([WIDTH, HEIGHT]);

var cola_initialized = false;

// The list of nodes, links, and constraints to feed into WebCola.
// These will be dynamically built as we retrieve them via XHR.
var nodes = [], links = [], constraints = [];

// WebCola requires links to refer to nodes by index within the
// nodes array, so as nodes are dynamically added, we need to
// be able to retrieve their index efficiently in order to add
// links to/from them.  This also allows us to avoid adding the
// same node twice.
var node_index = {};

// Constraints will be added to try to keep siblings at the same y
// position.  For this we need to track siblings, which we do by
// mapping each parent to an array of its siblings in this hash.
// It also enables us to deduplicate links across multiple XHRs.
var deps = {};

// d3 visualization elements.  Kept global to aid in-browser debugging.
var svg, fg, node, path, tip, tip_template;

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

function redraw_on_zoom() {
    fg.attr("transform",
            "translate(" + d3.event.translate + ")" +
            " scale(" + d3.event.scale + ")");
}

// Returns 1 iff a link was added, otherwise 0.
function add_node(commit) {
    if (commit.sha1 in node_index) {
        return 0;
    }
    nodes.push(commit);
    node_index[commit.sha1] = nodes.length - 1;
    return 1;
}

// Returns 1 iff a link was added, otherwise 0.
function add_link(parent_sha1, child_sha1) {
    var pi = node_index[parent_sha1];
    var ci = node_index[child_sha1];

    var link = {
        source: pi,
        target: ci,
        value: 1   // no idea what WebCola needs this for
    };

    if (! (parent_sha1 in deps)) {
        deps[parent_sha1] = {};
    }
    if (child_sha1 in deps[parent_sha1]) {
        // We've already got this link, presumably
        // from a previous XHR.
        return 0;
    }

    deps[parent_sha1][child_sha1] = true;
    links.push(link);
    return 1;
}

function build_constraints() {
    constraints = [];  // FIXME: only rebuild constraints which changed
    for (var parent_sha1 in deps) {
        constraints.push(build_constraint(parent_sha1));
    }
}

function build_constraint(parent_sha1) {
    constraint = {
        axis: 'x',
        type: 'alignment',
        offsets: [],
        parent: parent_sha1
    };
    for (var child_sha1 in deps[parent_sha1]) {
        constraint.offsets.push({
            node: node_index[child_sha1],
            offset: 0
        });
    }
    return constraint;
}

// Returns true iff new data was added.
function add_data(data) {
    var new_nodes = 0, new_links = 0;
    $.each(data.commits, function (i, commit) {
        new_nodes += add_node(commit);
    });
    $.each(data.dependencies, function (i, dep) {
        new_links += add_link(dep.parent, dep.child);
    });

    if (new_nodes > 0 || new_links > 0) {
        build_constraints();
        return [new_nodes, new_links, data.root];
    }

    return false;
}

function add_commitish(commitish) {
    if (! svg) {
        init_svg();
    }
    draw_graph(commitish);
}

function init_svg() {
    svg = d3.select("body").append("svg")
        .attr("width", WIDTH)
        .attr("height", HEIGHT);

    svg.append('rect')
        .attr('class', 'background')
        .attr('width', "100%")
        .attr('height', "100%")
        .call(d3.behavior.zoom().on("zoom", redraw_on_zoom));

    fg = svg.append('g');
}

function init_cola() {
    if (cola_initialized)
        return;

    d3cola
        .nodes(nodes)
        .links(links)
        .flowLayout("y", 150)
        .symmetricDiffLinkLengths(30);
        //.jaccardLinkLengths(100);

    define_arrow_markers(fg);

    cola_initialized = true;
}

function draw_graph(commitish) {
    d3.json("deps.json/" + commitish, function (error, data) {
        var new_data = add_data(data);

        init_cola();

        if (! new_data) {
            noty_warn('No new commits or dependencies found!');
            return;
        }

        new_data_notification(new_data);

        path = fg.selectAll(".link")
            .data(links, link_key)
          .enter().append('svg:path')
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
    var new_links = new_data[1];
    var root      = new_data[2];

    var notification =
            '<span class="commit-ref">' +
            root.commitish +
            '</span> resolved as ' + root.sha1;

    notification += "<p>" + new_nodes + " new node";
    if (new_nodes != 1)
        notification += 's';
    notification += "; " + new_links + " new link";
    if (new_nodes != 1)
        notification += 's';
    notification += '</p>';

    noty_info(notification);
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
            d.width  = d.rect_width  + 2 * MARGIN;
            d.height = d.rect_height + 2 * MARGIN;
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
        d.innerBounds = d.bounds.inflate(-MARGIN);
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
