class ForkDetectedError extends Error {
    public name: string;
    public message: string;
    public forkHeight: number;

    constructor(message: string, forkHeight: number) {
        super(message);
        Error.captureStackTrace(this, this.constructor);
        this.name = this.constructor.name;
        this.message = message;
        this.forkHeight = forkHeight;
    }
}

export default ForkDetectedError;