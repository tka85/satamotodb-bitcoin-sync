import Database from "./Database";
import debug = require('debug');
import appConfig from '../appConfig.json';

const log = appConfig.debug.input ? debug('satamoto:Input') : Function.prototype;

class Input {
    public _inputSerial: number;
    public _txSerial: number;
    public vin: number;
    public seq: number;
    public _outOutputSerial: number;
    public outValue: number;
    public scriptAsm: string;
    public scriptHex: string;
    public txInWitness: string[];

    constructor({ _txSerial, vin, seq, _outOutputSerial, outValue, scriptAsm, scriptHex, txInWitness }
        : { _txSerial: number, vin: number, seq: number, _outOutputSerial: number, outValue: number, scriptAsm: string, scriptHex: string, txInWitness: string[] }) {
        this._txSerial = _txSerial;
        this.vin = vin;
        this.seq = seq;
        this._outOutputSerial = _outOutputSerial;
        this.outValue = outValue;
        this.scriptAsm = scriptAsm;
        this.scriptHex = scriptHex;
        this.txInWitness = txInWitness;
    }

    async save() {
        this._inputSerial = await Database.saveInput(this);
        return Promise.resolve();
    }
}

export default Input;