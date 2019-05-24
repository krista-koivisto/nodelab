class NodeLabConnector extends NodeLabExtension {
    init(params) {
        // Inherit parent SVG area if it exists, otherwise create own based on parent size
        var getSVG = ((params) => {
            if (params.parent && params.parent.svg) {
                return params.parent.svg;
            } else {
                var svg = this.addElement(document.createElementNS('http://www.w3.org/2000/svg', 'svg'), {
                    parent: this.nodelab,
                    classes: ['connector', 'noselect']
                });

                svg.setAttribute('viewBox', '0 0 ' + this.nodelab.size.width + ' ' + this.nodelab.size.height);

                return svg;
            }
        });

        this.element = getSVG(params);
        this.element.dataset.nodelabTarget = 'never';

        this.looseWires = [];
        this.connections = [];
        this.connecting = false;

        if (params.connection) {
            this.connect(params.connection);
        }

        this.on("pointerup", params.onClick || this.onClick.bind(this));
    }

    coorindatesToPath(coords) {
        // Adjust offset in accordance with distance
        const distance = {x: Math.abs(coords.start.x - coords.end.x), y: Math.abs(coords.start.y - coords.end.y)};
        const offset = (distance.x < 240 || distance.y < 240) ? Math.max(Math.min(distance.x, distance.y) / 2, 20) : 120;

        // SVG path messiness :)
        const path = 'path("' +
        'M' +  coords.start.x             + ' ' + coords.start.y  + ' ' +
        'S' + (coords.start.x + offset)   + ' ' + coords.start.y  + ' ' +
        ''  +  coords.middle.x            + ' ' + coords.middle.y + ' ' +
        'S' + (coords.end.x - offset / 2) + ' ' + coords.end.y    + ' ' +
        ''  +  coords.end.x               + ' ' + coords.end.y    + ' ")';

        return path;
    }

    onClick(e) {
        this.clearLooseWires();
    }

    clearLooseWires() {
        this.looseWires.forEach(connection => connection.remove());
        this.connections = this.connections.filter(conn => !this.looseWires.includes(conn));
        this.looseWires.length = 0;
    }

    hasLooseWires() {
        return (this.looseWires.length > 0);
    }

    badConnectAttempt() {
        this.looseWires.forEach(connection => connection.badConnection());
    }

    attachWires(socket) {
        var connections = this.looseWires;

        connections.forEach((connection) => {
            connection.connect(socket);
        });

        this.looseWires = [];

        return connections;
    }

    createWire(params = {}) {
        var connection = new NodeLabConnectionWire(this.nodelab, this, params);
        this.looseWires.push(connection);
        this.connections.push(connection);

        return connection;
    }

    update() {
        this.mouse = this.parent.mouse || {x: 0, y: 0};
        this.connections.forEach((connection) => {
            connection.update();
        });
    }
}

class NodeLabConnectionWire extends NodeLabExtension {
    init(params) {
        var params = {
            parent: this.parent,
            ...params,
            type: 'path'
        };

        this.element = this.addElement(document.createElementNS('http://www.w3.org/2000/svg', 'path'), {
            classes: ['connector-wire', 'noselect']
        });

        this.element.dataset.nodelabTarget = 'never';
        this.source = params.source;
        this.target = params.target || null;
        this.transitionDuration = this.element.style.transitionDuration;

        this.coordinates = {
            start: {x: 0, y: 0},
            middle: {x: 0, y: 0},
            end: {x: 0, y: 0},
            ...params.coordinates
        };

        this.parent.appendChild(this.element);
        this.connected = false;
    }

    connect(target) {
        this.connected = true;
        this.target = target;

        this.source.state = 'connected';
        this.source.updateState();
    }

    disconnect(socket) {
        if (!this.connected) {
            this.parent.clearLooseWires();
        } else {
            if (socket === this.source) {
                this.source = this.target;
            }

            if (this.source.connections.length <= 1) {
                this.source.state = 'connecting';
                this.source.updateState();
            }

            this.connected = false;
            this.parent.looseWires.push(this);
            this.target = null;
        }
    }

    badConnection() {
        this.element.style.transitionDuration = '0s';
        this.element.classList.add('error');
    }

    calculateBezier(start, target) {
        var center = {
            x: (target.x - start.x) / 2,
            y: (target.y - start.y) / 2
        };

        var coordinates = {
            start: {x: start.x, y: start.y},
            middle: {x: center.x + start.x, y: center.y + start.y},
            end: {x: target.x, y: target.y}
        }

        return coordinates;
    }

    update() {
        if (this.parent.mouse && !this.connected) {
            this.coordinates = this.calculateBezier(this.source.position, this.parent.mouse);
        } else {
            this.coordinates = this.calculateBezier(this.source.position, this.target.position);
        }

        // Fade error color back to normal
        if (this.element.classList.contains('error')) {
            this.element.style.transitionDuration = this.transitionDuration;
            this.element.classList.remove('error');
        }

        this.element.style.d = this.parent.coorindatesToPath(this.coordinates);
    }

    remove(params = {}) {
        if (this.source) this.source.removeWires([this], params);
        if (this.target) this.target.removeWires([this], params);

        this.parent.removeChild(this.element);
    }
}
