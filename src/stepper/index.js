// @flow
import TimeStateStepper from './timeStateStepper';
import SequenceStepper from './sequenceStepper';
import type { FactoryOptions, Stepper } from '../types';

export type Steppers<S, C> = {
    timeState: (timeStateId: string) => Promise<Stepper<S, C>>,
    sequence: (tag: string) => Promise<Stepper<S, C>>
}

export default function<S, C> (options: FactoryOptions<S, C>): Steppers<S, C> {
    return {
        timeState(timeStateId: string) {
            return TimeStateStepper(options, timeStateId);
        },
        sequence(tag: string) {
            return SequenceStepper(options, tag);
        },
    };
}
