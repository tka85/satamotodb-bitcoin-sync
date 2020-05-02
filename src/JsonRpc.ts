import debug = require('debug');
import JsonRpc2 = require('json-rpc2');
import appConfig from './appConfig.json';
import rpcConfig from './rpcConfig.json';
import JsonRpcError from './Errors/JsonRpcError';

const log = appConfig.debug.jsonrpc ? debug('satamoto:jsonRpc') : Function.prototype;

const rpcClient = Object.assign(JsonRpc2.Client.$create(rpcConfig.port, rpcConfig.host), { user: rpcConfig.user, password: rpcConfig.pass });

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