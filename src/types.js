// @flow
import type { Storage } from './storage/types';

export type Reducer<S, C> = (state: S, change: C) => S

export type Checksum = string | number

export type ChecksumCalc<S> = (state: S) => Checksum

export type FactoryOptions<S, C> = {
    reducer: Reducer<S, C>,
    checksum: ChecksumCalc<S>,
    storageProvider: Storage<S, C>,
    changeThreshold: number // the max number of changes to store in a block
}

export interface TimeState<S, C> {
    +id: string;
    +state: S;
    change(change: C, time: number): Promise<void>;
    stop(): Promise<void>;
}

export interface Stepper<S, C> {
    +startTime: number;
    +endTime: number;
    +state: S;
    +time: number;
    +nextChangeOffset: number;
    step(): Promise<Array<C>>;
    setTime(time: number): Promise<void>;
}

export type StateMap<S> = { [tag: string]: (S | null) }
export type ChangeMap<C> = { [tag: string]: C }

export interface TimeStateFactory<S, C> {
    create(initialState: S, time: number, tag?: string): Promise<TimeState<S, C>>;
    load(timeStateId: string): Promise<Stepper<S, C>>;
    loadSequence(timeStateTag: string): Promise<Stepper<S, C>>;
    loadSyncStepper(tags: Array<string>): Promise<Stepper<StateMap<S>, ChangeMap<C>>>;
}

export type MigrateStatus = Array<[string, number]> // Array<[stage, percent]>

export interface Migrator {
    timeState(
        timeStateId: string,
        newTag: string,
        status?: (MigrateStatus) => any
    ): Promise<string>; // returns new timeStateId

    sequence(
        oldTag: string,
        newTag: string,
        status: (MigrateStatus) => any
    ): Promise<Array<string>>; // returns new timeStateIds
}
