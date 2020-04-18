class DbError extends Error {
    public name: string;
    public message: string;
    public sql: string;
    public params: any[];

    constructor(message: string, sql: string, params: any[]) {
        super(message);
        Error.captureStackTrace(this, this.constructor);
        this.name = this.constructor.name;
        this.message = message;
        this.sql = sql;
        this.params = params;
    }
}

export default DbError;