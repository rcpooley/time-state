// @flow
import StepperImpl from './stepper';
import TimeStateStepper from './timeStateStepper';
import type { FactoryOptions, Stepper } from '../types';

export default async function<S, C> (
    options: FactoryOptions<S, C>,
    tag: string,
): Promise<Stepper<S, C>> {
    const timeStates = await options.storageProvider.getTimeStates(tag);
    if (timeStates.length === 0) {
        throw new Error(`No TimeStates found for tag ${tag}`);
    }

    const chunks = timeStates.map(ts => ({
        startTime: ts.startTime,
        endTime: ts.endTime,
    }));

    async function chunkLoader(idx: number): Promise<Stepper<S, C>> {
        return TimeStateStepper(options, timeStates[idx].id);
    }

    const stepper = new StepperImpl({
        numChunks: timeStates.length,
        startTime: timeStates[0].startTime,
        endTime: timeStates[timeStates.length - 1].endTime,
        chunkLoader,
        chunks,
    }, options, true);
    await stepper.init();
    return stepper;
}
