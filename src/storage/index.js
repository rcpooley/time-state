// @flow
import Mongo from './mongo';
import Memory from './memory';
import Dummy from './dummy';
import type { BlockModel, Storage, TimeStateModel } from './types';

class StorageProvider<S, C> implements Storage<S, C> {
    static async mongo(connUrl: string): Promise<StorageProvider<S, C>> {
        const db = await Mongo.connect(connUrl);
        return new StorageProvider(db);
    }

    static async memory(): Promise<StorageProvider<S, C>> {
        return new StorageProvider(new Memory());
    }

    static async dummy(): Promise<StorageProvider<S, C>> {
        return new StorageProvider(new Dummy());
    }

    provider: Storage<S, C>;

    constructor(provider: Storage<S, C>) {
        this.provider = provider;
    }

    createTimeState(): Promise<TimeStateModel<S, C>> {
        return this.provider.createTimeState();
    }

    addBlock(timeStateId: string, block: BlockModel<S, C>): Promise<BlockModel<S, C>> {
        const clone = { ...block };
        delete clone.id;

        ['initialState', 'time', 'changes'].forEach((key) => {
            if (!(key in clone)) {
                throw new Error(`Cannot save block with no ${key}`);
            }
        });
        if (Object.keys(clone.changes).length === 0) {
            throw new Error('Cannot save block with 0 changes');
        }

        return this.provider.addBlock(timeStateId, clone);
    }

    getTimeState(timeStateId: string): Promise<TimeStateModel<S, C>> {
        return this.provider.getTimeState(timeStateId);
    }

    getBlock(timeStateId: string, blockId: string): Promise<BlockModel<S, C>> {
        return this.provider.getBlock(timeStateId, blockId);
    }
}

export default StorageProvider;