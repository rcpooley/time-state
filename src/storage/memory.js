// @flow
import mongoose from 'mongoose';
import Util from '../util';
import type { BlockModel, Storage, TimeStateModel } from './types';

const { ObjectId } = mongoose.Types;

function newID(): string {
    return ObjectId().toString();
}

class Memory<S, C> implements Storage<S, C> {
    timeStates: { [id: string]: TimeStateModel<S, C> };

    constructor() {
        this.timeStates = {};
    }

    async createTimeState(time: number, tag: string): Promise<TimeStateModel<S, C>> {
        const ts = {
            id: newID(),
            tag,
            blocks: [],
            startTime: time,
            endTime: time,
        };
        this.timeStates[ts.id] = ts;
        return ts;
    }

    async addBlock(timeStateId: string, block: BlockModel<S, C>): Promise<BlockModel<S, C>> {
        await this.getTimeState(timeStateId);
        const ts = this.timeStates[timeStateId];

        const lastBlock = ts.blocks[ts.blocks.length - 1];
        if (lastBlock) {
            const endTime = Util.getBlockEndTime(lastBlock);
            if (endTime !== block.time) {
                throw new Error(`Cannot add block because starting time ${block.time} does not match previous block's ending time ${endTime}`);
            }
        }

        const obj = { ...block, id: newID() };
        ts.blocks.push(obj);
        ts.endTime = Util.getBlockEndTime(obj);
        return obj;
    }

    async getTimeState(timeStateId: string): Promise<TimeStateModel<S, C>> {
        if (!(timeStateId in this.timeStates)) {
            throw new Error(`TimeState not found with id ${timeStateId}`);
        }
        const ts = this.timeStates[timeStateId];
        const newBlocks = [];
        for (let i = 0; i < ts.blocks.length; i++) {
            const b = { ...ts.blocks[i] };
            delete b.changes;
            newBlocks.push(b);
        }
        return { ...ts, blocks: newBlocks };
    }

    async getBlock(timeStateId: string, blockId: string): Promise<BlockModel<S, C>> {
        await this.getTimeState(timeStateId);
        const ts = this.timeStates[timeStateId];
        for (let i = 0; i < ts.blocks.length; i++) {
            const b = ts.blocks[i];
            if (b.id === blockId) return b;
        }
        throw new Error(`Block not found with id ${blockId} in TimeState ${timeStateId}`);
    }

    async getTimeStates(tag: string): Promise<Array<TimeStateModel<S, C>>> {
        const arr = [];
        const ids = Object.keys(this.timeStates);
        for (let i = 0; i < ids.length; i++) {
            const ts = this.timeStates[ids[i]];
            if (ts.tag === tag) {
                const clone = { ...ts };
                delete clone.blocks;
                arr.push(clone);
            }
        }
        return arr;
    }
}

export default Memory;
