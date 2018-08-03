import { expect } from 'chai';
import Database from './db';

export async function testDB() {
    const num = Math.floor(Math.random() * 100000);
    const db = await Database.connect(`mongodb://localhost:27017/timestates${num}_test`);
    const cleanup = () => new Promise((resolve, reject) => {
        db.conn.dropDatabase((err, resp) => {
            if (err) reject(err);
            else resolve(resp);
        });
    });

    return { db, cleanup };
}

function describeDB(name, func, cached) {
    describe(name, async () => {
        let db;
        let cleanup;
        it('should create testing db', async () => {
            const d = cached() || await testDB();
            db = d.db;
            cleanup = d.cleanup;
        });

        func(() => db);

        it('should cleanup testing db', async () => {
            const res = await cleanup();
            expect(res).to.be.true;
        });
    });
}

export function initDBs(num) {
    const proms = [];
    for (let i = 0; i < num; i++) {
        proms.push(testDB());
    }

    let dbs = [];
    Promise.all(proms).then((a) => {
        dbs = a;
    });
    let curDB = 0;
    return function desc(name, func) {
        describeDB(name, func, () => {
            const db = dbs[curDB];
            if (db) curDB++;
            return db;
        });
    };
}

export const OPTS = {
    string5: {
        // state: a string of constant length
        // change: [index, new char]
        reducer: (s, c) => s.substring(0, c[0]) + c[1] + s.substring(c[0] + 1),
        checksum: (s) => {
            const alpha = 'abcdefghijklmnopqrstuvwxyz';
            let str = '';
            for (let i = 0; i < s.length; i++) {
                str += i;
                str += alpha.indexOf(s.charAt(i));
            }
            return str;
        },
    },
};
