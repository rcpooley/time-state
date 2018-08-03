// @flow
export type Reducer<S, C> = (state: S, change: C) => S

export type Checksum = string | number

export type ChecksumCalc<S> = (state: S) => Checksum

export type FactoryOptions<S, C> = {
    reducer: Reducer<S, C>,
    checksum: ChecksumCalc<S>,
    mongoUrl: string
}

export interface TimeState<S, C> {
    +id: string;
    +state: S;
    change(change: C, time: number): void;
    checksum(checksum: Checksum, time: number): void;
    stop(): Promise<void>;
}

export interface TimeStateStepper<S, C> {
    +state: S;
    +time: number;
    step(amount?: number): Promise<Array<C>>;
    setTime(time: number): Promise<void>;
}

export interface TimeStateFactory<S, C> {
    create(initialState: S, time: number): Promise<TimeState<S, C>>;
    load(timeStateId: string): Promise<TimeStateStepper<S, C>>;
}
