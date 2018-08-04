// @flow
import TimeStateImpl from './timeState';
import TimeStateStepperImpl from './timeStateStepper';
import StorageProvider from './storage';
import type {
    FactoryOptions, TimeState, TimeStateFactory, TimeStateStepper,
} from './types';

function factory<S, C>(options: FactoryOptions<S, C>): TimeStateFactory<S, C> {
    async function create(initialState: S, time: number): Promise<TimeState<S, C>> {
        const ts = new TimeStateImpl(options);
        await ts.init(initialState, time);
        return ts;
    }

    async function load(timeStateId: string): Promise<TimeStateStepper<S, C>> {
        const tss = new TimeStateStepperImpl(options);
        await tss.init(timeStateId);
        return tss;
    }

    return { create, load };
}

export default { factory, Storage: StorageProvider };
