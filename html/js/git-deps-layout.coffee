DEBUG = false

MIN_ROW_GAP = 60
MIN_NODE_X_GAP = 100  # presumably includes the node width
MAX_NODE_X_GAP = 300
MAX_NODE_Y_GAP = 80

dagre = require "dagre"

gdd = require "./git-deps-data.coffee"

# The list of constraints to feed into WebCola.
constraints = []

# Group nodes by row, as assigned by the y coordinates returned from
# dagre's layout().  This will map a y coordinate onto all nodes
# within that row.
row_groups = {}

debug = (msg) ->
    if exports.debug
        console.log msg

dagre_layout = ->
    g = new dagre.graphlib.Graph()
    exports.graph = g

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
    exports.row_groups = row_groups
    for sha1 in g.nodes()
        x = g.node(sha1).x
        y = g.node(sha1).y
        row_groups[y] = []  unless y of row_groups
        row_groups[y].push
            sha1: sha1
            x: x

    for y, nodes of row_groups
        nodes.sort (n) -> -n.x

    return row_groups

build_constraints = ->
    row_groups = dagre_row_groups()
    debug "build_constraints"
    for y, row_nodes of row_groups
        debug y
        debug row_nodes

    constraints.length = 0 # FIXME: only rebuild constraints which changed

    # We want alignment constraints between all nodes which dagre
    # assigned the same y value.
    #row_alignment_constraints(row_groups)

    # We need separation constraints ensuring that the left-to-right
    # ordering within each row assigned by dagre is preserved.
    for y, row_nodes of row_groups
        # No point having an alignment group with only one node in.
        continue if row_nodes.length <= 1

        # Multiple constraints per row.
        debug "ordering for row y=#{y}"
        row_node_ordering_constraints(row_nodes)
    debug_constraints()

    # We need separation constraints ensuring that the top-to-bottom
    # ordering assigned by dagre is preserved.  Since all nodes within
    # a single row are already constrained to the same y coordinate
    # from above, one would have hoped it would be enough to only have
    # separation between a single node in adjacent rows:
    #
    # row_ordering_constraints(row_groups)

    # However, due to https://github.com/tgdwyer/WebCola/issues/61
    # there is more flexibility for y-coordinates within a row than we
    # want, so instead we order rows using dependencies.
    dependency_ordering_constraints()

debug_constraints = (cs = constraints) ->
    for c in cs
        debug c
    return

row_alignment_constraints = (row_groups) ->
    row_alignment_constraint(row_nodes) \
        for y, row_nodes of row_groups when row_nodes.length > 1

row_alignment_constraint = (row_nodes) ->
    debug 'row_alignment_constraint'
    # A standard alignment constraint (one per row) is too strict
    # because it doesn't give cola enough "wiggle room":
    #
    #   constraint =
    #       axis: "y"
    #       type: "alignment"
    #       offsets: []
    #
    #   for node in row_nodes
    #       constraint.offsets.push
    #           node: gdd.node_index[node.sha1],
    #           offset: 0
    #
    #   constraints.push constraint
    #
    # So instead we use vertical min/max separation constraints:
    i = 0
    while i < row_nodes.length - 1
        left  = row_nodes[i]
        right = row_nodes[i+1]
        mm = max_unordered_separation_constraints \
            'y', MAX_NODE_Y_GAP,
            gdd.node_index[left.sha1],
            gdd.node_index[right.sha1]
        exports.constraints = constraints = constraints.concat mm
        i++
    debug_constraints()
    return

row_node_ordering_constraints = (row_nodes) ->
    debug 'row_node_ordering_constraints'
    i = 0
    while i < row_nodes.length - 1
        left  = row_nodes[i]
        right = row_nodes[i+1]
        left_i  = gdd.node_index[left.sha1]
        right_i = gdd.node_index[right.sha1]
        debug "  #{left_i} < #{right_i} (#{left.x} < #{right.x})"
        # mm = min_max_ordered_separation_constraints \
        #     'x', MIN_NODE_X_GAP, MAX_NODE_X_GAP, left_i, right_i
        min = min_separation_constraint \
            'x', MIN_NODE_X_GAP, left_i, right_i
        exports.constraints = constraints = constraints.concat min
        i++
    return

row_ordering_constraints = (row_groups) ->
    debug 'row_ordering_constraints'
    row_y_coords = Object.keys(row_groups).sort()

    i = 0
    while i < row_y_coords.length - 1
        upper_y = row_y_coords[i]
        lower_y = row_y_coords[i + 1]
        upper_node = row_groups[upper_y][0]
        lower_node = row_groups[lower_y][0]
        constraints.push \
            min_separation_constraint \
                'y', MIN_ROW_GAP,
                gdd.node_index[upper_node.sha1],
                gdd.node_index[lower_node.sha1]

        i++
    debug_constraints()
    return

dependency_ordering_constraints = () ->
    debug 'dependency_ordering_constraints'

    for parent_sha1, children of gdd.deps
        child_sha1s = Object.keys(children).sort (sha1) -> node(sha1).x
        dependency_ordering_constraint(parent_sha1, child_sha1s[0])
        len = child_sha1s.length
        if len > 1
            dependency_ordering_constraint(parent_sha1, child_sha1s[len-1])
        if len > 2
            middle = Math.floor(len / 2)
            dependency_ordering_constraint(parent_sha1, child_sha1s[middle])

    debug_constraints()
    return

dependency_ordering_constraint = (parent_sha1, child_sha1) ->
    constraints.push \
        min_separation_constraint \
        'y', MIN_ROW_GAP,
        gdd.node_index[parent_sha1],
        gdd.node_index[child_sha1]

##################################################################
# helpers

# Uses approach explained here:
# https://github.com/tgdwyer/WebCola/issues/62#issuecomment-69571870
min_max_ordered_separation_constraints = (axis, min, max, left, right) ->
    return [
        min_separation_constraint(axis, min, left, right),
        max_separation_constraint(axis, max, left, right)
    ]

# https://github.com/tgdwyer/WebCola/issues/66
max_unordered_separation_constraints = (axis, max, left, right) ->
    return [
        max_separation_constraint(axis, max, left, right),
        max_separation_constraint(axis, max, right, left)
    ]

min_separation_constraint = (axis, gap, left, right) ->
    {} =
        axis: axis
        gap: gap
        left: left
        right: right

# We use a negative gap and reverse the inequality, in order to
# achieve a maximum rather than minimum separation gap.  However this
# does not prevent the nodes from overlapping or even swapping order.
# For that you also need a min_separation_constraint, but it's more
# convenient to use min_max_ordered_separation_constraints.  See
# https://github.com/tgdwyer/WebCola/issues/62#issuecomment-69571870
# for more details.
max_separation_constraint = (axis, gap, left, right) ->
    {} =
        axis: axis
        gap: -gap
        left: right
        right: left

node = (sha1) ->
    exports.graph.node sha1

module.exports = exports =
    # Variables have to be exported every time they're assigned,
    # since assignment creates a new object and associated reference

    # Functions
    build_constraints: build_constraints
    debug_constraints: debug_constraints
    node: node

    # Variables
    debug: DEBUG
