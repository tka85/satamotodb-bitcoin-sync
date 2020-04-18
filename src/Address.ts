import bitcoinjs = require('bitcoinjs-lib');
import assert = require('assert');
import JsonRpc from './JsonRpc';
import InvalidAddressError from './Errors/InvalidAddressError';

class Address {
    static chain: string;
    static network: bitcoinjs.Network;

    static async init() {
        Address.chain = (await JsonRpc.doRequest('getmininginfo', [])).chain;
        switch (Address.chain) {
            case 'main':
                Address.network = bitcoinjs.networks.bitcoin;
                break;
            case 'test':
                Address.network = bitcoinjs.networks.testnet;
                break;
            case 'regtest':
                Address.network = bitcoinjs.networks.regtest;
                break;
        }
    }

    // Returns one of 'legacy', 'p2sh-segwit', 'bech32'
    static getAddressType(addr: string): string {
        try {
            bitcoinjs.address.toOutputScript(addr, Address.network);
        } catch (err) {
            throw new InvalidAddressError(err.message, addr, Address.chain);
        }

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
        assert(false, 'Unreachable code !!');
    }
}

export default Address;