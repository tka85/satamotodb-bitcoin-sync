class InvalidAddressError extends Error {
    public name: string;
    public message: string;
    public address: string;
    public network: string;

    constructor(message: string, address: string, network: string) {
        super(message);
        Error.captureStackTrace(this, this.constructor);
        this.name = this.constructor.name;
        this.message = message;
        this.address = address;
        this.network = network;
    }
}

export default InvalidAddressError;