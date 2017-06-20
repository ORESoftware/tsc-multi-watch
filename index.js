'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var residence = require("residence");
var cp = require("child_process");
var root = residence.findProjectRoot(process.cwd());
var fs = require('fs');
var async = require('async');
var path = require('path');
var chokidar = require("chokidar");
var chalk = require("chalk");
if (!root) {
    throw new Error('=> Could not find an NPM project root given your current working directory.');
}
var log = console.log.bind(console, ' => [tsc-multi-watch] =>');
var logGood = console.log.bind(console, chalk.cyan(' => [tsc-multi-watch] =>'));
var logVeryGood = console.log.bind(console, chalk.green(' => [tsc-multi-watch] =>'));
var logWarning = console.log.bind(console, chalk.yellow.bold(' => [tsc-multi-watch] =>'));
var logError = console.log.bind(console, chalk.red(' => [tsc-multi-watch] =>'));
var ignored = [
    /\/node_modules/,
    /\/.git/,
    /\/bower_components/
];
var isMatch = function (pth) {
    return ignored.some(function (ign) {
        return String(pth).match(ign);
    });
};
var logsDir = path.resolve(root + '/.tscmultiwatch');
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
var searchDir = function (dir, cb) {
    var tsconfigPaths = [];
    if (isMatch(dir)) {
        logWarning('dir was ignored => ', dir);
        return process.nextTick(cb);
    }
    fs.readdir(dir, function (err, items) {
        if (err) {
            return cb(err);
        }
        async.eachLimit(items, 6, function (item, cb) {
            var fullPath = path.resolve(dir, item);
            if (isMatch(dir)) {
                logWarning('dir was ignored => ', dir);
                return process.nextTick(cb);
            }
            fs.stat(fullPath, function (err, stats) {
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
        }, function (err) {
            cb(err, tsconfigPaths);
        });
    });
};
var startCP = function (cps) {
    return function (p, cb) {
        var logFile = path.resolve(root + '/.tscmultiwatch/' + String(p)
            .slice(root.length).replace(/\//g, '#') + '.log');
        var callable = true;
        var first = function () {
            if (callable) {
                clearTimeout(to);
                k.stderr.removeListener('data', onStdio);
                k.stdout.removeListener('data', onStdio);
                callable = false;
                cb.apply(this, arguments);
            }
        };
        var to = setTimeout(first, 6000);
        var dirname = path.dirname(p);
        var k = cp.spawn('bash', [], {
            detached: false,
            cwd: dirname
        });
        k.tsConfigPath = p;
        cps.push(k);
        var cmd = 'tsc -w';
        k.stdin.write("\n" + cmd + "\n");
        k.stdin.end();
        k.once('error', first);
        k.stderr.setEncoding('utf8');
        k.stdout.setEncoding('utf8');
        var count = 0;
        var onStdio = function () {
            if (count++ > 15) {
                first();
            }
        };
        var strm = fs.createWriteStream(logFile);
        k.stdout.pipe(strm);
        k.stderr.pipe(strm);
        k.stdout.on('data', onStdio);
        k.stderr.on('data', onStdio);
    };
};
function default_1(opts, cb) {
    var cps = [];
    var watcher = chokidar.watch(root, {
        ignoreInitial: true,
        ignored: /(\/node_modules\/|\/.git\/)/
    });
    process.once('exit', function () {
        watcher.close();
    });
    var ready = false;
    logGood('initialized chokidar watcher.');
    watcher.once('ready', function (v) {
        logVeryGood('chokidar watcher is now ready.');
        watcher.on('add', function (p) {
            if (!ready) {
                logWarning("The following file was added to your project => " + p);
                logWarning('But we are not ready to handle a link/add event just yet.');
                return;
            }
            if (String(p).match(/\.ts$/) && !String(p).match(/\.d\.ts$/)) {
                log('A typescript file was added at path =>', chalk.blue(p));
                var cpToKill = void 0, matchAmount = 0;
                for (var i = 0; i < cps.length; i++) {
                    var cp_1 = cps[i], tsConfigPath = cp_1.tsConfigPath, dir = path.dirname(tsConfigPath), ln = dir.length;
                    if (String(p).match(dir) && ln > matchAmount) {
                        cpToKill = cp_1;
                        matchAmount = dir.length;
                    }
                }
                if (cpToKill) {
                    logGood('We will re-start the appropriate watch process given this file change...');
                    var rewatchPath_1 = cpToKill.tsConfigPath;
                    cpToKill.kill('SIGINT');
                    startCP(cps)(rewatchPath_1, function (err) {
                        if (err) {
                            logError(err.stack || err);
                        }
                        else {
                            logVeryGood('A new watcher process was started at path =>', rewatchPath_1);
                        }
                    });
                }
                else {
                    logWarning('it appears that no current watch process was watching the directory that the file was added to.');
                    logWarning('no new watch process will be spawned nor will any watch process be re-started.');
                }
            }
        });
    });
    searchDir(root, function (err, tsconfigPaths) {
        if (err) {
            throw err;
        }
        if (tsconfigPaths.length < 1) {
            logError('No tsconfig.json files could be found in your project.');
            return process.exit(1);
        }
        else {
            logGood("tsc-multi-watch will attempt to start " + tsconfigPaths.length + " watching processes.");
        }
        async.eachLimit(tsconfigPaths, 3, startCP(cps), function (err) {
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
}
exports.default = default_1;
;
