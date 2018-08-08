import { expect } from 'chai';
import TS from './index';
import { stringOpt, stringOptData } from './testOptions';

const THRESH = 5;

async function getSampleTimeState(factory, start, end, startTime, tag) {
    let time = startTime;
    const ts = await factory.create(stringOptData[start].newState, time, tag);
    let lastChangeTime = 0;
    const timeMap = {};
    timeMap[time] = { state: ts.state };
    for (let i = start + 1; i <= end; i++) {
        if (i % 4 !== 0) {
            timeMap[time].offset = i;
            time += i;
        }
        await ts.change(stringOptData[i].change, time);
        lastChangeTime = time;
        timeMap[time] = { state: ts.state, offset: 0 };
    }
    await ts.stop();
    return { ts, timeMap, lastChangeTime };
}

async function testSetTime(tss, timeMap) {
    const times = Object.keys(timeMap)
        .map(t => parseInt(t, 10))
        .sort((a, b) => a - b);
    for (let i = 0; i < times.length; i++) {
        const t = times[i];
        const nextTime = times[i + 1] || t + 1;
        const ranges = [[t, t + 10], [nextTime - 10, nextTime]];
        for (let k = 0; k < ranges.length; k++) {
            const range = ranges[k];
            for (let j = Math.max(range[0], t); j < Math.min(range[1], nextTime); j++) {
                await tss.setTime(j);
                expect(tss.time).to.equal(t);
                expect(tss.state).to.equal(timeMap[t].state);
                expect(tss.nextChangeOffset).to.equal(timeMap[t].offset);
            }
        }
    }
}

function getState(idx) {
    return stringOptData[idx].newState;
}

function getChange(idx) {
    return stringOptData[idx].change;
}

