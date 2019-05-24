class NodeLab {
    constructor(container = document, params = {}) {
        container.classList.add("nodelab", "container");
        this.container = container;
        this.extensions = params.extensions || [];
        this.size = {width: this.container.clientWidth, height: this.container.clientHeight};
        this._uid = 0;

        this.on("update", () => this.update());
    }

    uid() {
        return this._uid++;
    }

    // Imports and initializes an extension
    create(extension, params = {}) {
        this.extensions.push(new extension(this, params.parent ? params.parent : this, params));
        return this.extensions[this.extensions.length - 1];
    }

    appendChild(element) {
        this.container.appendChild(element);
    }

    removeChild(element) {
        this.container.removeChild(element);
    }

    update() {
        // Call update for all registered extensions
        this.extensions.map(extension => {
            extension.update();
        });
    }

    // Add an event listener
    on(ev, action) {
        this.container.addEventListener(ev, action);
    }

    // Trigger an event
    trigger(ev, params = {}) {
        this.container.dispatchEvent(new CustomEvent(ev, params));
    }
}

// Extension template

class NodeLabExtension {
    constructor(nodelab, parent, params) {
        this.id = params.id || 'unspecified-' + nodelab.uid();
        this.nodelab = nodelab;
        this.parent = parent;
        this.init(params);
    }

    init(params) {
    }

    update() {
    }

    appendChild(element) {
        if (this.element) {
            this.element.appendChild(element);
        }
    }

    removeChild(element) {
        if (this.element) {
            this.element.removeChild(element);
        }
    }

    addElement(element, params = {classes: []}) {
        element.classList.add('nodelab', ...params.classes);
        element.id = params.id || 'unspecified-' + this.nodelab.uid();
        parent = params.parent || this.parent;

        // Apply custom parameters
        if (params.attributes) {
            Object.keys(params.attributes).map(attr => {
                element[attr] = params.attributes[attr];
            });
        }

        parent.appendChild(element);

        return element;
    }

    createElement(type, params = {classes: []}) {
        return this.addElement(document.createElement(type), params);
    }

    // Add an event listener
    on(ev, action) {
        this.element.addEventListener(ev, action);
    }

    // Trigger an event
    trigger(ev, details = {}) {
        this.element.dispatchEvent(new CustomEvent(ev, {detail: details}));
    }
}

// Extension tools
var NodeLabTools = {
    // Create aliased
    alias: ((data, aliases) => {
        if (data != null && aliases != null) {
            Object.keys(data).map(key => {
                data[aliases[key]] = data[key];
            });
        }
    }),

    arrayify: (data) => {
        return Array.isArray(data) ? data : [data];
    },

    getPointerTarget: (position, ignore = [], safetyLimit = 100) => {
        let counter = 0;
        let hidden = [];
        let target = null;

        while (!target) {
            let element = document.elementFromPoint(position.x, position.y);

            if (element) {
                if (element.dataset.nodelabTarget !== 'never' && !ignore.includes(element.id)) {
                    target = element;
                } else {
                    hidden.push({element: element, display: element.style.display});
                    element.style.display = 'none';
               }

                if(element.nodeName.toLowerCase() == "html") {
                    break;
                }

                if (safetyLimit && counter++ >= safetyLimit) break;
            } else {
                break;
            }
        }

        hidden.map(element => {element['element'].style.display = element['display'];});

        return target;
    },

    Draggable: class Draggable {
        constructor(parent, params = {}) {
            this.pointerStart = null;

            this.parent = parent;
            this.element = params.element || parent.element;
            this.onTranslate = params.onTranslate || (() => {});
            this.onStart = params.onStart || (() => {});
            this.onFinish = params.onFinish || (() => {});
            this.position = params.position || {x: 0, y: 0, z: 1};
            this.transform = params.transform || this.position;
            this.propagate = params.propagate || false;
            this.buttons = params.buttons || [1];
            this.previous = this.position;
            this.threshold = params.threshold || {x: 0, y: 0};
            this.middleMouse = params.middleMouse || false;
            this.cursor = params.cursor || null;
            this.snap = params.snap || null;
            this.hasMoved = false;

            this.initEvents();
        }

        initEvents() {
            this.element.style.touchAction = 'none';
            this.element.addEventListener('pointerdown', this.down.bind(this));
            window.addEventListener('pointermove', this.move.bind(this));
            window.addEventListener('pointerup', this.up.bind(this));
            if (!this.middleMouse) this.element.onmousedown = (e) => { if (e.button === 1) return false; }
        }

        down(e) {
            if (this.buttons.includes(e.buttons)) {
                if (!this.propagate) {
                    e.stopPropagation();
                }

                this.previous = this.position;
                this.pointerStart = [e.pageX, e.pageY];
                this.hasMoved = false;
                if (this.cursor) document.body.style.cursor = this.cursor;

                this.onStart(e);
            }
        }

        move(e) {
            if (this.buttons.includes(e.buttons)) {
                if (!this.pointerStart) return;
                e.preventDefault();

                let [x, y] = [e.pageX, e.pageY];
                let zoom = this.element.getBoundingClientRect().width / this.element.offsetWidth;
                let delta = {x: (x - this.pointerStart[0]) / zoom, y: (y - this.pointerStart[1]) / zoom};

                if (this.hasMoved || Math.abs(delta.x) > (this.threshold.x * zoom) || Math.abs(delta.y) > (this.threshold.y * zoom)) {
                    if (this.snap) {
                        // Correct position to snap offsets
                        this.position = {x: Math.floor(this.position.x / this.snap.x) * this.snap.x,
                                         y: Math.floor(this.position.y / this.snap.y) * this.snap.y};

                        delta = {x: (Math.floor(delta.x / this.snap.x) * this.snap.x),
                                 y: (Math.floor(delta.y / this.snap.y) * this.snap.y)};
                    }

                    this.hasMoved = true;
                    this.onTranslate(delta.x, delta.y, e);
                }
            }
        }

        up(e) {
            if (!this.pointerStart) return;

            e.elementMoved = this.hasMoved;
            this.hasMoved = false;
            this.pointerStart = null;
            document.body.style.cursor = null;
            this.onFinish(e);
        }
    }
}
