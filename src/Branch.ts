import Database from "./Database";
import debug = require('debug');
import appConfig from './appConfig.json';

const log = appConfig.debug.branch ? debug('satamoto:Branch') : Function.prototype;

class Branch {

    static async addNew(forkHeight: number, parentBranchId: number): Promise<number> {
        return await Database.addNewBranch(forkHeight, parentBranchId);
    }

    static async getBestId(): Promise<number> {
        return await Database.getBestBranchId();
    }
}

export default Branch;