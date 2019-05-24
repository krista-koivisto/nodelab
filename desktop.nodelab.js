class NodeLabDesktop extends NodeLabExtension {
    init(params) {
        this.name = "NodeLab Desktop";
        this.grid = params.grid || null;
        this.graphs = [];

        this.createDesktop(params);

        this.zoom = params.zoom || 1.0;

        const initialTransform = {
            x: 1000 - (this.element.offsetWidth / 2.0),
            y: 500 - (this.element.offsetHeight / 2.0),
            z: 0
        };

        // Make desktop draggable
        this.draggable = new NodeLabTools.Draggable(this, {
            buttons: [2, 4],
            onTranslate: this.onTranslate,
            onFinish: this.onFinish,
            position: initialTransform,
            transform: initialTransform,
            cursor: this.dragCursor || 'grabbing',
        });

        // Private transform update function
        this.updateTransform = (() => {
            this.size = {
                width: this.element.offsetWidth,
                height: this.element.offsetHeight
            };

            this.offset = {
                ...this.draggable.transform
            };

            this.view = {
                width: this.nodelab.container.clientWidth,
                height: this.nodelab.container.clientHeight,

                x: (-this.offset.x + (this.nodelab.container.clientWidth / 2.0) - this.size.width / 2.0) / this.zoom + this.size.width / 2.0,
                y: (-this.offset.y + (this.nodelab.container.clientHeight / 2.0) - this.size.height / 2.0) / this.zoom + this.size.height / 2.0,
                z:  this.offset.z + this.zoom
            };
        });

        // Set transform data to defaults
        this.update();

        // Create connector instance if one is requested
        if (params.connector && params.connector.extension) {
            this.connector = this.registerConnector(params.connector);
        }

        // Register mouse events
        this.on("pointermove", params.onMouseMove || this.onMouseMove.bind(this));
        this.on("click", params.onClick || this.onClick.bind(this));
        this.on("wheel", params.onMouseWheel || this.onMouseWheel.bind(this));
    }

    createSurface() {
        if (!this.svg) {
            // Create an SVG surface for drawing connections on
            this.svg = this.addElement(document.createElementNS('http://www.w3.org/2000/svg', 'svg'), {
                parent: this,
                classes: ['connector', 'noselect']
            });

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

    createDesktop(params) {
        // Create HTML element
        this.element = this.createElement('div', {classes: ['desktop', 'noselect']});

        // Set position
        const [width, height] = params.size ? [params.size.width, params.size.height] : [5000, 5000];
        this.element.style.width = width + 'px';
        this.element.style.height = height + 'px';
        this.element.id = params.id || 'nodelab-desktop-' + this.nodelab.uid();
        this.element.dataset.nodelabTarget = 'never';

        // Grid
        if (this.grid) {
            const gridColor = this.grid.color || '#dddddd';
            const gridThickness = (this.grid.thickness || '1') + 'px';
            const gridBackground = this.grid.background || '#ffffff';
            this.element.style.backgroundImage = 'linear-gradient(to right, '+gridColor+' '+gridThickness+', transparent 1px),' +
                                                  'linear-gradient(to bottom, '+gridColor+' '+gridThickness+', '+gridBackground+' 1px)';
            this.element.style.backgroundSize = this.grid.size ? this.grid.size.width + 'px ' + this.grid.size.height + 'px' : '20px 20px';
        }
    }

    onClick(e) {
    }

    onMouseMove(e) {
        const zoom = 1.0/this.zoom;
        const pos = this.element.getBoundingClientRect();

        this.mouse = {
            x: (e.clientX - pos.x) * zoom,
            y: (e.clientY - pos.y) * zoom
        };

        if (this.connector) {
            this.connector.update();
        }
    }

    onMouseWheel(e) {
        // Normalize delta across browsers
        const delta = (e.deltaY > 0 ? 1 : -1) / 24;
        this.zoom -= delta;

        // Lock zoom to 0.1 - 1.5
        if (this.zoom > 1.5) {
            this.zoom = 1.5;
        } else if (this.zoom < 0.1) {
            this.zoom = 0.1;
        }

        this.nodelab.trigger("update");
    }

    onTranslate(x, y, e) {
        this.transform = {x: this.position.x + (x * this.parent.zoom), y: this.position.y + (y * this.parent.zoom), z: this.position.z};
        this.parent.nodelab.trigger("update");
    }

    onFinish(e) {
        this.position = {x: this.transform.x, y: this.transform.y, z: this.transform.z};
    }

    show() {
        this.element.style.display = 'block';
    }

    hide() {
        this.element.style.display = 'none';
    }

    update() {
        const [x, y, z] = [this.draggable.transform.x, this.draggable.transform.y, this.zoom];
        this.element.style.transform = 'translate(' + x + 'px, ' + y + 'px) scale('+ z +')';

        this.updateTransform();
    }

    remove() {
        this.graphs.map(graph => {
            graph.remove();
        });

        this.element.remove();
    }
}
