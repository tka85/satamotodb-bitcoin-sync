import { Address, Script } from './types';
import Database from './Database';
import debug = require('debug');
import appConfig from './appConfig.json';

const log = appConfig.debug.output ? debug('satamoto:Output') : Function.prototype;

// Database tx output
class Output {
    public blockhash: string;
    public txid: string;
    public vout: number;
    public value: number;
    public addresses: string[];
    public reqSigs: number;
    public scriptAsm: string;
    public scriptHex: string;
    public scriptType: Script;
    public isCoinbase: boolean;
    public _spentByBlockhash: string;
    public _spentByTxid: string;
    public _spentByVin: number;
    public _isSpent: boolean;

    constructor({ blockhash, txid, isCoinbase, vout, value, addresses, reqSigs, scriptAsm, scriptHex, scriptType }
        : { blockhash: string, txid: string, isCoinbase: boolean, vout: number, value: number, addresses: string[], reqSigs: number, scriptAsm: string, scriptHex: string, scriptType: Script }) {
        this.blockhash = blockhash;
        this.txid = txid;
        this.isCoinbase = isCoinbase;
        this.vout = vout;
        this.value = value;
        this.addresses = addresses;
        this.reqSigs = reqSigs;
        this.scriptAsm = scriptAsm;
        this.scriptHex = scriptHex;
        this.scriptType = scriptType;
        this._spentByBlockhash = null;
        this._spentByTxid = null;
        this._spentByVin = null;
        this._isSpent = false;
    }

    async save() {
        return await Database.saveOutput(this);
    }

    static async getBlockhash({ txid, vout }: { txid: string, vout: number }): Promise<string> {
        return await Database.getOutputBlockhash({ txid, vout });
    }

    static async getValue({ blockhash, txid, vout }: { blockhash: string, txid: string, vout: number }): Promise<number> {
        return await Database.getOutputValue({ blockhash, txid, vout });
    }
}

export default Output;