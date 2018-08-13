// @flow
import mongoose from 'mongoose';
import Util from '../util';
import type { Storage, TimeStateModel, BlockModel } from './types';

const { Schema } = mongoose;
const { ObjectId } = mongoose.Types;

const blockSchema = new Schema({
    tsId: Schema.Types.ObjectId,
    initialState: Schema.Types.Mixed,
    time: Number,
    changes: Schema.Types.Mixed,
});

const timeStateSchema = new Schema({
    tag: String,
    startTime: Number,
    endTime: Number,
});

class Mongo<S, C> implements Storage<S, C> {
    conn: mongoose.Connection;

    Block: mongoose.Model;

    TimeState: mongoose.Model;

    static async connect(
        connUrl: string,
        timeStateCollection?: string = 'TimeState',
        blockCollection?: string = 'Block',
    ): Promise<Mongo<S, C>> {
        const db = new Mongo();
        await db.init(connUrl, timeStateCollection, blockCollection);
        return db;
    }

    static getId(id: string, msg?: string): ObjectId {
        try {
            return ObjectId(id);
        } catch (err) {
            throw new Error(msg || `TimeState not found with id ${id}`);
        }
    }

    init(connUrl: string, timeStateCollection: string, blockCollection: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.conn = mongoose.createConnection(connUrl, { useNewUrlParser: true }, (err) => {
                if (err) {
                    reject(err);
                } else {
                    this.Block = this.conn.model(blockCollection, blockSchema);
                    this.TimeState = this.conn.model(timeStateCollection, timeStateSchema);
                    resolve();
                }
            });
        });
    }

    async createTimeState(time: number, tag: string): Promise<TimeStateModel<S, C>> {
        const ts = await this.TimeState.create({
            tag,
            startTime: time,
            endTime: time,
        });
        const obj = ts.toObject();
        return {
            id: obj._id.toString(),
            tag: obj.tag,
            startTime: obj.startTime,
            endTime: obj.endTime,
            blocks: [],
        };
    }

    async addBlock(timeStateId: string, block: BlockModel<S, C>): Promise<BlockModel<S, C>> {
        const tsId = Mongo.getId(timeStateId);
        const blk: any = { ...block, tsId, _id: ObjectId() };

        // Make sure block's time = last block's endTime
        const lastBlock = (await this.Block.find({ tsId }).sort({ time: -1 }).limit(1))[0];
        if (lastBlock) {
            const endTime = Util.getBlockEndTime(lastBlock);
            if (endTime !== block.time) {
                throw new Error(`Cannot add block because starting time ${block.time} does not match previous block's ending time ${endTime}`);
            }
        }

        // Update TimeState endTime
        const res = await this.TimeState.update(
            { _id: tsId },
            { $set: { endTime: Util.getBlockEndTime(block) } },
        );
        if (res.n !== 1 || res.ok !== 1) {
            throw new Error(`TimeState not found with id ${timeStateId}`);
        }

        const newBlock = (await this.Block.create(blk)).toObject();

        return {
            id: newBlock._id.toString(),
            initialState: newBlock.initialState,
            time: newBlock.time,
            changes: newBlock.changes,
        };
    }

    async getTimeState(timeStateId: string): Promise<TimeStateModel<S, C>> {
        const ts = await this.TimeState.findById(Mongo.getId(timeStateId));
        if (!ts) {
            throw new Error(`TimeState not found with id ${timeStateId}`);
        }
        const obj = ts.toObject();

        const blocks = await this.Block.find({ tsId: ts._id }, { changes: 0 });

        return {
            id: obj._id.toString(),
            tag: obj.tag,
            startTime: obj.startTime,
            endTime: obj.endTime,
            blocks: blocks.map((b) => {
                const o = b.toObject();
                return {
                    id: o._id.toString(),
                    initialState: o.initialState,
                    time: o.time,
                };
            }),
        };
    }

    async getBlock(timeStateId: string, blockId: string): Promise<BlockModel<S, C>> {
        const msg = `Block not found with id ${blockId} in TimeState ${timeStateId}`;

        const tsId = Mongo.getId(timeStateId);
        const bId = Mongo.getId(blockId, msg);

        const blk = (await this.Block.find({ _id: bId, tsId }))[0];
        if (!blk) {
            throw new Error(msg);
        }

        const obj = blk.toObject();
        return {
            id: blk._id.toString(),
            initialState: obj.initialState,
            time: obj.time,
            changes: obj.changes,
        };
    }

    async getTimeStates(tag: string): Promise<Array<TimeStateModel<S, C>>> {
        const arr = await this.TimeState.find({ tag });

        const allIds = arr.map(o => o._id);

        const numBlocks = await this.Block.aggregate([
            { $match: { tsId: { $in: allIds } } },
            { $group: { _id: '$tsId' } },
        ]);
        const atLeastOne = numBlocks.map(o => o._id.toString());
        const empty = arr.filter(obj => !atLeastOne.includes(obj._id.toString()));

        // Delete empty timeStates
        if (empty.length > 0) {
            const emptyIds = empty.map(o => o._id);
            await this.TimeState.deleteMany({ _id: { $in: emptyIds } });
        }

        const objs = arr.map((ts) => {
            const clone = { ...ts.toObject() };
            clone.id = clone._id.toString();
            delete clone._id;
            return clone;
        });

        return objs
            .filter(obj => atLeastOne.includes(obj.id))
            .sort((a, b) => a.startTime - b.startTime);
    }

    async getTags(): Promise<Array<string>> {
        return (await this.TimeState.aggregate([{ $group: { _id: '$tag' } }]))
            .map(obj => obj._id)
            .filter(tag => !!tag);
    }
}

export default Mongo;
