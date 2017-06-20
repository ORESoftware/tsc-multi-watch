'use strict';

import * as residence from 'residence';
import {Stats} from "fs";
import * as util from "util";
import * as cp from 'child_process';
const root = residence.findProjectRoot(process.cwd());
const fs = require('fs');
const async = require('async');
const path = require('path');
import * as chokidar from 'chokidar';
import {ChildProcess} from "child_process";
import * as chalk from 'chalk';
import Timer = NodeJS.Timer;

if (!root) {
  throw new Error('=> Could not find an NPM project root given your current working directory.');
}

const log = console.log.bind(console, ' => [tsc-multi-watch] =>');
const logGood = console.log.bind(console, chalk.cyan(' => [tsc-multi-watch] =>'));
const logVeryGood = console.log.bind(console, chalk.green(' => [tsc-multi-watch] =>'));
const logWarning = console.log.bind(console, chalk.yellow.bold(' => [tsc-multi-watch] =>'));
const logError = console.log.bind(console, chalk.red(' => [tsc-multi-watch] =>'));

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

interface IMultiWatchChildProcess extends ChildProcess {
  tsConfigPath: string;
  fnCalledWhenExitting: Function,
  tscMultiWatchTO?: Timer
}

const logsDir = path.resolve(root + '/.tscmultiwatch');

try {
  fs.mkdirSync(logsDir);
}
catch (err) {

}

try {
  fs.mkdirSync(path.resolve(logsDir + '/logs'));
}
catch (err) {

}

let searchDir = function (dir: string, tsConfigPaths: Array<string>, cb: Function) {

  if (isMatch(dir)) {
    // we ignore paths that match any of the regexes in the list
    logWarning('dir was ignored => ', dir);
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
        logWarning('dir was ignored => ', dir);
        return process.nextTick(cb);
      }

      fs.stat(fullPath, function (err: Error, stats: Stats) {

        if (err) {
          return cb(err);
        }

        if (stats.isDirectory()) {
          return searchDir(fullPath, tsConfigPaths, cb);
        }

        if (stats.isFile()) {
          if (String(item).match(/^tsconfig.*\.json$/)) {
            tsConfigPaths.push(fullPath);
          }
        }
        else {
          logWarning('the following item is neither a file nor directory (a symlink?) => ', fullPath);
        }

        cb(null);

      });

    }, function (err: Error) {

      cb(err, tsConfigPaths)

    });

  });

};

let startCP = function (cps: Array<IMultiWatchChildProcess>) {

  return function (p: string, cb: Function) {

    let logFile = path.resolve(root + '/.tscmultiwatch/' + String(p)
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

    let to = setTimeout(first, 6000);
    let dirname = path.dirname(p);

    let k = <IMultiWatchChildProcess> cp.spawn('bash', [], {
      detached: false,
      cwd: dirname
    });

    k.once('exit', function () {
      clearTimeout(k.tscMultiWatchTO);
      console.log('child process exitted.');
      k.fnCalledWhenExitting && k.fnCalledWhenExitting();
    });

    k.tsConfigPath = p;
    cps.push(k);

    let cmd = 'tsc -w';
    k.stdin.write(`\n${cmd}\n`);
    k.stdin.end();
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

  }
};

export default function (opts: Object | null, cb?: Function) {

  const cps: Array<IMultiWatchChildProcess> = [];

  const watcher = chokidar.watch(root, {
    ignoreInitial: true,
    ignored: /(\/node_modules\/|\/.git\/)/
  });

  process.once('exit', function () {
    // cleanup carefully
    watcher.close();
  });

  let ready = false;

  logGood('initialized chokidar watcher.');

  watcher.once('ready', function (v: any) {

    logVeryGood('chokidar watcher is now ready.');

    watcher.on('add', function (p: string) {

      if (!ready) {
        logWarning(`The following file was added to your project => ${p}`);
        logWarning('But we are not ready to handle a link/add event just yet.');
        return;
      }

      if (String(p).match(/\.ts$/) && !String(p).match(/\.d\.ts$/)) {

        log('A typescript file was added at path =>', chalk.blue(p));

        let cpToKill: IMultiWatchChildProcess, matchAmount = 0;

        for (let i = 0; i < cps.length; i++) {

          let cp = cps[i], tsConfigPath = cp.tsConfigPath,
            dir = path.dirname(tsConfigPath),
            ln = dir.length;

          if (String(p).match(dir) && ln > matchAmount) {
            cpToKill = cp;
            matchAmount = ln;
          }
        }

        if (cpToKill) {

          // remove cp from array
          let index = cps.indexOf(cpToKill);
          cps.splice(index, 1);

          logGood('We will re-start the appropriate watch process given this file change...');

          let rewatchPath = cpToKill.tsConfigPath;

          console.log('child process has exitted.');
          startCP(cps)(rewatchPath, function (err: Error) {

            if (err) {
              logError(err.stack || err);
            }
            else {
              logVeryGood('A new watcher process was started at path =>', rewatchPath);
            }
          });

          cpToKill.once('exit', function () {
            console.log('exit 2');
          });

          cpToKill.kill('SIGINT');
          cpToKill.tscMultiWatchTO = setTimeout(() => {
            cpToKill.kill('SIGKILL');
          }, 5000);

        }
        else {
          logWarning('it appears that no current watch process was watching the directory that the file was added to.');
          logWarning('no new watch process will be spawned nor will any watch process be re-started.');
        }

      }

    });
  });

  const $tsconfigPaths: Array<string> = [];

  searchDir(root, $tsconfigPaths, function (err: Error, tsconfigPaths: Array<string>) {

    if (err) {
      throw err;
    }

    if (tsconfigPaths.length < 1) {
      logError('No tsconfig.json files could be found in your project.');
      return process.exit(1);
    }
    else {
      logGood(`tsc-multi-watch will attempt to start ${tsconfigPaths.length} watching processes.`);
    }

    async.eachLimit(tsconfigPaths, 3, startCP(cps), function (err: Error) {

      if (err) {
        throw err;
      }

      ready = true;

      logVeryGood('tsc-multi-watch is running watchers against the following tsconfig.json files:');
      tsconfigPaths.forEach(function (p, index) {
        logGood('[' + (index + 1) + ']', p);
      });

      cb && cb();

    });

  });

};




