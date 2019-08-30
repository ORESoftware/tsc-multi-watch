'use strict';

import runTMW from './main';
import parser from './cli-parser';

const v = parser.parse(process.argv);

if (v.opts.help) {
  console.log();
  console.log(parser.getHelpString());
  console.log();
  process.exit(0);
}

runTMW(v.opts, (err, results) => {
  
  if (err) {
    console.error(err);
    process.exit(1);
  }
  
  console.log('Watching the following configs:');
  console.log({results});
  console.log();
  
});
