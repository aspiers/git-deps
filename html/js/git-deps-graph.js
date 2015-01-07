var WIDTH   = 960,
    HEIGHT  = 500,
    MARGIN  = 14,   // space in between <rects>
    PADDING =  5,   // space in between <text> label and <rect> border
    EDGE_ROUTING_MARGIN = 3;

var color = d3.scale.category20();

var d3cola = cola.d3adaptor()
    .avoidOverlaps(true)
    .size([WIDTH, HEIGHT]);

var svg, fg;

jQuery(function () {
    draw_graph();
});

function draw_graph () {
    svg = d3.select("body").append("svg")
        .attr("width", WIDTH)
        .attr("height", HEIGHT);

    svg.append('rect')
        .attr('class', 'background')
        .attr('width', "100%")
        .attr('height', "100%")
        .call(d3.behavior.zoom().on("zoom", redraw));

    fg = svg.append('g');

    function redraw() {
        fg.attr("transform",
                "translate(" + d3.event.translate + ")" +
                " scale(" + d3.event.scale + ")");
    }

    d3.json("test.json", function (error, graph) {
        d3cola
            .nodes(graph.nodes)
            .links(graph.links)
            .flowLayout("y", 150)
            .symmetricDiffLinkLengths(30);
            //.jaccardLinkLengths(100);

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

        var path = fg.selectAll(".link")
            .data(graph.links)
          .enter().append('svg:path')
            .attr('class', 'link');

        var node = fg.selectAll(".node")
                .data(graph.nodes)
                .enter().append("g")
                .attr("class", "node")
                .call(d3cola.drag);

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
        // label.append("title")
        //     .text(function (d) { return d.name; });

        rect.attr('width',  function (d, i) { return d.rect_width;  })
            .attr('height', function (d, i) { return d.rect_height; });

        // Centre label
        label.attr("x", function (d) { return d.rect_width  / 2; })
             .attr("y", function (d) { return d.rect_height / 2; });

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

        d3cola.start(10,20,20);

        d3cola.on("tick", function () {
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
        });

        // d3cola.on("end", routeEdges);

        // turn on overlap avoidance after first convergence
        // d3cola.on("end", function () {
        //    if (!d3cola.avoidOverlaps()) {
        //        graph.nodes.forEach(function (v) {
        //            v.width = v.height = 10;
        //        });
        //        d3cola.avoidOverlaps(true);
        //        d3cola.start();
        //    }
        // });
    });
}

function isIE () {
    return (navigator.appName == 'Microsoft Internet Explorer') ||
            ((navigator.appName == 'Netscape') &&
             (new RegExp("Trident/.*rv:([0-9]{1,}[\.0-9]{0,})").exec(navigator.userAgent)
              != null));
}
