import Database from "./Database";
import debug = require('debug');
import appConfig from '../appConfig.json';

const log = appConfig.debug.branch ? debug('satamoto:Branch') : Function.prototype;

class Branch {

    static async addNew(forkHeight: number, parentBranchSerial: number): Promise<number> {
        return await Database.addNewBranch(forkHeight, parentBranchSerial);
    }

    static async getBestSerial(): Promise<number> {
        return await Database.getBestBranchSerial();
    }
}

export default Branch;