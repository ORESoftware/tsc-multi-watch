'use strict';

const tscif = require('run-tsc-if');

exports.run = (projectRoot) => {
  
  return tscif.run({
    projectRoot
  });
  
};


