'use strict';

import * as residence from 'residence';
import {Stats} from "fs";
import * as util from "util";
import * as cp from 'child_process';
import log from './logging';

const fs = require('fs');
const async = require('async');
const path = require('path');
import * as chokidar from 'chokidar';
import {ChildProcess} from "child_process";
import * as chalk from 'chalk';
import Timer = NodeJS.Timer;
import {OptionsToType} from "@oresoftware/cli";
import CliOptions from "./cli-options";

export type EVCb<T, E = any> = (err: E, val?: T) => void;

// here is a diff  pppojj

const ignored: Array<RegExp> = [
  /\/node_modules/,
  /\/.git/,
  /\/bower_components/
];

let isMatch = function (pth: string): boolean {
  return ignored.some(function (ign) {
    return !!String(pth).match(ign);
  });
};

interface IMultiWatchChildProcess extends ChildProcess {
  tsConfigPath: string;
  fnCalledWhenExitting: Function,
  tscMultiWatchTO?: Timer
}


const searchDir =  (dir: string, tsConfigPaths: Array<string>, cb: EVCb<Array<string>>) =>{
  
  if (isMatch(dir)) {
    // we ignore paths that match any of the regexes in the list
    log.warn('dir was ignored => ', dir);
    return process.nextTick(cb);
  }
  
  fs.readdir(dir,  (err: Error, items: Array<string>) => {
    
    if (err) {
      return cb(err);
    }
    
    async.eachLimit(items, 6,  (item: string, cb: EVCb<any>) => {
      
      const fullPath = path.resolve(dir, item);
      
      if (isMatch(dir)) {
        // we ignore paths that match any of the regexes in the list
        log.warn('dir was ignored => ', dir);
        return process.nextTick(cb);
      }
      
      fs.stat(fullPath, function (err: Error, stats: Stats) {
        
        if (err) {
          console.error(err);
          return cb(null);
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
          log.warn('the following item is neither a file nor directory (a symlink?) => ', fullPath);
        }
        
        cb(null);
        
      });
      
    }, (err: any) => {
      cb(err, tsConfigPaths)
    });
    
  });
  
};

let startCP = function (root: string, cps: Array<IMultiWatchChildProcess>) {
  
  return  (p: string, cb: EVCb<any>) => {
    
    const logFile = path.resolve(root + '/.tscmultiwatch/' + String(p)
      .slice(root.length).replace(/\//g, '#') + '.log');
    
    let callable = true;
    
    const first = function () {
      if (callable) {
        log.good(`tsc watch process now watching ${chalk.magenta(p)}`);
        clearTimeout(to);
        k.stderr.removeListener('data', onStdio);
        k.stdout.removeListener('data', onStdio);
        callable = false;
        cb.apply(null, arguments);
      }
    };
    
    const to = setTimeout(first, 4000);
    const dirname = path.dirname(p);
    
    const k = <IMultiWatchChildProcess>cp.spawn('bash', [], {
      detached: false
    });
    
    k.once('exit', function () {
      clearTimeout(k.tscMultiWatchTO);
      console.log('child process exitted.');
      k.fnCalledWhenExitting && k.fnCalledWhenExitting();
    });
    
    k.tsConfigPath = p;
    cps.push(k);
    
    const cmd = `cd '${dirname}' && tsc -w`;
    k.stdin.end(`${cmd}`);
    k.once('error', first);
    k.stderr.setEncoding('utf8');
    k.stdout.setEncoding('utf8');
    
    let count = 0;
    
    const onStdio = function () {
      if (count++ > 15) {
        first();
      }
    };
    
    const strm = fs.createWriteStream(logFile);
    k.stdout.pipe(strm);
    k.stderr.pipe(strm);
    k.stdout.on('data', onStdio);
    k.stderr.on('data', onStdio);
    
  }
};

const matchesTSFile = function (p: string): boolean {
  return String(p).match(/\.ts$/) && !String(p).match(/\.d\.ts$/);
};

export default (opts: OptionsToType<typeof CliOptions>, cb: EVCb<any>) => {
  
  const root = opts.root;
  
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
  
  log.good('created chokidar watcher.');
  
  watcher.once('ready', function (v: any) {
    
    log.veryGood('chokidar watcher is now ready.');
    
    watcher.on('add', function (p: string) {
      
      if (!ready) {
        if (matchesTSFile(p)) {
          log.warn(`The following file was added to your project => ${p}`);
          log.warn('But we are not ready to handle a link/add event just yet.');
        }
        return;
      }
      
      if (matchesTSFile(p)) {
        
        log.info('A typescript file was added at path =>', chalk.blue(p));
        
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
          
          log.good('We will re-start the appropriate watch process given this file change...');
          
          let rewatchPath = cpToKill.tsConfigPath;
          
          console.log('child process has exitted.');
          startCP(root, cps)(rewatchPath, function (err: Error) {
            
            if (err) {
              log.error(err.stack || err);
            }
            else {
              log.veryGood('A new watcher process was started at path =>', rewatchPath);
            }
          });
          
          cpToKill.kill('SIGINT');
          cpToKill.tscMultiWatchTO = setTimeout(() => {
            cpToKill.kill('SIGKILL');
          }, 5000);
          
        }
        else {
          log.warn('it appears that no current watch process was watching the directory that the file was added to.');
          log.warn('no new watch process will be spawned nor will any watch process be re-started.');
        }
      }
      
    });
  });
  
  const $tsconfigPaths: Array<string> = [];
  
  searchDir(root, $tsconfigPaths, (err: Error, tsconfigPaths: Array<string>) => {
    
    if (err) {
      throw err;
    }
    
    if (tsconfigPaths.length < 1) {
      log.error('No tsconfig.json files could be found in your project.');
      return process.exit(1);
    }
    else {
      log.good(`tsc-multi-watch will attempt to start ${tsconfigPaths.length} watching processes.`);
    }
    
    async.eachLimit(tsconfigPaths, 3, startCP(root, cps), function (err: Error) {
      
      if (err) {
        throw err;
      }
      
      ready = true;
      
      log.veryGood('tsc-multi-watch is running watchers against the following tsconfig.json files:');
      
      tsconfigPaths.forEach(function (p, index) {
        log.good('[' + (index + 1) + ']', p);
      });
      
      cb && cb(null, tsconfigPaths);
      
    });
    
  });
  
};




