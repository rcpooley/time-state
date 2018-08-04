// @flow
import mongoose from 'mongoose';
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

    async createTimeState(): Promise<TimeStateModel<S, C>> {
        const ts = {
            id: newID(),
            blocks: [],
        };
        this.timeStates[ts.id] = ts;
        return ts;
    }

    async addBlock(timeStateId: string, block: BlockModel<S, C>): Promise<BlockModel<S, C>> {
        const ts = await this.getTimeState(timeStateId);
        const obj = { ...block, id: newID() };
        ts.blocks.push(obj);
        return obj;
    }

    async getTimeState(timeStateId: string): Promise<TimeStateModel<S, C>> {
        if (!(timeStateId in this.timeStates)) {
            throw new Error(`TimeState not found with id ${timeStateId}`);
        }
        return this.timeStates[timeStateId];
    }

    async getBlock(timeStateId: string, blockId: string): Promise<BlockModel<S, C>> {
        const ts = await this.getTimeState(timeStateId);
        for (let i = 0; i < ts.blocks.length; i++) {
            const b = ts.blocks[i];
            if (b.id === blockId) return b;
        }
        throw new Error(`Could not find block ${blockId} in TimeState ${timeStateId}`);
    }
}

export default Memory;
