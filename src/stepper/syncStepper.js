// @flow
import SequenceStepper from './sequenceStepper';
import type {
    ChangeMap, FactoryOptions, StateMap, Stepper,
} from '../types';
import type { TimeStateModel } from '../storage/types';

type StepperData<S, C> = {
    stepper: Stepper<S, C>,
    timeStates: Array<TimeStateModel<S, C>>,
    timeStateIdx: number,
    nextTime: number,
    active: boolean
}

class SyncStepper<S, C> implements Stepper<StateMap<S>, ChangeMap<C>> {
    options: FactoryOptions<S, C>;

    tags: Array<string>;

    steppers: { [tag: string]: StepperData<S, C> };

    startTime: number;

    endTime: number;

    state: StateMap<S>;

    time: number;

    nextChangeOffset: number;

    constructor(options: FactoryOptions<S, C>, tags: Array<string>) {
        this.options = options;
        this.tags = tags;
    }

    async init() {
        this.steppers = {};
        await Promise.all(
            this.tags.map(tag => this.loadStepper(tag)),
        );

        const steppers = Object.keys(this.steppers).map(tag => this.steppers[tag]);

        this.startTime = Math.min(...steppers.map(s => s.stepper.startTime));
        this.endTime = Math.max(...steppers.map(s => s.stepper.endTime));

        this.state = {};
        Object.keys(this.steppers)
            .forEach((tag) => {
                const active = this.steppers[tag].stepper.startTime === this.startTime;
                this.steppers[tag].active = active;

                if (active) {
                    this.state[tag] = this.steppers[tag].stepper.state;
                } else {
                    this.state[tag] = null;
                    this.steppers[tag].nextTime = this.steppers[tag].stepper.startTime;
                }
            });

        this.time = this.startTime;
        this.updateNextChangeOffset();
    }

    updateNextChangeOffset() {
        const validTags = Object.keys(this.steppers)
            .filter(tag => this.steppers[tag].nextTime - this.time > 0);

        if (validTags.length === 0) {
            this.nextChangeOffset = 0;
            return;
        }

        this.nextChangeOffset = Math.min(...validTags
            .map(tag => this.steppers[tag].nextTime - this.time));
    }

    async loadStepper(tag: string) {
        let timeStates = [];
        const stepper = await SequenceStepper(this.options, tag, (a) => {
            timeStates = a;
        });
        this.steppers[tag] = {
            stepper,
            timeStates,
            timeStateIdx: 0,
            nextTime: stepper.startTime + stepper.nextChangeOffset,
            active: true,
        };
    }

    async step(): Promise<Array<ChangeMap<C>>> {
        const nextTime = this.time + this.nextChangeOffset;

        // Handle sequences with null spot
        const nullTags = Object.keys(this.steppers)
            .filter((tag) => {
                const s = this.steppers[tag];
                if (s.timeStateIdx === s.timeStates.length) return false;
                return s.timeStates[s.timeStateIdx].endTime === this.time;
            });

        await Promise.all(
            nullTags.map((tag) => {
                this.steppers[tag].active = false;
                this.state[tag] = null;
                this.steppers[tag].timeStateIdx++;
                // step to the next spot since next step we won't step (lol)
                return this.steppers[tag].stepper.step();
            }),
        );

        const tags = Object.keys(this.steppers)
            .filter(tag => this.steppers[tag].nextTime === nextTime);

        const changeArray = await Promise.all(
            tags.map(tag => this.stepStepper(tag)),
        );

        this.time = nextTime;
        this.updateNextChangeOffset();

        let changes = [];
        changeArray.forEach((arr) => {
            changes = changes.concat(arr);
        });

        return changes;
    }

    async stepStepper(tag: string): Promise<Array<ChangeMap<C>>> {
        const data = this.steppers[tag];

        let changes = [];

        if (!data.active) {
            data.active = true;
        } else {
            changes = await data.stepper.step();
        }

        data.nextTime = data.stepper.time + data.stepper.nextChangeOffset;
        this.state[tag] = data.stepper.state;

        return changes.map(c => ({ [tag]: c }));
    }

    async setTime(time: number): Promise<void> {
        await Promise.all(
            Object.keys(this.steppers).map(tag => this.setStepperTime(tag, time)),
        );

        this.time = time;
        this.updateNextChangeOffset();
    }

    async setStepperTime(tag: string, time: number) {
        const s = this.steppers[tag];
        await s.stepper.setTime(time);
        const ts = s.timeStates.filter(ats => time >= ats.startTime && time <= ats.endTime)[0];
        if (ts) {
            s.timeStateIdx = s.timeStates.indexOf(ts);
            s.active = true;
            s.nextTime = s.stepper.time + s.stepper.nextChangeOffset;
            this.state[tag] = s.stepper.state;
        } else {
            s.timeStateIdx = 0;
            s.timeStates.forEach((ats, idx) => {
                if (time > ats.endTime) s.timeStateIdx = idx + 1;
            });
            s.active = false;
            if (s.timeStateIdx === s.timeStates.length) {
                s.nextTime = 0;
            } else {
                s.nextTime = s.timeStates[s.timeStateIdx].startTime;
            }
            this.state[tag] = null;
            if (time >= s.stepper.time) {
                await s.stepper.step();
            }
        }
    }
}

export default SyncStepper;
