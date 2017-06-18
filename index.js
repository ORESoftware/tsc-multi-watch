'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var residence = require("residence");
var util = require("util");
var root = residence.findProjectRoot(process.cwd());
var fs = require('fs');
var async = require('async');
var path = require('path');
if (!root) {
    throw new Error('=> Could not find an NPM project root given your current working directory.');
}
var ignored = [
    /\/node_modules\//,
    /\/.git\//,
    /\/bower_components\//
];
var isMatch = function (pth) {
    return ignored.some(function (ign) {
        return String(pth).match(ign);
    });
};
var tsconfigPaths = [];
var searchDir = function (dir, cb) {
    if (isMatch(dir)) {
        return process.nextTick(cb);
    }
    fs.readdir(dir, function (err, items) {
        if (err) {
            return cb(err);
        }
        async.eachLimit(items, 6, function (item, cb) {
            var fullPath = path.resolve(dir, item);
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
            });
        });
    });
};
searchDir(root, function (err) {
    if (err) {
        throw err;
    }
    async.eachLimit(tsconfigPaths, 3, function (p, cb) {
    }, function (err) {
        if (err) {
            throw err;
        }
        console.log(' => tsc-multi-watch is running watchers against the following paths:');
        console.log(util.inspect(tsconfigPaths));
    });
});
