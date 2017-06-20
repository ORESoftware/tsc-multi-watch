# tsc-multi-watch
Spawns a watch process for each tsconfig.json file in your project.

## Caveats / Pitfalls
Make sure the tsconfig.json file in the root of your project ignores the directories that contain your
other tsconfig.json files, otherwise you may get strange behavior, duplicate transpilation, etc.

You may not have a tsconfig.json file in the root of your project - but the above applies for any tsconfig.json file
which might "shadow" another file.


## Installation

### `$ npm install -g -D tsc-multi-watch`

### CLI

`$ cd <project-root> && tscmultiwatch`

### Programmatic API

```javascript
import tscmultiwatch from 'tsc-multi-watch';
const {default:tscmultiwatch} = require('tsc-multi-watch'); 

tscmultiwatch({options}, function(err){
  
});

```

## You can use tsconfig.json files that match this pattern

```
tsconfig-test.json
tsconfigFOO.json
tsconfig.bar.json
//etc
```

### Here is the regex currently beign used

```javascript
  if (String(item).match(/^tsconfig.*\.json$/)) {
       tsConfigPaths.push(fullPath);
  }

```
   

