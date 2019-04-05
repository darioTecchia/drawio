/**
 * convert an edgelist in this format [["a", "b"], ...] in an adjacent list
 * @param {Array[]} edgelist edgelist in the format [["a", "b"], ...]
 */
function convert_edgelist_to_adjlist(edgelist) {
    var adjlist = {};
    var i, len, pair, u, v;
    for (i = 0, len = edgelist.length; i < len; i += 1) {
        pair = edgelist[i];
        u = pair[0];
        v = pair[1];
        if (adjlist[u]) {
            adjlist[u].push(v);
        } else {
            adjlist[u] = [v];
        }
        if (adjlist[v]) {
            adjlist[v].push(u);
        } else {
            adjlist[v] = [u];
        }
    }
    return adjlist;
};

/**
 * Breadth-First Search using adjacent list
 * @param {string} sourceNode sourceNode
 * @param {*} adjlist ajacent list
 * @param {string[]} visited visited nodes
 */
var bfs = function (sourceNode, adjlist, visited) {
    var q = [];
    var current_group = [];
    var i, len, adjV, nextVertex;
    q.push(sourceNode);
    visited[sourceNode] = true;
    while (q.length > 0) {
        sourceNode = q.shift();
        current_group.push(sourceNode);
        adjV = adjlist[sourceNode];
        for (i = 0, len = adjV.length; i < len; i += 1) {
            nextVertex = adjV[i];
            if (!visited[nextVertex]) {
                q.push(nextVertex);
                visited[nextVertex] = true;
            }
        }
    }
    return current_group;
};

/**
 * Find all the connected components in a graph
 * @param {Graph} G graph
 */
function allComponents(G) {
    var groups = [];
    var visited = {};
    var v;

    let edges = [];
    for (let e in G) {
        let elem = G[e];
        if (elem.isEdge()) {
            edges.push(elem)
        }
    }

    let edges_ids = edges.map((edge) => {
        return [
            edge.source.id,
            edge.target.id
        ]
    });

    var adjlist = convert_edgelist_to_adjlist(edges_ids);

    for (v in adjlist) {
        if (adjlist.hasOwnProperty(v) && !visited[v]) {
            groups.push(bfs(v, adjlist, visited));
        }
    }
    return groups;
}

/**
 * Check if a graph is connected
 * @param {Graph} G graph
 */
function isConnected(G) {
    let nodes = [];
    for (let e in G) {
        let elem = G[e];
        if (elem.isVertex()) {
            nodes.push(elem)
        }
    }

    for (let e in nodes) {
        let elem = nodes[e];
        if (!!!elem.edges) return false
    }
    return allComponents(G).length == 1;
}