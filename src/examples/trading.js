// @flow
/* eslint-disable no-await-in-loop, no-console */
import TS from '../index';
import type {
    ChangeMap, StateMap, Stepper, TimeState,
} from '../types';

type State = [number, number] // [highest bid, lowest ask]

type Change = number // Positive = bid, Negative = ask

type SyncStepper = Stepper<StateMap<State>, ChangeMap<Change>>

function rand(min: number, max: number): number {
    return min + Math.random() * (max - min);
}

function ave(s: State) {
    return (s[0] + s[1]) / 2;
}

function ratio(syncState: StateMap<State>): number {
    // Make sure we don't have any null values
    if (Object.values(syncState).includes(null)) return -1;

    const state: { [pair: string]: State } = (syncState: any);

    let r = 1; // 1 BTC

    r *= state.BTCUSD[0]; // BTC -> USD (bid)
    r /= state.ETHUSD[1]; // USD -> ETH (ask)
    r *= state.ETHBTC[0]; // ETH -> BTC (bid)

    return r;
}

const pairs = {
    BTCUSD: [6462, 1],
    ETHUSD: [362, 0.25],
    ETHBTC: [0.055911, 0.001],
}; // Maps pair to [base price, delta price]

const storage = TS.Storage.memory();
const factory = TS.factory({
    reducer: (s: State, c: Change) => {
        const newState = [s[0], s[1]]; // Clone the state
        if (c > 0) {
            newState[0] = c;
        } else {
            newState[1] = -c;
        }
        return newState;
    },
    checksum: (s: State) => s[0] + s[1],
    storageProvider: storage,
    changeThreshold: 50,
});

async function simulateMarket(pair: string, startTime: number, endTime: number) {
    const [base, delta] = pairs[pair];
    const startBid = base - rand(0, delta);
    const startAsk = base + rand(0, delta);

    const ts: TimeState<State, Change> = await factory.create(
        [startBid, startAsk],
        startTime,
        pair, // Use pair as tag
    );

    let time = startTime;
    while (time < endTime) {
        time += Math.floor(rand(1, 20));

        let { state } = ts;
        if (rand(0, 1) > 0.5) {
            await ts.change(state[0] + rand(-delta, delta), time);
        } else {
            await ts.change(-(state[1] + rand(-delta, delta)), time);
        }

        // Make sure bid is lower than ask
        ({ state } = ts);
        if (state[0] >= state[1]) {
            await ts.change(state[1] - rand(0, delta), time);
        }
    }

    await ts.stop();
}

const timeRanges = [
    [100, 200],
    [1000, 2000],
    [3000, 4000],
    [7000, 8000],
    [10000, 13000],
];

(async function run() {
    for (let i = 0; i < timeRanges.length; i++) {
        const range = timeRanges[i];

        // Simulate all markets in this time range
        await Promise.all(
            Object.keys(pairs).map(pair => simulateMarket(
                pair,
                Math.floor(range[0] + rand(0, 10)),
                Math.floor(range[1] - rand(0, 10)),
            )),
        );
    }

    // Get lowest & highest price of BTCUSD
    const btcStepper = await factory.loadSequence('BTCUSD');
    let lowest = ave(btcStepper.state);
    let highest = lowest;
    while (btcStepper.nextChangeOffset > 0) {
        await btcStepper.step();
        const price = ave(btcStepper.state);
        if (price < lowest) lowest = price;
        if (price > highest) highest = price;
    }
    console.log(`BTCUSD lowest: ${lowest}`);
    console.log(`BTCUSD highest: ${highest}`);

    // Get best ratio trading in a circle
    const stepper: SyncStepper = await factory.loadSyncStepper(Object.keys(pairs));
    let bestRatio = ratio(stepper.state);
    let time = stepper.startTime;
    while (stepper.nextChangeOffset > 0) {
        await stepper.step();
        const r = ratio(stepper.state);
        if (r > bestRatio) {
            bestRatio = r;
            ({ time } = stepper);
        }
    }
    console.log(`Best ratio: ${bestRatio}`);
    console.log(`Time: ${time}`);
    await stepper.setTime(time);
    console.log(`Market state: ${JSON.stringify(stepper.state, null, 2)}`);
}());
