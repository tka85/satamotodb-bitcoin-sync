import debug = require('debug');
import assert = require('assert');
import { Pool, QueryResult, Client, PoolClient } from 'pg';
import Block from "./Block";
import Transaction from "./Transaction";
import Output from './Output';
import Input from './Input';
import ForkDetectedError from './Errors/ForkDetectedError';
import DbError from './Errors/DbError';
import Address from './Address';
import appConfig from '../appConfig.json';
import dbConfig from '../dbConfig.json';

const log = appConfig.debug.database ? debug('satamoto:Database') : Function.prototype;
const logError = appConfig.debug.database ? debug('satamoto:Database:error') : Function.prototype;

// Single client for whole app
const pool = new Pool({
    user: dbConfig.user,
    host: dbConfig.host,
    database: dbConfig.db,
    password: dbConfig.pass,
    port: dbConfig.port
});

// the pool will emit an error on behalf of any idle clients
// it contains if a backend error or network partition happens
pool.on('error', (err) => {
    logError('Unexpected db pool error', err);
    process.exit(1);
});

class Database {
    // Single client due to transactions
    static client: PoolClient;

    static async init(): Promise<void> {
        if (!Database.client) {
            try {
                Database.client = await pool.connect();
                log('Db client connected');
            } catch (err) {
                logError(err);
                throw new DbError('Failed db connect', null, null);
            };
        }
        return Promise.resolve();
    }

    static async doQuery(sql: string, params: any[] = []): Promise<any> {
        try {
            return await Database.client.query(sql, params);
        } catch (err) {
            logError(err);
            throw new DbError(err.message, sql, params);
        }
    }

    static async beginTransaction(): Promise<void> {
        log('BEGIN');
        await Database.doQuery('BEGIN');
        return Promise.resolve();
    }

    static async commitTransaction(): Promise<void> {
        log('COMMIT');
        await Database.doQuery('COMMIT');
        return Promise.resolve();
    }

    static async rollbackTransaction(): Promise<void> {
        log('ROLLBACK');
        await Database.doQuery('ROLLBACK');
        return Promise.resolve();
    }

    /**
     * @param height    {number}
     * @param blockhash {string}
     * @returns                     false if db has no block at this height, true if db has block with this hash at that height
     * @throws                      if db has block at this height but with diff hash (fork)
     */
    static async existsBlock({ height, blockhash }: { height: number, blockhash: string }): Promise<boolean> {
        let res = await Database.doQuery('SELECT 1 AS exists FROM block_btc WHERE height = $1 AND blockhash = $2 AND _is_valid = true', [height, blockhash]);
        if (!res.rows[0]) {
            log(`No valid db block exists @height ${height} with hash ${blockhash}`);
            // Check if a block with different hash exists at that height => fork
            res = await Database.doQuery('SELECT blockhash FROM block_btc WHERE height = $1 AND blockhash <> $2 AND _is_valid = true', [height, blockhash]);
            if (res.rows[0]) {
                throw new ForkDetectedError(`Fork detected!! Db block at height ${height} has hash ${res.rows[0].blockhash} instead of chain's ${blockhash}`, height);
            }
            // No valid block exists at this height
            log(`No valid db block exists @height ${height} at all`);
            return Promise.resolve(false);
        }
        assert(res.rows.length === 1 && res.rows[0] && res.rows[0].exists);
        log(`Db block with hash ${blockhash} already exists at height ${height}`);
        return Promise.resolve(true);
    }

    static async saveBlock(block: Block): Promise<number> {
        log(`Saving`, block);
        const sql = 'INSERT INTO block_btc(_branch_serial, blockhash, strippedsize, size, weight, height, version, versionhex, merkleroot, time, mediantime, nonce, bits, difficulty, chainwork, ntx, previousblockhash, _is_valid) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, true) RETURNING _block_serial';
        const params = [block._branchSerial, block.blockhash, block.strippedSize, block.size, block.weight, block.height, block.version, block.versionHex, block.merkleRoot, block.time, block.medianTime, block.nonce, block.bits, block.difficulty, block.chainwork, block.nTx, block.previousBlockhash];
        log(`Saving block`, block);
        const insertedBlockSerial = await Database.doQuery(sql, params);
        return Promise.resolve(insertedBlockSerial.rows[0]._block_serial);
    }

