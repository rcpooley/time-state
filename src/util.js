// @flow
import type { BlockModel } from './storage/types';
import type { Stepper } from './types';

function getBlockEndTime<S, C>(block: BlockModel<S, C>): number {
    const times = Object.keys(block.changes)
        .map(t => parseInt(t, 10))
        .sort((a, b) => b - a);
    return block.time + times[0];
}

function getStepperPercent<S, C>(stepper: Stepper<S, C>): number {
    return (stepper.time - stepper.startTime) / (stepper.endTime - stepper.startTime);
}

export default { getBlockEndTime, getStepperPercent };
