var width = 960,
    height = 500;

var color = d3.scale.category20();

var d3cola = cola.d3adaptor()
    .avoidOverlaps(true)
    .size([width, height]);

var svg, fg;

jQuery(function () {
    draw_graph();
});

function draw_graph () {
    svg = d3.select("body").append("svg")
        .attr("width", width)
        .attr("height", height);

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

        var margin = 10, pad = 5;
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
                var extra = 2 * margin;
                d.width = b.width + extra;
                d.height = b.height + extra;
            });
        // label.append("title")
        //     .text(function (d) { return d.name; });

        rect.attr('width',  function (d, i) { return d.width; })
            .attr('height', function (d, i) { return d.height; });

        var lineFunction = d3.svg.line()
            .x(function (d) { return d.x; })
            .y(function (d) { return d.y; })
            .interpolate("linear");

        var routeEdges = function () {
            d3cola.prepareEdgeRouting(margin/3);
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
            node.each(function (d) { d.innerBounds = d.bounds.inflate(-margin); })
                .attr("transform", function (d) {
                    return "translate(" +
                        d.innerBounds.x + "," +
                        d.innerBounds.y + ")";
                })
                .attr("width",  function (d) { return d.innerBounds.width(); })
                .attr("height", function (d) { return d.innerBounds.height(); });

            path.each(function (d) {
                if (isIE()) this.parentNode.insertBefore(this, this);
            });
            path.attr("d", function (d) {
                cola.vpsc.makeEdgeBetween(
                    d,
                    d.source.innerBounds,
                    d.target.innerBounds,
                    5  // distance of arrow tip from object it points at
                );
                var lineData = [
                    { x: d.sourceIntersection.x, y: d.sourceIntersection.y },
                    { x: d.arrowStart.x, y: d.arrowStart.y }
                ];
                return lineFunction(lineData);
            });

            label.attr("x", function (d) { return d.bounds.width() / 2; })
                 .attr("y", function (d) { return d.bounds.height() / 2; });
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
