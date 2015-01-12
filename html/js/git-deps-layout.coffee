dagre = require "dagre"

gdd = require "./git-deps-data.coffee"

# The list of constraints to feed into WebCola.
constraints = []

# Group nodes by row, as assigned by the y coordinates returned from
# dagre's layout().  This will map a y coordinate onto all nodes
# within that row.
row_groups = {}

# Expose a container for externally accessible objects.  We can't
# directly expose the objects themselves because the references
# change each time they're constructed.  However we don't need this
# trick for the constraints arrays since we can easily empty that by
# setting length to 0.
externs = {}

dagre_layout = ->
    g = new dagre.graphlib.Graph()
    externs.graph = g

    # Set an object for the graph label
    g.setGraph {}

    # Default to assigning a new object as a label for each new edge.
    g.setDefaultEdgeLabel -> {}

    for node in gdd.nodes
        g.setNode node.sha1,
            label: node.name
            width: node.rect_width or 70
            height: node.rect_height or 30

    for parent_sha1, children of gdd.deps
        for child_sha1, bool of children
            g.setEdge parent_sha1, child_sha1

    dagre.layout g
    return g

dagre_row_groups = ->
    g = dagre_layout()
    row_groups = {}
    externs.row_groups = row_groups
    for sha1 in g.nodes
        x = g.node(sha1).x
        y = g.node(sha1).y
        row_groups[y] = []  unless y of row_groups
        row_groups[y].push
            sha1: sha1
            x: x
    return row_groups

build_constraints = ->
    row_groups = dagre_row_groups()

    constraints.length = 0 # FIXME: only rebuild constraints which changed

    # We want alignment constraints between all nodes which dagre
    # assigned the same y value.
    for y, row_nodes of row_groups
        # No point having an alignment group with only one node in.
        if row_nodes.length > 1
            constraints.push build_alignment_constraint(row_nodes)

    # We also need separation constraints ensuring that the
    # top-to-bottom ordering assigned by dagre is preserved.  Since
    # all nodes within a single row are already constrained to the
    # same y coordinate from above, it should be enough to only
    # have separation between a single node in adjacent rows.
    row_y_coords = Object.keys(row_groups).sort()

    i = 0
    while i < row_y_coords.length - 1
        upper_y = row_y_coords[i]
        lower_y = row_y_coords[i + 1]
        upper_node = row_groups[upper_y][0]
        lower_node = row_groups[lower_y][0]
        constraints.push
            gap: 30
            axis: "y"
            left: gdd.node_index[upper_node.sha1]
            right: gdd.node_index[lower_node.sha1]

        i++

build_alignment_constraint = (row_nodes) ->
    constraint =
        axis: "y"
        type: "alignment"
        offsets: []

    for i of row_nodes
        node = row_nodes[i]
        constraint.offsets.push
            node: gdd.node_index[node.sha1]
            offset: 0

    return constraint

node = (sha1) ->
    externs.graph.node sha1

module.exports =
    # Variables
    constraints: constraints
    g: externs

    # Functions
    build_constraints: build_constraints
    node: node
