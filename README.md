# Satamotodb bitcoin-sync image

## Summary

**NOTE**: This is not a stand-alone application. It is part of the project [satamotodb](https://github.com/tka85/satamotodb). Check out the [architecture plan](https://github.com/tka85/satamotodb/architecture.svg) for the various components.

The bitcoin-sync image contains a Node.js application that exports Bitcoin's blockchain data (blocks, txs, inputs, outputs, addresses etc.) from a [satamotodb-bitcoin-node](https://github.com/tka85/satamotodb-bitcoin-node) and stores them in a Postgres database. Check satamotodb's [docker-compose.yml](https://github.com/tka85/satamotodb/blob/master/docker-compose.yml) to see how this image is used and how it provides the config files needed by `satamotodb-bitcoin-sync` which here only contains empty configs:

* appConfig.json
* dbConfig.json
* rpcConfig.json


## Reorg detection

A reorg (chain fork) is detected when we have in the database at a specific height already a block but it has a different hash from what is on the chain atsame height.

The application can detect reorgs. When a reorg is detected, the application invalidates in the database all affected blocks and all relevant data belonging to these blocks by setting their `_is_valid` field to `false`. For this reason the `_is_valid` field should always be used when querying the database.

The application follows the blockchain's philosophy of being an append-only ledger in the sense that data is never deleted from the database. This way the database holds more than the blockchain does, since it keeps a clear record of the reorg events as well. This historical record of the reorg events is achieved by relating all blocks (and their transactions/inputs/otputs etc.) with a specific branch.

Therefore an outpoint (`txid:vout`) is no longer sufficient to uniquely identify a UTXO in the database. For this we need additionally the blockhash. This is so because in a reorg a transaction that exists in both competing branches of the fork will have the same txid. It is the competing blocks of the fork that are guaranteed to have different blockhashes and this helps differentiate the same transaction (and all relevant data) as it exists in both branches. Each time a reorg is detected, a new branch is created and certain blocks of the previous branch are invalidated.

## Build

```bash
 docker build . -t satamotodb-bitcoin-sync
```
