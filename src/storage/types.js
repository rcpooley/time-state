// @flow
export type BlockModel<S, C> = {
    id: string,
    initialState: S,
    time: number,
    changes: {
        [timeOffset: string]: Array<C>,
    }
}

export type TimeStateModel<S, C> = {
    id: string,
    startTime: number,
    endTime: number,
    blocks: Array<BlockModel<S, C>>
}

export interface Storage<S, C> {
    createTimeState(time: number): Promise<TimeStateModel<S, C>>;
    addBlock(timeStateId: string, block: BlockModel<S, C>): Promise<BlockModel<S, C>>;
    getTimeState(timeStateId: string): Promise<TimeStateModel<S, C>>;
    getBlock(timeStateId: string, blockId: string): Promise<BlockModel<S, C>>;
}
