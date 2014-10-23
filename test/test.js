'use strict';
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
        "sortKey": "/{}/{}/html"
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
        "sortKey": "/{}/{}/json"
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
        "sortKey": "/{}/baz/{+}"
    },
    '': {
        "pattern": {
            "length": 0
        },
        "methods": "the empty path",
        "params": {
            "0": ""
        },
        "sortKey": ""
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
        "sortKey": "/{}"
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
        "sortKey": "/{}/"
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
        "sortKey": "/{}//"
    },
    '/foo//bar': null
};


describe('Routeswitch', function() {
    Object.keys(testData).forEach(function(path) {
        it('match: ' + JSON.stringify(path), function() {
            eq(r.match(path), testData[path]);
        });
    });
});
