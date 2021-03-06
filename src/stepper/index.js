// @flow
import TimeStateStepper from './timeStateStepper';
import SequenceStepper from './sequenceStepper';
import SyncStepper from './syncStepper';
import type {
    ChangeMap, FactoryOptions, StateMap, Stepper,
} from '../types';

export type Steppers<S, C> = {
    timeState: (timeStateId: string) => Promise<Stepper<S, C>>,
    sequence: (tag: string) => Promise<Stepper<S, C>>,
    sync: (tags: Array<string>) => Promise<Stepper<StateMap<S>, ChangeMap<C>>>
}

export default function<S, C> (options: FactoryOptions<S, C>): Steppers<S, C> {
    return {
        timeState(timeStateId: string) {
            return TimeStateStepper(options, timeStateId);
        },
        sequence(tag: string) {
            return SequenceStepper(options, tag);
        },
        async sync(tags: Array<string>) {
            const sync = new SyncStepper(options, tags);
            await sync.init();
            return sync;
        },
    };
}
