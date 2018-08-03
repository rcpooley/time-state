import { expect } from 'chai';
import mongoose from 'mongoose';
import Database from './db';
import { testDB, initDBs } from './testing';

const { ObjectId } = mongoose.Types;
const describeDB = initDBs(4);

const blks = [];
for (let i = 0; i < 5; i++) {
    blks.push({
        _id: ObjectId(),
        initialState: { blockNum: i },
        time: i * 100,
        actions: { [`lol${i}`]: `actions${i}` },
    });
}

describe('Database', () => {
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
            const { db, cleanup } = await testDB();
            expect(db).to.not.be.null;
            const res = await cleanup();
            expect(res).to.be.true;
        });
    });

    describeDB('createTimeState', (db) => {
        it('should create a time state', async () => {
            const ts = await db().createTimeState();
            expect(ts).to.have.property('_id');
            expect(ts.blocks).to.be.empty;

            const r = await db().TimeState.remove({ _id: ts._id });
            expect(r.n).to.equal(1);
            expect(r.ok).to.equal(1);
        });
    });

    describeDB('addBlock', (db) => {
        let tsId;
        it('should create a time state', async () => {
            tsId = (await db().createTimeState())._id;
            expect(tsId).to.not.be.null;
        });

        for (let i = 0; i < blks.length; i++) {
            const blk = blks[i];

            it(`should add block ${i}`, async () => {
                await db().addBlock(tsId, blk);

                const ts = (await db().TimeState.findById(tsId)).toObject();
                expect(ts.blocks).to.have.lengthOf(i + 1);

                for (let j = 0; j <= i; j++) {
                    const b = ts.blocks[j];
                    const a = blks[j];
                    expect(b._id.toString()).to.not.equal(a._id.toString());
                    expect(b.time).to.equal(a.time);
                    expect(b.initialState).to.deep.equal(a.initialState);
                    expect(b.actions).to.deep.equal(a.actions);
                }
            });
        }

        it('should fail on invalid block', async () => {
            try {
                await db().addBlock(tsId, { actions: [] });
                expect(true, 'should have failed').false;
            } catch (err) {
                expect(err.message).to.equal('Cannot save block with 0 actions');
            }
        });
    });

    describeDB('getTimeState', (db) => {
        it('should fail on bad timeStateId', async () => {
            const tsId = ObjectId();
            try {
                await db().getTimeState(tsId);
                expect(true, 'should have failed').false;
            } catch (err) {
                expect(err.message).to.equal(`Could not find timeState with ID ${tsId.toString()}`);
            }
        });

        let tsId;
        it('should add a timestate', async () => {
            const ts = await db().TimeState.create({
                blocks: blks,
            });
            tsId = ts._id;
        });

        it('should getTimeState', async () => {
            const ts = await db().getTimeState(tsId);
            expect(ts._id.toString()).to.equal(tsId.toString());
            expect(ts.blocks).to.have.lengthOf(blks.length);
            for (let i = 0; i < ts.blocks.length; i++) {
                const b = ts.blocks[i];
                const a = blks[i];
                expect(b._id.toString()).to.equal(a._id.toString());
                expect(b.time).to.equal(a.time);
                expect(b.initialState).to.deep.equal(a.initialState);
                expect(b).to.not.have.property('actions');
            }
        });
    });

    describeDB('getBlock', (db) => {
        it('should fail on bad timeStateId', async () => {
            const tsId = ObjectId();
            const blkId = ObjectId();
            try {
                await db().getBlock(tsId, blkId);
                expect(true, 'should have failed').false;
            } catch (err) {
                expect(err.message).to.equal(`Could not find timeState block with timeStateId ${tsId.toString()} and blockId ${blkId.toString()}`);
            }
        });

        let tsId;
        it('should add a timestate', async () => {
            const ts = await db().TimeState.create({
                blocks: blks,
            });
            tsId = ts._id;
        });

        it('should fail on bad blockId', async () => {
            const blkId = ObjectId();
            try {
                await db().getBlock(tsId, blkId);
                expect(true, 'should have failed').false;
            } catch (err) {
                expect(err.message).to.equal(`Could not find timeState block with timeStateId ${tsId.toString()} and blockId ${blkId.toString()}`);
            }
        });

        for (let i = 0; i < blks.length; i++) {
            const a = blks[i];
            it('should get each block', async () => {
                const b = await db().getBlock(tsId, a._id);
                expect(b._id.toString()).to.equal(a._id.toString());
                expect(b.time).to.equal(a.time);
                expect(b.initialState).to.deep.equal(a.initialState);
                expect(b.actions).to.deep.equal(a.actions);
            });
        }
    });
});
