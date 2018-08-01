// @flow
export type Reducer<S, C> = (state: S, change: C) => S;

export type Checksum = string | number;

export type ChecksumCalc<S> = (state: S) => Checksum;

export type FactoryOptions<S, C> = {
    reducer: Reducer<S, C>,
    checksum: ChecksumCalc<S>,
    mongoUrl: string
};

export interface TimeState<S, C> {
    init(initialState: S, time: number): Promise<void>;
    change(change: C, time: number): void;
    checksum(checksum: Checksum, time: number): void;
}
