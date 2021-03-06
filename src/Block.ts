import JsonRpc from './JsonRpc';
import Database from './Database';
import Branch from './Branch';
import debug = require('debug');
import appConfig from '../appConfig.json';

const log = appConfig.debug.block ? debug('satamoto:Block') : Function.prototype;

class Block {
    public _blockSerial: number;
    public _branchSerial;
    public blockhash: string;
    public strippedSize: number;
    public size: number;
    public weight: number;
    public height: number;
    public version: number;
    public versionHex: string;
    public merkleRoot: string;
    public time: number;
    public medianTime: number;
    public nonce: number;
    public bits: string;
    public difficulty: string;
    public chainwork: string;
    public nTx: number;
    public previousBlockhash;
    public seq: number;
    public coinbase: string;

    constructor({ hash, size, strippedsize, weight, height, version, versionHex, merkleroot, time, mediantime, nonce, bits, difficulty, chainwork, nTx, previousblockhash }
        : { hash: string, size: number, strippedsize: number, weight: number, height: number, version: number, versionHex: string, merkleroot: string, time: number, mediantime: number, nonce: number, bits: string, difficulty: string, chainwork: string, nTx: number, previousblockhash: string }) {
        this.blockhash = hash;
        this.size = size;
        this.strippedSize = strippedsize;
        this.weight = weight;
        this.height = height;
        this.version = version;
        this.versionHex = versionHex;
        this.merkleRoot = merkleroot;
        this.time = time;
        this.medianTime = mediantime;
        this.nonce = nonce;
        this.bits = bits;
        this.difficulty = difficulty;
        this.chainwork = chainwork;
        this.nTx = nTx;
        this.previousBlockhash = previousblockhash;
        this._branchSerial = null; // will be filled in upon saving to db
    }

    static async exists({ height, blockhash }: { height: number, blockhash: string }): Promise<boolean> {
        return await Database.existsBlock({ height, blockhash });
    }

    async setBranch(): Promise<void> {
        this._branchSerial = await Branch.getBestSerial();
        log(`Set block branch serial to`, this._branchSerial);
        return Promise.resolve();
    }

    async save(): Promise<void> {
        await this.setBranch();
        this._blockSerial = await Database.saveBlock(this);
        return Promise.resolve();
    }

    async updateCoinbase({ seq, coinbase }: { seq: number, coinbase: string }): Promise<void> {
        this.seq = seq;
        this.coinbase = coinbase;
        return await Database.updateBlockCoinbase(this);
    }

    // Starts at best block in db and moves downwards until it find the first block that is in common with chain and returns its height
    static async getHeightOfBestBlockCommonWithChain(): Promise<number> {
        let nextHeight = await Database.getBestBlockHeight();
        let nextChainBlockhash = await JsonRpc.doRequest('getblockhash', [nextHeight]);
        let nextDbBlockhash = await Database.getBlockhashByHeight(nextHeight);
        while (nextChainBlockhash !== nextDbBlockhash && nextHeight > 0) {
            log(`Chain block (${nextChainBlockhash}) !== Db block (${nextDbBlockhash}) @height ${nextHeight}`);
            nextHeight--;
            nextChainBlockhash = await JsonRpc.doRequest('getblockhash', [nextHeight]);
            nextDbBlockhash = await Database.getBlockhashByHeight(nextHeight)
        }
        if (nextHeight === 0) {
            log(`??? Rewound all the way down to genesis block ???`);
        }
        log(`Found common block between chain and db @height ${nextHeight} (${nextDbBlockhash})`);
        return Promise.resolve(nextHeight);
    }

    static async getBranchSerialByHeight(height: number): Promise<number> {
        return await Database.getBlockBranchSerialByHeight(height);
    }

    // Invalidate blocks higher than the block @startHeight
    static async invalidateHigherThan(startHeight: number): Promise<void> {
        return await Database.invalidateBlocksHigherThan(startHeight);
    }
}

export default Block;