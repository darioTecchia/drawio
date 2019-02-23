(function () {

    CheckUtil = function (editorUi) {
        this.editorUi = editorUi;
        this.checkUtil = Object();
        // this.getState = this.editorUi.editor.graph.view.getState;
        this.errors = [];
        this.aliases = [];
        this.init();
    }

    CheckUtil.prototype.init = function () { }

    CheckUtil.prototype.applyRules = function (graph, rules) {
        for(let elem in graph) {
            let graphElem = graph[elem];
            delete graphElem.name
        }
        this.errors = [];
        delete graph[0];
        delete graph[1];
        this.arrangeLabel(graph);
        this.removeAmbiguity(graph, rules);
    }

    CheckUtil.prototype.applySemanticRules = function (graph, semanticRules) {
        // TODO
    }

    CheckUtil.prototype.removeAmbiguity = function (graph, rules) {
        let vertexs = this.getNodes(graph);
        let edges = this.getEdges(graph);
        console.log(vertexs, edges, rules, this.editorUi);
        let parser = new DOMParser();

        let stencils = localStorage.getItem('STENCIL');
        let stencilsXML = parser.parseFromString(stencils, 'application/xml');

        let connectors = localStorage.getItem('CONNECTOR');
        let connectorsXML = parser.parseFromString(connectors, 'application/xml');

        let shapesCollection = Array.from(stencilsXML.getElementsByTagName('shape'));
        let connectorsCollection = Array.from(connectorsXML.getElementsByTagName('connector'));

        let allStencilsGrafRef = shapesCollection.map((elem) => {
            return {
                'graphicRef': elem.getAttribute('graphicRef'),
                'name': elem.getAttribute('name')
            };
        }).concat(connectorsCollection.map((elem) => {
            return {
                'graphicRef': elem.getAttribute('graphicRef'),
                'name': 'Line'
            };
        }));

        let rulesGrafRefs = rules.language.token.map((elem) => {
            return {
                'graphicRef': elem._ref,
                'name': elem._name
            }
        }).concat(rules.language.connector.map((elem) => {
            return {
                'graphicRef': elem._ref,
                'name': elem._name
            }
        }));

        let allRefMap = {};
        for (grafRef in allStencilsGrafRef) {
            allRefMap[allStencilsGrafRef[grafRef].graphicRef] = []
        }
        this.aliases = JSON.parse(JSON.stringify(allRefMap));
        for (elem in rules.language.token) {
            let token = rules.language.token[elem];
            allRefMap[token._ref].push(token);
        }
        for (elem in rules.language.connector) {
            let connector = rules.language.connector[elem];
            allRefMap[connector._ref].push(connector);
        }

        /**
         * Solve node ambiguity
         */
        check_for: for (let vertex in vertexs) {
            let graphElem = vertexs[vertex];
            let elemState = this.editorUi.editor.graph.view.getState(graphElem);
            this.changeShapeColor(graphElem, 'black');

            let elemGraphRef = elemState.shape.stencil.desc.attributes.graphicRef.value;
            if (allRefMap[elemGraphRef].length == 1) {
                graphElem.name = allRefMap[elemGraphRef][0]._name;
                console.log(graphElem.value + " is a " + graphElem.name + "!");
                for (let vertex in allRefMap[elemGraphRef][0].ap) {
                    let ref = allRefMap[elemGraphRef][0].ap[vertex];
                    this.aliases[elemGraphRef][ref._ref] = ref._type;
                }
            } else {
                console.log('Ambiguity detected...\nResolving...');
                let edgesByApName = this.getEdgesByAPName(graphElem, elemState);
                console.log(edgesByApName);
                for (let elem in allRefMap[elemGraphRef]) {
                    let correct = true;
                    let token = allRefMap[elemGraphRef][elem];
                    for (let elem in token.ap) {
                        let ap = token.ap[elem];
                        correct = correct && eval(edgesByApName[ap._ref].length + ap._connectNum);
                    }
                    if (correct) {
                        graphElem.name = token._name;
                        console.log(graphElem.value + " is a " + token._name + "!");
                        continue check_for;
                    }
                }
                if (!graphElem.name) {
                    this.errors.push({ 'error': 'Impossible to disambigue this node!', 'elem': graphElem });
                }
            }
        }

        /**
         * Solve edges ambiguity
         */
        check_for: for (let edge in edges) {
            let graphElem = edges[edge];
            let elemState = this.editorUi.editor.graph.view.getState(graphElem);
            this.changeShapeColor(graphElem, 'black');

            let elemGraphRef = elemState.style.graphicRef;
            if (graphElem.source == graphElem.target)
                this.errors.push({ 'error': 'Loop', 'elem': graphElem });
            if (graphElem.source == null || graphElem.target == null)
                this.errors.push({ 'error': 'Edge with null attaching point!', 'elem': graphElem });
            if (allRefMap[elemGraphRef].length == 1) {
                graphElem.name = allRefMap[elemGraphRef][0]._name;
                console.log(graphElem.value + " is a " + graphElem.name + "!");
            } else {
                console.log('Ambiguity detected...\nResolving...');
                let caps = this.getCapsRefs(graphElem, elemState);
                check: for (let cap in allRefMap[elemGraphRef]) {
                    let elemCap = allRefMap[elemGraphRef][cap];
                    let myCaps = [elemCap.cap[0]._type, elemCap.cap[1]._type];
                    if (caps.sort()[0] == myCaps.sort()[0] && caps.sort()[1] == myCaps.sort()[1]) {
                        graphElem.name = elemCap._name;
                        console.log(graphElem.value + " is a " + graphElem.name + "!");
                        continue check_for;
                    }
                }
                if (!graphElem.name) {
                    this.errors.push({ 'error': 'Impossible to disambigue this edge!', 'elem': graphElem });
                }
                this.errors.push({ 'error': 'This edge is used wrong!', 'elem': graphElem });
            }
        }

        this.printErrors();
    }

    CheckUtil.prototype.getEdgesByAPName = function (symbol, symbolState, APName) {
        let edges = {};
        for (let elem in symbolState.shape.stencil.constraints) {
            let constraint = symbolState.shape.stencil.constraints[elem];
            edges[constraint.name] = [];
        }
        for (let elem in symbol.edges) {
            let edge = symbol.edges[elem];
            let edgeState = this.editorUi.editor.graph.view.getState(edge);
            let sourceState = this.editorUi.editor.graph.view.getState(edge.source);
            let targetState = this.editorUi.editor.graph.view.getState(edge.target);
            if (edge.source.id == symbol.id) {
                let exitX = edgeState.style.exitX;
                let exitY = edgeState.style.exitY;
                let a = this.getSymAPConstraintName(sourceState, exitX, exitY);
                edges[a].push(edge);
            } else if (edge.target.id == symbol.id) {
                let entryX = edgeState.style.entryX;
                let entryY = edgeState.style.entryY;
                let b = this.getSymAPConstraintName(targetState, entryX, entryY);
                edges[b].push(edge);
            }
        }
        return edges;
    }

    CheckUtil.prototype.getOccurranceConstraintByName = function (symbol, symbolState, name) {
        return this.getEdgesByAPName(symbol, symbolState, name).length;
    }

    /**
     * Get AP constraint name
     */
    CheckUtil.prototype.getSymAPConstraintName = function (symbolState, x, y) {
        let myPoint = new mxPoint(x, y);
        return symbolState.shape.stencil.constraints.find((constraint) => {
            return constraint.point.equals(myPoint);
        }).name;
    }

    /**
     * Get shape attaching points type
     */
    CheckUtil.prototype.getSymbolAPsType = function (shape) {

    }

    /**
     * Get connector attaching points type
     */
    CheckUtil.prototype.getCapsRefs = function (connector, connectorState) {
        let sourceState = this.editorUi.editor.graph.view.getState(connector.source);
        let targetState = this.editorUi.editor.graph.view.getState(connector.target);

        let exitX = connectorState.style.exitX;
        let exitY = connectorState.style.exitY;

        let entryX = connectorState.style.entryX;
        let entryY = connectorState.style.entryY;

        let sourceAPConstraintName = this.getSymAPConstraintName(sourceState, exitX, exitY);
        let targetAPConstraintName = this.getSymAPConstraintName(targetState, entryX, entryY);

        let sourceGraphRef = sourceState.shape.stencil.desc.attributes.graphicRef.value;
        let targetGraphRef = targetState.shape.stencil.desc.attributes.graphicRef.value;

        return [this.aliases[sourceGraphRef][sourceAPConstraintName], this.aliases[targetGraphRef][targetAPConstraintName]];

    }

    /**
     * Print all the errors
     */
    CheckUtil.prototype.printErrors = function () {
        for (elem in this.errors) {
            let error = this.errors[elem];
            this.changeShapeColor(error.elem, 'red');
            console.error(`Problem occurred in ${error.elem.value}, ID: ${error.elem.id}\nError: ${error.error}`);
        }
    }

    /**
     * Get the errors
     */
    CheckUtil.prototype.getErrors = function () {
        return this.errors;
    }

    /**
     * Change the border color of a shape
     */
    CheckUtil.prototype.changeShapeColor = function (shape, color) {
        let style = this.editorUi.editor.graph.getModel().getStyle(shape);
        let newStyle = mxUtils.setStyle(style, mxConstants.STYLE_STROKECOLOR, color);
        let cs = new Array();
        cs[0] = shape;
        this.editorUi.editor.graph.setCellStyle(newStyle, cs);
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
            return element.isEdge();
        });
        return edges;
    }

})();