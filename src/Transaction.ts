import Database from "./Database";
import debug = require('debug');
import config from "./config";

const log = config.debug.tx ? debug('satamoto:Transaction') : Function.prototype;

class Transaction {
    public blockhash: string;
    public txid: string;
    public hash: string;
    public size: string;
    public vsize: string;
    public weight: string;
    public version: number;
    public locktime: string;
    public hex: string;
    public isCoinbase: boolean;
    public fee: number;

    constructor({ blockhash, txid, hash, size, vsize, weight, version, locktime, hex, isCoinbase }
        : { blockhash: string, txid: string, hash: string, size: string, vsize: string, weight: string, version: number, locktime: string, hex: string, isCoinbase: boolean }) {
        this.blockhash = blockhash;
        this.txid = txid;
        this.hash = hash;
        this.size = size;
        this.vsize = vsize;
        this.weight = weight;
        this.version = version;
        this.locktime = locktime;
        this.hex = hex;
        this.isCoinbase = isCoinbase;
    }

    async save(): Promise<void> {
        return await Database.saveTransaction(this);
    }

    async updateFee(fee: string): Promise<void> {
        this.fee = parseInt(fee, 10);
        return await Database.saveTransactionFee(this);
    }
}

export default Transaction;