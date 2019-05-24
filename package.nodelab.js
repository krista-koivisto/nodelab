class NodeLabPackage extends NodeLabExtension {
    init(params) {
        this.name = "NodeLab Package";
        this.category = params.category || null;
        this.graph = params.graph || [];
        this.outputType = params.outputType || null;
        this.outputNode = params.output || this.getOutputNode();
        this.expression = params.expression || null;
        this.component = params.component || null;
        this.component.object = null;
        this.spawner = params.spawner || null;

        // Only take unused inputs from the output node for the package
        let inputs = this.outputNode.inputs;
        let inputNames = Object.keys(inputs).filter(node => (inputs[node].socket.connections.length == 0 && inputs[node].value == 0));
        this.component.settings = {...this.outputNode.settings, title: {text: this.component.settings.name}};
        this.component.settings.inputs = [Object.keys(this.outputNode.inputs)[0], ...inputNames];
        this.component.settings.outputs = Object.keys(this.outputNode.outputs);
        this.component.settings.internal = params.internal || null;
        delete this.component.settings.id;
        delete this.component.settings.position;
    }

    async spawn() {
        let obj = null;
        if (this.component && this.spawner) {
            obj = await this.spawner(this.component.objectType, this.component.settings);
            let expressionInput = obj.inputs[Object.keys(obj.inputs)[0]];
            expressionInput.socket.state = 'disabled';
            expressionInput.socket.updateState();
            expressionInput.setValue(this.getExpression());
            obj.update();
        } else if (!this.spawner) {
            throw "NodeLabPackage: package has no spawner! (Attach a graph addNode function for example.)";
        } else {
            throw "NodeLabPackage: package has no NodeLabComponent to spawn!";
        }

        this.parent.update();

        return obj;
    }

    spawnSource() {
    }

    getOutputNode() {
        let outputNode = null;

        if (this.outputNode) {
            outputNode = this.outputNode;
        } else if (this.outputType) {
            outputNode = this.graph.find(node => {
                const isOutput = node.objectType === this.outputType || node.objectType === this.outputType.name;
                const canOutput = node.settings.output === undefined || node.settings.output; // 'undefined' for backward compatibility
                if (isOutput && canOutput) return node;
            });
        } else {
            throw "NodeLabPackage: package has no output node type!";
        }

        if (outputNode) {
            return outputNode;
        } else {
            throw "NodeLabPackage: package has no node of type '" + this.outputType.name + "'!";
        }
    }

    getExpression() {
        if (this.expression) {
            return this.expression;
        } else {
            throw "NodeLabPackage: I can't figure out how I work yet! You tell me! :<";
        }
    }

    update() {
    }
}
