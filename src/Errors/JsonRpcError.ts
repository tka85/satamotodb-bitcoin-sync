class JsonRpcError extends Error {
    public name: string;
    public message: string;
    public cmd: string;
    public params: any[];

    constructor(message: string, cmd: string, params: any[] = []) {
        super(message);
        Error.captureStackTrace(this, this.constructor);
        this.name = this.constructor.name;
        this.message = message;
        this.cmd = cmd;
        this.params = params;
    }
}

export default JsonRpcError;