class NodeLabNode extends NodeLabExtension {
    init(params) {
        this.name = params.name || "NodeLab Node";
        this.inputs = {};
        this.outputs = {};
        this.settings = params;
        this.zeroEmpty = params.zeroEmpty || true;
        this.size = params.size || {width: 160, height: 240};
        this.selected = params.selcted || false;
        this.graph = this.parent;
        this.id = params.id || 'nodelab-node-' + this.nodelab.uid();
        this.createBody(params);

        this.draggable = new NodeLabTools.Draggable(this, {
            element: this.element,
            onStart: this.onTranslateStart,
            onTranslate: this.onTranslate,
            onFinish: this.onFinish,
            position: params.position || {x: 0, y: 0, z: 1},
            tolerance: params.move.tolerance,
            snap: params.move.snap,
        });

        this.connector = this.parent.connector;

        // Mouse / Touch events
        this.on("pointerdown", this.onClick.bind(this));
        //this.on("click", this.onClick.bind(this));

        this.on("process", this.doProcess.bind(this));
        this.on("focus", this.onFocus.bind(this));
        this.on("blur", this.onBlur.bind(this));
        this.on("nodeselect", this.onSelect.bind(this));
        this.on("nodedeselect", this.onDeselect.bind(this));
        this.on("connect", this.onConnect.bind(this));
        this.on("disconnect", this.onConnect.bind(this));

        this.start();
    }

    start() {
    }

    doProcess(e) {
        if (!e.detail || !e.detail.noProcess) {
            this.process(this.inputs, this.outputs);
            this.processOutputs(e);
            this.processEvent(e);
        }
    }

    processEvent(e) {
    }

    process(inputs, outputs) {
    }

    createBody(params) {
        // Node HTML element (tabindex: -1 so the node can receive focus)
        this.element = this.createElement('div', {classes: ['node'], id: this.id, attributes: {tabIndex: '-1'}});

        // Some aliases to make interaction nicer
        this.aliases = {html: 'innerHTML', text: 'innerText'};
        NodeLabTools.alias(params.title, this.aliases);
        NodeLabTools.alias(params.inputSpacer, this.aliases);
        NodeLabTools.alias(params.outputSpacer, this.aliases);

        // Create the elements which make up the node
        var elementSettings = {...params, type: 'div', parent: this};
        this.title = this.createElement('div', {...elementSettings, classes: ['node-item', 'title', 'noselect'], attributes: {...params.title, id: this.id + '-title'}});
        this.outputSpacer = this.createElement('div', {...elementSettings, classes: ['node-item', 'spacer', 'outputs', 'noselect'], attributes: {innerText: 'Outputs', id: this.id + '-inputs'}});
        this.inputSpacer = this.createElement('div', {...elementSettings, classes: ['node-item', 'spacer', 'inputs', 'noselect'], attributes: {innerText: 'Inputs', id: this.id + '-outputs'}});

        this.updateConnections();

        this.element.dataset.nodelabType = 'node';
        this.size.width = this.size.width < 176 ? 176 : this.size.width;
        this.element.style.minWidth = this.size.width + 'px';
        //@TODO: implement vertical scaling?
        //this.element.style.height = this.size.height + 'px';
    }

    addInput(params = {}) {
        if (this.inputs[params.name]) {
            throw "An input with that name already exists!";
        }

        this.inputs[params.name] = new NodeLabNodeInput(this.nodelab, this, {...params, id: this.id + '-input-' + this.nodelab.uid()});
        this.updateConnections();

        return this.inputs[params.name];
    }

    removeInput(name, params = {}) {
        let input = this.inputs[name];
        input.removeConnections(params);
        this.removeChild(input.element);
        delete this.inputs[name];

        if (!params.noProcess) {
            this.updateConnections();
        }
    }

    addOutput(params = {}) {
        if (this.outputs[params.name]) {
            throw "An output with that name already exists!";
        }

        this.outputs[params.name] = new NodeLabNodeOutput(this.nodelab, this, {...params, id: this.id + '-output-' + this.nodelab.uid()});
        this.updateConnections();

        return this.outputs[params.name];
    }

