import debug = require('debug');
import JsonRpc2 = require('json-rpc2');
import config from './config';
import JsonRpcError from './Errors/JsonRpcError';

const log = config.debug.jsonrpc ? debug('satamoto:jsonRpc') : Function.prototype;

const rpcClient = Object.assign(JsonRpc2.Client.$create(config.rpc.port, config.rpc.host), { user: config.rpc.user, password: config.rpc.pass });

class JsonRpc {
    static async doRequest(cmd: string, params: any[] = []): Promise<any> {
        log(`${cmd} ${JSON.stringify(params)}`);
        return new Promise((resolve, reject) => {
            rpcClient.call(cmd, params, function cb(err, result) {
                if (err) {
                    reject(new JsonRpcError(err.message, cmd, params));
                }
                resolve(result);
            });
        });
    }
}

export default JsonRpc;