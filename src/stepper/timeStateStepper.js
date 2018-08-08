// @flow
import Util from '../util';
import type { FactoryOptions, Stepper } from '../types';
import StepperImpl from './stepper';
import type { BlockModel } from '../storage/types';

class BlockStepper<S, C> implements Stepper<S, C> {
    options: FactoryOptions<S, C>;

    block: BlockModel<S, C>;

    blockTimes: Array<number>;

    nextTimeIdx: number;

    startTime: number;

    endTime: number;

    state: S;

    time: number;

    nextChangeOffset: number;

    constructor(options: FactoryOptions<S, C>, block: BlockModel<S, C>) {
        this.options = options;
        this.block = block;
        this.blockTimes = Object.keys(this.block.changes)
            .map(t => parseInt(t, 10))
            .sort((a, b) => a - b);
        this.nextTimeIdx = 0;
        this.startTime = this.block.time;
        this.endTime = Util.getBlockEndTime(this.block);
        this.state = this.block.initialState;
        this.time = this.startTime;
        this.nextChangeOffset = this.blockTimes[this.nextTimeIdx];
    }

    async step(): Promise<Array<C>> {
        // Get the changes
        const timeOffset = this.blockTimes[this.nextTimeIdx];
        const changes = this.block.changes[timeOffset.toString()];

        // Execute the changes
        changes.forEach((change) => {
            this.state = this.options.reducer(this.state, change);
        });
        this.time = this.block.time + timeOffset;

        this.nextTimeIdx++;
        if (this.nextTimeIdx === this.blockTimes.length) {
            this.nextChangeOffset = 0;
        } else {
            this.nextChangeOffset = this.block.time
                + this.blockTimes[this.nextTimeIdx] - this.time;
        }

        return changes;
    }

    async setTime(): Promise<void> { // eslint-disable-line class-methods-use-this
        throw new Error('This should never be called');
    }
}

export default async function<S, C> (
    options: FactoryOptions<S, C>,
    timeStateId: string,
): Promise<Stepper<S, C>> {
    const timeState = await options.storageProvider.getTimeState(timeStateId);

    const chunks = [];
    for (let i = 0; i < timeState.blocks.length; i++) {
        const endTime = i < timeState.blocks.length - 1
            ? timeState.blocks[i + 1].time : timeState.endTime;
        chunks.push({
            startTime: timeState.blocks[i].time,
            endTime,
        });
    }

    async function chunkLoader(idx: number): Promise<Stepper<S, C>> {
        const block = await options.storageProvider.getBlock(
            timeStateId,
            timeState.blocks[idx].id,
        );
        return (new BlockStepper(options, block): any); // TODO this is bad
    }

    const stepper = new StepperImpl({
        numChunks: timeState.blocks.length,
        startTime: timeState.startTime,
        endTime: timeState.endTime,
        chunkLoader,
        chunks,
    }, options);
    await stepper.init();
    if (stepper.nextChangeOffset === 0) await stepper.step();
    return stepper;
}
