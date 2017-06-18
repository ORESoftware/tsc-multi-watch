'use strict';

import * as residence from 'residence';
import {Stats} from "fs";
import * as util from "util";
const root = residence.findProjectRoot(process.cwd());
const fs = require('fs');
const async = require('async');
const path = require('path');

if (!root) {
  throw new Error('=> Could not find an NPM project root given your current working directory.');
}

const ignored : Array<RegExp> = [
  /\/node_modules\//,
  /\/.git\//,
  /\/bower_components\//
];

let isMatch = function(pth: string): boolean{
  return ignored.some(function(ign){
     return String(pth).match(ign);
  });
};

const tsconfigPaths: Array<string> = [];


let searchDir = function (dir: string, cb: Function) {

  if(isMatch(dir)){
    // we ignore paths that match any of the regexes in the list
    return process.nextTick(cb);
  }

  fs.readdir(dir, function (err: Error, items: Array<string>) {

    if (err) {
      return cb(err);
    }

    async.eachLimit(items, 6, function (item: string, cb: Function) {

      const fullPath = path.resolve(dir, item);

      fs.stat(fullPath, function (err: Error, stats: Stats) {

        if (err) {
          return cb(err);
        }

        if (stats.isDirectory()) {
          return searchDir(fullPath, cb);
        }

        if (stats.isFile()) {
          if (String(item).match(/^tsconfig\.json$/)) {
            tsconfigPaths.push(fullPath);
          }
        }


      });


    });


  });


};


searchDir(root, function (err: Error) {

  if (err) {
    throw err;
  }

  async.eachLimit(tsconfigPaths, 3, function(p: string, cb: Function){


  }, function(err){

    if(err){
      throw err;
    }

    console.log(' => tsc-multi-watch is running watchers against the following paths:');
    console.log(util.inspect(tsconfigPaths));
  });


});


