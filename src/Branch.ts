import Database from "./Database";
import debug = require('debug');

const log = debug('satamoto:Branch');

class Branch {

    static async addNew(forkHeight: number, parentBranchId: number): Promise<number> {
        return await Database.addNewBranch(forkHeight, parentBranchId);
    }

    static async getBestId(): Promise<number> {
        return await Database.getBestBranchId();
    }
}

export default Branch;