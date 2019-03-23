(function () {

    /**
     * TODO
     * - NEED TO CHECK IF THE GRAPH IS CONNECTED
     * - NEED TO STORE INFO ABOUNT AP NAME, TYPE, REF [OK]
     * - NEED TO SEPARATE INFO FOR SEMANTIC PURPOSE [OK]
     * - IMPLEMENT followPath FUNCTION [OK]
     * - MOVE NODE TEXT INFO INTO THE DEFINITION FROM THE SEMANTIC DEFINITION (LOOK THE PAPAER) [OK]
     * - IMPLEMENT getNodeByAPName AND getNodeByAPType [OK]
     * - RENAME ALL CAP IN AP
     * - DELETE _ref FIELD
     * - TEXT MUST BE AN ARRAYs
     */

    /** RULES FUNCTIONS */
    function connectNum(ApName) {
        return ApName.length;
    }
    function numLoop(ApName) {
        // TODO
    }

    CheckUtil = function (editorUi) {
        this.editorUi = editorUi;
        this.checkUtil = Object();
        this.errors = [];
        this.aliases = [];
        this.allRefMap = {};
        this.rulesGrafRefs = {};
        this.semanticRulesByRef = {};
        this.init();
    }

    CheckUtil.prototype.init = function () { }

    /**
     * Check if the graph respect all the definition and apply the semantic rules
     */
    CheckUtil.prototype.check = function (graph, rules, semanticRules) {
        delete graph[0];
        delete graph[1];
        for (let elem in graph) {
            let graphElem = graph[elem];
            delete graphElem.name
            delete graphElem.semanticProperty
        }
        this.errors = [];

        console.log("%cRules", "color: blue;");
        console.info('graph', graph);
        console.info('rules', rules);
        console.info('semanticRules', semanticRules);

        console.log("#############################################");
        console.log("%cRe-arranging the label...", "color: red;");
        console.group('ARRANGING LABEL');
        this.arrangeLabel(graph);
        console.groupEnd();
        console.log("%cThe label are arranged!", "color: red;");

        console.log("#############################################");

        console.log("%cRemoving the ambiguity...", "color: orange;");
        console.group('REMOVING AMBIGUITY');
        this.removeAmbiguity(graph, rules);
        console.groupEnd();
        console.log("%cThe ambiguity are removed!", "color: orange;");

        console.log("#############################################");

        console.log("%cAppling the rules...", "color: yellow;");
        console.group('APPLING THE RULES');
        this.applyRules(graph, rules);
        console.groupEnd();
        console.log('%cRules applied!', "color: yellow;");

        console.log("#############################################");

        console.log("%cAppling the semantic rules...", "color: green;");
        console.group('APPLING SEMANTIC RULES');

        let semanticRulesByRef = {};
        for (let elem in semanticRules.language.semantic) {
            let semanticRule = semanticRules.language.semantic[elem];
            semanticRulesByRef[semanticRule._ref] = semanticRule;
        }

        // CALCULATING PRIORITY TABLE
        let visitTable = this.getVisitTable(semanticRulesByRef);

        // ORDERIGN ALL THE NODES
        console.group('APPLING VISIT TABLE');
        let orderedGraph = this.applyVisitTable(graph, visitTable);
        console.info('orderedGraph', this.printGraph(orderedGraph));
        console.groupEnd();

        console.log(this.applySemanticRules(orderedGraph, semanticRulesByRef));
        console.groupEnd();
        console.log('%cSemantic rules applied!', "color: green;");

        console.log("#############################################");
        this.printErrors();
    }

    /**
     * Apply the rules/definition to the graph
     */
    CheckUtil.prototype.applyRules = function (graph, rules) {
        let vertexs = this.getNodes(graph);
        let edges = this.getEdges(graph);

        for (let elem in rules.language.token) {
            let tokenRule = rules.language.token[elem];
            let tokenElements = vertexs.filter((vertex) => {
                if (vertex.name == tokenRule._name) return vertex;
            });
            if (!eval(tokenElements.length + tokenRule._occurrences)) {
                this.errors.push({ 'error': `Error! ${tokenRule._name}'occurrances must be ${tokenRule._occurrences}, but is ${tokenElements.length}`, 'elem': tokenRule });
            }
            for (let elem in tokenElements) {
                let tokenElem = tokenElements[elem];
                let tokenState = this.editorUi.editor.graph.view.getState(tokenElem);
                let elemGraphRef = tokenState.shape.stencil.desc.attributes.graphicRef.value;

                if (!!this.rulesGrafRefs[elemGraphRef].localConstraint) {
                    if (!this.checkSymbolLocalConstraint(tokenElem, tokenState)) {
                        this.errors.push({ 'error': `Error! Local Constraint is not respected!`, 'elem': tokenElem });
                        this.changeShapeColor(tokenElem, 'red');
                    }
                }

                let edgesByApName = this.getEdgesByAPName(tokenElem, tokenState);
                for (let elem in tokenRule.ap) {
                    let apRule = tokenRule.ap[elem];
                    if (!eval(edgesByApName[apRule._ref].length + apRule._connectNum)) {
                        this.errors.push({ 'error': `Error! Rules on sybol attacching point are not respected!`, 'elem': tokenElem });
                        this.changeShapeColor(tokenElem, 'red');
                    }
                }
            }
        }
    }

    /**
     * Remove all the ambiguity from the graph
     */
    CheckUtil.prototype.removeAmbiguity = function (graph, rules) {

        let vertexs = this.getNodes(graph);
        let edges = this.getEdges(graph);
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

        for (grafRef in allStencilsGrafRef) {
            this.allRefMap[allStencilsGrafRef[grafRef].graphicRef] = [];
        }
        this.aliases = JSON.parse(JSON.stringify(this.allRefMap));
        for (elem in rules.language.token) {
            let token = rules.language.token[elem];
            this.allRefMap[token._ref].push(token);
        }
        for (elem in rules.language.connector) {
            let connector = rules.language.connector[elem];
            this.allRefMap[connector._ref].push(connector);
        }

        for (let elem in rules.language.token) {
            let token = rules.language.token[elem];
            this.rulesGrafRefs[token._ref] = token;
        }
        for (let elem in rules.language.connector) {
            let token = rules.language.connector[elem];
            this.rulesGrafRefs[token._ref] = token;
        }

        /**
         * collect all the rules by name
         */
        let rulesByName = {};
        for (let elem in rules.language.connector) {
            let connectorRule = rules.language.connector[elem];
            rulesByName[connectorRule._name] = connectorRule
        }
        for (let elem in rules.language.token) {
            let tokenRule = rules.language.token[elem];
            rulesByName[tokenRule._name] = tokenRule
        }

        /**
         * Solve node ambiguity
         */
        check_for: for (let vertex in vertexs) {
            let graphElem = vertexs[vertex];
            let elemState = this.editorUi.editor.graph.view.getState(graphElem);
            this.changeShapeColor(graphElem, 'black');
            let elemGraphRef = elemState.shape.stencil.desc.attributes.graphicRef.value;

            if (this.allRefMap[elemGraphRef].length == 1) {
                graphElem.name = this.allRefMap[elemGraphRef][0]._name;
                console.log(graphElem.id + " is a " + graphElem.name + "!");
                let graphElemRules = rulesByName[graphElem.name];
                graphElem.rules = graphElemRules;
                graphElem.semanticProperty = {};
                if (graphElemRules.text) {
                    if (graphElemRules.text[0]._type && graphElemRules.text[0]._type.charAt(0) == '(') {
                        graphElem.semanticProperty[graphElemRules.text[0]._name] = graphElem.value;
                    } else {
                        graphElem.semanticProperty[graphElemRules.text[0]._name] = graphElem.value;
                    }
                }
                for (let vertex in this.allRefMap[elemGraphRef][0].ap) {
                    let ref = this.allRefMap[elemGraphRef][0].ap[vertex];
                    this.aliases[elemGraphRef][ref._ref] = ref._type;
                }
            } else {
                console.log('Ambiguity detected...\nResolving...');
                let edgesByApName = this.getEdgesByAPName(graphElem, elemState);
                for (let elem in this.allRefMap[elemGraphRef]) {
                    let correct = true;
                    let token = this.allRefMap[elemGraphRef][elem];
                    for (let elem in token.ap) {
                        let ap = token.ap[elem];
                        correct = correct && eval(edgesByApName[ap._ref].length + ap._connectNum);
                    }
                    if (!!this.rulesGrafRefs[elemGraphRef].localConstraint) {
                        correct = correct && this.checkSymbolLocalConstraint(graphElem, elemState);
                    }
                    if (correct) {
                        graphElem.name = token._name;
                        console.log(graphElem.id + " is a " + token._name + "!");
                        let graphElemRules = rulesByName[graphElem.name];
                        graphElem.rules = graphElemRules;
                        graphElem.semanticProperty = {};
                        if (graphElemRules.text) {
                            if (graphElemRules.text[0]._type && graphElemRules.text[0]._type.charAt(0) == '(') {
                                graphElem.semanticProperty[graphElemRules.text[0]._name] = graphElem.value;
                            } else {
                                graphElem.semanticProperty[graphElemRules.text[0]._name] = graphElem.value;
                            }
                        }
                        for (let vertex in this.allRefMap[elemGraphRef][0].ap) {
                            let ref = this.allRefMap[elemGraphRef][0].ap[vertex];
                            this.aliases[elemGraphRef][ref._ref] = ref._type;
                        }
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
            if (this.allRefMap[elemGraphRef].length == 1) {
                graphElem.name = this.allRefMap[elemGraphRef][0]._name;
                let graphElemRules = rulesByName[graphElem.name];
                graphElem.rules = graphElemRules;
                graphElem.semanticProperty = {};
                if (graphElemRules.text) {
                    if (graphElemRules.text[0]._type && graphElemRules.text[0]._type.charAt(0) == '(') {
                        graphElem.semanticProperty[graphElemRules.text[0]._name] = graphElem.value;
                    } else {
                        graphElem.semanticProperty[graphElemRules.text[0]._name] = graphElem.value;
                    }
                }
                console.log(graphElem.id + " is a " + graphElem.name + "!");
            } else {
                console.log('Ambiguity detected...\nResolving...');
                let caps = this.getCapsRefs(graphElem, elemState);
                check: for (let cap in this.allRefMap[elemGraphRef]) {
                    let elemCap = this.allRefMap[elemGraphRef][cap];
                    let myCaps = [elemCap.ap[0]._type, elemCap.ap[1]._type];
                    if (caps.sort()[0] == myCaps.sort()[0] && caps.sort()[1] == myCaps.sort()[1]) {
                        graphElem.name = elemCap._name;
                        console.log(graphElem.id + " is a " + graphElem.name + "!");
                        let graphElemRules = rulesByName[graphElem.name];
                        graphElem.rules = graphElemRules;
                        graphElem.semanticProperty = {};
                        if (graphElemRules.text) {
                            if (graphElemRules.text[0]._type && graphElemRules.text[0]._type.charAt(0) == '(') {
                                graphElem.semanticProperty[graphElemRules.text[0]._name] = graphElem.value;
                            } else {
                                graphElem.semanticProperty[graphElemRules.text[0]._name] = graphElem.value;
                            }
                        }
                        continue check_for;
                    }
                }
                if (!graphElem.name) {
                    this.errors.push({ 'error': 'Impossible to disambigue this edge!', 'elem': graphElem });
                }
                this.errors.push({ 'error': 'This edge is used wrong!', 'elem': graphElem });
            }
        }
    }

    /**
     * Apply the semantic rules to the graph
     */
    CheckUtil.prototype.applySemanticRules = function (graph, semanticRules) {

        let L = Object.assign([], graph);

        // DELETING ALL THE NODES WHICH AREN'T SEMANTIC RULES
        for (let elem in L) {
            let graphElem = L[elem];
            let graphElemSemRule = semanticRules[graphElem.name];

            if (!graphElemSemRule) {
                delete L[elem];
            }
        }

        if (L.length == 0) return true;

        console.group('CALCULATING ALL THE PROPERTIES');
        // CALCULATING ALL THE PROPERTIES

        let loopCounter = 0;

        while (L.length != 0) {

            if (++loopCounter == 100) {
                console.log('loop');
                return false;
            }

            inner: for (let elem in L) {
                let x = L[elem];

                let xRules = semanticRules[x.name];
                let propertyToCalculate = xRules.property.length;

                if (++loopCounter == 100) {
                    console.log('loop');
                    return false;
                }
                let calculatedProperties = this.calculateProperties(x, xRules);
                console.log("CALCULATED: " + calculatedProperties);
                console.log("TO CALCULATE: " + propertyToCalculate);

                if (calculatedProperties == 0) {
                    if (!L[elem + 1]) {
                        return false;
                    } else {
                        continue inner;
                    }
                } else {
                    x.status = "INCOMPLETE";
                    if (calculatedProperties == propertyToCalculate) {
                        console.log("PROPERTY CALCULATION FOR " + x.id + " IS COMPLETATED!");
                        x.status = "COMPLETE";
                        L.shift();
                    }
                }
                console.log(L);
            }
        }
        console.groupEnd();
        return true;
    }

    /**
     * Calulate node properties
     */
    CheckUtil.prototype.calculateProperties = function (node, rules) {
        let calculatedProperties = 0;
        console.group('CALCULATING PROPERTY OF ' + node.id + ": " + node.name);
        console.log("Calculating the properties of: ", node, node.id, rules);
        for (let elem in rules.property) {
            let elemProperty = rules.property[elem];

            if (elemProperty.action) {
                if (this.executeAction(node, elemProperty.action)) {
                    calculatedProperties++;
                }
            } else {
                for (let elem in elemProperty.procedure) {
                    let propertyProcedure = elemProperty.procedure[elem];

                    if (
                        window['CheckUtil']['prototype'][propertyProcedure._name](
                            this,
                            node,
                            elemProperty._name,
                            propertyProcedure._param,
                            propertyProcedure._path,
                            propertyProcedure._postCondition
                        ) != undefined
                    ) {
                        calculatedProperties++;
                    }
                }
            }
        }

        console.groupEnd();
        return calculatedProperties;
    }

    /**
     * Apply the visit table to the graph
     */
    CheckUtil.prototype.applyVisitTable = function (graph, visitTable) {
        let N = Object.values(graph).sort((a, b) => {
            return visitTable[a.name].order - visitTable[b.name].order;
        });

        let L = [];
        let nodes = [];
        while (N.length != 0) {
            let rem = N.shift();
            L.push(rem);
            nodes = this.followPath(rem, graph, N, visitTable, nodes);
            L = L.concat(nodes);
            N = N.filter((i) => {
                return nodes.indexOf(i) < 0;
            });
        }

        L = this.stableSort(L, (a, b) => {
            if (visitTable[a.name].priority > visitTable[b.name].priority) {
                return 1;
            }
            if (visitTable[a.name].priority < visitTable[b.name].priority) {
                return -1;
            }
        });
        return L;
    }

    /**
     * Retrieve components of a path step
     */
    CheckUtil.prototype.scorporatePathStep = function (pathStep) {
        let regex = /(\(#att([a-z]+)\s*=\s*'([a-z]+)'\)::)?(([a-z]+)+|\*)(\[(@[a-z]+)\s*=\s*'([a-z]+)'\])?$/i;
        if (regex.test(pathStep)) {
            let regexApply = pathStep.match(regex);
            return {
                axis: regexApply[1] ? regexApply[1] : "",
                axisProperty: regexApply[2] ? regexApply[2] : "",
                axisValue: regexApply[3] ? regexApply[3] : "",
                nodeToReach: regexApply[4] ? regexApply[4] : "",
                predicate: regexApply[6] ? regexApply[6] : "",
                predicateProperty: regexApply[7] ? regexApply[7] : "",
                predicateValue: regexApply[8] ? regexApply[8] : ""
            }
        } else {
            console.error('Incorrect Path: ' + pathStep);
        }
    }

    /**
     * Resolve path step
     */
    CheckUtil.prototype.resolvePathStep = function (nodes, pathStep) {
        let pathStepElements = this.scorporatePathStep(pathStep);
        console.info('pathStep', pathStep, pathStepElements);

        let selectedElements = [];
        let nodesToReturn = [];

        for (let elem in nodes) {
            let node = nodes[elem];
            console.log(node.id);
            if (node.isEdge()) {
                console.log('RESOLVING EDGE PATH');

                selectedElements.push(node.source);
                selectedElements.push(node.target);
                if (pathStepElements.axis) {
                    selectedElements = [window["CheckUtil"]["prototype"]["getNodeByAP" + pathStepElements.axisProperty](this, node, pathStepElements.axisValue).node];
                }
                if (pathStepElements.nodeToReach) {

                    if (pathStepElements.nodeToReach == '*') {
                        // nodesToReturn = nodesToReturn.concat(selectedElements);
                    } else {
                        selectedElements = selectedElements.filter((elem) => {
                            return elem.name.toUpperCase() == pathStepElements.nodeToReach.toUpperCase()
                        });
                    }
                }
                if (pathStepElements.predicate) {

                    selectedElements = selectedElements.filter((elem) => {
                        return elem.semanticProperty[pathStepElements.predicateProperty.substr(1)] == pathStepElements.predicateValue;
                    });

                }
                console.info('selectedElements', selectedElements);
                nodesToReturn = nodesToReturn.concat(selectedElements);
            } else {
                console.log('RESOLVING NODE PATH');

                let adiacentEdges = node.edges;
                selectedElements = adiacentEdges;
                if (pathStepElements.nodeToReach == '*') {
                    nodesToReturn = nodesToReturn.concat(selectedElements);
                } else {
                    if (pathStepElements.axis) {

                        selectedElements = window["CheckUtil"]["prototype"]["newGetEdgesByAP" + pathStepElements.axisProperty](this, node);
                        selectedElements = selectedElements[pathStepElements.axisValue];
                    }
                    if (pathStepElements.nodeToReach) {

                        selectedElements = selectedElements.filter((elem) => {
                            return elem.name.toUpperCase() == pathStepElements.nodeToReach.toUpperCase()
                        });
                    }
                    if (pathStepElements.predicate) {

                        selectedElements = selectedElements.filter((elem) => {
                            return elem.semanticProperty[pathStepElements.predicateProperty.substr(1)] == pathStepElements.predicateValue;
                        });
                    }
                    nodesToReturn = nodesToReturn.concat(selectedElements);
                }
            }
        }
        return nodesToReturn;
    }

    /**
     * Resolve path
     */
    CheckUtil.prototype.resolvePath = function (node, path) {
        console.group('RESOLVING A PATH FOR: ' + node.id);
        console.info('node, path', node, path);
        let nodes = [];
        nodes = nodes.concat(node);
        let splittedPath = path.split('/');
        for (let elem in splittedPath) {
            let pathStep = splittedPath[elem];
            nodes = this.resolvePathStep(nodes, pathStep);
        }
        console.groupEnd();
        return nodes;
    }

    /**
     * Follow the path from a node
     */
    CheckUtil.prototype.followPath = function (node, G, N, PTPATHS, nodes) {
        let nname = node.name;
        let npaths = PTPATHS[nname].paths;
        for (let elem in npaths) {
            let npath = npaths[elem];
            let nds = this.resolvePath(node, npath._value);
            nds = nds.filter((i) => {
                return nodes.indexOf(i) < 0;
            });
            nds = nds.filter((i) => {
                return N.indexOf(i) > -1;
            });

            if (npath._flag == 'B') {
                nodes = nodes.concat(nds);
            }
            for (let elem in nds) {
                let n = nds[elem];
                if (npath._flag == 'D') {
                    if (nodes.indexOf(n) < 0) {
                        nodes.push(n);
                    }
                }
                nodes = this.followPath(n, G, N, PTPATHS, nodes);
            }
        }
        return nodes;
    }

    /**
     * Get the visit table from the semantic rules
     */
    CheckUtil.prototype.getVisitTable = function (semanticRules) {
        console.log(semanticRules);

        let visits = [];
        for (let elem in semanticRules) {
            let semanticRule = semanticRules[elem];
            if (semanticRule.visit) {
                visits.push({
                    ref: semanticRule._ref,
                    priority: semanticRule.visit._priority,
                    order: semanticRule.visit._order,
                    paths: semanticRule.visit.path
                })
            } else {
                visits.push({
                    ref: semanticRule._ref,
                    priority: 99,
                    order: 99,
                    paths: []
                })
            }
        }

        visits = visits.sort((a, b) => {
            return a.order - b.order
        });

        visitObj = {};
        for (let elem in visits) {
            let visit = visits[elem];
            visitObj[visit.ref] = visit;
        }
        return visitObj;
    }

    /**
     * Get the node by AP Name
     */
    CheckUtil.prototype.getNodeByAPName = function (thos, edge, APName) {
        let APs = thos.getCapsRefsWithNode(edge);

        let capName = edge.rules.ap.find((c) => {
            return c._name.toUpperCase() == APName.toUpperCase();
        })._type;

        return APs.find((elem) => {
            return elem.ref.toUpperCase() == capName.toUpperCase();
        });
    }

    /**
     * Get the node by AP Type
     */
    CheckUtil.prototype.getNodeByAPType = function (thos, edge, APType) {
        let APs = thos.getCapsRefsWithNode(edge);

        return APs.find((elem) => {
            return elem.ref.toUpperCase() == APType.toUpperCase();
        });
    }

    /**
     * Get all the edge collected by AP Name
     */
    CheckUtil.prototype.getEdgesByAPName = function (symbol, symbolState, thos = this) {
        let edges = {};
        for (let elem in symbolState.shape.stencil.constraints) {
            let constraint = symbolState.shape.stencil.constraints[elem];
            edges[constraint.name] = [];
        }
        for (let elem in symbol.edges) {
            let edge = symbol.edges[elem];
            let edgeState = thos.editorUi.editor.graph.view.getState(edge);
            let sourceState = thos.editorUi.editor.graph.view.getState(edge.source);
            let targetState = thos.editorUi.editor.graph.view.getState(edge.target);
            if (edge.source.id == symbol.id) {
                let exitX = edgeState.style.exitX;
                let exitY = edgeState.style.exitY;
                let a = thos.getSymAPConstraintName(sourceState, exitX, exitY);
                edges[a].push(edge);
            } else if (edge.target.id == symbol.id) {
                let entryX = edgeState.style.entryX;
                let entryY = edgeState.style.entryY;
                let b = thos.getSymAPConstraintName(targetState, entryX, entryY);
                edges[b].push(edge);
            }
        }
        return edges;
    }

    /**
     * Get all the edge collected by AP Name
     */
    CheckUtil.prototype.newGetEdgesByAPName = function (thos, symbol) {
        let symbolState = thos.editorUi.editor.graph.view.getState(symbol);

        let edges = {};
        for (let elem in symbolState.shape.stencil.constraints) {
            let constraint = symbolState.shape.stencil.constraints[elem];
            edges[constraint.name] = [];
        }
        for (let elem in symbol.edges) {
            let edge = symbol.edges[elem];
            let edgeState = thos.editorUi.editor.graph.view.getState(edge);
            let sourceState = thos.editorUi.editor.graph.view.getState(edge.source);
            let targetState = thos.editorUi.editor.graph.view.getState(edge.target);
            if (edge.source.id == symbol.id) {
                let exitX = edgeState.style.exitX;
                let exitY = edgeState.style.exitY;
                let a = thos.getSymAPConstraintName(sourceState, exitX, exitY);
                edges[a].push(edge);
            } else if (edge.target.id == symbol.id) {
                let entryX = edgeState.style.entryX;
                let entryY = edgeState.style.entryY;
                let b = thos.getSymAPConstraintName(targetState, entryX, entryY);
                edges[b].push(edge);
            }
        }
        return edges;
    }

    /**
     * Get all the edge collected by AP Type
     */
    CheckUtil.prototype.newGetEdgesByAPType = function (thos, symbol) {
        let edges = {};
        for (let elem in symbol.rules.ap) {
            let constraint = symbol.rules.ap[elem];
            edges[constraint._type] = [];
        }
        for (let elem in symbol.edges) {
            let edge = symbol.edges[elem];
            let edgeState = thos.editorUi.editor.graph.view.getState(edge);

            let sourceState = thos.editorUi.editor.graph.view.getState(edge.source);

            let targetState = thos.editorUi.editor.graph.view.getState(edge.target);

            if (edge.source.id == symbol.id) {
                let exitX = edgeState.style.exitX;
                let exitY = edgeState.style.exitY;
                let a = thos.getSymAPConstraintType(sourceState, exitX, exitY);
                edges[a].push(edge);

            } else if (edge.target.id == symbol.id) {
                let entryX = edgeState.style.entryX;
                let entryY = edgeState.style.entryY;
                let b = thos.getSymAPConstraintType(targetState, entryX, entryY);
                edges[b].push(edge);
            }
        }
        return edges;
    }

    /**
     * get all the occurance of edges on the AP
     */
    CheckUtil.prototype.getOccurranceConstraintByName = function (symbol, symbolState, name) {
        return this.getEdgesByAPName(symbol, symbolState, name).length;
    }

    /**
     * check symbol local contraint
     */
    CheckUtil.prototype.checkSymbolLocalConstraint = function (symbol, symbolState) {
        let elemGraphRef = symbolState.shape.stencil.desc.attributes.graphicRef.value;
        let edgesByApName = this.getEdgesByAPName(symbol, symbolState);
        for (let APName in edgesByApName) {
            window[APName] = edgesByApName[APName];
        }
        return eval(this.rulesGrafRefs[elemGraphRef].localConstraint);
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
     * Get AP constraint type
     */
    CheckUtil.prototype.getSymAPConstraintType = function (symbolState, x, y) {
        let myPoint = new mxPoint(x, y);
        let name = symbolState.shape.stencil.constraints.find((constraint) => {
            return constraint.point.equals(myPoint);
        }).name;
        return this.aliases[symbolState.cell.rules._ref][name];
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
     * Get connector attaching points type, with nodes
     */
    CheckUtil.prototype.getCapsRefsWithNode = function (connector, connectorState) {
        connectorState = connectorState ? connectorState : this.editorUi.editor.graph.view.getState(connector);
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

        return [
            {
                node: connector.source,
                ref: this.aliases[sourceGraphRef][sourceAPConstraintName]
            },
            {
                node: connector.target,
                ref: this.aliases[targetGraphRef][targetAPConstraintName]
            }
        ];
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

    /** SEMANTIC RULES FUNCTIONS */
    CheckUtil.prototype.assign = function (thos, graphElem, propertyName, param, path = "", postCondition = "") {
        if (path) {
            console.log('PATH HERE!');
            let pathResult = thos.resolvePath(graphElem, path)[0];
            if (param.charAt(0) == '#') {
                graphElem.semanticProperty[propertyName] = pathResult[param.slice(1)];
            } else if (param.charAt(0) == '@') {
                graphElem.semanticProperty[propertyName] = pathResult.semanticProperty[param];
            }
        } else {
            graphElem.semanticProperty[propertyName] = param;
        }
        return graphElem.semanticProperty[propertyName]
    }

    CheckUtil.prototype.executeAction = function (graphElem, action) {

        console.log(action);

        return true;
    }

    CheckUtil.prototype.size = function (thos, graphElem, propertyName, param, path = "", postCondition = "") {
        if (path) {
            console.log('PATH HERE!');
            let pathResult = thos.resolvePath(graphElem, path);
            graphElem.semanticProperty[propertyName] = pathResult.length;
        } else {
            graphElem.semanticProperty[propertyName] = param;
        }
        return graphElem.semanticProperty[propertyName];
    }

    CheckUtil.prototype.exist = function (thos, graphElem, propertyName, param, path = "", postCondition = "") {
        if (path) {
            console.log('PATH HERE!');
            let pathResult = thos.resolvePath(graphElem, path);
            graphElem.semanticProperty[propertyName] = !!pathResult.length;
        } else {
            graphElem.semanticProperty[propertyName] = param;
        }
        return graphElem.semanticProperty[propertyName];
    }

    CheckUtil.prototype.add = function (thos, graphElem, propertyName, param, path = "", postCondition = "") {
        if (postCondition) {
            if (path) {
                console.log('PATH HERE!');
                let pathResult = thos.resolvePath(graphElem, path)[0];
                window[propertyName] = [];
                window[propertyName].push(pathResult.semanticProperty[param]);
                if (eval(postCondition)) {
                    graphElem.semanticProperty[propertyName] = [];
                    graphElem.semanticProperty[propertyName].push(pathResult.semanticProperty[param]);
                } else {
                    console.log('postCondition not respected', postCondition);
                }
            } else {
                graphElem.semanticProperty[propertyName] = param;
            }
        } else {
            if (path) {
                console.log('PATH HERE!');
                let pathResult = thos.resolvePath(graphElem, path)[0];
                graphElem.semanticProperty[propertyName] = [];
                graphElem.semanticProperty[propertyName].push(pathResult.semanticProperty[param]);
            } else {
                graphElem.semanticProperty[propertyName].push(param);
            }
        }
        return graphElem.semanticProperty[propertyName].length
    }

    CheckUtil.prototype.addAll = function (thos, graphElem, propertyName, param, path = "", postCondition = "") {
        if (path) {
            console.log('PATH HERE!');
            let pathResult = thos.resolvePath(graphElem, path)[0];
            graphElem.semanticProperty[propertyName] = [];
            graphElem.semanticProperty[propertyName] = graphElem.semanticProperty[propertyName].concat(pathResult.semanticProperty[param]);
        } else {
            graphElem.semanticProperty[propertyName] = graphElem.semanticProperty[propertyName].concat(param);
        }
        return graphElem.semanticProperty[propertyName];
    }

    CheckUtil.prototype.stableSort = function (array, cmp) {
        cmp = !!cmp ? cmp : (a, b) => {
            if (a < b) return -1;
            if (a > b) return 1;
            return 0;
        };
        let stabilizedThis = array.map((el, index) => [el, index]);
        let stableCmp = (a, b) => {
            let order = cmp(a[0], b[0]);
            if (order != 0) return order;
            return a[1] - b[1];
        }
        stabilizedThis.sort(stableCmp);
        for (let i = 0; i < array.length; i++) {
            array[i] = stabilizedThis[i][0];
        }
        return array;
    }

    CheckUtil.prototype.printGraph = function (graph) {
        if (Array.isArray(graph))
            return graph.map((cell) => { return cell.id });
        else
            return Object.keys(graph);
    }

})();