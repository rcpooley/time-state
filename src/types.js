// @flow
import type { Storage } from './storage/types';

export type Reducer<S, C> = (state: S, change: C) => S

export type Checksum = string | number

export type ChecksumCalc<S> = (state: S) => Checksum

export type FactoryOptions<S, C> = {
    reducer: Reducer<S, C>,
    checksum: ChecksumCalc<S>,
    storageProvider: Storage<S, C>,
    changeThreshold: number
}

export interface TimeState<S, C> {
    +id: string;
    +state: S;
    change(change: C, time: number): Promise<void>;
    stop(): Promise<void>;
}

export interface TimeStateStepper<S, C> {
    +startTime: number;
    +endTime: number;
    +state: S;
    +time: number;
    +nextChangeOffset: number;
    step(): Promise<Array<C>>;
    setTime(time: number): Promise<void>;
}

export interface TimeStateFactory<S, C> {
    create(initialState: S, time: number): Promise<TimeState<S, C>>;
    load(timeStateId: string): Promise<TimeStateStepper<S, C>>;
}