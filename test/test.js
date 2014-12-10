'use strict';

// mocha defines to avoid JSHint breakage
/* global describe, it, before, beforeEach, after, afterEach */


// It's okay to clobber the global Promise for testing
global.Promise = require('bluebird');

var RouteSwitch = require('../routeswitch');
var deepEqual = require('assert').deepEqual;

function eq(actual, expected) {
    try {
        deepEqual(actual, expected);
    } catch (e) {
        throw new Error('Expected:\n' + JSON.stringify(expected, null, 4)
                + '\nActual:\n' + JSON.stringify(actual, null, 4));
    }
}

var r = new RouteSwitch([
        {pattern: '/{foo}/{bar}/html', methods: 'looks like html'},
        {pattern: '/{foo}/{bar}/json', methods: 'looks like json'},
        {pattern: '/{foo}/baz/{+path}', methods: 'looks like some arbitrary path'},
        {pattern: '', methods: 'the empty path'},
        {pattern: '/{foo}', methods: 'resource'},
        {pattern: '/{foo}/{bar}/json', methods: 'looks like json'},
        {pattern: '/{foo}/', methods: 'listing'},
        {pattern: '/{foo}//', methods: 'doubleslash'},
        {pattern: '/{foo}/{bar}/', methods: 'twoparts'}
]);

var testData = {
    '/some/thing/html': {
        "pattern": {
            "length": 2
        },
        "methods": "looks like html",
        "params": {
            "0": "/some/thing/html",
            "1": "some",
            "2": "thing",
            "foo": "some",
            "bar": "thing"
        },
        "sortKey": "/{}/{}/html",
        "path": '/{foo}/{bar}/html'
    },
    '/some/thing/json': {
        "pattern": {
            "length": 2
        },
        "methods": "looks like json",
        "params": {
            "0": "/some/thing/json",
            "1": "some",
            "2": "thing",
            "foo": "some",
            "bar": "thing"
        },
        "sortKey": "/{}/{}/json",
        'path': '/{foo}/{bar}/json'
    },
    '/some/baz/some/long/path': {
        "pattern": {
            "length": 2
        },
        "methods": "looks like some arbitrary path",
        "params": {
            "0": "/some/baz/some/long/path",
            "1": "some",
            "2": "some/long/path",
            "foo": "some",
            "path": "some/long/path"
        },
        "sortKey": "/{}/baz/{+}",
        'path': '/{foo}/baz/{+path}'
    },
    '': {
        "pattern": {
            "length": 0
        },
        "methods": "the empty path",
        "params": {
            "0": ""
        },
        "sortKey": "",
        'path': ''
    },
    '/foo': {
        "pattern": {
            "length": 1
        },
        "methods": "resource",
        "params": {
            "0": "/foo",
            "1": "foo",
            "foo": "foo"
        },
        "sortKey": "/{}",
        "path": '/{foo}'
    },
    '/foo/': {
        "pattern": {
            "length": 1
        },
        "methods": "listing",
        "params": {
            "0": "/foo/",
            "1": "foo",
            "foo": "foo"
        },
        "sortKey": "/{}/",
        "path": '/{foo}/'
    },
    '/foo//': {
        "pattern": {
            "length": 1
        },
        "methods": "doubleslash",
        "params": {
            "0": "/foo//",
            "1": "foo",
            "foo": "foo"
        },
        "sortKey": "/{}//",
        "path": '/{foo}//'
    },
    '/foo//bar': null
};

function validator(routeswitch) {
    return function (method, path, req, expectedRes, done) {
        return routeswitch.then(function(xs) {
            var route = xs.match(path);
            var handler = route.methods[method].request_handler(null, null);
            return handler.then(function(res) {
                eq(res, expectedRes);
                done();
            }).catch(function(e) {
                 done(e);
            });
        }).catch(function(e) {
            done(e);
        });
    };
}

describe('Routeswitch', function() {

    Object.keys(testData).forEach(function(path) {
        it('match: ' + JSON.stringify(path), function() {
            eq(r.match(path), testData[path]);
        });
    });

    it('load plain handlers from disk', function(done) {

        var handlerDirs = [__dirname + '/handlers/plain'];
        var routeswitch = RouteSwitch.fromDirectories(handlerDirs, console.log);
        var request     = validator(routeswitch);

        request('get', '/v1/hello', null, { status: 200, body: 'Hello, world!' }, done);

    });

    it('load configurable handlers from disk', function(done) {

        var loader = function (path) {
            var config = {
                fortune: function () { return 'Wax on, wax off.'; }
            };
            var constructor = require(path);
            return constructor(config);
        };

        var handlerDirs = [__dirname + '/handlers/configurable'];
        var routeswitch = RouteSwitch.fromDirectories(handlerDirs, { loader: loader });
        var request     = validator(routeswitch);

        request('get', '/v1/fortune', null, { status: 200, body: 'Wax on, wax off.' }, done);

    });

});
