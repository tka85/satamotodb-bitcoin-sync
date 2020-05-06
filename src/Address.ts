import debug = require('debug');
import JsonRpc from './JsonRpc';
import appConfig from '../appConfig.json';

const log = appConfig.debug.address ? debug('satamoto:address') : Function.prototype;

class Address {
    static chain: string;

    static async init() {
        Address.chain = (await JsonRpc.doRequest('getmininginfo', [])).chain;
    }

    // Returns one of 'legacy', 'p2sh-segwit', 'bech32'
    static getAddressType(addr: string): string {
        switch (Address.chain) {
            case 'main':
                if (addr.startsWith('1')) {
                    return 'legacy';
                }
                else if (addr.startsWith('3')) {
                    return 'p2sh-segwit';
                }
                else if (addr.startsWith('bc')) {
                    return 'bech32';
                }
            case 'test':
                if (addr.startsWith('m') || addr.startsWith('n')) {
                    return 'legacy';
                }
                else if (addr.startsWith('2')) {
                    return 'p2sh-segwit';
                }
                else if (addr.startsWith('tb')) {
                    return 'bech32';
                }
            case 'regtest':
                if (addr.startsWith('m') || addr.startsWith('n')) {
                    return 'legacy';
                }
                else if (addr.startsWith('2')) {
                    return 'p2sh-segwit';
                }
                else if (addr.startsWith('bcrt')) {
                    return 'bech32';
                }
        }
        return 'INVALID';
    }
}

export default Address;