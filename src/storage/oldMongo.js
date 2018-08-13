// @flow
import mongoose from 'mongoose';
import Util from '../util';
import type { Storage, TimeStateModel, BlockModel } from './types';

const { Schema } = mongoose;
const { ObjectId } = mongoose.Types;

const blockSchema = new Schema({
    initialState: Schema.Types.Mixed,
    time: Number,
    changes: Schema.Types.Mixed,
});

const timeStateSchema = new Schema({
    tag: String,
    startTime: Number,
    endTime: Number,
    blocks: [blockSchema],
});

class OldMongo<S, C> implements Storage<S, C> {
    conn: mongoose.Connection;

    Block: mongoose.Model;

    TimeState: mongoose.Model;

    static async connect(connUrl: string): Promise<OldMongo<S, C>> {
        const db = new OldMongo();
        await db.init(connUrl);
        return db;
    }

    static getId(id: string, msg?: string): ObjectId {
        try {
            return ObjectId(id);
        } catch (err) {
            throw new Error(msg || `TimeState not found with id ${id}`);
        }
    }

    init(connUrl: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.conn = mongoose.createConnection(connUrl, { useNewUrlParser: true }, (err) => {
                if (err) {
                    reject(err);
                } else {
                    this.Block = this.conn.model('Block', blockSchema);
                    this.TimeState = this.conn.model('TimeState', timeStateSchema);
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
            blocks: [],
        });
        const obj = ts.toObject();
        return {
            id: obj._id.toString(),
            tag: obj.tag,
            startTime: obj.startTime,
            endTime: obj.endTime,
            blocks: obj.blocks,
        };
    }

    async addBlock(timeStateId: string, block: BlockModel<S, C>): Promise<BlockModel<S, C>> {
        const blk: any = { ...block };
        blk._id = ObjectId();

        const tsId = OldMongo.getId(timeStateId);

        const book = await this.TimeState.aggregate([
            { $match: { _id: tsId } },
            { $unwind: '$blocks' },
            { $sort: { 'blocks.time': -1 } },
            { $group: { _id: '$_id', block: { $first: '$blocks' } } },
            { $limit: 1 },
        ]);
        if (book.length > 0) {
            const b = book[0].block;
            const endTime = Util.getBlockEndTime(b);
            if (endTime !== block.time) {
                throw new Error(`Cannot add block because starting time ${block.time} does not match previous block's ending time ${endTime}`);
            }
        }

        const res = await this.TimeState.update(
            { _id: tsId },
            {
                $push: { blocks: blk },
                $set: { endTime: Util.getBlockEndTime(block) },
            },
        );
        if (res.n !== 1 || res.nModified !== 1 || res.ok !== 1) {
            throw new Error(`TimeState not found with id ${timeStateId}`);
        }

        const ret = { ...block };
        ret.id = blk._id.toString();
        return ret;
    }

    async getTimeState(timeStateId: string): Promise<TimeStateModel<S, C>> {
        const ts = await this.TimeState.findById(OldMongo.getId(timeStateId), { 'blocks.changes': 0 });
        if (!ts) {
            throw new Error(`TimeState not found with id ${timeStateId}`);
        }
        const obj = ts.toObject();
        return {
            id: obj._id.toString(),
            tag: obj.tag,
            startTime: obj.startTime,
            endTime: obj.endTime,
            blocks: obj.blocks.map((b) => {
                const blk = { ...b };
                blk.id = blk._id.toString();
                delete blk._id;
                return blk;
            }),
        };
    }

    async getBlock(timeStateId: string, blockId: string): Promise<BlockModel<S, C>> {
        const msg = `Block not found with id ${blockId} in TimeState ${timeStateId}`;
        const res = await this.TimeState.find(
            { _id: OldMongo.getId(timeStateId), 'blocks._id': OldMongo.getId(blockId, msg) },
            { 'blocks.$': 1 },
        );
        if (res.length === 0) {
            throw new Error(msg);
        }
        const obj = res[0].blocks[0].toObject();
        const id = obj._id.toString();
        delete obj._id;
        return { ...obj, id };
    }

    async getTimeStates(tag: string): Promise<Array<TimeStateModel<S, C>>> {
        const arr = await this.TimeState.aggregate([
            { $match: { tag } },
            {
                $project: {
                    tag: 1,
                    startTime: 1,
                    endTime: 1,
                    numBlocks: { $size: '$blocks' },
                },
            },
        ]);

        // Delete empty timeStates
        const empty = arr.filter(o => o.numBlocks === 0);
        if (empty.length > 0) {
            const emptyIds = empty.map(o => o._id);
            await this.TimeState.deleteMany({ _id: { $in: emptyIds } });
        }

        return arr
            .filter(o => o.numBlocks > 0)
            .map(ts => ({
                id: ts._id.toString(),
                tag: ts.tag,
                startTime: ts.startTime,
                endTime: ts.endTime,
            }));
    }

    async getTags(): Promise<Array<string>> {
        return (await this.TimeState.aggregate([{ $group: { _id: '$tag' } }]))
            .map(obj => obj._id)
            .filter(tag => !!tag);
    }
}

export default OldMongo;
