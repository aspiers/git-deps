var $ = require('jquery');
var dagre = require('dagre');

var gdd = require('./git-deps-data');

// The list of constraints to feed into WebCola.
var constraints = [];

// Group nodes by row, as assigned by the y coordinates returned from
// dagre's layout().  This will map a y coordinate onto all nodes
// within that row.
var row_groups = {};

// Expose a container for externally accessible objects.  We can't
// directly expose the objects themselves because the references
// change each time they're constructed.  However we don't need this
// trick for the constraints arrays since we can easily empty that by
// setting length to 0.
var externs = {};

function dagre_layout() {
    var g = new dagre.graphlib.Graph();
    externs.graph = g;

    // Set an object for the graph label
    g.setGraph({});

    // Default to assigning a new object as a label for each new edge.
    g.setDefaultEdgeLabel(function() { return {}; });

    $.each(gdd.nodes, function (i, node) {
        g.setNode(node.sha1, {
            label: node.name,
            width: node.rect_width || 70,
            height: node.rect_height || 30
        });
    });

    $.each(gdd.deps, function (parent_sha1, children) {
        $.each(children, function (child_sha1, bool) {
            g.setEdge(parent_sha1, child_sha1);
        });
    });

    dagre.layout(g);

    return g;
}

function dagre_row_groups() {
    var g = dagre_layout();

    var row_groups = {};
    externs.row_groups = row_groups;

    g.nodes().forEach(function (sha1) {
        var x = g.node(sha1).x;
        var y = g.node(sha1).y;
        if (! (y in row_groups)) {
            row_groups[y] = [];
        }
        row_groups[y].push({
            sha1: sha1,
            x: x
        });
    });
    return row_groups;
}

function build_constraints() {
    var row_groups = dagre_row_groups();

    constraints.length = 0;  // FIXME: only rebuild constraints which changed

    // We want alignment constraints between all nodes which dagre
    // assigned the same y value.
    for (var y in row_groups) {
        var row_nodes = row_groups[y];
        // No point having an alignment group with only one node in.
        if (row_nodes.length > 1) {
            constraints.push(build_alignment_constraint(row_nodes));
        }
    }

    // We also need separation constraints ensuring that the
    // top-to-bottom ordering assigned by dagre is preserved.  Since
    // all nodes within a single row are already constrained to the
    // same y coordinate from above, it should be enough to only
    // have separation between a single node in adjacent rows.
    var row_y_coords = Object.keys(row_groups).sort();
    for (var i = 0; i < row_y_coords.length - 1; i++) {
        var upper_y = row_y_coords[i];
        var lower_y = row_y_coords[i+1];
        var upper_node = row_groups[upper_y][0];
        var lower_node = row_groups[lower_y][0];
        constraints.push({
            gap: 30,
            axis: 'y',
            left: gdd.node_index[upper_node.sha1],
            right: gdd.node_index[lower_node.sha1]
        });
    }
}

function build_alignment_constraint(row_nodes) {
    constraint = {
        axis: 'y',
        type: 'alignment',
        offsets: [],
    };
    for (var i in row_nodes) {
        var node = row_nodes[i];
        constraint.offsets.push({
            node: gdd.node_index[node.sha1],
            offset: 0
        });
    }
    return constraint;
}

module.exports = {
    // Variables
    constraints: constraints,
    g: externs,

    // Functions
    build_constraints: build_constraints
};
