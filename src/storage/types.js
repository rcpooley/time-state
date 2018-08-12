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
    tag: string,
    startTime: number,
    endTime: number,
    blocks: Array<BlockModel<S, C>>
}

export interface Storage<S, C> {
    // Creates and returns a timeState with no blocks
    createTimeState(time: number, tag: string): Promise<TimeStateModel<S, C>>;

    // Adds a block to a timeState
    // Generates a new id for the block
    // Returns the block with the new id
    addBlock(timeStateId: string, block: BlockModel<S, C>): Promise<BlockModel<S, C>>;

    // Returns the corresponding timeState
    // Each block in the blocks array will not have 'changes' property
    getTimeState(timeStateId: string): Promise<TimeStateModel<S, C>>;

    // Returns the corresponding block (with all properties)
    getBlock(timeStateId: string, blockId: string): Promise<BlockModel<S, C>>;

    // Returns an array of timeStates with the provided tag
    // Each timeState will not have 'blocks' property
    getTimeStates(tag: string): Promise<Array<TimeStateModel<S, C>>>;

    // Returns an array of all the tags saved
    getTags(): Promise<Array<string>>;
}
