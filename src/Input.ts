import Database from "./Database";
import debug = require('debug');

const log = debug('satamoto:Input');

class Input {
    public blockhash: string;
    public txid: string;
    public vin: number;
    public seq: number;
    public outBlockhash: string;
    public outTxid: string;
    public outVout: number;
    public outValue: number;
    public scriptAsm: string;
    public scriptHex: string;
    public txInWitness: string[];

    constructor({ blockhash, txid, vin, seq, outBlockhash, outTxid, outVout, outValue, scriptAsm, scriptHex, txInWitness }
        : { blockhash: string, txid: string, vin: number, seq: number, outBlockhash: string, outTxid: string, outVout: number, outValue: number, scriptAsm: string, scriptHex: string, txInWitness: string[] }) {
        this.blockhash = blockhash;
        this.txid = txid;
        this.vin = vin;
        this.seq = seq;
        this.outBlockhash = outBlockhash;
        this.outTxid = outTxid;
        this.outVout = outVout;
        this.outValue = outValue;
        this.scriptAsm = scriptAsm;
        this.scriptHex = scriptHex;
        this.txInWitness = txInWitness;
    }

    async save() {
        return await Database.saveInput(this);
    }
}

export default Input;