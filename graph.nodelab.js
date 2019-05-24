class NodeLabGraph extends NodeLabExtension {
    init(params) {
        this.name = "NodeLab Graph";
        this.nodes = {};
        this.nodeUID = 0;
        this.actions = params.on;
        this.selecting = false;
        this.selected = [];
        this.multiSelect = false;
        this.id = params.id || 'nodelab-graph-' + this.nodelab.uid();
        this.components = params.components ? this.registerComponents(params.components) : {};
        if (this.parent.graphs) this.parent.graphs.push(this);

        this.select = {start: {x: 0, y: 0}, x: 0, y: 0, width: 0, height: 0};
        this.element = this.createElement('div', {classes: ['graph', 'noselect'], id: this.id, attributes: {tabIndex: '-1'}});
        this.size = {width: this.element.offsetWidth, height: this.element.offsetHeight};
        this.connector = params.connector || this.parent.connector || null;
        this.selectSensitivity = params.selectSensitivity || 50;
        this.grid = params.grid || this.parent.grid;
        this.element.dataset.nodelabTarget = 'never';

        // Create connector instance if one is requested
        if (params.connector && params.connector.extension) {
            this.connector = this.registerConnector(params.connector);
        }

        // Create history instance if one is requested
        if (params.history && params.history.extension) {
            this.history = new params.history.extension(this.nodelab, this, params.history);
        }

        // Make desktop draggable
        this.draggable = new NodeLabTools.Draggable(this, {
            propagate: true,
            onStart: this.onDragStart,
            onTranslate: this.onDragTranslate,
            onFinish: this.onDragFinish,
        });

        // User registered events
        const actions = {...params.on};
        Object.keys(actions).map(action => {
            this.on(action, actions[action].bind(this));
        });

        // Mouse / touch events
        this.on("pointermove", this.onMouseMove.bind(this));
        this.on("pointerdown", this.onClick.bind(this));
        this.on("keydown", this.onKeyDown.bind(this));
        this.on("keyup", this.onKeyUp.bind(this));
        this.on("dragselect", this.onDragSelect.bind(this));
    }

    registerComponents(components) {
        let table = {};
        components.map(component => {table[component.name] = component; });
        return table;
    }

    addNode(component, params = {}) {
        let settings = {...params};
        let tolerance = this.grid ? {x: this.grid.size.width / 2, y: this.grid.size.height / 2} : {x: 0, y: 0};
        settings.id = settings.id || this.id + '-node-' + this.nodelab.uid();
        settings.nodelab = this.nodelab;
        settings.parent = this;
        settings.position = {...this.getView(), ...settings.position};
        settings.move = params.move || this.grid ? {tolerance: tolerance, snap: this.grid.snap} : {tolerance: tolerance, snap: tolerance};

        var node = new component(settings);
        this.nodes[node.id] = node;
        this.nodeUID++;

        // Override some node event functions
        node.onMoveStart = this.moveNodesStart.bind(node);
        node.onMove = this.moveNodes.bind(node);
        node.onMoveFinish = this.moveNodesFinish.bind(node);
        node.remove = this.removeNode.bind(node);
        node.processEvent = this.nodeEvent.bind(node);

        node.on("nodeselect", this.onNodeSelect.bind(node));

        const actions = {...this.actions, ...settings.on};
        Object.keys(actions).map(action => {
            node.on(action, actions[action].bind(node));
        });

        node.objectType = component;
        if (this.history && !settings.noHistory) this.history.push(node.simplify(node), NodeLabEvents.add);

        return node;
    }

    createSurface() {
        if (!this.svg) {
            // Create an SVG surface for drawing connections on
            this.svg = this.addElement(document.createElementNS('http://www.w3.org/2000/svg', 'svg'), {
                parent: this,
                classes: ['connector', 'noselect']
            });

            // Create the selection box and hide it
            this.selectBox = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            this.selectBox.setAttribute('width', '0');
            this.selectBox.setAttribute('height', '0');
            this.selectBox.classList.add('nodelab', 'selectBox');
            this.svg.appendChild(this.selectBox);

            this.svg.setAttribute('viewBox', '0 0 ' + this.size.width + ' ' + this.size.height);
        }
    }

    registerConnector(params) {
        var connectorParams = {parent: this, ...params.params};

        this.createSurface();

        // Create extension
        var connector = nodelab.create(params.extension, connectorParams);

        return connector;
    }

    onKeyDown(e) {
        this.multiSelect = e.ctrlKey;

        switch(e.key.toLowerCase()) {
            case 'delete':
                this.removeSelected();
                break;
            case 'z':
                e.preventDefault();
                if (e.ctrlKey && !e.shiftKey) this.undo(e);
                if (e.ctrlKey &&  e.shiftKey) this.redo(e);
                break;
            default:
                break;
        }

        // Make sure the graph retains focus despite other actions
        this.element.focus();
    }

    onKeyUp(e) {
        this.multiSelect = e.ctrlKey;

        if (e.key) {
            switch(e.key.toLowerCase()) {
                default:
                    break;
            }
        }
    }

    onMouseMove(e) {
        const zoom = 1.0/this.parent.zoom;
        const pos = this.parent.element.getBoundingClientRect();

        this.mouse = {
            x: (e.clientX - pos.x) * zoom,
            y: (e.clientY - pos.y) * zoom
        };

        if (this.connector) {
            this.connector.update();
        }
    }

    moveNodesStart(e) {
        // Overridden function, this = node
        this.parent.selected.map(node => {
            node.draggable.previous = node.draggable.position;
        });
    }

    moveNodes(x, y, e) {
        // Overridden function, this = node
        this.parent.selected.map(node => {
            node.move(x, y, e);
        });
    }

    moveNodesFinish(e) {
        var simplified = [];

        // Overridden function, this = node
        this.parent.selected.map(node => {
            node.moveFinish(e);
            if (this.parent.history) {
                let simple = node.simplify(node);
                simple.position.previous = node.draggable.previous;
                simplified.push(simple);
            }
        });

        if (this.parent.history && e.elementMoved) this.parent.history.push(simplified, NodeLabEvents.move);
    }

    removeNode(params = {}) {
        // Overridden function, this = node
        this.parent.removeNodes([this], params);
    }

    nodeEvent(e) {
        // Overridden function, this = node
        if (this.parent.history && (!e.detail || !e.detail.noHistory)) {
            if (e.what && e.what == 'connect') {
                if (e.socket) {
                    let connections = e.socket.connections;
                    this.parent.history.push(connections, NodeLabEvents.connect);
                }
            } else if (e.what && e.what == 'disconnect') {
                if (e.detail.socket) {
                    let connections = e.detail.socket.connections;
                    this.parent.history.push(connections, NodeLabEvents.disconnect);
                }
            } else if (e.type == 'change') {
                this.parent.history.push(e.detail, NodeLabEvents.change);
            }
        }
    }

    removeNodes(nodes, params = {}) {
        var simplified = [];

        nodes.map(node => {
            simplified.push(node.simplify(node));
            node.removeConnections();
            this.removeChild(node.element);
            delete this.nodes[node.id];
        });

        if (this.history && !params.noHistory) this.history.push(simplified, NodeLabEvents.remove);
    }

    onNodeSelect(e) {
        // Event function, this = node
        if (this.parent.selected.length == 0) {
            this.parent.selected = [this];
        }
    }

    drawSelect() {
        if (!this.selectBox.classList.contains('dragging')) {
            this.selectBox.classList.add('dragging');
        }

        this.selectBox.setAttribute('x', this.select.x);
        this.selectBox.setAttribute('y', this.select.y);
        this.selectBox.setAttribute('width', this.select.width);
        this.selectBox.setAttribute('height', this.select.height);
    }

    stopSelect() {
        this.selectBox.classList.remove('dragging');
    }

    onDragStart(e) {
        this.parent.select = {start: this.parent.mouse, ...this.parent.mouse, width: 0, height: 0};
    }

    onDragTranslate(x, y, e) {
        const delta = {x, y};

        if (Math.abs(delta.x) > this.parent.selectSensitivity ||
            Math.abs(delta.y) > this.parent.selectSensitivity) {
                this.parent.selecting = true;

                // Make sure the size is never negative
                if (delta.x < 0) {
                    this.parent.select.x = this.parent.select.start.x + delta.x;
                    this.parent.select.width = -delta.x;
                } else {
                    this.parent.select.width = delta.x;
                }

                if (delta.y < 0) {
                    this.parent.select.y = this.parent.select.start.y + delta.y;
                    this.parent.select.height = -delta.y;
                } else {
                    this.parent.select.height = delta.y;
                }

                this.parent.drawSelect();
                this.parent.trigger('dragselect');
        }
    }

    onDragFinish(e) {
        this.parent.selecting = false;
        this.parent.stopSelect();
    }

    onDragSelect(e) {
        var deselected = [];

        // Loop through all nodes and check if they are in the selected area
        Object.keys(this.nodes).map(nodeid => {
            let node = this.nodes[nodeid];
            if (node.draggable.position.x > this.select.x && node.draggable.position.y > this.select.y &&
                node.draggable.position.x < (this.select.x + this.select.width) &&
                node.draggable.position.y < (this.select.y + this.select.height))
            {
                if (!this.selected.includes(node)) {
                    this.selected.push(node);
                    node.trigger("nodeselect");
                }
            } else {
                if (node.selected) {
                    deselected.push(node);
                    node.trigger("nodedeselect", {source: this.id});
                }
            }
        });

        this.selected = this.selected.filter(n => !deselected.includes(n));
    }

    deselectAll(e) {
        this.selected.map(node => {
            node.trigger("blur", {source: this.id});
        });

        this.selected = [];
    }

    removeSelected(e) {
        this.removeNodes(this.selected);
        this.selected = [];
    }

    undo(e) {
        this.deselectAll(e);
        this.history.undo();
    }

    redo(e) {
        this.deselectAll(e);
        this.history.redo();
    }

    onClick(e) {
        if (!this.multiSelect) this.deselectAll(e);
    }

    simplify(expressionType) {
        let simple = {nodes: []};

        Object.keys(this.nodes).map(node => {
            let n = this.nodes[node];
            simple.nodes.push(n.simplify());

            if (expressionType && n.objectType === expressionType) {
                simple.expression = n.outputs[Object.keys(n.outputs)[0]].value;
            }
        });

        return simple;
    }

    getView() {
        if (this.parent.update) this.parent.update();
        return this.parent.view || {x: 0, y: 0, z: 0};
    }

    connectSockets(data) {
        data.map(connection => {
            let source = this.nodes[connection.sourceNode];
            let target = this.nodes[connection.targetNode];
            let input = target.inputs[connection.targetInput];
            let output = source.outputs[connection.sourceOutput];
            output.connectTo(input, {noHistory: true});
            this.nodelab.trigger("update");
        });
    }

    disconnectSockets(data) {
        data.map(connection => {
            let node = this.nodes[connection.targetNode];
            node.inputs[connection.targetInput].removeConnection(connection.sourceNode, connection.sourceOutput, {noHistory: true});
        });
    }

    restoreNodes(data) {
        data.map(node => {
            const obj = this.addNode(this.getObject(node.objectType), {...node.settings, noHistory: true});
            obj.setPosition(node.position.x, node.position.y);
        });

        data.map(node => { this.restoreConnections(node); });
        this.nodelab.trigger("update");
    }

    restoreConnections(node) {
        if (node.inputs) Object.keys(node.inputs).map(async (input) => {
            const value = node.inputs[input].value === '0' ? '' : node.inputs[input].value;
            await this.nodes[node.id].inputs[input].setValue(value, {noHistory: true});
            await this.connectSockets(node.inputs[input].socket.connections);
        });

        if (node.outputs) Object.keys(node.outputs).map(output => { this.connectSockets(node.outputs[output].socket.connections); });
    }

    getObject(obj) {
        // Look up component object from name if necessary
        if (typeof obj === 'string'){
            return this.components[obj];
        } else {
            return obj;
        }
    }

    toJSON() {
        let nodes = [];

        Object.keys(this.nodes).map(node => { nodes.push(this.nodes[node].simplify()); });

        return JSON.stringify(nodes);
    }

    fromJSON(json) {
        let pkg = JSON.parse(json);

        Object.keys(pkg).map(node => { pkg[node].objectType = this.getObject(pkg[node].objectType); });
        this.restoreNodes(pkg);

        this.nodelab.trigger("update");
    }

    update() {
        Object.keys(this.nodes).map(node => {
            this.nodes[node].update();
        });
    }

    remove() {
        const nodes = Object.keys(this.nodes).map(node => {
            return this.nodes[node];
        });

        this.removeNodes(nodes, {noHistory: true});
        this.element.remove();
    }
}