    // Update the element inputs and outputs
    updateConnections(params = {}) {
        var templateRows = '40px 30px ';
        var width = this.size.width + 'px';
        var numRows = 3;

        Object.keys(this.outputs).map(output => {
            this.outputs[output].element.style.gridRow = numRows++;
            this.outputs[output].element.style.minWidth = width;
            templateRows += '40px ';
        });

        if (Object.keys(this.inputs).length) {
            this.inputSpacer.style.display = 'inherit';
            this.inputSpacer.style.gridRow = numRows++;
            templateRows += '30px ';

            Object.keys(this.inputs).map(input => {
                this.inputs[input].element.style.display = 'inherit';
                this.inputs[input].element.style.gridRow = numRows++;
                this.inputs[input].element.style.minWidth = width;
                templateRows += '40px ';
            });
        } else {
            this.inputSpacer.style.display = 'none';
            Object.keys(this.inputs).map(input => {
                this.inputs[input].element.style.display = 'none';
            });
        }

        this.element.style.gridTemplateRows = templateRows;
    }

    updateSockets() {
        Object.keys(this.inputs).map(input => {
            this.inputs[input].update();
        });

        Object.keys(this.outputs).map(output => {
            this.outputs[output].update();
        });

        if (this.connector) this.connector.update();
    }

    removeConnections() {
        Object.keys(this.outputs).map(output => {
            if (this.outputs[output]) this.outputs[output].removeConnections();
        });

        Object.keys(this.inputs).map(input => {
            if (this.inputs[input]) this.inputs[input].removeConnections();
        });
    }

    processOutputs(e) {
        Object.keys(this.outputs).map(output => {
            this.outputs[output].onProcess(e);
        });
    }

    setPosition(x, y) {
        this.draggable.transform = {x: x, y: y, z: this.draggable.position.z};
        this.position = this.draggable.position = this.draggable.transform;
        this.updateChildren();
        this.nodelab.trigger("update");
    }

    moveStart(e) {
    }

    move(x, y, e) {
        this.draggable.transform = {x: this.draggable.position.x + x, y: this.draggable.position.y + y, z: this.draggable.position.z};
        this.updateChildren();
        this.nodelab.trigger("update");
    }

    moveFinish(e) {
        this.draggable.position = {x: this.draggable.transform.x, y: this.draggable.transform.y, z: this.draggable.transform.z};
    }

    onMoveStart(e) {
        this.moveStart(e);
    }

    onMove(x, y, e) {
        this.move(x, y, e);
    }

    onMoveFinish(e) {
        this.moveFinish(e);
    }

    onTranslateStart(e) {
        this.parent.onMoveStart(e);
    }

    onTranslate(x, y, e) {
        this.parent.onMove(x, y, e);
    }

    onFinish(e) {
        this.parent.onMoveFinish(e);
    }

    onConnect(e) {
    }

    onDisconnect(e) {
    }

    onSelect(e) {
        this.selected = true;
        this.title.classList.add("selected");
        this.element.classList.add("selected");
    }

    onFocus(e) {
    }

    onDeselect(e) {
        const allowedSource = (e.detail.source === this.id || e.detail.source === this.parent.id);

        // Only allow self or the parent to send deselect messages
        if (this.selected && (!this.parent || allowedSource)) {
            this.title.classList.remove("selected");
            this.element.classList.remove("selected");
            this.selected = false;
        } else if (this.parent && e.detail.source && !allowedSource) {
            throw "NodeLab Node: nodedeselect triggered by unauthorized element. Will not deselect.";
        }
    }

    onBlur(e) {
        this.trigger("nodedeselect", {...e.detail});
    }

    onClick(e) {
        e.stopPropagation();

        if (!this.parent.multiSelect || !this.element.classList.contains("selected")) {
            this.focus();
            this.trigger("nodeselect");
        } else if (this.parent.multiSelect && this.element.classList.contains("selected")) {
            this.blur();
        }
    }

    blur() {
        this.parent.selected = this.parent.selected.filter(node => node !== this);
        this.trigger("blur", {source: this.id});
    }

    focus() {
        if (!this.parent.selecting && !this.parent.multiSelect && (this.parent.deselectAll && !this.element.classList.contains("selected"))) {
            this.parent.deselectAll();
        } else if (this.parent.multiSelect && !this.element.classList.contains("selected")) {
            this.parent.selected.push(this);
        }

        this.element.focus();
    }

