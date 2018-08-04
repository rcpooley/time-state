// @flow
import mongoose from 'mongoose';
import Util from '../util';
import type { Storage, TimeStateModel, BlockModel } from './types';

const { Schema } = mongoose;
const { ObjectId } = mongoose.Types;

const blockSchema = new Schema({
    initialState: Schema.Types.Mixed,
    time: Number,
    actions: Schema.Types.Mixed,
});

const timeStateSchema = new Schema({
    startTime: Number,
    endTime: Number,
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

    async createTimeState(time: number): Promise<TimeStateModel<S, C>> {
        const ts = await this.TimeState.create({
            startTime: time,
            endTime: time,
            blocks: [],
        });
        const obj = ts.toObject();
        return {
            id: obj._id.toString(),
            startTime: obj.startTime,
            endTime: obj.endTime,
            blocks: obj.blocks,
        };
    }

    async addBlock(timeStateId: string, block: BlockModel<S, C>): Promise<BlockModel<S, C>> {
        const blk: any = { ...block };
        blk._id = ObjectId();

        const res = await this.TimeState.update(
            { _id: Mongo.getId(timeStateId) },
            {
                $push: { blocks: blk },
                $set: { endTime: Util.getBlockEndTime(block) },
            },
        );
        if (res.n !== 1 || res.nModified !== 1 || res.ok !== 1) {
            throw new Error(`Invalid mongo response: ${JSON.stringify(res)}`);
        }

        const ret = { ...block };
        ret.id = blk._id.toString();
        return ret;
    }

    async getTimeState(timeStateId: string): Promise<TimeStateModel<S, C>> {
        const ts = await this.TimeState.findById(Mongo.getId(timeStateId), { 'blocks.actions': 0 });
        if (!ts) {
            throw new Error(`TimeState not found with id ${timeStateId}`);
        }
        const obj = ts.toObject();
        return {
            id: obj._id.toString(),
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
            { _id: Mongo.getId(timeStateId), 'blocks._id': Mongo.getId(blockId, msg) },
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
}

export default Mongo;
