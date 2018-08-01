// @flow
import Database from './db';
import type { BlockModel } from './db';
import type { FactoryOptions, TimeState, Checksum } from './types';

class TimeStateImpl<S, C> implements TimeState<S, C> {
    db: Database<S, C>;

    options: FactoryOptions<S, C>;

    timeStateId: any;

    curBlock: BlockModel<S, C>;

    state: S;

    constructor(db: Database<S, C>, options: FactoryOptions<S, C>) {
        this.db = db;
        this.options = options;
    }

    async newBlock(time: number): Promise<void> {
        if (this.curBlock) {
            await this.db.addBlock(this.timeStateId, this.curBlock);
        }

        this.curBlock = {
            initialState: this.state,
            changes: [],
            checksums: [],
            time: new Date(time),
        };
    }

    async init(initialState: S, time: number): Promise<void> {
        this.timeStateId = (await this.db.createTimeState())._id;
        this.state = initialState;

        return this.newBlock(time);
    }

    change(change: C, time: number) {
        this.curBlock.changes.push([change, time]);
        this.state = this.options.reducer(this.state, change);
    }

    checksum(checksum: Checksum, time: number) {
        const check: Checksum = this.options.checksum(this.state);
        if (check !== checksum) {
            throw new Error(`Invalid checksum. Expected: ${checksum.toString()}; Actual: ${check}`);
        }
        this.curBlock.checksums.push([checksum, time]);
    }
}

export default TimeStateImpl;
