import debug = require('debug');
import assert = require('assert');
import { Pool, QueryResult, Client, PoolClient } from 'pg';
import Block from "./Block";
import Transaction from "./Transaction";
import Output from './Output';
import Input from './Input';
import ForkDetectedError from './Errors/ForkDetectedError';
import DbError from './Errors/DbError';
import appConfig from './appConfig.json';
import dbConfig from './dbConfig.json';
import Address from './Address';

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

    static async doQuery(sql: string, params: any[] = []): Promise<QueryResult> {
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

    static async saveBlock(block: Block): Promise<void> {
        log(`Saving`, block);
        const sql = 'INSERT INTO block_btc(_branch_id, blockhash, strippedsize, size, weight, height, version, versionhex, merkleroot, time, mediantime, nonce, bits, difficulty, chainwork, ntx, previousblockhash, _is_valid) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)';
        const params = [block._branchId, block.blockhash, block.strippedSize, block.size, block.weight, block.height, block.version, block.versionHex, block.merkleRoot, block.time, block.medianTime, block.nonce, block.bits, block.difficulty, block.chainwork, block.nTx, block.previousBlockhash, true];
        log(`Saving block `, block);
        await Database.doQuery(sql, params);
        return Promise.resolve();
    }

    static async saveTransaction(tx: Transaction): Promise<void> {
        log(`Saving `, tx);
        const res = await Database.doQuery(
            'INSERT INTO tx_btc(blockhash, txid, hash, size, vsize, weight, version, locktime, hex, _is_coinbase, _is_valid) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
            [tx.blockhash, tx.txid, tx.hash, tx.size, tx.vsize, tx.weight, tx.version, tx.locktime, tx.hex, tx.isCoinbase, true]
        );
        return Promise.resolve();
    }

    static async saveTransactionFee(tx: Transaction): Promise<void> {
        log(`Saving fee for`, tx);
        await Database.doQuery(
            'UPDATE tx_btc SET _fee = $1 WHERE blockhash = $2 AND txid = $3 AND _is_valid = $4',
            [tx.fee, tx.blockhash, tx.txid, true]
        );
        return Promise.resolve();
    }

    static async saveOutput(o: Output): Promise<void> {
        log(`Saving`, o);
        let sql = 'INSERT INTO output_btc(blockhash, txid, vout, value, reqsigs, scriptasm, scripthex, scripttype, _spent_by_blockhash, _spent_by_txid,  _spent_by_vin, _is_spent, _is_valid) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)';
        let params = [o.blockhash, o.txid, o.vout, o.value, o.reqSigs, o.scriptAsm, o.scriptHex, o.scriptType, o._spentByBlockhash, o._spentByTxid, o._spentByVin, o._isSpent, true];
        await Database.doQuery(sql, params);
        if (o.addresses) { // check because output of genesis block in regtest does not have addresses[] (??)
            let addrIndex = 0;
            for (const nextAddr of o.addresses) {
                sql = 'INSERT INTO output_address_btc(blockhash, txid, vout, addr, addr_idx, addrtype, _is_valid) VALUES($1, $2, $3, $4, $5, $6, $7)';
                params = [o.blockhash, o.txid, o.vout, nextAddr, addrIndex, Address.getAddressType(nextAddr), true];
                await Database.doQuery(sql, params);
                addrIndex++;
            }
        }
        return Promise.resolve();
    }

    static async saveInput(i: Input): Promise<void> {
        log(`Saving`, i);
        let sql = 'INSERT INTO input_btc(blockhash, txid, vin,  seq, out_blockhash, out_txid, out_vout, out_value, scriptasm, scripthex, txinwitness, _is_valid) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)';
        let params = [i.blockhash, i.txid, i.vin, i.seq, i.outBlockhash, i.outTxid, i.outVout, i.outValue, i.scriptAsm, i.scriptHex, i.txInWitness, true];
        await Database.doQuery(sql, params);
        sql = 'UPDATE output_btc SET _spent_by_blockhash = $1, _spent_by_txid = $2, _spent_by_vin = $3, _is_spent = true WHERE blockhash = $4 AND txid = $5 AND vout = $6 AND value = $7 AND _is_valid = true RETURNING _output_id';
        params = [i.blockhash, i.txid, i.vin, i.outBlockhash, i.outTxid, i.outVout, i.outValue];
        const updated = await Database.doQuery(sql, params);
        if (updated.rows.length !== 1) {
            throw new DbError(`Should have a single *valid* output in db for blockhash=${i.outBlockhash} / txid=${i.outTxid} / vout=${i.outVout} but found ${updated.rows.length} (_output_ids: ${JSON.stringify(updated.rows)})`, sql, params);
        }
        return Promise.resolve();
    }

    static async updateBlockCoinbase(block: Block): Promise<void> {
        log(`Setting block seq/coinbase to ${block.seq}/${block.coinbase}`);
        const sql = `UPDATE block_btc SET seq = $1, coinbase = $2 WHERE blockhash = $3 AND _is_valid = true RETURNING _block_id`;
        const params = [block.seq, block.coinbase, block.blockhash];
        const updated = await Database.doQuery(sql, params);
        if (updated.rows.length !== 1) {
            throw new DbError(`Should have a single *valid* block in db for blockhash=${block.blockhash} but found ${updated.rows.length} (_block_ids: ${JSON.stringify(updated.rows)})`, sql, params);
        }
        return Promise.resolve();
    }

    static async getBestBranchId(): Promise<number> {
        const res = await Database.doQuery('SELECT max(_branch_id) AS current_branch_id FROM branch_btc');
        log(`Best branch id:`, res.rows[0].current_branch_id);
        return Promise.resolve(res.rows[0].current_branch_id);
    }

    // We add new branch when there is a fork; parentBranchId is the branchId of the block at which the fork takes place
    static async addNewBranch(forkHeight: number, parentBranchId: number): Promise<number> {
        const sql = 'INSERT INTO branch_btc(_fork_height, _parent_branch) VALUES($1, $2) RETURNING _branch_id';
        const params = [forkHeight, parentBranchId];
        const res = await Database.doQuery(sql, params);
        if (!res.rows[0] || !res.rows[0]._branch_id) {
            throw new DbError(`Failed to insert new branch @forkHeight ${forkHeight} with parent branch id ${parentBranchId}`, sql, params);
        }
        log(`Added new branch`, res.rows[0]._branch_id);
        return Promise.resolve(res.rows[0]._branch_id);
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

    static async getBlockBranchIdByHeight(height: number): Promise<number> {
        const sql = 'SELECT _branch_id FROM block_btc WHERE height = $1  AND _is_valid = true';
        const params = [height];
        const res = await Database.doQuery(sql, params);
        if (!res.rows[0] || !res.rows[0]._branch_id) {
            throw new DbError(`Invalid height; no valid db block at height ${height}`, sql, params);
        }
        log(`Branch id of block @height ${height} is ${res.rows[0]._branch_id}`);
        return Promise.resolve(res.rows[0]._branch_id);
    }

    // Invalidate blocks higher than the block @startHeight
    static async invalidateBlocksHigherThan(startHeight: number): Promise<void> {
        await Database.doQuery('UPDATE block_btc SET _is_valid = false WHERE height > $1', [startHeight]);
        return Promise.resolve();
    }

    static async getOutputBlockhash({ txid, vout }: { txid: string, vout: number }): Promise<string> {
        const sql = 'SELECT blockhash FROM output_btc WHERE txid = $1 AND vout = $2 AND _is_valid = true';
        const params = [txid, vout];
        const res = await Database.doQuery(sql, params);
        if (res.rows.length !== 1) {
            // For given txid:vout only a single output in db can be valid
            throw new DbError(`Should have a single *valid* output in db for txid=${txid} / vout=${vout} but found ${res.rows.length} (hashes: ${JSON.stringify(res.rows)})`, sql, params);
        }
        return Promise.resolve(res.rows[0].blockhash);
    }

    static async getOutputValue({ blockhash, txid, vout }: { blockhash: string, txid: string, vout: number }): Promise<number> {
        const sql = 'SELECT value FROM output_btc WHERE blockhash = $1 AND txid = $2 AND vout = $3 AND _is_valid = true';
        const params = [blockhash, txid, vout];
        const res = await Database.doQuery(sql, params);
        if (res.rows.length !== 1) {
            // For given blockhash:txid:vout only a single output in db can be valid
            throw new DbError(`Should have a single *valid* output in db for blockhash=${blockhash} / txid=${txid} / vout=${vout} but found ${res.rows.length} (values: ${JSON.stringify(res.rows)})`, sql, params);
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