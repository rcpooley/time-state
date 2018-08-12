import Mongo from './storage/mongo';
import OldMongo from './storage/oldMongo';

export async function testDB(useOld) {
    const Mon = useOld ? OldMongo : Mongo;

    const num = Math.floor(Math.random() * 100000);
    const db = await Mon.connect(`mongodb://localhost:27017/timestates${num}_test`);
    const cleanup = () => new Promise((resolve, reject) => {
        db.conn.dropDatabase((err, resp) => {
            if (err) reject(err);
            else resolve(resp);
        });
    });

    return { db, cleanup };
}