    simplify(settings = {}) {
        var simple = {inputs: {}, outputs: {}};

        simple.id = this.id;
        simple.position = this.draggable.position;
        simple.settings = this.settings;
        simple.parent = this.parent.id;
        simple.objectType = this.objectType.name;

        // Get rid of circular references
        delete simple.settings.nodelab;
        delete simple.settings.parent;

        Object.keys(this.inputs).map(input => {
            simple.inputs[input] = this.inputs[input].simplify(settings);
        });

        Object.keys(this.outputs).map(output => {
            simple.outputs[output] = this.outputs[output].simplify(settings);
        });

        return simple;
    }

    remove(params = {}) {
        this.removeConnections();
        this.parent.removeChild(this.element);
    }

    updateChildren() {
        Object.keys(this.inputs).map(input => {
            this.inputs[input].trigger("update");
        });

        Object.keys(this.outputs).map(output => {
            this.outputs[output].trigger("update");
        });
    }

    update() {
        const [width, height] = [this.element.clientWidth, this.element.clientHeight];
        const [x, y] = [this.draggable.transform.x - (width / 2.0), this.draggable.transform.y - (height / 2.0)];

        this.element.style.transform = 'translate(' + x + 'px, ' + y + 'px)';
    }
}

class NodeLabNodeInput extends NodeLabExtension {
    init(params) {
        this.id = params.id || this.parent.id + '-input-' + this.nodelab.uid();
        this.name = params.name || "NodeLab Input";
        this.textValue = params.value || '';
        this.zeroEmpty = params.zeroEmpty || this.parent.zeroEmpty || true;
        this.value = params.value || (this.zeroEmpty ? '0' : "");
        this.graph = this.parent.graph;
        this.initialValue = params.value || (this.zeroEmpty ? '0' : "");

        this.element = this.createElement('div', {classes: ['node-item', 'input', 'noselect'], id: this.id + '-block'});
        this.input = this.createElement('input', {
            parent: this.element,
            classes: ['label', 'input'],
            id: this.id,
            attributes: {
                placeholder: this.name,
                innerText: this.value,
            }
        });

        this.element.dataset.nodelabType = 'input';
        this.element.dataset.nodelabName = this.name;
        this.element.dataset.nodelabParent = this.parent.id;
        this.input.dataset.nodelabType = this.element.dataset.nodelabType;
        this.input.dataset.nodelabName = this.element.dataset.nodelabName;
        this.input.dataset.nodelabParent = this.element.dataset.nodelabParent;
        this.connector = this.parent.connector;
        this.node = this.parent;
        this.type = params.type || params.accepts || 'any';

        this.on("update", this.update.bind(this));
        this.on("change", this.onChange.bind(this));
        this.on("keypress", this.onKeyPress.bind(this));
        this.on("keydown", this.onKeyPress.bind(this));
        this.on("click", this.onClick.bind(this));
        this.input.addEventListener("pointerdown", this.mouseEvent.bind(this));
        this.input.addEventListener("input", this.onInput.bind(this));
        this.input.addEventListener("focus", this.onFocus.bind(this));

        this.socket = new NodeLabNodeSocket(this.nodelab, this, {
            socketType: 'input',
            ...params,
            id: this.id + '-socket',
            type: this.type,
            class: 'input'
        });

        this.updateLabel();
        this.doZeroEmpty();
    }

    setValue(value, params = {}) {
        this.value = this.initialValue = this.textValue = value;
        this.trigger("change", params);
    }

    onClick(e) {
        e.stopPropagation();
    }

    onFocus(e) {
        this.graph.deselectAll();
        this.parent.trigger("nodeselect");

        this.initialValue = this.value;
    }

    onInput(e) {
        if (!this.input.hasAttribute('disabled')) {
            this.value = this.input.value;
            this.textValue = this.value;
        }

        this.onChange(e);
    }

    onKeyPress(e) {
        e.stopPropagation();
    }

