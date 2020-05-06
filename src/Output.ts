import { Address, Script } from './types';
import Database from './Database';
import debug = require('debug');
import appConfig from '../appConfig.json';

const log = appConfig.debug.output ? debug('satamoto:Output') : Function.prototype;

// Database tx output
class Output {
    public _outputSerial: number;
    public _txSerial: number;
    public vout: number;
    public value: number;
    public addresses: string[];
    public reqSigs: number;
    public scriptAsm: string;
    public scriptHex: string;
    public scriptType: Script;
    public isCoinbase: boolean;
    public _spentByInputSerial: number;
    public _isSpent: boolean;

    constructor({ _txSerial, isCoinbase, vout, value, addresses, reqSigs, scriptAsm, scriptHex, scriptType }
        : { _txSerial: number, isCoinbase: boolean, vout: number, value: number, addresses: string[], reqSigs: number, scriptAsm: string, scriptHex: string, scriptType: Script }) {
        this._txSerial = _txSerial;
        this.isCoinbase = isCoinbase;
        this.vout = vout;
        this.value = value;
        this.addresses = addresses;
        this.reqSigs = reqSigs;
        this.scriptAsm = scriptAsm;
        this.scriptHex = scriptHex;
        this.scriptType = scriptType;
        this._spentByInputSerial = null;
        this._isSpent = false;
    }

    async save(): Promise<void> {
        this._outputSerial = await Database.saveOutput(this);
        return Promise.resolve();
    }

    static async getSerial({ txid, vout }: { txid: string, vout: number }): Promise<number> {
        return await Database.getOutputSerial({ txid, vout });
    }

    static async getValue({ outputSerial }: { outputSerial: number }): Promise<number> {
        return await Database.getOutputValue({ outputSerial });
    }
}

export default Output;