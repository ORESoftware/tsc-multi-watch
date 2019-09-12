'use strict';

import * as residence from 'residence';
import {Stats} from "fs";
import * as util from "util";
import * as cp from 'child_process';
import log from './logging';
import fs = require('fs');
import async = require('async');
import path = require('path');
import * as chokidar from 'chokidar';
import {ChildProcess} from "child_process";
import chalk from 'chalk';
import Timer = NodeJS.Timer;
import {OptionsToType} from "@oresoftware/cli";
import CliOptions from "./cli-options";
import pt from "prepend-transform";
import {CliOpts} from "./cli-options";

export type EVCb<T, E = any> = (err: E, val?: T) => void;

const ignored: Array<RegExp> = [
  /\/node_modules/,
  /\/.git/,
  /\/bower_components/,
  /\/test\//,
  /\/sumanjs\//
];

const replaceSlashColor = (p: string, color?: string): string => {
  color = color || 'magenta';
  return String(p).replace(/\//g, (chalk as any)[color].bold('/'));
};

let isMatch = function (pth: string): boolean {
  return ignored.some(function (ign) {
    return !!String(pth).match(ign);
  });
};

interface IMultiWatchChildProcess extends ChildProcess {
  tsConfigPath: string;
  tsConfig: any,
  fnCalledWhenExitting: Function,
  tscMultiWatchTO?: Timer
}

const runSearch = (dir: string, cb: EVCb<Array<string>>) => {
  
  const tsConfigPaths: Array<string> = [];
  
  const searchDir = (dir: string, cb: EVCb<any>) => {
    
    if (isMatch(dir)) {
      // we ignore paths that match any of the regexes in the list
      log.warn('dir was ignored:', dir);
      return process.nextTick(cb);
    }
    
    if (isMatch(dir + '/')) {
      // we ignore paths that match any of the regexes in the list
      log.warn('dir was ignored:', dir);
      return process.nextTick(cb);
    }
    
    fs.readdir(dir, (err: Error, items: Array<string>) => {
      
      if (err) {
        return cb(err);
      }
      
      async.eachLimit(items, 6, (item: string, cb: EVCb<any>) => {
        
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
            return searchDir(fullPath, cb);
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
        
      }, cb);
      
    });
    
  };
  
  searchDir(dir, (err: any) => {
    cb(err, tsConfigPaths)
  });
  
};

const startCP = (root: string, cps: Set<IMultiWatchChildProcess>) => {
  return (p: string, cb: EVCb<any>) => {
    
    const logFile = path.resolve(root + '/.tscmultiwatch/logs/' + String(p)
    .slice(root.length).replace(/\//g, '•') + '.log');
    
    let tsConfig = null;
    try {
      tsConfig = require(p);
    }
    catch (err) {
      log.error(err);
      log.error('Could not load JSON for tsconfig.json file located here:', p);
      return process.nextTick(cb);
    }
    
    let callable = true;
    
    const first = (...args: any[]) => {
      if (callable) {
        callable = false;
        log.good(`tsc watch process now watching ${chalk.blueBright(replaceSlashColor(p, 'blue'))}`);
        clearTimeout(to);
        k.stderr.removeListener('data', onStdio);
        k.stdout.removeListener('data', onStdio);
        cb.apply(null, ...args);
      }
    };
    
    const to = setTimeout(first, 4000);
    const tsconfDir = path.dirname(p);
    
    const k = <IMultiWatchChildProcess>cp.spawn('bash', [], {
      detached: false
    });
    
    k.once('exit', code => {
      clearTimeout(k.tscMultiWatchTO);
      log.error('child process exitted.');
      k.fnCalledWhenExitting && k.fnCalledWhenExitting();
    });
    
    k.tsConfig = tsConfig;
    k.tsConfigPath = p;
    
    const bn = path.basename(p);
    cps.add(k);
    
    const cmd = ` cd '${tsconfDir}' && tsc --project '${bn}' --pretty false --preserveWatchOutput --watch `;
    k.stdin.end(`${cmd}`);
    k.once('error', first);
    k.stderr.setEncoding('utf8');
    k.stdout.setEncoding('utf8');
    
    k.stdout.pipe(pt(chalk.blueBright(replaceSlashColor(p + ': ', 'gray')))).pipe(process.stdout);
    k.stderr.pipe(pt(chalk.magenta(replaceSlashColor(p + ': ', 'gray')))).pipe(process.stderr);
    
    k.once('exit', code => {
      if (code > 0) {
        first(new Error('Could not run this command: ' + cmd));
      }
    });
    
    const con = {
      stdout: '',
      count: 0
    };
    
    const onStdio = (d: string) => {
      
      con.stdout += String(d || '').trim();
      
      if (/Found 0 errors/ig.test(con.stdout)) {
        first();
        return;
      }
      
      if (/Watching for file changes/ig.test(con.stdout)) {
        first();
        return;
      }
      
      if (con.count++ > 15) {
        first();
      }
      
    };
    
    const strm = fs.createWriteStream(logFile, {encoding: 'utf8'});
    strm.write('In the beginning: ');
    strm.write(new Date().toUTCString());
    strm.write('\n');
    k.stdout.pipe(strm);
    k.stderr.pipe(strm);
    k.stdout.on('data', onStdio);
    k.stderr.on('data', onStdio);
    
  }
};

const matchesTSFile = (p: string): boolean => {
  return String(p).match(/\.ts$/) && !String(p).match(/\.d\.ts$/);
};

export default (opts: CliOpts, cb: EVCb<any>) => {
  
  const root = opts.root;
  const logsDir = path.resolve(root + '/.tscmultiwatch');
  
  if (opts.ignore && opts.ignore.length) {
    for (const i of opts.ignore) {
      ignored.push(new RegExp('i', 'ig'));
    }
  }
  
  try {
    fs.mkdirSync(logsDir);
  }
  catch (err) {
    // ignore
  }
  
  try {
    fs.mkdirSync(path.resolve(logsDir + '/logs'));
  }
  catch (err) {
    // ignore
  }
  
  const cps = new Set<IMultiWatchChildProcess>();
  const startCps = startCP(root, cps);
  
  const watcher = chokidar.watch(root, {
    ignoreInitial: true,
    ignored: /(\/node_modules\/|\/.git\/)/
  });
  
  process.once('exit', function () {
    // cleanup carefully
    watcher.close();
  });
  
  let ready = false;
  const changedFiles = new Set<string>();
  log.good('created chokidar watcher.');
  
  const runAdd = () => {
    
    const cfarray = Array.from(changedFiles);
    changedFiles.clear();
    
    const cpset = new Set<IMultiWatchChildProcess>();
    
    for (const cp of cps) {
      
      const dir = path.dirname(cp.tsConfigPath);
      
      for (const cf of cfarray) {
        if (String(cf).startsWith(dir)) {
          cpset.add(cp);
          break;
        }
      }
      
    }
    
    if (cpset.size < 1) {
      log.warn('it appears that no current watch process was watching the directory that the file was added to.');
      log.warn('no new watch process will be spawned nor will any watch process be re-started.');
      return;
    }
    
    log.good('We will re-start the appropriate watch process given these file changes...');
    
    for (const cpToKill of cpset) {
      
      cps.delete(cpToKill);
      
      cpToKill.removeAllListeners('exit');
      cpToKill.once('exit', code => {
        log.info('child process exitted with code:', code);
        cpToKill.fnCalledWhenExitting && cpToKill.fnCalledWhenExitting();
      });
      
      const rewatchPath = cpToKill.tsConfigPath;
      
      startCps(rewatchPath, (err) => {
        
        if (err) {
          log.error(err);
          return;
        }
        
        log.veryGood('A new watcher process was started at path =>', rewatchPath);
      });
      
      cpToKill.kill('SIGINT');
      cpToKill.tscMultiWatchTO = setTimeout(() => {
        cpToKill.kill('SIGKILL');
      }, 2000);
      
    }
    
  };
  
  let to: Timer = null;
  
  watcher.once('ready', () => {
    
    log.veryGood('chokidar watcher is now ready.');
    
    watcher.on('change', (p, stats) => {
      // if the file is tsconfig.json, then we restart process also
    });
    
    watcher.on('add', (p, stats) => {
      
      if (!ready) {
        if (matchesTSFile(p)) {
          log.warn(`The following file was added to your project => ${p}`);
          log.warn('But we are not ready to handle a link/add event just yet.');
        }
        return;
      }
      
      if (matchesTSFile(p)) {
        log.info('A typescript file was added at path =>', chalk.blueBright(replaceSlashColor(p, 'blue')));
        changedFiles.add(p);
        clearTimeout(to);
        to = setTimeout(runAdd, 500);
      }
      
    });
    
  });
  
  runSearch(root, (err: Error, tsconfigPaths: Array<string>) => {
    
    if (err) {
      throw err;
    }
    
    if (tsconfigPaths.length < 1) {
      log.error('No tsconfig.json files could be found within your project root:', root);
      return process.exit(1);
    }
    
    log.good(`tsc-multi-watch will attempt to start ${tsconfigPaths.length} watching processes.`);
    
    async.eachLimit(tsconfigPaths, 3, startCps, err => {
      
      if (err) {
        throw err;
      }
      
      ready = true;
      cb && cb(null, tsconfigPaths);
      
    });
    
  });
  
};