    onChange(e) {
        this.updateLabel();
        this.doZeroEmpty();

        if (e.type == 'change' && (!e.detail || !e.detail.noHistory) && this.value !== this.initialValue) {
            e.detail = {...e.detail, value: this.value, initial: this.initialValue, input: this.name, node: this.node.id};
        }

        this.parent.doProcess(e);
    }

    onConnect(e) {
        this.parent.trigger("connect", {source: e.detail.source});
    }

    onDisconnect(e) {
        this.parent.trigger("disconnect", {source: e.detail.source});
    }

    simplify(settings = {}) {
        var simple = {};

        simple.id = this.id;
        simple.socket = this.socket.simplify(settings);
        simple.value = this.value;

        return simple;
    }

    mouseEvent(e) {
        if (this.socket.state != 'connected') {
            e.stopPropagation();
        }
    }

    doZeroEmpty() {
        if (this.zeroEmpty && this.value == '') {
            this.value = '0';
        }
    }

    removeConnection(sourceId, output, params = {}) {
        this.socket.removeConnection(sourceId, output, params);
    }

    removeConnections(params = {}) {
        this.socket.removeAll(params);
    }

    updateLabel() {
        if (this.socket.state == 'connected' || this.socket.state == 'disabled') {
            // Get value (append all values one after the other for multis)
            if (this.socket.connections.length) {
                this.value = this.socket.connections.reduce((values, v) => v.source.getValue() + " " + values, []);
            }

            this.input.setAttribute('disabled', 'disabled');
            this.input.setAttribute('placeholder', this.name);
            this.input.classList.add('disabled');
        } else {
            this.value = this.textValue;
            this.input.setAttribute('placeholder', this.name);
            this.input.classList.remove('disabled');
            this.input.removeAttribute('disabled');
        }

        this.input.value = this.value;
    }

    update() {
        this.socket.trigger("update");
    }
}

class NodeLabNodeOutput extends NodeLabExtension {
    init(params) {
        this.value = params.value || "0";
        this.id = params.id || this.parent.id + '-output-' + this.nodelab.uid();
        this.name = params.name || "NodeLab Output";
        this.graph = this.parent.graph;

        this.element = this.createElement('div', {classes: ['node-item', 'output'], id: this.id + '-block'});
        this.output = this.createElement('span', {
            parent: this.element,
            classes: ['label', 'output'],
            id: this.id,
            attributes: {innerText: this.value}
        });

        this.element.dataset.nodelabType = 'output';
        this.element.dataset.nodelabName = this.name;
        this.connector = this.parent.connector;
        this.node = this.parent;
        this.type = params.type || 'any';

        this.on("update", this.update.bind(this));
        this.on("change", this.onChange.bind(this));
        this.on("click", this.onClick.bind(this));
        this.on("connect", this.onConnect.bind(this));
        this.on("disconnect", this.onConnect.bind(this));

        this.socket = new NodeLabNodeSocket(this.nodelab, this, {
            ...params,
            id: this.id + '-socket',
            socketType: 'output',
            type: this.type,
            class: 'output'
        });

        this.updateLabel();
    }

    onClick(e) {
        e.stopPropagation();
    }

    onConnect(e) {
        this.parent.trigger("connect", {source: e.detail.source});
    }

    onDisconnect(e) {
        this.parent.trigger("disconnect", {source: e.detail.source});
    }

    onChange(e) {
        this.updateLabel();
        this.socket.propagate(e);
    }

    onProcess(e) {
        this.onChange(e);
    }

    simplify(settings = {}) {
        var simple = {};

        simple.id = this.id;
        simple.socket = this.socket.simplify(settings);

        return simple;
    }

    connectTo(input, params = {}) {
        this.socket.createWire(params);
        input.socket.attachWires(params);
    }

    removeConnection(targetId, input, params = {}) {
        this.socket.removeConnection(targetId, input, params);
    }

    removeConnections(params = {}) {
        this.socket.removeAll(params);
    }

    updateLabel() {
        this.element.value = this.value;
        this.output.innerText = this.value;
    }

    update() {
        this.updateLabel();
        this.socket.trigger("update");
    }
}

