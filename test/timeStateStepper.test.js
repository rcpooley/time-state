import { expect } from 'chai';
import TimeStateStepperImpl from './timeStateStepper';
import { initDBs, OPTS } from './testing';

const describeDB = initDBs(3);

describe('TimeStateStepperImpl', () => {
    describeDB('init', (db) => {
        it('should fail with empty blocks', async () => {
            const ts = await db().createTimeState();

            const tss = new TimeStateStepperImpl(db());
            try {
                await tss.init(ts._id.toString());
                expect(true, 'should have failed').false;
            } catch (err) {
                expect(err.message).to.equal('Cannot init stepper from timeState with no blocks');
            }
        });

        it('should init successfully', async () => {
            const ts = await db().createTimeState();
            await db().addBlock(ts._id, {
                initialState: 'hello',
                time: 1000,
                actions: {
                    5: [],
                    10: [],
                    7: [],
                },
            });

            const tss = new TimeStateStepperImpl(db(), OPTS.string5);
            await tss.init(ts._id.toString());
            expect(tss.timeStateId).to.deep.equal(ts._id);
            expect(tss.curBlockIdx).to.equal(0);
            expect(tss.curBlockTimes).to.deep.equal([5, 7, 10]);
            expect(tss.nextTimeIdx).to.equal(0);
            expect(tss.state).to.be.undefined;
            expect(tss.time).to.equal(0);
        });
    });

    describeDB('nextBlock', (db) => {
        it('should fail with bad checksums', async () => {
            const ts = await db().createTimeState();
            await db().addBlock(ts._id, {
                initialState: 'hello',
                time: 1000,
                actions: { 1: 1 },
            });
            await db().addBlock(ts._id, {
                initialState: 'jello',
                time: 2000,
                actions: { 1: 1 },
            });

            const tss = new TimeStateStepperImpl(db(), OPTS.string5);
            await tss.init(ts._id.toString());
            tss.state = 'hello';

            try {
                await tss.nextBlock();
                expect(true, 'should have failed').false;
            } catch (err) {
                expect(err.message).to.equal(
                    `Checksum mismatch when loading next block. Old checksum: ${OPTS.string5.checksum('hello')}; New checksum: ${OPTS.string5.checksum('jello')}`,
                );
            }
        });
    });

    describeDB('getClosestBlockIdx', (db) => {
        let tss;
        it('should init stepper', async () => {
            const blks = [];
            for (let i = 1; i <= 10; i++) {
                blks.push({
                    initialState: 'hello',
                    time: i * 100,
                    actions: { 1: 1 },
                });
            }

            const ts = await db().TimeState.create({
                blocks: blks,
            });

            tss = new TimeStateStepperImpl(db(), OPTS.string5);
            await tss.init(ts._id.toString());
        });

        it('should get first block when time = 0', () => {
            expect(tss.getClosestBlockIdx(0)).to.equal(0);
        });

        for (let i = 1; i <= 10; i++) {
            it(`should get block ${i}`, () => {
                for (let j = 0; j < 100; j++) {
                    expect(tss.getClosestBlockIdx(i * 100 + j)).to.equal(i - 1);
                }
            });
        }
    });
});