describe('TimeStateFactory', async () => {
    let db;
    let factory;
    let storage;
    it('should init the factory', async () => {
        storage = await TS.Storage.memory();
        db = storage.provider;
        const opts = { ...stringOpt, storageProvider: storage, changeThreshold: THRESH };
        factory = TS.factory(opts);
    });

    describe('TimeState', () => {
        let ts;
        let model;
        it('should create a TimeState', async () => {
            ts = await factory.create('hello', 1000);
            model = db.timeStates[ts.id];
            expect(ts.state).to.equal('hello');
            expect(model).to.deep.equal({
                id: ts.id,
                tag: '',
                startTime: 1000,
                endTime: 1000,
                blocks: [],
            });
        });

        it('should create a TimeState with a tag', async () => {
            const ts2 = await factory.create('hello', 1000, 'cool tag');
            const model2 = db.timeStates[ts2.id];
            expect(ts2.state).to.equal('hello');
            expect(model2).to.deep.equal({
                id: ts2.id,
                tag: 'cool tag',
                startTime: 1000,
                endTime: 1000,
                blocks: [],
            });
        });

        it('should make changes', async () => {
            for (let i = 0; i < THRESH - 1; i++) {
                for (let j = 0; j < 2; j++) {
                    await ts.change([4, 'a'], 1000 + i);
                    expect(ts.state).to.equal('hella');
                }
            }
            await ts.change([3, 't'], 1004);
            expect(ts.state).to.equal('helta');
            expect(model.blocks).to.be.empty;
        });

        it('should create a block', async () => {
            await ts.change([0, 'd'], 1005);
            expect(ts.state).to.equal('delta');
            expect(model.blocks).to.have.lengthOf(1);
            const b = model.blocks[0];
            expect(b.initialState).to.equal('hello');
            expect(b.time).to.equal(1000);

            const c = [4, 'a'];
            expect(b.changes).to.deep.equal({
                0: [c, c],
                1: [c, c],
                2: [c, c],
                3: [c, c],
                4: [[3, 't']],
            });
        });

        it('should create another block', async () => {
            const c = [3, 'f'];
            for (let i = 0; i < THRESH; i++) {
                await ts.change(c, 1104 + i);
                expect(ts.state).to.equal('delfa');
            }

            expect(model.blocks).to.have.lengthOf(2);
            const b = model.blocks[1];
            expect(b.initialState).to.equal('helta');
            expect(b.time).to.equal(1004);
            expect(b.changes).to.deep.equal({
                1: [[0, 'd']],
                100: [c],
                101: [c],
                102: [c],
                103: [c],
            });
        });

        it('should stop', async () => {
            await ts.stop();
            expect(model.blocks).to.have.lengthOf(3);
            try {
                await ts.change([1, 'a'], 2000);
                expect(true, 'should have failed').false;
            } catch (err) {
                expect(err.message).to.equal('Cannot emit change on a closed timeState');
            }
        });

        it('should stop and make block', async () => {
            const ts2 = await factory.create('pun', 1000);
            const model2 = db.timeStates[ts2.id];
            expect(ts2.state).to.equal('pun');
            ts2.change([0, 'n'], 1001);
            expect(model2.blocks).to.be.empty;
            await ts2.stop();
            expect(model2.blocks).to.have.lengthOf(1);
            const b = model2.blocks[0];
            expect(b.initialState).to.equal('pun');
            expect(b.time).to.equal(1000);
            expect(b.changes).to.deep.equal({
                1: [[0, 'n']],
            });
        });

        it('should make changes with no delay', async () => {
            const ats = await factory.create('hello', 100);
            await ats.change([0, 'j'], 100);
            await ats.change([4, 'a'], 100);
            await ats.change([1, 'a'], 105);
            await ats.stop();
            const mem = db.timeStates[ats.id];
            expect(mem.blocks).to.have.lengthOf(1);
            const b = mem.blocks[0];
            expect(Object.keys(b.changes)).to.deep.equal(['0', '5']);
            expect(b.changes[0]).to.deep.equal([[0, 'j'], [4, 'a']]);
            expect(b.changes[5]).to.deep.equal([[1, 'a']]);
        });
    });

    describe('TimeStateStepper', () => {
        let tss;
        let timeMap = {};
        it('should load a stepper', async () => {
            const test = await getSampleTimeState(factory, 0, 100, 1000);
            timeMap = test.timeMap;
            tss = await factory.load(test.ts.id);
            expect(tss.startTime).to.equal(1000);
            expect(tss.endTime).to.equal(test.lastChangeTime);
            expect(tss.state).to.equal(stringOptData[0].newState);
            expect(tss.time).to.equal(1000);
            expect(tss.nextChangeOffset).to.equal(1);
        });

        it('should step successfully', async () => {
            let time = 1000;
            for (let i = 1; i <= 100;) {
                time += i;

                const changes = await tss.step();
                expect(changes).to.have.lengthOf(i % 4 === 3 ? 2 : 1);
                i += changes.length;
                expect(tss.state).to.equal(stringOptData[i - 1].newState);
                expect(tss.time).to.equal(time);
                expect(tss.nextChangeOffset).to.equal(timeMap[time].offset);
            }
        });

        it('should set time successfully', () => testSetTime(tss, timeMap));

        it('should fail on bad checksum', async () => {
            db.timeStates['stepper-test'] = {
                id: 'stepper-test',
                tag: '',
                startTime: 1000,
                endTime: 1300,
                blocks: [
                    {
                        id: 'block0',
                        initialState: 'hello',
                        time: 1000,
                        changes: {
                            100: [[0, 'j']],
                            250: [[4, 'a']],
                        },
                    },
                    {
                        id: 'block1',
                        initialState: 'hella',
                        time: 1250,
                        changes: {
                            50: [[2, 'b']],
                        },
                    },
                ],
            };
            const tss2 = await factory.load('stepper-test');
            expect(tss2.startTime).to.equal(1000);
            expect(tss2.endTime).to.equal(1300);
            expect(tss2.state).to.equal('hello');
            expect(tss2.time).to.equal(1000);
            expect(tss2.nextChangeOffset).to.equal(100);
            await tss2.step();
            expect(tss2.state).to.equal('jello');
            expect(tss2.time).to.equal(1100);
            expect(tss2.nextChangeOffset).to.equal(150);
            try {
                await tss2.step();
                expect(true, 'should have failed').false;
            } catch (err) {
                expect(err.message).to.equal(`Checksum mismatch when loading next block. Old checksum: ${stringOpt.checksum('jella')}; New checksum: ${stringOpt.checksum('hella')}`);
            }
        });

        it('should step with zero delay change', async () => {
            const ts = await factory.create('hello', 100);
            await ts.change([0, 'j'], 100);
            await ts.change([4, 'a'], 100);
            await ts.change([1, 'a'], 104);
            await ts.stop();

            const atss = await factory.load(ts.id);

            // 100
            expect(atss.startTime).to.equal(100);
            expect(atss.endTime).to.equal(104);
            expect(atss.time).to.equal(100);
            expect(atss.state).to.equal('jella');
            expect(atss.nextChangeOffset).to.equal(4);

            // 100 -> 104
            expect(await atss.step()).to.deep.equal([[1, 'a']]);
            expect(atss.time).to.equal(104);
            expect(atss.state).to.equal('jalla');
            expect(atss.nextChangeOffset).to.equal(0);

            // 104 -> 104
            expect(await atss.step()).to.deep.equal([]);
            expect(atss.time).to.equal(104);
            expect(atss.state).to.equal('jalla');
            expect(atss.nextChangeOffset).to.equal(0);
        });
    });

    describe('TimeStateSequence', () => {
        let tss;
        let timeMap = {};
        const timeRanges = [];
        it('should load a stepper', async () => {
            let time = 1000;
            for (let i = 0; i < 5; i++) {
                const test = await getSampleTimeState(factory, i * 200, i * 200 + 100, time, 'sequence-test');
                timeMap = { ...timeMap, ...test.timeMap };
                if (i !== 4) timeMap[test.lastChangeTime].offset = 1000;
                timeRanges.push([time, test.lastChangeTime]);
                time = test.lastChangeTime + 1000;
            }

            tss = await factory.loadSequence('sequence-test');
            expect(tss.startTime).to.equal(1000);
            expect(tss.endTime).to.equal(time - 1000);
            expect(tss.state).to.equal(stringOptData[0].newState);
            expect(tss.time).to.equal(1000);
            expect(tss.nextChangeOffset).to.equal(1);
        });

        it('should verify the time states', async () => {
            const timeStates = await storage.getTimeStates('sequence-test');
            expect(timeStates).to.have.lengthOf(5);
            for (let i = 0; i < timeRanges.length; i++) {
                const r = timeRanges[i];
                expect(timeStates[i].startTime).to.equal(r[0]);
                expect(timeStates[i].endTime).to.equal(r[1]);
            }
        });

        it('should step successfully', async () => {
            let time = 1000;
            for (let i = 0; i < 5; i++) {
                for (let j = i * 200 + 1; j <= i * 200 + 100;) {
                    time += j;

                    const changes = await tss.step();
                    expect(changes).to.have.lengthOf(j % 4 === 3 ? 2 : 1);
                    j += changes.length;
                    expect(tss.state).to.equal(stringOptData[j - 1].newState);
                    expect(tss.time).to.equal(time);
                    expect(tss.nextChangeOffset).to.equal(timeMap[time].offset);
                }
                if (i !== 4) {
                    time += 1000;
                    const changes = await tss.step();
                    expect(changes).to.be.empty;
                    expect(tss.state).to.equal(timeMap[time].state);
                    expect(tss.time).to.equal(time);
                    expect(tss.nextChangeOffset).to.equal(timeMap[time].offset);
                }
            }
        });

        it('should set time successfully', () => testSetTime(tss, timeMap)).timeout(5000);

        it('should step with zero change delay', async () => {
            const ats = await factory.create('hello', 100, 'zero-tag');
            await ats.change([0, 'b'], 100);
            await ats.change([3, 't'], 100);
            await ats.change([4, 'y'], 105);
            await ats.stop();

            const bts = await factory.create('coolo', 106, 'zero-tag');
            await bts.change([0, 'p'], 106);
            await bts.change([4, 'i'], 108);
            await bts.stop();

            const cts = await factory.create('asdfg', 108, 'zero-tag');
            await cts.change([4, 'z'], 109);
            await cts.stop();

            const dts = await factory.create('qqqqq', 109, 'zero-tag');
            await dts.change([2, 'v'], 109);
            await dts.stop();

            const atss = await factory.loadSequence('zero-tag');

            // 100
            expect(atss.startTime).to.equal(100);
            expect(atss.endTime).to.equal(109);
            expect(atss.state).to.equal('belto');
            expect(atss.time).to.equal(100);
            expect(atss.nextChangeOffset).to.equal(5);

            // 100 -> 105
            expect(await atss.step()).to.deep.equal([[4, 'y']]);
            expect(atss.state).to.equal('belty');
            expect(atss.time).to.equal(105);
            expect(atss.nextChangeOffset).to.equal(1);

            // 105 -> 106
            expect(await atss.step()).to.deep.equal([]);
            expect(atss.state).to.equal('poolo');
            expect(atss.time).to.equal(106);
            expect(atss.nextChangeOffset).to.equal(2);

            // 106 -> 108
            expect(await atss.step()).to.deep.equal([]);
            expect(atss.state).to.equal('asdfg');
            expect(atss.time).to.equal(108);
            expect(atss.nextChangeOffset).to.equal(1);

            // 108 -> 109
            expect(await atss.step()).to.deep.equal([]);
            expect(atss.state).to.equal('qqvqq');
            expect(atss.time).to.equal(109);
            expect(atss.nextChangeOffset).to.equal(0);

            // 109 -> 109
            expect(await atss.step()).to.deep.equal([]);
            expect(atss.state).to.equal('qqvqq');
            expect(atss.time).to.equal(109);
            expect(atss.nextChangeOffset).to.equal(0);
        });
    });

    describe('SyncStepper', () => {
        async function initSequence(tag, timeArrayMap) {
            const startIndices = Object.keys(timeArrayMap).map(idx => parseInt(idx, 10));
            for (let i = 0; i < startIndices.length; i++) {
                let startIdx = startIndices[i];
                const times = timeArrayMap[startIdx];

                const ts = await factory.create(
                    stringOptData[startIdx++].newState,
                    times[0],
                    tag,
                );

                for (let j = 1; j < times.length; j++) {
                    await ts.change(stringOptData[startIdx++].change, times[j]);
                }

                await ts.stop();
            }
        }

        const sequences = [
            [
                [10, 15, 20],
                [30, 31, 37],
                [38, 39],
            ],
            [
                [12, 13, 15, 17, 21],
                [27, 34, 37, 39],
            ],
            [
                [10, 17, 22, 29, 30, 42],
            ],
        ];

        const seqIndices = {};
        it('should initialize data', async () => {
            const parsed = {};
            let curChangeIdx = 0;
            for (let i = 0; i < sequences.length; i++) {
                const seq = sequences[i];
                const obj = {};
                const idxs = [];
                for (let j = 0; j < seq.length; j++) {
                    obj[curChangeIdx] = seq[j];
                    idxs.push(curChangeIdx);
                    curChangeIdx += seq[j].length + 2;
                }
                const tag = `seq_${i}`;
                parsed[tag] = obj;
                seqIndices[tag] = idxs;
            }

            await Promise.all(
                Object.keys(parsed).map(tag => initSequence(tag, parsed[tag])),
            );
        });

        it('should step successfully', async () => {
            const idxMap = Object.keys(seqIndices).map(tag => seqIndices[tag][0]);
            let states = {};

            const stepper = await factory.loadSyncStepper(Object.keys(seqIndices));
            expect(stepper.startTime).to.equal(10);
            expect(stepper.endTime).to.equal(42);
            expect(stepper.time).to.equal(10);
            expect(stepper.nextChangeOffset).to.equal(2);

            const assertStateChange = (obj) => {
                states = { ...states, ...obj };
                expect(stepper.state).to.deep.equal(states);
            };

            const assertStates = (...idxs) => {
                const obj = {};
                idxs.forEach((i) => {
                    if (i >= 10) {
                        obj[`seq_${i % 10}`] = null;
                    } else {
                        obj[`seq_${i}`] = getState(idxMap[i]++);
                    }
                });
                assertStateChange(obj);
            };

            const assertChange = async (...idxs) => {
                const changes = idxs.map(idx => ({
                    [`seq_${idx}`]: getChange(idxMap[idx]),
                }));
                expect(await stepper.step()).to.deep.equal(changes);
            };

            assertStateChange({
                seq_0: getState(idxMap[0]++),
                seq_1: null,
                seq_2: getState(idxMap[2]++),
            });

            // 10 -> 12
            expect(await stepper.step()).to.deep.equal([]);
            assertStateChange({ seq_1: getState(idxMap[1]++) });
            expect(stepper.time).to.equal(12);
            expect(stepper.nextChangeOffset).to.equal(1);

            // 12 -> 13
            await assertChange(1);
            assertStates(1);
            expect(stepper.time).to.equal(13);
            expect(stepper.nextChangeOffset).to.equal(2);

            // 13 -> 15
            await assertChange(0, 1);
            assertStates(0, 1);
            expect(stepper.time).to.equal(15);
            expect(stepper.nextChangeOffset).to.equal(2);

            // 15 -> 17
            await assertChange(1, 2);
            assertStates(1, 2);
            expect(stepper.time).to.equal(17);
            expect(stepper.nextChangeOffset).to.equal(3);

            // 17 -> 20
            await assertChange(0);
            assertStates(0);
            expect(stepper.time).to.equal(20);
            expect(stepper.nextChangeOffset).to.equal(1);

            // 20 -> 21
            await assertChange(1);
            assertStates(10, 1);
            expect(stepper.time).to.equal(21);
            expect(stepper.nextChangeOffset).to.equal(1);

            // 21 -> 22
            await assertChange(2);
            assertStates(11, 2);
            expect(stepper.time).to.equal(22);
            expect(stepper.nextChangeOffset).to.equal(5);

            // 22 -> 27
            expect(await stepper.step()).to.deep.equal([]);
            idxMap[1] = seqIndices.seq_1[1];
            assertStates(1);
            expect(stepper.time).to.equal(27);
            expect(stepper.nextChangeOffset).to.equal(2);

            // 27 -> 29
            await assertChange(2);
            assertStates(2);
            expect(stepper.time).to.equal(29);
            expect(stepper.nextChangeOffset).to.equal(1);

            // 29 -> 30
            await assertChange(2);
            idxMap[0] = seqIndices.seq_0[1];
            assertStates(0, 2);
            expect(stepper.time).to.equal(30);
            expect(stepper.nextChangeOffset).to.equal(1);

            // 30 -> 31
            await assertChange(0);
            assertStates(0);
            expect(stepper.time).to.equal(31);
            expect(stepper.nextChangeOffset).to.equal(3);

            // 31 -> 34
            await assertChange(1);
            assertStates(1);
            expect(stepper.time).to.equal(34);
            expect(stepper.nextChangeOffset).to.equal(3);

            // 34 -> 37
            await assertChange(0, 1);
            assertStates(0, 1);
            expect(stepper.time).to.equal(37);
            expect(stepper.nextChangeOffset).to.equal(1);

            // 37 -> 38
            expect(await stepper.step()).to.deep.equal([]);
            idxMap[0] = seqIndices.seq_0[2];
            assertStates(0);
            expect(stepper.time).to.equal(38);
            expect(stepper.nextChangeOffset).to.equal(1);

            // 38 -> 39
            await assertChange(0, 1);
            assertStates(0, 1);
            expect(stepper.time).to.equal(39);
            expect(stepper.nextChangeOffset).to.equal(3);

            // 39 -> 42
            await assertChange(2);
            assertStates(2, 10, 11);
            expect(stepper.time).to.equal(42);
            expect(stepper.nextChangeOffset).to.equal(0);

            // 42 -> 42
            expect(await stepper.step()).to.deep.equal([]);
            assertStates();
            expect(stepper.time).to.equal(42);
            expect(stepper.nextChangeOffset).to.equal(0);
        });
    });
});
