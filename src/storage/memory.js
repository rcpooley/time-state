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

    async createTimeState(time: number): Promise<TimeStateModel<S, C>> {
        const ts = {
            id: newID(),
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
}

export default Memory;
