// @flow
import { expect } from 'chai';
import Util from './util';
import TimeStateImpl from './timeState';
import StorageProvider from './storage';
import type {
    FactoryOptions,
    TimeState,
    TimeStateFactory,
    Stepper,
    StateMap,
    ChangeMap,
    Migrator,
    Reducer,
    ChecksumCalc, MigrateStatus,
} from './types';
import StepperInit from './stepper';
import type { Storage } from './storage/types';

function factory<S, C>(options: FactoryOptions<S, C>): TimeStateFactory<S, C> {
    const steppers = StepperInit(options);

    async function create(initialState: S, time: number, tag?: string): Promise<TimeState<S, C>> {
        const ts = new TimeStateImpl(options);
        await ts.init(initialState, time, tag);
        return ts;
    }

    async function load(timeStateId: string): Promise<Stepper<S, C>> {
        return await steppers.timeState(timeStateId);
    }

    async function loadSequence(timeStateTag: string): Promise<Stepper<S, C>> {
        return await steppers.sequence(timeStateTag);
    }

    async function loadSyncStepper(
        tags: Array<string>,
    ): Promise<Stepper<StateMap<S>, ChangeMap<C>>> {
        return await steppers.sync(tags);
    }

    return {
        create, load, loadSequence, loadSyncStepper,
    };
}

function migrate<S, C>(
    reducer: Reducer<S, C>,
    checksum: ChecksumCalc<S>,
    oldStorage: Storage<S, C>,
    newStorage: Storage<S, C>,
    newChangeThreshold: number,
): Migrator {
    const factoryA = factory({
        reducer,
        checksum,
        storageProvider:
        oldStorage,
        changeThreshold: -1,
    });
    const factoryB = factory({
        reducer,
        checksum,
        storageProvider: newStorage,
        changeThreshold: newChangeThreshold,
    });

    async function timeState(
        timeStateId: string,
        newTag: string,
        cb?: (MigrateStatus) => any,
    ): Promise<string> {
        /* eslint-disable no-await-in-loop */
        const status: MigrateStatus = [
            ['stepping', 0],
            ['verifying', 0],
        ];
        const percentThresh = 0.1;
        let lastPercent = 0;
        if (cb) cb(status);

        const stepper = await factoryA.load(timeStateId);
        const newTs = await factoryB.create(stepper.state, stepper.time, newTag);
        while (stepper.nextChangeOffset > 0) {
            const changes = await stepper.step();
            for (let i = 0; i < changes.length; i++) {
                await newTs.change(
                    changes[i],
                    stepper.time,
                );
            }
            const percent = Util.getStepperPercent(stepper);
            status[0][1] = percent;
            if (percent - lastPercent >= percentThresh) {
                lastPercent = percent;
                if (cb) cb(status);
            }
        }
        await newTs.stop();

        // Verify
        lastPercent = 0;
        await stepper.setTime(stepper.startTime);
        const newStepper = await factoryB.load(newTs.id);
        expect(stepper.startTime).to.equal(newStepper.startTime);
        expect(stepper.endTime).to.equal(newStepper.endTime);
        while (stepper.nextChangeOffset > 0) {
            expect(stepper.time).to.equal(newStepper.time);
            expect(checksum(stepper.state)).to.equal(checksum(newStepper.state));
            const oldChanges = await stepper.step();
            const newChanges = await newStepper.step();
            expect(oldChanges).to.deep.equal(newChanges);

            const percent = Util.getStepperPercent(stepper);
            status[1][1] = percent;
            if (percent - lastPercent >= percentThresh) {
                lastPercent = percent;
                if (cb) cb(status);
            }
        }
        expect(stepper.time).to.equal(newStepper.time);
        expect(checksum(stepper.state)).to.equal(checksum(newStepper.state));
        expect(stepper.nextChangeOffset).to.equal(newStepper.nextChangeOffset);

        return newTs.id;
        /* eslint-enable no-await-in-loop */
    }

    async function sequence(
        oldTag: string,
        newTag: string,
        cb?: (MigrateStatus) => any,
    ): Promise<Array<string>> {
        const oldStates = await oldStorage.getTimeStates(oldTag);
        const status: MigrateStatus = oldStates.map(ts => [`init-${ts.id}`, 0]);
        if (cb) cb(status);

        return await Promise.all(
            oldStates.map((ts, idx) => timeState(ts.id, newTag, (stat) => {
                for (let i = stat.length - 1; i >= 0; i--) {
                    if (stat[i][1] > 0) {
                        status[idx] = [`${stat[i][0]}-${ts.id}`, stat[i][1]];
                        break;
                    }
                }
                if (cb) cb(status);
            })),
        );
    }

    return { timeState, sequence };
}

export default { factory, Storage: StorageProvider, migrate };
