# The list of nodes and links to feed into WebCola.
# These will be dynamically built as we retrieve them via XHR.
nodes = []
links = []

# WebCola requires links to refer to nodes by index within the
# nodes array, so as nodes are dynamically added, we need to
# be able to retrieve their index efficiently in order to add
# links to/from them.  This also allows us to avoid adding the
# same node twice.
node_index = {}

# Track dependencies in a hash of hashes which maps parents to
# children to booleans.  Constraints will be added to try to keep
# siblings at the same y position.  For this we need to track
# siblings, which we do by mapping each parent to an array of its
# siblings in this hash.  It also enables us to deduplicate links
# across multiple XHRs.
deps = {}

# Track dependences in reverse in a hash of hashes which maps children
# to parents to booleans.  This allows us to highlight parents when
# the mouse hovers over a child, and know when we can safely remove
# a commit due to its sole parent being deleted.
rdeps = {}

# Returns 1 iff a node was added, otherwise 0.
add_node = (commit) ->
    if commit.sha1 of node_index
        n = node commit.sha1
        n.explored ||= commit.explored
        return 0

    nodes.push commit
    node_index[commit.sha1] = nodes.length - 1
    return 1

# Returns 1 iff a dependency was added, otherwise 0.
add_dependency = (parent_sha1, child_sha1) ->
    deps[parent_sha1] = {}  unless parent_sha1 of deps

    # We've already got this link, presumably
    # from a previous XHR.
    return 0 if child_sha1 of deps[parent_sha1]
    deps[parent_sha1][child_sha1] = true
    add_link parent_sha1, child_sha1
    return 1

# Returns 1 iff a reverse dependency was added, otherwise 0.
add_rev_dependency = (child_sha1, parent_sha1) ->
    rdeps[child_sha1] = {}  unless child_sha1 of rdeps

    # We've already got this link, presumably
    # from a previous XHR.
    return 0 if parent_sha1 of rdeps[child_sha1]
    rdeps[child_sha1][parent_sha1] = true
    return 1

add_link = (parent_sha1, child_sha1) ->
    pi = node_index[parent_sha1]
    ci = node_index[child_sha1]
    link =
        source: pi
        target: ci
        value: 1 # no idea what WebCola needs this for

    links.push link
    return

# Returns true iff new data was added.
add_data = (data) ->
    new_nodes = 0
    new_deps = 0
    for commit in data.commits
        new_nodes += add_node(commit)

    for dep in data.dependencies
        new_deps += add_dependency(dep.parent, dep.child)
        add_rev_dependency(dep.child, dep.parent)

    if new_nodes > 0 or new_deps > 0
        return [
            new_nodes
            new_deps
            data.query
        ]

    return false

node = (sha1) ->
    i = node_index[sha1]
    unless i?
        console.error "No index for SHA1 '#{sha1}'"
        return null
    return nodes[i]

module.exports =
    # Variables (N.B. if these variables are reinitialised at any
    # point, the values here will become stale and require updating)
    nodes: nodes
    links: links
    node_index: node_index
    deps: deps
    rdeps: rdeps

    # Functions
    add: add_data
    node: node
