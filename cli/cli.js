#!/usr/bin/env node
'use strict';

const path = require('path');
const cp = require('child_process');

if (process.env.oresoftware_dev === 'yes') {
  const projectRoot = path.dirname(__dirname);
  const {run} = require('./run-tsc-if');
  const toExec = run(projectRoot);
  console.log(cp.execSync(toExec, {encoding: 'utf8'}));
}


require('../dist/cli');
