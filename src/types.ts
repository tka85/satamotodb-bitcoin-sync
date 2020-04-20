export type Config = {
    rpc: {
        host: string,
        port: number,
        user: string,
        pass: string,
        timeout: number,
    },
    pg: {
        user: string,
        host: string,
        db: string,
        pass: string,
        port: number
    },
    debug: {
        app: boolean,
        database: boolean,
        branch: boolean,
        block: boolean,
        tx: boolean,
        output: boolean,
        input: boolean,
        address: boolean,
        jsonrpc: boolean
    },
    minConfirmations: number
};

export type Address = 'legacy' | 'p2sh-segwit' | 'bech32';

export type Script = 'pubkey' | 'pubkeyhash' | 'scripthash' | 'multisig' | 'nulldata' | 'witness_v0_keyhash' | 'witness_v0_scripthash' | 'nonstandard';