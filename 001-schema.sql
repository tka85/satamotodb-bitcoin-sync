CREATE TYPE typeof_btc_address AS ENUM (
    'legacy',
    'p2sh-segwit',
    'bech32'
);

CREATE TYPE typeof_btc_script AS ENUM (
    'pubkey',
    'pubkeyhash',
    'scripthash',
    'multisig',
    'nulldata',
    'witness_v0_keyhash',
    'witness_v0_scripthash',
    'witness_unknown',
    'nonstandard'
);

CREATE TABLE IF NOT EXISTS branch_btc (
    _branch_id serial PRIMARY KEY,
    _fork_height integer NOT NULL,
    _time bigint DEFAULT EXTRACT(EPOCH FROM NOW()),
    _parent_branch integer
);

-- consider using genesis block's creation time for initial default branch
INSERT INTO branch_btc (_fork_height, _time)
    VALUES (0, EXTRACT(EPOCH FROM NOW()));

CREATE TABLE IF NOT EXISTS block_btc (
    _block_id serial PRIMARY KEY,
    _branch_id integer,
    blockhash text NOT NULL,
    strippedsize bigint,
    size bigint,
    weight bigint,
    height integer,
    version integer,
    versionhex text,
    merkleroot text,
    time bigint,
    mediantime bigint,
    nonce bigint,
    bits text,
    difficulty text,
    chainwork text,
    ntx integer,
    previousblockhash text,
    seq bigint, -- coinbase tx
    coinbase text, -- coinbase tx
    _is_valid boolean DEFAULT TRUE,
    UNIQUE (blockhash),
    UNIQUE (blockhash, _is_valid)
);

CREATE TABLE IF NOT EXISTS tx_btc (
    _tx_id serial PRIMARY KEY,
    blockhash text NOT NULL,
    txid text NOT NULL,
    hash text, -- differs from txid for witness txs
    version integer,
    size bigint,
    vsize bigint, -- differs from size for witness txs
    weight bigint,
    locktime bigint,
    hex text,
    _is_coinbase boolean,
    _is_valid boolean DEFAULT TRUE,
    _fee bigint,
    UNIQUE (blockhash, txid, _is_valid)
);

CREATE TABLE IF NOT EXISTS output_btc (
    _output_id serial PRIMARY KEY,
    blockhash text NOT NULL,
    txid text NOT NULL,
    vout integer NOT NULL,
    value bigint,
    reqsigs integer,
    scriptasm text,
    scripthex text,
    scripttype typeof_btc_script,
    _is_spent boolean DEFAULT FALSE,
    _spent_by_blockhash text,
    _spent_by_txid text,
    _spent_by_vin integer,
    _is_valid boolean DEFAULT TRUE,
    UNIQUE (blockhash, txid, vout, _is_valid),
    UNIQUE (_spent_by_blockhash, _spent_by_txid, _spent_by_vin, _is_valid)
);

CREATE TABLE IF NOT EXISTS output_address_btc (
    _addr_id serial PRIMARY KEY,
    blockhash text NOT NULL,
    txid text NOT NULL,
    vout integer NOT NULL,
    addr text NOT NULL,
    addr_idx integer NOT NULL, -- it can be that the same address apears more than once in single addresses[] of an output
    addrtype typeof_btc_address,
    _is_valid boolean DEFAULT TRUE,
    UNIQUE (blockhash, txid, vout, addr, addr_idx)
);

CREATE TABLE IF NOT EXISTS input_btc (
    _input_id serial PRIMARY KEY,
    blockhash text NOT NULL,
    txid text NOT NULL,
    vin integer NOT NULL,
    out_blockhash text, -- the hash of the block that contained the tx that produced the output
    out_txid text, -- the txid of the transaction that produced the output
    out_vout integer, -- the n of the output in the transaction that produced it
    out_value bigint,
    seq bigint,
    scriptasm text,
    scripthex text,
    txinwitness text[],
    _is_valid boolean DEFAULT TRUE,
    UNIQUE (blockhash, txid, vin),
    UNIQUE (blockhash, txid, vin, _is_valid)
);

CREATE TABLE IF NOT EXISTS wallet_btc (
    _wallet_addr_id serial PRIMARY KEY,
    walletaddr text NOT NULL,
    walletaddrtype typeof_btc_address,
    walletname text
);

-- To speed up things, postpone all foreign key constraints until after the db has been populated with the blockchain data
-- ALTER TABLE branch_btc ADD FOREIGN KEY (_parent_branch) REFERENCES branch_btc (_branch_id) MATCH FULL ON UPDATE RESTRICT;
-- ALTER TABLE block_btc ADD FOREIGN KEY (_branch_id) REFERENCES branch_btc (_branch_id) MATCH FULL ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;
-- ALTER TABLE block_btc ADD FOREIGN KEY (previousblockhash) REFERENCES block_btc (blockhash) MATCH FULL ON UPDATE RESTRICT;
-- ALTER TABLE tx_btc ADD FOREIGN KEY (blockhash, _is_valid) REFERENCES block_btc (blockhash, _is_valid) MATCH FULL ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;
-- ALTER TABLE output_btc ADD FOREIGN KEY (blockhash, txid, _is_valid) REFERENCES tx_btc (blockhash, txid, _is_valid) MATCH FULL ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;
-- ALTER TABLE output_address_btc ADD FOREIGN KEY (blockhash, txid, vout, _is_valid) REFERENCES output_btc (blockhash, txid, vout, _is_valid) MATCH FULL ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;
-- ALTER TABLE input_btc ADD FOREIGN KEY (blockhash, txid, _is_valid) REFERENCES tx_btc (blockhash, txid, _is_valid) MATCH FULL ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;
-- ALTER TABLE input_btc ADD FOREIGN KEY (out_blockhash, out_txid, out_vout, _is_valid) REFERENCES output_btc (blockhash, txid, vout, _is_valid) MATCH FULL ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;
-- ALTER TABLE output_btc ADD FOREIGN KEY (_spent_by_blockhash, _spent_by_txid, _spent_by_vin, _is_valid) REFERENCES input_btc (blockhash, txid, vin, _is_valid) MATCH SIMPLE ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;
