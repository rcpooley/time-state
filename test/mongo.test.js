import { expect } from 'chai';
import Mongo from './storage/mongo';

describe('Mongo', () => {
    describe('connect', () => {
        it('should error on bad url', async () => {
            try {
                await Mongo.connect('mongodb://localhost:11111/timestate_test');
                expect(true, 'Should have failed').false;
            } catch (err) {
                if (err.name !== 'MongoNetworkError') {
                    throw err;
                }
            }
        }).timeout(5000);
    });
});
