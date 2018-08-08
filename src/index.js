// @flow
import TimeStateImpl from './timeState';
import StorageProvider from './storage';
import type {
    FactoryOptions, TimeState, TimeStateFactory, Stepper, StateMap, ChangeMap,
} from './types';
import StepperInit from './stepper';

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

export default { factory, Storage: StorageProvider };
