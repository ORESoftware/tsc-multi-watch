## tsc-multiple-watch
Spawns a watch process for each tsconfig.json file in your project.


### CLI

`$ npm install -g tsc-multi-watch`
<br>
`$ cd <project-root> && tscmultiwatch`


### Programmatic API

```javascript
import tscmultiwatch from 'tsc-multi-watch';
const {default:tscmultiwatch} = require('tsc-multi-watch'); 

tscmultiwatch({options}, function(err){
  
});

```

