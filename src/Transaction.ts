import Database from "./Database";
import debug = require('debug');
import appConfig from '../appConfig.json';

const log = appConfig.debug.tx ? debug('satamoto:Transaction') : Function.prototype;

class Transaction {
    public _txSerial: number;
    public _blockSerial: number;
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

    constructor({ _blockSerial, txid, hash, size, vsize, weight, version, locktime, hex, isCoinbase }
        : { _blockSerial: number, txid: string, hash: string, size: string, vsize: string, weight: string, version: number, locktime: string, hex: string, isCoinbase: boolean }) {
        this._blockSerial = _blockSerial;
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
        this._txSerial = await Database.saveTransaction(this);
        return Promise.resolve();
    }

    /**
     *
     * @param fee   {string}        fee in satoshis
     */
    async updateFee(fee: string): Promise<void> {
        this.fee = parseInt(fee, 10);
        return await Database.updateTransactionFee(this);
    }
}

export default Transaction;