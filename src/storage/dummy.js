// @flow
import mongoose from 'mongoose';
import type { BlockModel, Storage, TimeStateModel } from './types';

const { ObjectId } = mongoose.Types;

function newID(): string {
    return ObjectId().toString();
}

/* eslint-disable class-methods-use-this, no-unused-vars */
class Dummy<S, C> implements Storage<S, C> {
    async createTimeState(time: number, tag: string): Promise<TimeStateModel<S, C>> {
        return {
            id: newID(),
            tag,
            blocks: [],
            startTime: time,
            endTime: time,
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

    async getTimeStates(tag: string) {
        throw new Error('Cannot call getTimeStates on dummy storage provider');
    }

    async getTags() {
        throw new Error('Cannot call getTimeStates on dummy storage provider');
    }
}
/* eslint-enable class-methods-use-this, no-unused-vars */

export default Dummy;
