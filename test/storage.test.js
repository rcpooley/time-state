import { expect } from 'chai';
import Storage from './storage';
import { testDB } from './testing';

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
