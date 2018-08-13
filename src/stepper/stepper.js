// @flow
import type { FactoryOptions, Stepper } from '../types';

type Chunk = {
    startTime: number,
    endTime: number
}

export type StepperData<S, C> = {
    numChunks: number,
    startTime: number,
    endTime: number,
    chunkLoader: (idx: number) => Promise<Stepper<S, C>>,
    chunks: Array<Chunk>
}

class StepperImpl<S, C> implements Stepper<S, C> {
    data: StepperData<S, C>;

    options: FactoryOptions<S, C>;

    skipChecksum: boolean;

    stepToChunk: boolean;

    curChunkIdx: number;

    curChunk: Stepper<S, C>;

    startTime: number;

    endTime: number;

    state: S;

    time: number;

    nextChangeOffset: number;

    constructor(data: StepperData<S, C>, options: FactoryOptions<S, C>, skipChecksum?: boolean) {
        this.data = data;
        this.options = options;
        if (skipChecksum) this.skipChecksum = true;

        if (data.numChunks === 0) {
            throw new Error('Cannot create a stepper with no chunks to step through');
        }
    }

    async init() {
        this.curChunkIdx = -1;
        await this.nextChunk();

        this.startTime = this.data.startTime;
        this.endTime = this.data.endTime;
        this.state = this.curChunk.state;
        this.time = this.curChunk.time;
        this.nextChangeOffset = this.curChunk.nextChangeOffset;
    }

    async nextChunk(): Promise<boolean> {
        this.curChunkIdx++;
        if (this.curChunkIdx === this.data.numChunks) {
            return false;
        }

        this.curChunk = await this.data.chunkLoader(this.curChunkIdx);

        if (this.state) {
            const curChecksum = this.options.checksum(this.state);
            const newChecksum = this.options.checksum(this.curChunk.state);
            if (curChecksum !== newChecksum) {
                throw new Error(`Checksum mismatch when loading next block. Old checksum: ${curChecksum}; New checksum: ${newChecksum}`);
            }
        }

        return true;
    }

    async step(): Promise<Array<C>> {
        if (this.curChunkIdx === this.data.numChunks) {
            return [];
        }

        if (this.stepToChunk) {
            this.stepToChunk = false;
            this.state = this.curChunk.state;
            this.time = this.curChunk.time;
            this.nextChangeOffset = this.curChunk.nextChangeOffset;
            return [];
        }

        const changes = await this.curChunk.step();
        this.state = this.curChunk.state;
        this.time = this.curChunk.time;
        this.nextChangeOffset = this.curChunk.nextChangeOffset;

        if (this.nextChangeOffset === 0) {
            try {
                const cont = await this.nextChunk();
                if (cont) {
                    this.nextChangeOffset = this.curChunk.nextChangeOffset;
                }
            } catch (err) {
                if (this.skipChecksum) {
                    this.nextChangeOffset = this.curChunk.time - this.time;
                    this.stepToChunk = true;
                    if (this.nextChangeOffset === 0) {
                        return await this.step();
                    }
                } else {
                    throw err;
                }
            }
        }

        return changes;
    }

    // assume start <= end and start/end in bounds of [0, blocks.length - 1]
    getClosestChunkIdx(
        time: number,
        start: number = 0,
        end: number = this.data.numChunks - 1,
    ): number {
        const c = (n: number) => this.data.chunks[n];

        if (start === end) {
            if (time < c(start).startTime) return 0;
            return start;
        }

        const mid = Math.floor((start + end) / 2);
        if (time < c(mid).startTime) {
            return this.getClosestChunkIdx(time, start, mid);
        }
        if (mid === this.data.numChunks - 1 || time < c(mid + 1).startTime) {
            return mid;
        }
        return this.getClosestChunkIdx(time, mid + 1, end);
    }

    async setTime(time: number): Promise<void> {
        this.curChunkIdx = this.getClosestChunkIdx(time) - 1;
        this.state = (undefined: any);
        await this.nextChunk();
        this.state = this.curChunk.state;
        this.time = this.curChunk.time;
        this.nextChangeOffset = this.curChunk.nextChangeOffset;
        while (this.curChunk.time + this.curChunk.nextChangeOffset <= time
            && this.time < this.endTime) {
            await this.step(); // eslint-disable-line no-await-in-loop
        }
    }
}

export default StepperImpl;
