import { expect } from 'chai';
import mongoose from 'mongoose';
import Storage from './storage';
import { testDB } from './testing';

const { ObjectId } = mongoose.Types;

function test(name, dbFunc, func) {
    describe(name, () => {
        let db;
        it('should get storage', async () => {
            db = await dbFunc();
        });

        it('getTimeState should fail', async () => {
            try {
                await db.getTimeState('invalid_id');
                expect(true, 'should have failed').false;
            } catch (err) {
                expect(err.message).to.equal('TimeState not found with id invalid_id');
            }
        });

        let ts;
        it('should createTimeState', async () => {
            ts = await db.createTimeState(1000);
            expect(ts.startTime).to.equal(1000);
            expect(ts.endTime).to.equal(1000);
            expect(ts.blocks).to.be.empty;
        });

        it('should getTimeState', async () => {
            const dbTs = await db.getTimeState(ts.id);
            expect(dbTs).to.deep.equal(ts);
        });

        it('addBlock should fail', async () => {
            try {
                await db.addBlock('invalid_id', {
                    initialState: '',
                    time: 0,
                    changes: { a: 1 },
                });
                expect(true, 'should have failed').false;
            } catch (err) {
                expect(err.message).to.equal('TimeState not found with id invalid_id');
            }

            const id = ObjectId().toString();
            try {
                await db.addBlock(id, {
                    initialState: '',
                    time: 0,
                    changes: { 1: ['a'] },
                });
                expect(true, 'should have failed').false;
            } catch (err) {
                expect(err.message).to.equal(`TimeState not found with id ${id}`);
            }

            try {
                await db.addBlock(ts.id, {});
                expect(true, 'should have failed').false;
            } catch (err) {
                expect(err.message).to.equal('Cannot save block with no initialState');
            }

            try {
                await db.addBlock(ts.id, {
                    initialState: 'hello',
                });
                expect(true, 'should have failed').false;
            } catch (err) {
                expect(err.message).to.equal('Cannot save block with no time');
            }

            try {
                await db.addBlock(ts.id, {
                    initialState: 'hello',
                    time: 1000,
                });
                expect(true, 'should have failed').false;
            } catch (err) {
                expect(err.message).to.equal('Cannot save block with no changes');
            }

            try {
                await db.addBlock(ts.id, {
                    initialState: 'hello',
                    time: 1000,
                    changes: {},
                });
                expect(true, 'should have failed').false;
            } catch (err) {
                expect(err.message).to.equal('Cannot save block with 0 changes');
            }
        });

        const blks = [];
        it('should add a block', async () => {
            const b = await db.addBlock(ts.id, {
                initialState: 'hello',
                time: 1000,
                changes: {
                    10: 'hmm',
                },
            });
            expect(b.initialState).to.equal('hello');
            expect(b.time).to.equal(1000);
            expect(b.changes).to.deep.equal({ 10: 'hmm' });
            blks.push(b);
        });

        it('timeState should have updated endTime', async () => {
            ts = await db.getTimeState(ts.id);
            expect(ts.endTime).to.equal(1010);
        });

        it('should add another block', async () => {
            const b = await db.addBlock(ts.id, {
                initialState: 'jello',
                time: 1010,
                changes: {
                    100: 'hmma',
                },
            });
            expect(b.initialState).to.equal('jello');
            expect(b.time).to.equal(1010);
            expect(b.changes).to.deep.equal({ 100: 'hmma' });
            blks.push(b);
        });

        it('timeState should have updated endTime again', async () => {
            ts = await db.getTimeState(ts.id);
            expect(ts.endTime).to.equal(1110);
        });

        it('should get blocks in getTimeState', async () => {
            ts = await db.getTimeState(ts.id);
            expect(ts.blocks).to.have.lengthOf(blks.length);
            for (let i = 0; i < blks.length; i++) {
                const b = ts.blocks[i];
                const a = blks[i];
                expect(b.id).to.equal(a.id);
                expect(b.initialState).to.equal(a.initialState);
                expect(b.time).to.equal(a.time);
                expect(b).to.not.have.property('changes');
            }
        });

        it('getBlock should fail', async () => {
            try {
                await db.getBlock('invalid_id', 'invalid_block');
                expect(true, 'should have failed').false;
            } catch (err) {
                expect(err.message).to.equal('TimeState not found with id invalid_id');
            }

            try {
                await db.getBlock(ts.id, 'invalid_block');
                expect(true, 'should have failed').false;
            } catch (err) {
                expect(err.message).to.equal(`Block not found with id invalid_block in TimeState ${ts.id}`);
            }

            const bId = ObjectId().toString();
            try {
                await db.getBlock(ts.id, bId);
                expect(true, 'should have failed').false;
            } catch (err) {
                expect(err.message).to.equal(`Block not found with id ${bId} in TimeState ${ts.id}`);
            }
        });

        it('getBlock should work', async () => {
            for (let i = 0; i < blks.length; i++) {
                const a = blks[i];
                const b = await db.getBlock(ts.id, a.id);
                expect(b.id).to.equal(a.id);
                expect(b.initialState).to.equal(a.initialState);
                expect(b.time).to.equal(a.time);
                expect(b).to.have.property('changes');
            }
        });

        it('should get no time states from getTimeStates', async () => {
            const arr = await db.getTimeStates('random tag');
            expect(arr).to.be.empty;
        });

        it('getTags should work', async () => {
            const tags = ['hello', 'how', 'are', 'you', 'doing', 'today'];
            for (let i = 0; i < 3; i++) {
                for (let j = 0; j < tags.length; j++) {
                    await db.createTimeState(100, tags[j]);
                }
            }
            const dbTags = await db.getTags();
            dbTags.sort();
            expect(dbTags).to.deep.equal(tags.sort());
        });

        it('should create time states with tags', async () => {
            for (let i = 0; i < 10; i++) {
                const ts2 = await db.createTimeState(i * 2, i % 2 === 0 ? 'first' : 'second');
                await db.addBlock(ts2.id, {
                    initialState: 'hello',
                    time: i * 2,
                    changes: { 1: 'lol' },
                });
            }
        });

        it('should get "first" time states', async () => {
            const arr = await db.getTimeStates('first');
            expect(arr).to.have.lengthOf(5);
            arr.forEach((t, idx) => {
                expect(t.startTime).to.equal(idx * 4);
                expect(t.endTime).to.equal(idx * 4 + 1);
                expect(t.tag).to.equal('first');
                expect(t).to.not.have.property('blocks');
            });
        });

        it('should get "second" time states', async () => {
            const arr = await db.getTimeStates('second');
            expect(arr).to.have.lengthOf(5);
            arr.forEach((t, idx) => {
                expect(t.startTime).to.equal(idx * 4 + 2);
                expect(t.endTime).to.equal(idx * 4 + 2 + 1);
                expect(t.tag).to.equal('second');
                expect(t).to.not.have.property('blocks');
            });
        });

        it('addBlock should fail on time mismatch', async () => {
            const ts2 = await db.createTimeState(1000, '');
            await db.addBlock(ts2.id, {
                initialState: 'hello',
                time: 5000,
                changes: {
                    500: ['a'],
                },
            });
            try {
                await db.addBlock(ts2.id, {
                    initialState: 'goodbye',
                    time: 5501,
                    changes: {
                        1: ['a'],
                    },
                });
                expect(true, 'should have failed').false;
            } catch (err) {
                expect(err.message).to.equal('Cannot add block because starting time 5501 does not match previous block\'s ending time 5500');
            }

            await db.addBlock(ts2.id, {
                initialState: 'goodbye',
                time: 5500,
                changes: {
                    1: ['a'],
                },
            });

            await db.addBlock(ts2.id, {
                initialState: 'asdf',
                time: 5501,
                changes: {
                    2: ['a'],
                },
            });
        });

        it('getTimeStates should delete empty blocks', async () => {
            for (let i = 0; i < 5; i++) {
                await db.createTimeState(i * 100, 'deltest');
                const ats = await db.createTimeState(i * 100 + 50, 'deltest');
                await db.addBlock(ats.id, {
                    initialState: 'hi',
                    time: i * 100 + 50,
                    changes: {
                        1: 'a',
                    },
                });
            }
            const states = await db.getTimeStates('deltest');
            expect(states).to.have.lengthOf(5);
        });

        it('should addBlock with 0 change time', async () => {
            const ats = await db.createTimeState(1000, 'buzz');
            await db.addBlock(ats.id, {
                initialState: 'hello',
                time: 1000,
                changes: {
                    0: [[0, 'j']],
                },
            });
        });

        it('should getTimeStates in order', async () => {
            const ats = await db.createTimeState(2000, 'test-order');
            await db.addBlock(ats.id, {
                initialState: 'hello',
                time: 2000,
                changes: { 0: [0, 'j'] },
            });
            const bts = await db.createTimeState(1000, 'test-order');
            await db.addBlock(bts.id, {
                initialState: 'hello',
                time: 2000,
                changes: { 0: [0, 'j'] },
            });
            const states = await db.getTimeStates('test-order');
            expect(states).to.have.lengthOf(2);
            expect(states[0].id).to.equal(bts.id);
            expect(states[1].id).to.equal(ats.id);
        });

        if (func) func();
    });
}

let cleanup;
test('Storage - memory', () => Storage.memory());
test('Storage - mongo', async () => {
    const d = await testDB();
    cleanup = d.cleanup;
    return new Storage(d.db);
}, () => {
    it('should cleanup db', async () => {
        await cleanup();
    });
});

test('Storage - oldMongo', async () => {
    const d = await testDB(true);
    cleanup = d.cleanup;
    return new Storage(d.db);
}, () => {
    it('should cleanup db', async () => {
        await cleanup();
    });
});
