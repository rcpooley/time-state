import { expect } from 'chai';
import Database from './db';

describe('Database', () => {
    let db;

    describe('connect', () => {
        it('should error on bad url', async () => {
            try {
                await Database.connect('mongodb://localhost:11111/timestate_test');
                expect(true, 'Should have failed').false;
            } catch (err) {
                if (err.name !== 'MongoNetworkError') {
                    throw err;
                }
            }
        }).timeout(5000);

        it('should connect successfully', async () => {
            db = await Database.connect('mongodb://localhost:27017/timestate_test');
        });
    });

    describe('createTimeState', () => {
        it('should create a time state', async () => {
            const ts = await db.createTimeState();
            expect(ts).to.have.property('_id');
            expect(ts.blocks).to.be.empty;

            const r = await db.TimeState.remove({ _id: ts._id });
            expect(r.n).to.equal(1);
            expect(r.ok).to.equal(1);
        });
    });

    describe('addBlock', () => {
        let tsId;
        it('should create a time state', async () => {
            tsId = (await db.createTimeState())._id;
            expect(tsId).to.not.be.null;
        });

        const blks = [
            {
                initialState: { foo: 'nope' },
                changes: [[{ add: 1 }, 5]],
                checksums: [[{ nah: 2 }, 6]],
                time: new Date(12345),
            },
            {
                initialState: { foo: 'yup' },
                changes: [[{ add: 2 }, 5]],
                checksums: [[{ nah: 3 }, 6]],
                time: new Date(54321),
            },
        ];

        it('should add a block', async () => {
            await db.addBlock(tsId, blks[0]);

            const ts = (await db.TimeState.findById(tsId)).toObject();
            expect(ts.blocks).to.have.lengthOf(1);
            const b = ts.blocks[0];
            Object.keys(blks[0]).forEach((k) => {
                expect(b[k]).to.deep.equal(blks[0][k]);
            });
        });

        it('should add a second block', async () => {
            await db.addBlock(tsId, blks[1]);

            const ts = (await db.TimeState.findById(tsId)).toObject();
            blks.forEach((b, idx) => {
                Object.keys(b).forEach((k) => {
                    expect(ts.blocks[idx][k]).to.deep.equal(b[k]);
                });
                expect(ts.blocks[idx]).to.have.property('_id');
            });
        });
    });

    describe('cleanup', () => {
        it('should delete database', () => new Promise((resolve, reject) => {
            db.conn.dropDatabase((err, resp) => {
                try {
                    expect(err).to.be.null;
                    expect(resp).to.be.true;
                    resolve();
                } catch (e) {
                    reject(e);
                }
            });
        }));

        it('should close connection', () => {
            db.conn.close(() => {
                setTimeout(() => {
                    process.exit(0);
                }, 1000);
            });
        });
    });
});
