// @flow
import mongoose from 'mongoose';
import type { BlockModel, Storage, TimeStateModel } from './types';

const { ObjectId } = mongoose.Types;

function newID(): string {
    return ObjectId().toString();
}

/* eslint-disable class-methods-use-this, no-unused-vars */
class Dummy<S, C> implements Storage<S, C> {
    async createTimeState(): Promise<TimeStateModel<S, C>> {
        return {
            id: newID(),
            blocks: [],
        };
    }

    async addBlock(timeStateId: string, block: BlockModel<S, C>): Promise<BlockModel<S, C>> {
        return block;
    }

    async getTimeState(timeStateId: string): Promise<TimeStateModel<S, C>> {
        throw new Error('Cannot call getTimeState on dummy storage provider');
    }

    async getBlock(timeStateId: string, blockId: string): Promise<BlockModel<S, C>> {
        throw new Error('Cannot call getBlock on dummy storage provider');
    }
}
/* eslint-enable class-methods-use-this, no-unused-vars */

export default Dummy;
