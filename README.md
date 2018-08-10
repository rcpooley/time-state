# Time State
Store and fetch historical values of a state ([Flow](https://flow.org/) friendly!)

## Installation
```bash
$ npm install time-state
```

## Usage
First import time-state
```js
const TS = require('time-state');
```
Then create a [factory](https://github.com/rcpooley/time-state/blob/master/src/types.js#L37) (see [FactoryOptions](https://github.com/rcpooley/time-state/blob/master/src/types.js#L10))
```js
const factory = TS.factory({/* options */});
```

## Storage
Each factory requires a [StorageProvider](https://github.com/rcpooley/time-state/blob/master/src/storage/types.js#L19). time-state provides three options:

##### MongoDB
time-state will create a single TimeState collection
```js
const storage = await TS.Storage.mongo('mongodb://localhost:27017/testdb');
```

##### Memory
time-state will store everything in memory
```js
const storage = TS.Storage.memory();
// Save and load storage.provider.timeStates for persistence
```

##### Create your own
Feel free to implement [StorageProvider](https://github.com/rcpooley/time-state/blob/master/src/storage/types.js#L19).
See [storage/mongo.js](https://github.com/rcpooley/time-state/blob/master/src/storage/mongo.js)
and [storage/memory.js](https://github.com/rcpooley/time-state/blob/master/src/storage/memory.js).

## Examples
* See [examples/tictactoe.js](https://github.com/rcpooley/time-state/blob/master/src/examples/tictactoe.js) for basic factory usage.
* See [examples/trading.js](https://github.com/rcpooley/time-state/blob/master/src/examples/trading.js) for usage of the sequence stepper and sync stepper.
