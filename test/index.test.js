import { expect } from 'chai';
import TS from './index';
import { stringOpt, stringOptData } from './testOptions';

const THRESH = 5;

describe('TimeStateFactory', async () => {
    let db;
    let factory;
    it('should init the factory', async () => {
        const storage = await TS.Storage.memory();
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
        const timeMap = {};
        it('should load a stepper', async () => {
            let time = 1000;
            const ts = await factory.create(stringOptData[0].newState, time);
            let lastChangeTime = 0;
            timeMap[time] = { state: ts.state, offset: 1 };
            for (let i = 1; i <= 100; i++) {
                if (i % 4 !== 0) {
                    timeMap[time].offset = i;
                    time += i;
                }
                await ts.change(stringOptData[i].change, time);
                lastChangeTime = time;
                timeMap[time] = { state: ts.state, offset: 0 };
            }
            await ts.stop();
            tss = await factory.load(ts.id);
            expect(tss.startTime).to.equal(1000);
            expect(tss.endTime).to.equal(lastChangeTime);
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

        it('should set time successfully', async () => {
            const times = Object.keys(timeMap)
                .map(t => parseInt(t, 10))
                .sort((a, b) => a - b);
            for (let i = 0; i < times.length; i++) {
                const t = times[i];
                const nextTime = times[i + 1] || t + 1;
                for (let j = t; j < nextTime; j++) {
                    await tss.setTime(j);
                    expect(tss.time).to.equal(t);
                    expect(tss.state).to.equal(timeMap[t].state);
                    expect(tss.nextChangeOffset).to.equal(timeMap[t].offset);
                }
            }
        });
    });
});
