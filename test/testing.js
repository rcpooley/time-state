import Mongo from './storage/mongo';

export async function testDB() {
    const num = Math.floor(Math.random() * 100000);
    const db = await Mongo.connect(`mongodb://localhost:27017/timestates${num}_test`);
    const cleanup = () => new Promise((resolve, reject) => {
        db.conn.dropDatabase((err, resp) => {
            if (err) reject(err);
            else resolve(resp);
        });
    });

    return { db, cleanup };
}

export class BlockBuilder {
    constructor(options, initialState, initialTime) {
        this.options = options;
        this.blocks = [];
        this.state = initialState;
        this.time = initialTime;
        this.split();
    }

    _getActs(time) {
        const off = time - this.curBlock.time;
        if (!(off in this.curBlock.actions)) {
            this.curBlock.actions[off] = [[], []];
        }
        return this.curBlock.actions[off];
    }

    change(c, time) {
        this.state = this.options.reducer(this.state, c);
        this.time = time;
        const acts = this._getActs(time);
        acts[1].push(c);
        return this;
    }

    checksum(cs, time) {
        this.time = time;
        const acts = this._getActs(time);
        acts[0].push(acts[1].length);
        acts[1].push(cs);
        return this;
    }

    split() {
        if (this.curBlock) {
            this.blocks.push(this.curBlock);
        }
        this.curBlock = {
            initialState: this.state,
            time: this.time,
            actions: {},
        };
        return this;
    }
}