class NodeLabNodeSocket extends NodeLabExtension {
    init(params) {
        this.name = params.name || "NodeLab Socket";
        this.id = params.id || this.parent.id + '-socket';
        this.element = this.createElement('div', {classes: ['socket', params.class, 'noselect'], id: this.id});
        this.element.dataset.nodelabType = 'socket';
        this.element.dataset.nodelabName = this.parent.name;
        this.element.dataset.nodelabParent = this.parent.node.id;
        this.connector = this.parent.connector;
        this.connections = [];
        this.node = this.parent.node;
        this.type = params.type || 'any';
        this.graph = this.parent.graph;
        this.socketType = params.socketType || 'multi';
        this.state = params.state || 'open';

        this.updateState();
        this.updatePosition();

        // Mouse events
        this.on("pointerdown", this.onClick.bind(this));
        this.on("pointerup", this.onClick.bind(this));
        this.on("pointermove", this.onMouseMove.bind(this));

        this.on("update", this.update.bind(this));
        this.on("change", this.onChange.bind(this));
        this.on("connect", this.onConnect.bind(this));
        this.on("connecting", this.onConnecting.bind(this));
        this.on("disconnect", this.onDisconnect.bind(this));
    }

    updateState() {
        if (this.connections.length === 0 && this.state !== 'disabled') {
            this.state = 'open';
        }

        this.element.classList.remove('disabled', 'open', 'connecting', 'connected');
        this.element.classList.add(this.state);
    }

    updatePosition() {
        var element = {
            x: this.element.offsetLeft + this.element.offsetWidth / 2 + 12,
            y: this.element.offsetTop + this.element.offsetHeight / 2 - 14
        };

        var node = {
            x: this.node.draggable.transform.x - this.node.element.offsetWidth / 2,
            y: this.node.draggable.transform.y - this.node.element.offsetHeight / 2
        };

        this.position = {x: element.x + node.x, y: element.y + node.y};
    }

    onChange(e) {
        if (e.what) e.socket = this.simplify();

        this.updateState();
        this.parent.onChange(e);
    }

    onConnect(e) {
        e.what = 'connect';
        this.parent.trigger("connect", {source: this.id});
        this.onChange(e);
    }

    onConnecting(e) {
        e.what = 'connecting';
        this.onChange(e);
    }

    onDisconnect(e) {
        e.what = 'disconnect';
        this.parent.trigger("disconnect", {source: this.id});
        this.onChange(e);
    }

    propagate(e) {
        // Propagate the connected state change down the chain of nodes
        if (this.state == 'connected') {
            this.connections.map(connection => {
                if (connection.connected) {
                    connection.target.onChange(e);
                }
            });
        }
    }

    getValue() {
        return this.parent.value;
    }

    isCompatibleWith(type) {
        // Type 'any' is compatible with all
        if (this.type == 'any' || (Array.isArray(this.type) && this.type.includes('any'))) {
            return true;
        }

        // Convert types to array if necessary
        var types = Array.isArray(type) ? type : [type];
        var compare = Array.isArray(this.type) ? this.type : [this.type];

        // Filter and compare length, if it's shorter a match was found
        var result = compare.filter(t => !types.includes(t));

        return (result.length < compare.length);
    }

    attachWires(params = {}) {
        var compatible = false;

        this.updatePosition();

        // Check socket compatibility
        this.connector.looseWires.map(connection => {
            compatible = compatible || this.isCompatibleWith(connection.source.type);
        });

        if (compatible) {
            this.connections = [...this.connections, ...this.connector.attachWires(this)];
            this.state = 'connected';
            this.trigger("connect", params);
        } else {
            this.connector.looseWires.map(connection => connection.badConnection());
        }

        // Remove duplicates if they were somehow to be created
        this.connections = this.connections.reduce(function(a,b) {
            if (a.findIndex(conn => (conn.source == b.source && conn.target == b.target)) < 0) {
                a.push(b);
            } else {
                b.remove({...params, noHistory: true});
            }
            return a;
        }, []);
    }

    removeConnection(nodeId, name, params = {}) {
        if (this.socketType === 'input') {
            this.connections.map(connection => {
                if (connection.source.node.id === nodeId && connection.source.name === name) {
                    connection.remove(params);
                }
            });
        } else if (this.socketType === 'output') {
            this.connections.map(connection => {
                if (connection.target.node.id === nodeId && connection.target.name === name) {
                    connection.remove(params);
                }
            });
        }
    }

