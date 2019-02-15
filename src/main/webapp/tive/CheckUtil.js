(function () {

    CheckUtil = function (editorUi) {
        this.editorUi = editorUi;
        this.checkUtil = Object();
        this.init();
    }

    CheckUtil.prototype.init = function () {

    }

    CheckUtil.prototype.applyRules = function (graph, rules) {
        delete graph[0];
        delete graph[1];
        this.arrangeLabel(graph);
        this.removeAmbiguity(graph);
    }

    CheckUtil.prototype.applySemanticRules = function (graph, semanticRules) {
        
    }

    CheckUtil.prototype.removeAmbiguity = function (graph) {

    }

    /**
     * arrange all the labels by put the label's value in the edge's value
     */
    CheckUtil.prototype.arrangeLabel = function (graph) {

        let nodes = this.getNodes(graph);

        this.editorUi.editor.graph.model.beginUpdate();

        nodes.forEach(node => {
            if ((node.style.indexOf('text;') == 0) && node.parent.isEdge()) {
                node.parent.setValue(node.value);
                this.editorUi.editor.graph.removeCells(new Array(node))
            }
        });

        this.editorUi.editor.graph.model.endUpdate();
    }

    /**
     * get all the nodes from the graph
     */
    CheckUtil.prototype.getNodes = function (graph) {
        let nodes = [];

        nodes = Object.values(graph).filter((element) => {
            // elements 0 and 1 are to ignore
            return element.isVertex();
        });

        return nodes;
    }

    /**
     * get all the edges from the graph
     */
    CheckUtil.prototype.getEdges = function (graph) {
        let edges = [];

        edges = Object.values(graph).filter((element) => {
            // elements 0 and 1 are to ignore
            return element.isEdge();
        });

        return edges;
    }

})();