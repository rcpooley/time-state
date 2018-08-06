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
    });
});
