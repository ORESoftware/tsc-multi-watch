'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var residence = require("residence");
var util = require("util");
var cp = require("child_process");
var root = residence.findProjectRoot(process.cwd());
var fs = require('fs');
var async = require('async');
var path = require('path');
if (!root) {
    throw new Error('=> Could not find an NPM project root given your current working directory.');
}
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
var logsDir = path.resolve(root + '/.tscmwlogs');
try {
    fs.mkdirSync(logsDir);
}
catch (err) {
}
var tsconfigPaths = [];
var searchDir = function (dir, cb) {
    if (isMatch(dir)) {
        console.log('dir was ignored => ', dir);
        return process.nextTick(cb);
    }
    fs.readdir(dir, function (err, items) {
        if (err) {
            return cb(err);
        }
        async.eachLimit(items, 6, function (item, cb) {
            var fullPath = path.resolve(dir, item);
            if (isMatch(dir)) {
                console.log('dir was ignored => ', dir);
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
        }, cb);
    });
};
function default_1(opts, cb) {
    searchDir(root, function (err) {
        if (err) {
            throw err;
        }
        if (tsconfigPaths.length < 1) {
            console.error('No tsconfig.json files could be found in your project.');
            return process.exit(1);
        }
        else {
            console.log(" => tsc-multi-watch will start " + tsconfigPaths.length + " watching processes.");
        }
        async.eachLimit(tsconfigPaths, 3, function (p, cb) {
            var logFile = path.resolve(root + '/.tscmwlogs/' + String(p)
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
            var to = setTimeout(first, 8000);
            var dirname = path.dirname(p);
            console.log('dirname used => ', dirname);
            var k = cp.spawn('bash', [], {
                detached: false,
                cwd: dirname
            });
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
        }, function (err) {
            if (err) {
                throw err;
            }
            console.log(' => tsc-multi-watch is running watchers against the following paths:');
            console.log(util.inspect(tsconfigPaths));
            cb && cb();
        });
    });
}
exports.default = default_1;
;