    static async saveTransaction(tx: Transaction): Promise<number> {
        log(`Saving`, tx);
        const sql = 'INSERT INTO tx_btc(_block_serial, txid, hash, size, vsize, weight, version, locktime, hex, _is_coinbase, _is_valid) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true) RETURNING _tx_serial';
        const params = [tx._blockSerial, tx.txid, tx.hash, tx.size, tx.vsize, tx.weight, tx.version, tx.locktime, tx.hex, tx.isCoinbase];
        const insertedTxSerial = await Database.doQuery(sql, params);
        return Promise.resolve(insertedTxSerial.rows[0]._tx_serial);
    }

    static async updateTransactionFee(tx: Transaction): Promise<void> {
        log(`Saving fee for`, tx);
        const sql = 'UPDATE tx_btc SET _fee = $1 WHERE _tx_serial=$2 AND _is_valid = true RETURNING _tx_serial';
        const params = [tx.fee, tx._txSerial];
        const updatedTxSerials = await Database.doQuery(sql, params);
        if (updatedTxSerials.rows.length !== 1) {
            throw new DbError(`Should have a single *valid* tx in db for _tx_serial ${tx._txSerial} but found ${updatedTxSerials.rows.length} (_tx_serials: ${JSON.stringify(updatedTxSerials.rows)})`, sql, params);
        }
        return Promise.resolve();
    }

    static async saveOutput(o: Output): Promise<number> {
        log(`Saving`, o);
        let sql = 'INSERT INTO output_btc(_tx_serial, vout, value, reqsigs, scriptasm, scripthex, scripttype, _spent_by_input_serial, _is_spent, _is_valid) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true) RETURNING _output_serial';
        let params = [o._txSerial, o.vout, o.value, o.reqSigs, o.scriptAsm, o.scriptHex, o.scriptType, o._spentByInputSerial, o._isSpent];
        const insertedOutputSerial = await Database.doQuery(sql, params);
        if (o.addresses) { // check because output of genesis block in regtest does not have addresses[] (??)
            o.addresses.forEach(async (nextAddr, addrIndex) => {
                sql = 'INSERT INTO output_address_btc(_output_serial, addr, addr_idx, addrtype, _is_valid) VALUES($1, $2, $3, $4, true)';
                params = [insertedOutputSerial.rows[0]._output_serial, nextAddr, addrIndex, Address.getAddressType(nextAddr)];
                await Database.doQuery(sql, params);
            });
        }
        return Promise.resolve(insertedOutputSerial.rows[0]._output_serial);
    }

    static async saveInput(i: Input): Promise<number> {
        log(`Saving`, i);
        let sql = 'INSERT INTO input_btc(_tx_serial, vin, _out_output_serial, out_value, seq, scriptasm, scripthex, txinwitness, _is_valid) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true) RETURNING _input_serial';
        let params = [i._txSerial, i.vin, i._outOutputSerial, i.outValue, i.seq, i.scriptAsm, i.scriptHex, i.txInWitness];
        const insertedInputSerial = await Database.doQuery(sql, params);
        sql = 'UPDATE output_btc SET _spent_by_input_serial = $1, _is_spent = true WHERE _output_serial = $2 AND _is_valid = true RETURNING _output_serial';
        params = [insertedInputSerial.rows[0]._input_serial, i._outOutputSerial];
        const updatedOutputSerials = await Database.doQuery(sql, params);
        if (updatedOutputSerials.rows.length !== 1) {
            throw new DbError(`Should have a single *valid* output in db for _output_serial = ${i._outOutputSerial} but found ${updatedOutputSerials.rows.length} (_output_serials: ${JSON.stringify(updatedOutputSerials.rows)})`, sql, params);
        }
        return Promise.resolve(insertedInputSerial.rows[0]._input_serial);
    }

    static async updateBlockCoinbase(block: Block): Promise<void> {
        log(`Setting block seq/coinbase to ${block.seq}/${block.coinbase}`);
        const sql = `UPDATE block_btc SET seq = $1, coinbase = $2 WHERE blockhash = $3 AND _is_valid = true RETURNING _block_serial`;
        const params = [block.seq, block.coinbase, block.blockhash];
        const updatedBlockSerials = await Database.doQuery(sql, params);
        if (updatedBlockSerials.rows.length !== 1) {
            throw new DbError(`Should have a single *valid* block in db for blockhash=${block.blockhash} but found ${updatedBlockSerials.rows.length} (_block_serials: ${JSON.stringify(updatedBlockSerials.rows)})`, sql, params);
        }
        return Promise.resolve();
    }

