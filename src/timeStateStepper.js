// @flow
import mongoose from 'mongoose';
import type { Checksum, FactoryOptions, TimeStateStepper } from './types';
import type { TimeStateModel, BlockModel, Actions } from './db';
import Database from './db';

const { ObjectId } = mongoose.Types;

class TimeStateStepperImpl<S, C> implements TimeStateStepper<S, C> {
    db: Database<S, C>;

    options: FactoryOptions<S, C>;

    timeStateId: ObjectId;

    timeState: TimeStateModel<S, C>;

    curBlockIdx: number;

    curBlock: BlockModel<S, C>;

    curBlockTimes: Array<number>;

    nextTimeIdx: number;

    state: S;

    time: number;

    constructor(db: Database<S, C>, options: FactoryOptions<S, C>) {
        this.db = db;
        this.options = options;
    }

    async init(timeStateId: string) {
        this.timeStateId = ObjectId(timeStateId);
        this.timeState = await this.db.getTimeState(this.timeStateId);
        if (this.timeState.blocks.length === 0) {
            throw new Error('Cannot init stepper from timeState with no blocks');
        }
        this.curBlockIdx = -1;
        this.time = 0;
        await this.nextBlock();
    }

    async nextBlock() {
        this.curBlockIdx++;
        if (this.curBlockIdx === this.timeState.blocks.length) {
            return;
        }

        this.curBlock = await this.db.getBlock(
            this.timeStateId,
            this.timeState.blocks[this.curBlockIdx]._id,
        );

        if (this.state) {
            const curChecksum = this.options.checksum(this.state);
            const newChecksum = this.options.checksum(this.curBlock.initialState);
            if (curChecksum !== newChecksum) {
                throw new Error(`Checksum mismatch when loading next block. Old checksum: ${curChecksum}; New checksum: ${newChecksum}`);
            }
        }

        this.curBlockTimes = Object.keys(this.curBlock.actions)
            .map(t => parseInt(t, 10))
            .sort((a, b) => a - b);
        this.nextTimeIdx = 0;
    }

    peekActions(): Actions<C> {
        return this.curBlock.actions[this.curBlockTimes[this.nextTimeIdx].toString()];
    }

    async step(amount?: number): Promise<Array<C>> {
        if (this.curBlockIdx === this.timeState.blocks.length) {
            return [];
        }

        let amt;
        if (!amount) {
            amt = this.curBlock.time + this.curBlockTimes[this.nextTimeIdx] - this.time;
        } else {
            amt = amount;
        }

        return await this.stepAmount(amt);
    }

    async stepAmount(amount: number): Promise<Array<C>> {
        const endTime = this.time + amount;

        let allChanges = [];

        while (this.time < endTime) {
            const actions = this.peekActions();

            // Split changes into groups between checksums
            const changeGroups: Array<Array<C>> = [];
            const checksums: Array<Checksum> = [];
            let lastIdx = 0;
            actions[0].forEach((idx) => {
                const changes: Array<C> = (actions[1].slice(lastIdx, idx): Array<any>);
                changeGroups.push(changes);
                lastIdx = idx + 1;
                checksums.push((actions[1][idx]: any));
            });
            if (lastIdx < actions[1].length) {
                const changes: Array<C> = (actions[1].slice(lastIdx): Array<any>);
                changeGroups.push(changes);
            }

            for (let i = 0; i < changeGroups.length; i++) {
                const changes = changeGroups[i];
                changes.forEach((change) => {
                    this.state = this.options.reducer(this.state, change);
                });
                if (i < checksums.length) {
                    const checksum = this.options.checksum(this.state);
                    if (checksum !== checksums[i]) {
                        throw new Error(`Checksum mismatch. Expected: ${checksums[i]}; Actual: ${checksum}`);
                    }
                }
                allChanges = allChanges.concat(changes);
            }

            this.time = this.curBlock.time + this.curBlockTimes[this.nextTimeIdx];
            this.nextTimeIdx++;
            if (this.nextTimeIdx === this.curBlockTimes.length) {
                await this.nextBlock(); // eslint-disable-line no-await-in-loop
                if (this.curBlockIdx === this.timeState.blocks.length) {
                    break;
                }
            }
        }

        return allChanges;
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
        await this.nextBlock();
        for (let i = 0; i < this.curBlockTimes.length; i++) {
            if (time < this.curBlockTimes[i]) {
                this.nextTimeIdx = i;
                break;
            }
        }
    }
}

export default TimeStateStepperImpl;
