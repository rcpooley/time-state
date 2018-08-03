// @flow
import mongoose from 'mongoose';
import type { Checksum } from './types';

const { Schema } = mongoose;
const { ObjectId } = mongoose.Types;

export type Action<C> = C | Checksum;

// [array of checksum indices, array of changes and checksums]
export type Actions<C> = [Array<number>, Array<Action<C>>]

export type BlockModel<S, C> = {
    _id: ObjectId,
    initialState: S,
    time: number,
    actions: {
        [timeOffset: string]: Actions<C>
    }
}

export type TimeStateModel<S, C> = {
    _id: ObjectId,
    blocks: Array<BlockModel<S, C>>
}

const blockSchema = new Schema({
    initialState: Schema.Types.Mixed,
    time: Number,
    actions: Schema.Types.Mixed,
});

const timeStateSchema = new Schema({
    blocks: [blockSchema],
});

class Database<S, C> {
    conn: mongoose.Connection;

    Block: mongoose.Model;

    TimeState: mongoose.Model;

    static async connect(connUrl: string): Promise<Database<S, C>> {
        const db = new Database();
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
        return ts.toObject();
    }

    async addBlock(timeStateId: ObjectId, block: BlockModel<S, C>) {
        if (Object.keys(block.actions).length === 0) {
            throw new Error('Cannot save block with 0 actions');
        }
        const blk = { ...block };
        delete blk._id;
        const res = await this.TimeState.update(
            { _id: timeStateId },
            { $push: { blocks: blk } },
        );
        if (res.n !== 1 || res.nModified !== 1 || res.ok !== 1) {
            throw new Error(`Invalid mongo response: ${JSON.stringify(res)}`);
        }
    }

    async getTimeState(timeStateId: ObjectId): Promise<TimeStateModel<S, C>> {
        const ts = await this.TimeState.findById(timeStateId, { 'blocks.actions': 0 });
        if (!ts) {
            throw new Error(`Could not find timeState with ID ${timeStateId}`);
        }
        return ts.toObject();
    }

    async getBlock(timeStateId: ObjectId, blockId: ObjectId): Promise<BlockModel<S, C>> {
        const res = await this.TimeState.find(
            { _id: timeStateId, 'blocks._id': blockId },
            { 'blocks.$': 1 },
        );
        if (res.length === 0) {
            throw new Error(`Could not find timeState block with timeStateId ${timeStateId} and blockId ${blockId}`);
        }
        return res[0].blocks[0].toObject();
    }
}

export default Database;
