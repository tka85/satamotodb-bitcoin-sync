import { Config } from './types';

const config: Config = {
    rpc: {
        host: '127.0.0.1',
        port: 8332, // same port for all three: mainnet, testnet, regtest
        user: 'satamoto',
        pass: 'satamoto',
        timeout: 180000
    },
    pg: {
        user: 'postgres',
        host: 'satamoto_postgres',
        db: 'satamoto',
        pass: 'satamoto',
        port: 5432
    },
    debug: {
        app: true,
        database: false,
        branch: true,
        block: true,
        tx: true,
        output: true,
        input: true,
        address: true,
        jsonrpc: false
    },
    minConfirmations: 0
};

export default config;