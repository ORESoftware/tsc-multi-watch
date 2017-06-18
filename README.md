# tsc-multiple-watch
Spawns a watch process for each tsconfig.json file in your project.


# CLI

`$ npm install -g tsc-multi-watch`
`$ cd <project-root> && tscmultiwatch`


# Programmtic API

```javascript
import tscmultiwatch from 'tsc-mult-watch';
const {default:tscmultiwatch} = require('tsc-multi-watch'); 

tscmultiwatch({options}, function(err){
  
});


```
