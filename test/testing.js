import Mongo from './storage/mongo';

export async function testDB() {
    const num = Math.floor(Math.random() * 100000);
    const db = await Mongo.connect(`mongodb://localhost:27017/timestates${num}_test`);
    const cleanup = () => new Promise((resolve, reject) => {
        db.conn.dropDatabase((err, resp) => {
            if (err) reject(err);
            else resolve(resp);
        });
    });

    return { db, cleanup };
}
