const NodeLabEvents = Object.freeze({
    add: 1,
    remove: 2,
    connect: 3,
    disconnect: 4,
    move: 5,
    change: 6,
    save: 7
})

class NodeLabHistory extends NodeLabExtension {
    init(params) {
        this._undo = [];
        this._redo = [];
        this.size = params.size;
        this.state = 1;
    }

    push(data, type) {
        this._undo.push(new NodeLabHistoryEvent(this, data, type, this.state));
        this._redo = [];

        if (this.size && this._undo.length > this.size) {
            this._undo.shift();
        }

        this.trigger("push", ++this.state);
    }

    current() {
        return this._undo[this._undo.length - 1];
    }

    trigger(what, state) {
        this.parent.trigger("history", {event: what, state: state});
    }

    action(from, to, func) {
        const e = from.pop();

        if (e) {
            to.push(e);
            e[func]();
            this.trigger(func, e.state);
        }
    }

    undo() {
        this.action(this._undo, this._redo, 'undo');
    }

    redo() {
        this.action(this._redo, this._undo, 'redo');
    }
}

class NodeLabHistoryEvent {
    constructor(parent, data, type, state, params = {}) {
        this.parent = parent;
        this.graph = parent.parent;
        this.state = state;
        this.type = type;
        this.data = data;
    }

    undo() {
        switch(this.type) {
            case NodeLabEvents.add:
                this.graph.nodes[this.data.id].remove({noHistory: true});
                break;
            case NodeLabEvents.remove:
                this.graph.restoreNodes(this.data);
                break;
            case NodeLabEvents.move:
                this.data.map(node => {
                    this.graph.nodes[node.id].setPosition(node.position.previous.x, node.position.previous.y);
                });
                break;
            case NodeLabEvents.connect:
                this.disconnectSockets(this.data);
                break;
            case NodeLabEvents.disconnect:
                this.connectSockets(this.data);
                break;
            case NodeLabEvents.change:
                this.graph.nodes[this.data.node].inputs[this.data.input].setValue(this.data.initial, {noHistory: true});
                break;
            case NodeLabEvents.save:
                break; // Just return to the save state
            default:
                throw "NodeLab History: unknown undo action!";
        }
    }

    redo() {
        switch(this.type) {
            case NodeLabEvents.add:
                this.graph.restoreNodes([this.data]);
                break;
            case NodeLabEvents.remove:
                let nodes = [];
                this.data.map(node => {
                    nodes.push(this.graph.nodes[node.id]);
                });
                this.graph.removeNodes(nodes, {noHistory: true});
                break;
            case NodeLabEvents.move:
                this.data.map(node => {
                    this.graph.nodes[node.id].setPosition(node.position.x, node.position.y);
                });
                break;
            case NodeLabEvents.connect:
                this.connectSockets(this.data);
                break;
            case NodeLabEvents.disconnect:
                this.disconnectSockets(this.data);
                break;
            case NodeLabEvents.change:
                this.graph.nodes[this.data.node].inputs[this.data.input].setValue(this.data.value, {noHistory: true});
                break;
            case NodeLabEvents.save:
                break; // Just return to the save state
            default:
                throw "NodeLab History: unknown redo action!";
        }
    }
}
