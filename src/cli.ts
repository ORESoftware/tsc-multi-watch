'use strict';

import runTMW from './main';
import parser from './cli-parser';
const v = parser.parse(process.argv);

if (v.opts.help || Object.keys(v.opts).length < 1) {
  console.log(parser.getHelpString());
  process.exit(0);
}


runTMW(v.opts, (err, results) => {
  console.log({err,results});
});
