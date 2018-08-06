// @flow
/* eslint-disable no-await-in-loop, no-console */
import TS from '../index';
import type { Stepper, TimeState } from '../types';

type Board = Array<number>

type State = {
    player: number, // 1 or 2
    board: Board,
}

type Change = number // position

function sleep(time: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, time);
    });
}

// returns 1 or 2 if there is a winner, 0 if game is in progress, or -1 if cat
function getWinner(board: Board): number {
    const matches = (a, b, c) => (board[a] === board[b] && board[b] === board[c] ? board[a] : 0);
    const winners = [
        matches(0, 4, 8),
        matches(2, 4, 6),
    ];
    for (let i = 0; i < 3; i++) {
        winners.push(matches(i, i + 3, i + 6));
        winners.push(matches(i * 3, i * 3 + 1, i * 3 + 2));
    }
    return winners.filter(w => w > 0)[0] || board.filter(i => i === 0).length === 0 ? -1 : 0;
}

const storage = TS.Storage.memory();
const factory = TS.factory({
    reducer: (s: State, c: Change) => {
        const newState = {
            player: 3 - s.player, // alternate between 1 and 2
            board: s.board.slice(0), // clone the current board
        };
        newState.board[c] = s.player; // update the board with the requested move
        return newState;
    },
    checksum: (s: State) => JSON.stringify(s),
    storageProvider: storage,
    changeThreshold: 9,
});

async function playGame(firstPlayer: number): Promise<string> {
    const ts: TimeState<State, Change> = await factory.create({
        player: firstPlayer,
        board: new Array(9).fill(0),
    }, Date.now());

    while (getWinner(ts.state.board) === 0) {
        await sleep(50);
        const open = ts.state.board.map((v, idx) => [v, idx]).filter(arr => arr[0] === 0);
        const move = open[Math.floor(Math.random() * open.length)];
        await ts.change(move[1], Date.now());
    }

    await ts.stop();

    return ts.id;
}

function printState(stepper: Stepper<State, Change>) {
    console.log(new Date(stepper.time));
    const board = stepper.state.board.map(i => '_XO'.charAt(i));
    const boardStr = [0, 1, 2].map(i => board.slice(i * 3, i * 3 + 3).join(' ')).join('\n');
    console.log(`${boardStr}\n`);
}

async function printGame(id: string) {
    const stepper: Stepper<State, Change> = await factory.load(id);
    printState(stepper);
    while (stepper.nextChangeOffset > 0) {
        await stepper.step();
        printState(stepper);
    }
}

Promise.all([
    playGame(1),
    playGame(2),
]).then(async (ids) => {
    for (let i = 0; i < ids.length; i++) {
        console.log(`Game ${i}:`);
        await printGame(ids[i]);
    }
    console.log('Final memory');
    console.log(JSON.stringify(storage.provider, null, 2));
});
