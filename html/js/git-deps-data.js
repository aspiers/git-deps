var $ = require('jquery');

// The list of nodes and links to feed into WebCola.
// These will be dynamically built as we retrieve them via XHR.
var nodes = [], links = [];

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

// Returns 1 iff a node was added, otherwise 0.
function add_node(commit) {
    if (commit.sha1 in node_index) {
        return 0;
    }
    nodes.push(commit);
    node_index[commit.sha1] = nodes.length - 1;
    return 1;
}

// Returns 1 iff a dependency was added, otherwise 0.
function add_dependency(parent_sha1, child_sha1) {
    if (! (parent_sha1 in deps)) {
        deps[parent_sha1] = {};
    }
    if (child_sha1 in deps[parent_sha1]) {
        // We've already got this link, presumably
        // from a previous XHR.
        return 0;
    }

    deps[parent_sha1][child_sha1] = true;

    add_link(parent_sha1, child_sha1);

    return 1;
}

function add_link(parent_sha1, child_sha1) {
    var pi = node_index[parent_sha1];
    var ci = node_index[child_sha1];

    var link = {
        source: pi,
        target: ci,
        value: 1   // no idea what WebCola needs this for
    };

    links.push(link);
}

// Returns true iff new data was added.
function add_data(data) {
    var new_nodes = 0, new_deps = 0;
    $.each(data.commits, function (i, commit) {
        new_nodes += add_node(commit);
    });
    $.each(data.dependencies, function (i, dep) {
        new_deps += add_dependency(dep.parent, dep.child);
    });

    if (new_nodes > 0 || new_deps > 0) {
        return [new_nodes, new_deps, data.root];
    }

    return false;
}

function node(sha1) {
    var i = node_index[sha1];
    if (! i) {
        console.error("No index for SHA1 '" + sha1 + "'");
        return null;
    }
    return nodes[i];
}

module.exports = {
    // Variables
    nodes: nodes,
    links: links,
    node_index: node_index,
    deps: deps,

    // Functions
    add: add_data,
    node: node
};
