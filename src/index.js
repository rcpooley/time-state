// @flow
import Database from './db';
import TimeStateImpl from './timeState';
import type {
    FactoryOptions, TimeState, TimeStateFactory, TimeStateStepper,
} from './types';
import TimeStateStepperImpl from './timeStateStepper';

async function FactoryGen<S, C>(options: FactoryOptions<S, C>): Promise<TimeStateFactory<S, C>> {
    const db = await Database.connect(options.mongoUrl);

    async function create(initialState: S, time: number): Promise<TimeState<S, C>> {
        const ts = new TimeStateImpl(db, options);
        await ts.init(initialState, time);
        return ts;
    }

    async function load(timeStateId: string): Promise<TimeStateStepper<S, C>> {
        const tss = new TimeStateStepperImpl(db, options);
        await tss.init(timeStateId);
        return tss;
    }

    return { create, load };
}

export default FactoryGen;
