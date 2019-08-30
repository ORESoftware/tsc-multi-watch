
# tsc-multi-watch
Spawns a watch process for each tsconfig.json file in the search root.
The process is:

```bash
cd '${tsconfDir}' && tsc --project '${p}' --pretty false --preserveWatchOutput --watch
```

## Installation

>
>```bash
> $ npm install -g tsc-multi-watch`
>```
>

### CLI

>
>```bash
>
> $ tsc_multi_watch --root="$(pwd)"  # --root defaults to $PWD, so this is redundant
>
>```
>

### Programmatic API

```javascript
import tscmw from 'tsc-multi-watch';

tscmw(opts, (err, v) => {
  // v shows which paths are being watched
});

```


### Here is the regex currently beign used to find tsconfig.json files:

```javascript
  if (String(item).match(/^tsconfig.*\.json$/)) {
       tsConfigPaths.push(fullPath);
  }

```
   

