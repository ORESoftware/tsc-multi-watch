#!/usr/bin/env node
'use strict';

import * as residence from 'residence';
import {Stats} from "fs";
import * as util from "util";
import * as cp from 'child_process';
const root = residence.findProjectRoot(process.cwd());
const fs = require('fs');
const async = require('async');
const path = require('path');

if (!root) {
  throw new Error('=> Could not find an NPM project root given your current working directory.');
}

const ignored: Array<RegExp> = [
  /\/node_modules/,
  /\/.git/,
  /\/bower_components/
];

let isMatch = function (pth: string): boolean {
  return ignored.some(function (ign) {
    return String(pth).match(ign);
  });
};


const logsDir = path.resolve(root + '/.tscmwlogs');

try {
  fs.mkdirSync(logsDir);
}
catch (err) {


}


const tsconfigPaths: Array<string> = [];


let searchDir = function (dir: string, cb: Function) {

  if (isMatch(dir)) {
    // we ignore paths that match any of the regexes in the list
    console.log('dir was ignored => ', dir);
    return process.nextTick(cb);
  }

  fs.readdir(dir, function (err: Error, items: Array<string>) {

    if (err) {
      return cb(err);
    }

    async.eachLimit(items, 6, function (item: string, cb: Function) {

      const fullPath = path.resolve(dir, item);

      if (isMatch(dir)) {
        // we ignore paths that match any of the regexes in the list
        console.log('dir was ignored => ', dir);
        return process.nextTick(cb);
      }

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

        cb(null);


      });


    }, cb);


  });


};

exports.default = function(){

  searchDir(root, function (err: Error) {

    if (err) {
      throw err;
    }

    if (tsconfigPaths.length < 1) {
      console.error('No tsconfig.json files could be found in your project.');
      return process.exit(1);
    }
    else {
      console.log(` => tsc-multi-watch will start ${tsconfigPaths.length} watching processes.`);
    }

    async.eachLimit(tsconfigPaths, 3, function (p: string, cb: Function) {


      let logFile = path.resolve(root + '/.tscmwlogs/' + String(p)
        .slice(root.length).replace(/\//g, '#') + '.log');

      let callable = true;

      let first = function () {
        if (callable) {
          clearTimeout(to);
          k.stderr.removeListener('data', onStdio);
          k.stdout.removeListener('data', onStdio);
          callable = false;
          cb.apply(this, arguments);
        }
      };

      let to = setTimeout(first, 8000);

      let k = cp.spawn('bash', [], {
        detached: false,
        cwd: path.dirname(p)
      });

      let cmd = 'tsc -w';
      k.stdin.write(`\n${cmd}\n`);
      k.once('error', first);
      k.stderr.setEncoding('utf8');
      k.stdout.setEncoding('utf8');


      let count = 0;

      let onStdio = function () {
        if (count++ > 15) {
          first();
        }
      };

      let strm = fs.createWriteStream(logFile);

      k.stdout.pipe(strm);
      k.stderr.pipe(strm);
      k.stdout.on('data', onStdio);
      k.stderr.on('data', onStdio);

    }, function (err: Error) {

      if (err) {
        throw err;
      }

      console.log(' => tsc-multi-watch is running watchers against the following paths:');
      console.log(util.inspect(tsconfigPaths));

    });


  });

};




