"use strict";
if (!global.Promise) {
    // Make sure we have a Promise implementation even on node <= 0.10
    require('es6-shim');
}
var fs = require('fs');
var Path = require('path');
var readdir = function(dir) {
    return new Promise(function(resolve, reject) {
        var cb = function(err, res) {
            if (err) { reject(err); }
            else { resolve(res); }
        };
        return fs.readdir(dir, cb);
    });
};
var RU = require('regexp-utils');

function naiveRFC6570ToRegExp (path) {
    // We only support simple variable names for now
    var keys = [];
    var re = RU.escapeRegExp(path)
            // Braces are backslash-escaped here; literal braces are expected
            // to be percent-encoded in the passed-in path.
            .replace(/\\{(\\[+/])?([a-zA-Z0-9_]+)\\}/g, function(_, modifier, key) {
                keys.push(key);
                switch(modifier) {
                    // Reserved expansion {+foo}, matches reserved chars
                    // including slashes
                    // http://tools.ietf.org/html/rfc6570#page-22
                    case '\\+': return '(.+)';
                    // Optional path component, separated by a leading slash,
                    // and possibly empty apart from the slash.
                    case '\\/': return '(?:\\/([^\\/]*)(?=\\/|$))?';
                    // Default: only match one path component
                    default: return '([^\\/]*(?=\\/|$))';
                }
            });
    return {
        regexp: new RegExp('^' + re + '$'),
        keys: keys
    };
}

// Convert a route into a matcher object
function routeToMatcher (route) {
    var pattern = route.pattern,
        keys = [];
    if (pattern !== undefined) {
        if (pattern.constructor === String) {
            var pathMatcher = naiveRFC6570ToRegExp(pattern);
            keys = pathMatcher.keys;
            pattern = pathMatcher.regexp;
        }
    } else {
        throw new Error('Undefined pattern passed into RouteSwitch:\n' + route);
    }

    return {
        pattern: pattern,
        keys: keys,
        route: route
    };
}

/**
 * Simple request router using regexp-utils
 *
 * Route is expected to be an object like this:
 * {
 *      pattern: '/{title}/{part}', // path pattern in RFC6570 syntax
 *      value: {} // arbitrary object, returned on match
 * }
 *
 * Return value:
 * {
 *      route: { // original route object
 *          pattern: '/{title}/{part}', // path pattern in RFC6570 syntax
 *          value: {} // arbitrary object, returned on match
 *      },
 *      path: '/some title/some part', // the passed-in path
 *      params: { // path parameters
 *          title: "some title",
 *          part: "some part"
 *      },
 *      query: { } // query parameters
 * }
 *
                newMatch.index = match.index;
                newMatch.input = s;
 */

function RouteSwitch ( routes ) {
    // convert string paths in routes to regexps
    this.routes = routes.map(routeToMatcher);
    this.matcher = RU.makeRegExpSwitch(this.routes);
}


RouteSwitch.prototype.match = function match (path) {
    var m = this.matcher(path),
        i;
    if (m) {
        var params = {};
        // Copy over numeric indexes
        for (i = 0; i < m.match.length; i++) {
            params[i] = m.match[i];
        }
        // Named parameters
        if (m.matcher.keys && m.matcher.keys.length) {
            var keys = m.matcher.keys;
            // Map group to keys
            for (i = 0; i < keys.length; i++) {
                params[keys[i]] = m.match[i+1];
            }
        }
        return {
            route: m.matcher.route,
            params: params
        };
    } else {
        return null;
    }
};

RouteSwitch.prototype.addRoute = function addRoute(route) {
    var matcher = routeToMatcher(route);
    this.routes.push(matcher);
    this.matcher = RU.makeRegExpSwitch(this.routes);
};


RouteSwitch.prototype.removeRoute = function removeRoute(route) {
    this.routes = this.routes.filter(function(matcher) {
        return matcher.route !== route;
    });
    this.matcher = RU.makeRegExpSwitch(this.routes);
};


// Load all handlers from the handlers directory
function loadHandlers (path, log) {
    return readdir(path)
    .then(function(handlerNames) {
        var handlers = [];
        handlerNames.forEach(function(handlerName) {
            var handlerPath = Path.resolve(path + '/' + handlerName);
            try {
                handlers.push(require(handlerPath));
            } catch (e) {
                if (log) { log('error/handler', e, handlerName, e && e.stack); }
            }
        });
        return handlers;
    });
}

function makeRouter (path, log) {
}

/**
 * Create a new router from handlers in a directory.
 *
 * Each handler is expected to export a 'path' property. The router will map
 * to the full module.
 *
 * @static
 * @param {String} path to handle directory
 * @param {Function} [optional] log('level', message)
 * @returns {Promise<RouteSwitch>}
 */
RouteSwitch.fromHandlers = function fromHandlers(path, log) {
    // Load routes & handlers
    return loadHandlers(path, log)
    .then(function(handlers) {
        var allRoutes = [];
        var handlerPromises = handlers.map(function(handler) {
            if (handler.constructor === Function) {
                return handler({log: log});
            } else {
                return Promise.resolve(handler);
            }
        });
        return Promise.all(handlerPromises)
        .then(function (handlers) {
            handlers.forEach(function(handler) {
                //console.log('handler', handler);
                handler.routes.forEach(function(route) {
                    allRoutes.push({
                        pattern: route.path,
                        methods: route.methods
                    });
                });
            });
            if (log) { log('notice', path, allRoutes); }
            return new RouteSwitch(allRoutes);
        });
    });
};

module.exports = RouteSwitch;
