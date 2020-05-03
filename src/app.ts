import assert = require('assert');
import debug = require('debug');
import JsonRpc from './JsonRpc';
import { Big } from 'big.js';
import Block from './Block';
import Input from './Input';
import Output from './Output';
import Database from './Database';
import Transaction from './Transaction';
import Branch from './Branch';
import ForkDetectedError from './Errors/ForkDetectedError';
import JsonRpcError from './Errors/JsonRpcError';
import DbError from './Errors/DbError';
import Address from './Address';
import appConfig from '../appConfig.json';

const log = appConfig.debug.app ? debug('satamoto:app') : Function.prototype;
const logError = appConfig.debug.app ? debug('satamoto:app:error') : Function.prototype;

async function syncDb(startHeight: number = null): Promise<void> {
    await Database.init();
    await Address.init();

    const dbHeight = startHeight || await Database.getBestBlockHeight();
    const chainBlockcount = await JsonRpc.doRequest('getblockcount', []);
    const heightLimit = Math.max(chainBlockcount - appConfig.minConfirmations, 0);
    if (dbHeight + 1 > heightLimit) {
        log(`No syncing; db has ${dbHeight} blocks; chain has ${chainBlockcount} and required minConfirmation = ${appConfig.minConfirmations}`);
        return;
    }
    log(`Syncing db with chain for blocks ${dbHeight} ==> ${heightLimit} (out of total ${chainBlockcount} on chain)`);
    // Start check at current best db block in case there was a fork beneath it since last sync
    try {
        for (let height = dbHeight; height <= heightLimit; height++) {
            await Database.beginTransaction();
            const chainBlockhash = await JsonRpc.doRequest('getblockhash', [height]);
            log(`Chain block @height ${height}: ${chainBlockhash}`);
            if (!await Block.exists({ height, blockhash: chainBlockhash })) {
                const chainBlock = await JsonRpc.doRequest('getblock', [chainBlockhash, 2]);
                const dbBlock = new Block(chainBlock);
                await dbBlock.save();
                let isFirstTxOfBlock = true;
                for (const chainTx of chainBlock.tx) {
                    chainTx.isCoinbase = false;
                    if (isFirstTxOfBlock) {
                        assert(chainTx.vin[0].coinbase);
                        assert(chainTx.vin.length === 1);
                        chainTx.isCoinbase = true;
                    }
                    log(`height=${height} / tx=${chainTx.txid}`);
                    chainTx._blockSerial = dbBlock._blockSerial;
                    const dbTx = new Transaction(chainTx);
                    await dbTx.save();

                    let totalInputValue = new Big(0);
                    let totalOutputValue = new Big(0);
                    for (const chainOutput of chainTx.vout) {
                        const outValue = new Big(chainOutput.value).times(1e8);
                        const dbOutput = new Output({
                            _txSerial: dbTx._txSerial,
                            isCoinbase: dbTx.isCoinbase,
                            vout: chainOutput.n,
                            value: parseInt(outValue.toFixed(), 10),
                            addresses: chainOutput.scriptPubKey.addresses || null,
                            reqSigs: chainOutput.scriptPubKey.reqSigs || null,
                            scriptAsm: chainOutput.scriptPubKey.asm,
                            scriptHex: chainOutput.scriptPubKey.hex,
                            scriptType: chainOutput.scriptPubKey.type
                        });
                        await dbOutput.save();
                        totalOutputValue = totalOutputValue.plus(outValue);
                    }
                    for (let i = 0; i < chainTx.vin.length; i++) {
                        if (chainTx.isCoinbase) {
                            // Coinbase input data is saved in block
                            await dbBlock.updateCoinbase({ seq: chainTx.vin[0].sequence, coinbase: chainTx.vin[0].coinbase });
                        } else {
                            const outTxid = chainTx.vin[i].txid;
                            const outVout = chainTx.vin[i].vout;
                            const _outOutputSerial = await Output.getSerial({ txid: outTxid, vout: outVout });
                            const outValue = await Output.getValue({ outputSerial: _outOutputSerial });
                            const dbInput = new Input({
                                _txSerial: dbTx._txSerial,
                                vin: i,
                                _outOutputSerial,
                                outValue,
                                seq: chainTx.vin[i].sequence,
                                scriptAsm: chainTx.vin[i].scriptSig && chainTx.vin[i].scriptSig.asm || null,
                                scriptHex: chainTx.vin[i].scriptSig && chainTx.vin[i].scriptSig.hex || null,
                                txInWitness: chainTx.vin[i].txinwitness || null
                            });
                            await dbInput.save();
                            totalInputValue = totalInputValue.plus(outValue);
                        }
                    }
                    if (!chainTx.isCoinbase) {
                        await dbTx.updateFee(totalInputValue.minus(totalOutputValue).toFixed());
                    }
                    isFirstTxOfBlock = false;
                }
            }
            await Database.commitTransaction();
        }
    } catch (err) {
        if (err instanceof ForkDetectedError) {
            // Not db error, commit
            await Database.commitTransaction();
            // Fork beneath best db block could only have happened when checking the best db block i.e. the first block checked against chain
            logError(err);
            // Find height of best common block between Db and Chain
            log('Rewinding to find best common block with chain');
            const bestCommonBlockHeight = await Block.getHeightOfBestBlockCommonWithChain();
            const bestCommonBlockBranchSerial = await Block.getBranchSerialByHeight(bestCommonBlockHeight);
            // Add new branch for fork; its parent branch is the branch of the best common block between db and chain
            await Branch.addNew(bestCommonBlockHeight, bestCommonBlockBranchSerial);
            // Invalidate all db blocks from bestCommonBlockHeight upwards
            Block.invalidateHigherThan(bestCommonBlockHeight);
            // Recursive call to sync from height of best common block
            return await syncDb(bestCommonBlockHeight);
        } else if (err instanceof JsonRpcError) {
            await Database.rollbackTransaction();
            logError(`Failed JSON-RPC request "${err.cmd}" with params "${JSON.stringify(err.params)}". ERROR:`, err.message, 'STACK:', err.stack);
        } else if (err instanceof DbError) {
            await Database.rollbackTransaction();
            logError(`Failed database query "${err.sql}" with params "${JSON.stringify(err.params)}". ERROR:`, err.message, 'STACK:', err.stack);
        } else {
            logError('*** Unknown error', err);
        }
        // In all cases except ForkDetectedError, propagate error so app terminates
        throw err;
    }
}

async function sleep(t = 10000) {
    log(`Sleeping for ${t / 1000}s...`);
    return new Promise((res, rej) => {
        setTimeout(() => {
            res();
        }, t);
    });
}

; (async function infinity() {
    while (true) {
        // Kickstart syncing
        await syncDb()
            .catch(async (err) => {
                logError(err);
            })
        await sleep();
    }
})();