    static async getBestBranchSerial(): Promise<number> {
        const res = await Database.doQuery('SELECT max(_branch_serial) AS current_branch_serial FROM branch_btc');
        log(`Best branch serial:`, res.rows[0].current_branch_serial);
        return Promise.resolve(res.rows[0].current_branch_serial);
    }

    // We add new branch when there is a fork; parentBranchSerial is the branchSerial of the block at which the fork takes place
    static async addNewBranch(forkHeight: number, parentBranchSerial: number): Promise<number> {
        const sql = 'INSERT INTO branch_btc(_fork_height, _parent_branch_serial) VALUES($1, $2) RETURNING _branch_serial';
        const params = [forkHeight, parentBranchSerial];
        const insertedBranchSerial = await Database.doQuery(sql, params);
        if (!insertedBranchSerial.rows[0] || !insertedBranchSerial.rows[0]._branch_serial) {
            throw new DbError(`Failed to insert new branch @forkHeight ${forkHeight} with parent branch serial ${parentBranchSerial}`, sql, params);
        }
        log(`Added new branch`, insertedBranchSerial.rows[0]._branch_serial);
        return Promise.resolve(insertedBranchSerial.rows[0]._branch_serial);
    }

    static async getBestBlockHeight(): Promise<number> {
        const res = await Database.doQuery('SELECT max(height) AS best_height FROM block_btc WHERE _is_valid = true');
        if (!res.rows[0] || !res.rows[0].best_height) {
            // db empty, start at genesis
            return 0;
        }
        log(`Best valid block height`, res.rows[0].best_height);
        return Promise.resolve(res.rows[0].best_height);
    }

    static async getBlockhashByHeight(height: number): Promise<string> {
        const sql = 'SELECT blockhash FROM block_btc WHERE height = $1 AND _is_valid = true';
        const params = [height];
        const res = await Database.doQuery(sql, params);
        if (!res.rows[0] || !res.rows[0].blockhash) {
            throw new DbError(`Invalid height; no valid db block at height ${height}`, sql, params);
        }
        log(`Valid blockhash @height ${height}: ${res.rows[0].blockhash}`);
        return Promise.resolve(res.rows[0].blockhash);
    }

    static async getBlockBranchSerialByHeight(height: number): Promise<number> {
        const sql = 'SELECT _branch_serial FROM block_btc WHERE height = $1  AND _is_valid = true';
        const params = [height];
        const res = await Database.doQuery(sql, params);
        if (!res.rows[0] || !res.rows[0]._branch_serial) {
            throw new DbError(`Invalid height; no valid db block at height ${height}`, sql, params);
        }
        log(`Branch serial of block @height ${height} is ${res.rows[0]._branch_serial}`);
        return Promise.resolve(res.rows[0]._branch_serial);
    }

    // Invalidate blocks higher than the block @startHeight
    static async invalidateBlocksHigherThan(startHeight: number): Promise<void> {
        await Database.doQuery('UPDATE block_btc SET _is_valid = false WHERE height > $1', [startHeight]);
        return Promise.resolve();
    }

    static async getOutputSerial({ txid, vout }: { txid: string, vout: number }): Promise<number> {
        const sql = 'SELECT _output_serial FROM output_btc, tx_btc WHERE output_btc._tx_serial = tx_btc._tx_serial AND txid = $1 AND vout = $2 AND output_btc._is_valid = true';
        const params = [txid, vout];
        const res = await Database.doQuery(sql, params);
        if (res.rows.length !== 1) {
            // For given txid:vout only a single output in db can be valid
            throw new DbError(`Should have a single *valid* output in db for txid=${txid} / vout=${vout} but found ${res.rows.length} (hashes: ${JSON.stringify(res.rows)})`, sql, params);
        }
        return Promise.resolve(res.rows[0]._output_serial);
    }

    static async getOutputValue({ outputSerial }: { outputSerial: number }): Promise<number> {
        const sql = 'SELECT value FROM output_btc WHERE _output_serial = $1 AND _is_valid = true';
        const params = [outputSerial];
        const res = await Database.doQuery(sql, params);
        if (res.rows.length !== 1) {
            // For given outputSerial only a single output in db can be valid
            throw new DbError(`Should have a single *valid* output in db for _output_serial=${outputSerial} but found ${res.rows.length} (values: ${JSON.stringify(res.rows)})`, sql, params);
        }
        return Promise.resolve(res.rows[0].value);
    }

    static async shutdown() {
        log(`Shutting down Pg pool`);
        if (Database.client) {
            await Database.client.release();
        }
        await pool.end();
    }
}

export default Database;