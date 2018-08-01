// @flow
import mongoose from 'mongoose';
import type { Checksum } from './types';

const { Schema } = mongoose;
const { ObjectId } = mongoose.Types;

export type BlockModel<S, C> = {
    initialState: S,
    changes: Array<[C, number]>,
    checksums: Array<[Checksum, number]>,
    time: Date
}

export type TimeStateModel<S, C> = {
    _id: ObjectId,
    blocks: Array<BlockModel<S, C>>
}

const blockSchema = new Schema({
    initialState: Schema.Types.Mixed,
    changes: [Schema.Types.Mixed],
    checksums: [Schema.Types.Mixed],
    time: Date,
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
        await this.TimeState.update(
            { _id: timeStateId },
            { $push: { blocks: block } },
        );
    }
}

export default Database;
