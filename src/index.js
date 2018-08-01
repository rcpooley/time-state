// @flow
import Database from './db';
import TimeStateImpl from './timeState';
import type { FactoryOptions, TimeState } from './types';

async function TimeStateFactory<S, C>(options: FactoryOptions<S, C>) {
    const db = await Database.connect(options.mongoUrl);

    async function create(initialState: S): Promise<TimeState<S, C>> {
        const ts = new TimeStateImpl(db, options);
        await ts.init(initialState, 0);
        return ts;
    }

    return create;
}

export default TimeStateFactory;
