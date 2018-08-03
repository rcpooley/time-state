// @flow
import mongoose from 'mongoose';
import Database from './db';
import type { Actions, BlockModel } from './db';
import type { FactoryOptions, TimeState, Checksum } from './types';

const { ObjectId } = mongoose.Types;

class TimeStateImpl<S, C> implements TimeState<S, C> {
    db: Database<S, C>;

    options: FactoryOptions<S, C>;

    timeStateId: ObjectId;

    curBlock: BlockModel<S, C>;

    alive: boolean;

    state: S;

    id: string;

    constructor(db: Database<S, C>, options: FactoryOptions<S, C>) {
        this.db = db;
        this.options = options;
    }

    async newBlock(time: number): Promise<void> {
        if (this.curBlock) {
            await this.db.addBlock(this.timeStateId, this.curBlock);
        }

        this.curBlock = {
            _id: ObjectId(),
            initialState: this.state,
            time: new Date(time),
            actions: {},
        };
        this.alive = true;
    }

    async init(initialState: S, time: number): Promise<void> {
        this.timeStateId = (await this.db.createTimeState())._id;
        this.id = this.timeStateId.toString();
        this.state = initialState;

        return await this.newBlock(time);
    }

    getTimeActions(time: number): Actions<C> {
        const s = time.toString();
        if (!(time in this.curBlock.actions)) {
            this.curBlock.actions[s] = [[], []];
        }
        return this.curBlock.actions[s];
    }

    change(change: C, time: number) {
        if (!this.alive) {
            throw new Error('Cannot emit change on a closed timeState');
        }
        this.getTimeActions(time)[1].push(change);
        this.state = this.options.reducer(this.state, change);
    }

    checksum(checksum: Checksum, time: number) {
        if (!this.alive) {
            throw new Error('Cannot emit checksum on a closed timeState');
        }
        const check: Checksum = this.options.checksum(this.state);
        if (check !== checksum) {
            throw new Error(`Invalid checksum. Expected: ${checksum.toString()}; Actual: ${check}`);
        }
        const timeActions = this.getTimeActions(time);
        timeActions[0].push(timeActions[1].length);
        timeActions[1].push(checksum);
    }

    async stop() {
        this.alive = false;

        if (Object.keys(this.curBlock.actions).length > 0) {
            await this.newBlock(0);
        }
    }
}

export default TimeStateImpl;
