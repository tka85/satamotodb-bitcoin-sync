# Satamotodb Bitcoin project

## Summary

Application that exports Bitcoin's blockchain data (blocks, txs, inputs, outputs, addresses etc.) and stores them in a Postgres database.

Uses docker-compose and starts two containers:

* `satamoto_postgres` running Postgresql based on official Postgresql docker image
* `satamoto_bitcoin_node1` based on docker image [`satamotodb-bitcoin-node`](https://github.com/tka85/satamotodb-bitcoin-node)

## Reorg detection

A reorg (chain fork) is detected when we have in the database at a specific height already a block but it has a different hash from what is on the chain atsame height.

The application can detect reorgs that occur between runs. When a reorg is detected, the application invalidates in the database all affected blocks and all relevant data belonging to these blocks by setting their `_is_valid` field to `false`. For this reason the `_is_valid` field should always be used when querying the database.

The application follows the blockchain's philosophy of being an append-only ledger. So data is never deleted from the database. This way the database holds more than the blockchain does, since it keeps a clear record of the reorg events as well. This historical record of the reorg events is achieved by relating all blocks (and their transactions/inputs/otputs etc.) with a specific branch.

Therefore an outpoint (`txid:vout`) is no longer sufficient to uniquely identify a UTXO in the database. For this we need additionally the blockhash. This is so because in a reorg a transaction that exists in both competing branches of the fork will have the same txid. It is the competing blocks of the fork that are guaranteed to have different blockhashes and this helps differentiate the same transaction (and all relevant data) as it exists in both branches.

## Execution preparation

### Build satamotodb-bitcoin-node image

See project [satamotodb-bitcoin-node](https://github.com/tka85/satamotodb-bitcoin-node). This image has nodejs and bitcoind but does not start bitcoind by default. For this see `bitcoind-start.sh`.

### Install dependencies

Assuming you have npm installed locally:

```bash
npm i
```

### Required edit: select a bitcoin.conf

You need to edit in `docker-compose.yml` the `volumes` section of service `satamoto_bitcoin_node1`.

Uncomment only one of the three lines (`bitcoin-mainnet.conf`, `bitcoin-testnet.conf` or `bitcoin-regtest.conf`) that mounts the `bitcoin.conf`, depending on which blockchain data you want to collect.

### Optional edit: mount locally synced blockchain data

If you have locally synced blockchain data you can mount it so bitcoind can use it instead of syncing from scratch. To do so, unncomment and edit accordingly one of the two lines that mounts the chain data depending again on the netowrk.

If you don't have locally synced blockchain data, bitcoind will sync the chain data from scratch.

## Execution

Start the two containers, attach to `satamoto_bitcoin_node1` and run the application that fetches from bitcoind the chain data and populates the database:

```bash
docker-compose up
docker exec -it satamoto_bitcoin_node1 /bin/bash
su bitcoin                  # switch to user bitcoin
bitcoin-cli getblockcount   # healthcheck if daemon is up, correctly configured and responding to JSON-RPC requests
cd /opt/app && npm run build && node dist/src/app.js
```

In the database all amounts are in Satoshis and all timestamps are either in epoch or in UTC.

The next time the application runs, it will sync starting from the most recent valid block. Since all database operations use transactions, a block will never by half-synced even if your abrubtly stop the application halfway through a block.

## Connecting to Postgresql

Attach to the container `satamoto_postgres` and connect using `psql`:

```bash
docker exec -it satamoto_postgres /bin/bash
psql -U postgres -d satamoto
```

## Optional wallet table

The database table `wallet` is for populating it with your own wallet's addresses so you can do queries like:

* evaluate your balance
* get the set of your unspents
