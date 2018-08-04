// @flow
import type { BlockModel } from './storage/types';

function getBlockEndTime<S, C>(block: BlockModel<S, C>): number {
    const times = Object.keys(block.changes)
        .map(t => parseInt(t, 10))
        .sort((a, b) => b - a);
    return block.time + times[0];
}

export default { getBlockEndTime };
