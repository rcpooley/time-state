// @flow
import type {
    FactoryOptions, TimeState,
} from './types';
import type { Storage, BlockModel } from './storage/types';

class TimeStateImpl<S, C> implements TimeState<S, C> {
    db: Storage<S, C>;

    options: FactoryOptions<S, C>;

    curBlock: BlockModel<S, C>;

    alive: boolean;

    id: string;

    state: S;

    time: number;

    constructor(options: FactoryOptions<S, C>) {
        this.db = options.storageProvider;
        this.options = options;
    }

    async newBlock(time: number): Promise<void> {
        if (this.curBlock) {
            await this.db.addBlock(this.id, this.curBlock);
        }

        this.curBlock = {
            id: '',
            initialState: this.state,
            time,
            changes: {},
        };
    }

    async init(initialState: S, time: number, tag?: string): Promise<void> {
        this.id = (await this.db.createTimeState(time, tag || '')).id;
        this.state = initialState;
        await this.newBlock(time);
        this.alive = true;
        this.time = time;
    }

    getTimeActions(time: number): Array<C> {
        const s = time.toString();
        if (!(time in this.curBlock.changes)) {
            this.curBlock.changes[s] = [];
        }
        return this.curBlock.changes[s];
    }

    async change(change: C, time: number): Promise<void> {
        if (!this.alive) {
            throw new Error('Cannot emit change on a closed timeState');
        }

        if (time < this.time) {
            throw new Error(`Requested change time ${time} is less than timeState time ${this.time}`);
        }

        let offset = time - this.curBlock.time;

        if (
            !(offset in this.curBlock.changes)
            && Object.keys(this.curBlock.changes).length >= this.options.changeThreshold
        ) {
            await this.newBlock(this.time);
            offset = time - this.curBlock.time;
        }

        this.getTimeActions(offset).push(change);
        this.state = this.options.reducer(this.state, change);
        this.time = time;
    }

    async stop() {
        this.alive = false;

        if (Object.keys(this.curBlock.changes).length > 0) {
            await this.newBlock(0);
        }
    }
}

export default TimeStateImpl;
