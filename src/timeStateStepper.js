// @flow
import type { FactoryOptions, TimeStateStepper } from './types';
import type { TimeStateModel, BlockModel, Storage } from './storage/types';

class TimeStateStepperImpl<S, C> implements TimeStateStepper<S, C> {
    db: Storage<S, C>;

    options: FactoryOptions<S, C>;

    timeState: TimeStateModel<S, C>;

    curBlockIdx: number;

    curBlock: BlockModel<S, C>;

    curBlockTimes: Array<number>;

    nextTimeIdx: number;

    startTime: number;

    endTime: number;

    state: S;

    time: number;

    nextChangeOffset: number;

    constructor(options: FactoryOptions<S, C>) {
        this.db = options.storageProvider;
        this.options = options;
    }

    async init(timeStateId: string) {
        this.timeState = await this.db.getTimeState(timeStateId);
        this.curBlockIdx = -1;
        await this.nextBlock();

        this.startTime = this.curBlock.time;
        const lastBlock = await this.db.getBlock(
            this.timeState.id,
            this.timeState.blocks[this.timeState.blocks.length - 1].id,
        );
        const lastBlockTimes = Object.keys(lastBlock.changes)
            .map(t => parseInt(t, 10))
            .sort((a, b) => b - a);
        this.endTime = lastBlock.time + lastBlockTimes[0];

        this.state = this.curBlock.initialState;
        this.time = this.curBlock.time;
        this.nextChangeOffset = this.curBlockTimes[this.nextTimeIdx];
    }

    async nextBlock(): Promise<boolean> {
        this.curBlockIdx++;
        if (this.curBlockIdx === this.timeState.blocks.length) {
            return false;
        }

        this.curBlock = await this.db.getBlock(
            this.timeState.id,
            this.timeState.blocks[this.curBlockIdx].id,
        );

        if (this.state) {
            const curChecksum = this.options.checksum(this.state);
            const newChecksum = this.options.checksum(this.curBlock.initialState);
            if (curChecksum !== newChecksum) {
                throw new Error(`Checksum mismatch when loading next block. Old checksum: ${curChecksum}; New checksum: ${newChecksum}`);
            }
        }

        this.curBlockTimes = Object.keys(this.curBlock.changes)
            .map(t => parseInt(t, 10))
            .sort((a, b) => a - b);
        this.nextTimeIdx = 0;

        return true;
    }

    async step(): Promise<Array<C>> {
        if (this.curBlockIdx === this.timeState.blocks.length) {
            return [];
        }

        // Get the changes
        const timeOffset = this.curBlockTimes[this.nextTimeIdx];
        const changes = this.curBlock.changes[timeOffset.toString()];

        // Execute the changes
        changes.forEach((change) => {
            this.state = this.options.reducer(this.state, change);
        });
        this.time = this.curBlock.time + timeOffset;

        this.nextTimeIdx++;
        if (this.nextTimeIdx === this.curBlockTimes.length) {
            const cont = await this.nextBlock();
            if (!cont) {
                this.nextChangeOffset = 0;
                return changes;
            }
        }
        this.nextChangeOffset = this.curBlock.time
            + this.curBlockTimes[this.nextTimeIdx] - this.time;
        return changes;
    }

    // assume start <= end and start/end in bounds of [0, blocks.length - 1]
    getClosestBlockIdx(
        time: number,
        start: number = 0,
        end: number = this.timeState.blocks.length - 1,
    ): number {
        const t = (n: number) => this.timeState.blocks[n].time;

        if (start === end) {
            if (time < t(start)) return 0;
            return start;
        }

        const mid = Math.floor((start + end) / 2);
        if (time < t(mid)) {
            return this.getClosestBlockIdx(time, start, mid);
        }
        if (mid === this.timeState.blocks.length - 1 || time < t(mid + 1)) {
            return mid;
        }
        return this.getClosestBlockIdx(time, mid + 1, end);
    }

    async setTime(time: number) {
        this.curBlockIdx = this.getClosestBlockIdx(time) - 1;
        this.state = (undefined: any);
        await this.nextBlock();
        this.state = this.curBlock.initialState;
        this.time = this.curBlock.time;
        this.nextChangeOffset = this.curBlockTimes[this.nextTimeIdx];
        for (let i = 0; i < this.curBlockTimes.length; i++) {
            if (time < this.curBlock.time + this.curBlockTimes[i]) {
                this.nextTimeIdx = i;
                break;
            } else {
                await this.step(); // eslint-disable-line no-await-in-loop
            }
        }
    }
}

export default TimeStateStepperImpl;
