// @flow
import mongoose from 'mongoose';
import type { Storage, TimeStateModel, BlockModel } from './types';

const { Schema } = mongoose;
const { ObjectId } = mongoose.Types;

const blockSchema = new Schema({
    initialState: Schema.Types.Mixed,
    time: Number,
    actions: Schema.Types.Mixed,
});

const timeStateSchema = new Schema({
    blocks: [blockSchema],
});

class Mongo<S, C> implements Storage<S, C> {
    conn: mongoose.Connection;

    Block: mongoose.Model;

    TimeState: mongoose.Model;

    static async connect(connUrl: string): Promise<Mongo<S, C>> {
        const db = new Mongo();
        await db.init(connUrl);
        return db;
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

    async createTimeState(): Promise<TimeStateModel<S, C>> {
        const ts = await this.TimeState.create({
            blocks: [],
        });
        const obj = ts.toObject();
        return {
            id: obj._id.toString(),
            blocks: obj.blocks,
        };
    }

    async addBlock(timeStateId: string, block: BlockModel<S, C>): Promise<BlockModel<S, C>> {
        const blk: any = { ...block };
        blk._id = ObjectId();

        const res = await this.TimeState.update(
            { _id: timeStateId },
            { $push: { blocks: blk } },
        );
        if (res.n !== 1 || res.nModified !== 1 || res.ok !== 1) {
            throw new Error(`Invalid mongo response: ${JSON.stringify(res)}`);
        }

        const ret = { ...block };
        ret.id = blk._id.toString();
        return ret;
    }

    async getTimeState(timeStateId: string): Promise<TimeStateModel<S, C>> {
        const ts = await this.TimeState.findById(timeStateId, { 'blocks.actions': 0 });
        if (!ts) {
            throw new Error(`Could not find timeState with ID ${timeStateId}`);
        }
        const obj = ts.toObject();
        return {
            id: obj._id.toString(),
            blocks: obj.blocks,
        };
    }

    async getBlock(timeStateId: string, blockId: string): Promise<BlockModel<S, C>> {
        const res = await this.TimeState.find(
            { _id: timeStateId, 'blocks._id': blockId },
            { 'blocks.$': 1 },
        );
        if (res.length === 0) {
            throw new Error(`Could not find timeState block with timeStateId ${timeStateId} and blockId ${blockId}`);
        }
        const obj = res[0].blocks[0].toObject();
        const id = obj._id.toString();
        delete obj._id;
        return { ...obj, id };
    }
}

export default Mongo;
