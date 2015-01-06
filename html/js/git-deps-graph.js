var width = 960,
    height = 500;

var color = d3.scale.category20();

var d3cola = cola.d3adaptor()
    .avoidOverlaps(true)
    .size([width, height]);

jQuery(function () {
    draw_graph();
});

function draw_graph () {
    var svg = d3.select("body").append("svg")
        .attr("width", width)
        .attr("height", height);

    svg.append('rect')
        .attr('class', 'background')
        .attr('width', "100%")
        .attr('height', "100%")
        .call(d3.behavior.zoom().on("zoom", redraw));

    var fg = svg.append('g');

    function redraw() {
        fg.attr("transform",
                "translate(" + d3.event.translate + ")" +
                " scale(" + d3.event.scale + ")");
    }

    d3.json("test.json", function (error, graph) {
        var nodeRadius = 5;

        graph.nodes.forEach(function (v) { v.height = v.width = 2 * nodeRadius; });

        d3cola
            .nodes(graph.nodes)
            .links(graph.links)
            .flowLayout("y", 50)
            .symmetricDiffLinkLengths(16)
            .start(10,20,20);

        // define arrow markers for graph links
        fg.append('svg:defs').append('svg:marker')
            .attr('id', 'end-arrow')
            .attr('viewBox', '0 -5 10 10')
            .attr('refX', 6)
            .attr('markerWidth', 3)
            .attr('markerHeight', 3)
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
                .enter().append("rect")
                .attr("class", "node")
                .attr("rx", 5).attr("ry", 5)
                .call(d3cola.drag);

        var label = fg.selectAll(".label")
            .data(graph.nodes)
          .enter().append("text")
            .attr("class", "label")
            .text(function (d) { return d.name; })
            .call(d3cola.drag)
            .each(function (d) {
                var b = this.getBBox();
                var extra = 2 * margin + 2 * pad;
                d.width = b.width + extra;
                d.height = b.height + extra;
            });
        // label.append("title")
        //     .text(function (d) { return d.name; });

        d3cola.on("tick", function () {
            node.each(function (d) { d.innerBounds = d.bounds.inflate(-margin); })
                .attr("x", function (d) { return d.innerBounds.x; })
                .attr("y", function (d) { return d.innerBounds.y; })
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

            label.attr("x", function (d) { return d.x; })
                 .attr("y", function (d) { return d.y; });
        });
        // turn on overlap avoidance after first convergence
        //cola.on("end", function () {
        //    if (!cola.avoidOverlaps()) {
        //        graph.nodes.forEach(function (v) {
        //            v.width = v.height = 10;
        //        });
        //        cola.avoidOverlaps(true);
        //        cola.start();
        //    }
        //});
    });
}

function isIE () {
    return (navigator.appName == 'Microsoft Internet Explorer') ||
            ((navigator.appName == 'Netscape') &&
             (new RegExp("Trident/.*rv:([0-9]{1,}[\.0-9]{0,})").exec(navigator.userAgent)
              != null));
}