    removeWires(connections, params = {}) {
        this.connections = this.connections.filter(conn => !connections.includes(conn));

        if (this.connections.length === 0) {
            this.state = 'open';
        }

        this.trigger("disconnect", params);
    }

    detachAll(params = {}) {
        let simple = this.simplify();
        this.connections.map(connection => connection.disconnect(this));
        this.connections.length = 0;
        this.state = 'open';

        this.trigger("disconnect", {...params, socket: simple});
    }

    removeAll(params = {}) {
        this.connections.map(connection => connection.remove());
        this.connections.length = 0;
        this.state = 'open';

        this.trigger("disconnect", params);
    }

    createWire() {
        this.updatePosition();

        var params = {
            source: this,
            coordinates: { start: this.position }
        };

        this.connections.push(this.connector.createWire(params));

        if (this.state == 'open') {
            this.state = 'connecting';
        }

        this.trigger("connecting");
    }

    onClick(e) {
        // Touch events don't give the correct target on pointer up
        if (e.pointerType == 'touch' && e.type == 'pointerup' && !e.nodelabPropagated) {
            const target = NodeLabTools.getPointerTarget(this.graph.mouse, ['nodelab-path']);

            // Make sure we touched a socket, not anything else
            if (target && this.element.id !== target.id) {
                if (target.dataset.nodelabType === 'socket' || target.dataset.nodelabType === 'input') {
                    const parent = target.dataset.nodelabParent;
                    const name = target.dataset.nodelabName;
                    const node = this.graph.nodes[parent];
                    const input = node.inputs[name];

                    // Fire the target's onClick event
                    e.nodelabPropagated = true;
                    if (input) input.socket.onClick(e);
                    return;
                }
            } else {
                this.connector.clearLooseWires();
                return;
            }
        }

        if (this.connector) {
            if (this.state != 'disabled') {
                switch (this.socketType) {
                    case 'input':
                        if (this.connector.hasLooseWires()) {
                            if (this.connector.looseWires.length == 1) {
                                if (this.state == 'open') {
                                    this.attachWires();
                                } else if (this.state == 'connected') {
                                    this.removeAll();
                                    this.attachWires();
                                }
                            } else {
                                this.connector.badConnectAttempt();
                                throw "Too many wires for socket type '"+this.socketType+"'";
                            }
                        } else if (e.type != 'pointerup') {
                            this.detachAll();
                        }
                        break;
                    case 'output':
                        if ((e.pointerType == 'touch' || e.type != 'pointerup') && this.state != 'connecting') {
                            this.createWire();
                        }
                        break;
                    case 'multi':
                        if (this.connector.hasLooseWires()) {
                            this.attachWires();
                        } else if (e.type != 'pointerup') {
                            this.detachAll();
                        }
                        break;
                    default:
                        this.connector.clearLooseWires();
                }
            } else {
                if (this.connector.hasLooseWires()) {
                    this.connector.badConnectAttempt();
                    throw "Socket is disabled";
                }
            }
        } else {
            throw "No connector module loaded!";
        }

        e.stopPropagation();
    }

    onMouseMove(e) {
        if (this.connector) {
            this.element.classList.remove('compatible', 'incompatible');

            if (this.connector.hasLooseWires() && this.state != 'disabled') {
                if (this.connector.looseWires.length > 1 && this.socketType == 'input') {
                    this.element.classList.add('incompatible');
                } else if (this.connector.looseWires.some(wire => {return this.isCompatibleWith(wire.source.type);})) {
                    this.element.classList.add('compatible');
                } else {
                    this.element.classList.add('incompatible');
                }
            }
        }
    }

    simplify(settings = {}) {
        var simple = {connections: []};

        simple.id = this.id;
        simple.node = this.node.id;

        this.connections.map(connection => {
            let targetNode = connection.target ? connection.target.node.id : null;
            let targetInput = connection.target ? connection.target.parent.name : null;
            simple.connections.push({
                sourceNode: connection.source.node.id,
                sourceOutput: connection.source.parent.name,
                targetNode: targetNode,
                targetInput: targetInput,
            });
        });

        return simple;
    }

    update() {
        this.updatePosition();
    }
}
