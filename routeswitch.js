"use strict";

if (!global.Promise || !global.Promise.promisify) {
    global.Promise = require('bluebird');
}

var fs = require('fs');
var Path = require('path');
var async = require('async');

var readdirStats = function(dir) {
    return new Promise(function(resolve, reject) {
        var dirCB = function(err, names) {
            if (err) {
                reject(err);
            } else {
                names = names.map(function(name) { return dir + '/' + name; });
                async.map(names, fs.stat, function(err, stats) {
                    if (err) {
                        reject(err);
                    } else {
                        for (var i = 0; i < stats.length; i++) {
                            stats[i].name = names[i];
                        }
                        resolve(stats);
                    }
                });
            }
        };
        return fs.readdir(dir, dirCB);
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
                    case '\\/': return '(?:\\/([^\\/]+)(?=\\/|$))?';
                    // Default: only match one path component
                    default: return '([^\\/]+(?=\\/|$))';
                }
            });
    var sortKey = path.replace(/{([+\/]?)[^}]+}/g, '{$1}');
    return {
        regexp: new RegExp('^' + re + '$'),
        keys: keys,
        sortKey: sortKey
    };
}

// Convert a route into a matcher object
function routeToMatcher (route) {
    var pattern = route.pattern;
    var keys = [];
    var sortKey;
    if (pattern !== undefined) {
        if (pattern.constructor === String) {
            var regExpMatch = /^re:\/(.*)\/([a-zA-Z]*)$/.exec(pattern);
            if (regExpMatch) {
                // Whitespace here is to make sure that regexps sort before other patterns
                sortKey = ' ' + pattern;
                pattern = new RegExp(regExpMatch[1], regExpMatch[2]);
            } else {
                var pathMatcher = naiveRFC6570ToRegExp(pattern);
                keys = pathMatcher.keys;
                pattern = pathMatcher.regexp;
                sortKey = pathMatcher.sortKey;
            }
        } else {
            sortKey = ' ' + pattern;
        }
    } else {
        throw new Error('Undefined pattern passed into RouteSwitch:\n' + route);
    }

    return {
        pattern: pattern,
        keys: keys,
        methods: route.methods,
        sortKey: sortKey,
        path: route.pattern
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
    this.matcher = this.makeMatcher();
}

RouteSwitch.prototype.makeMatcher = function() {
    this.sortedRoutes = this.routes.sort(function(a,b) {
        return a.sortKey > b.sortKey;
    });
    // TODO: export documentation
    var routes = this.routes;
    var self = this;

    for (var i=0; i<routes.length; i++) {
        for (var j=i+1; j<=routes.length; j++) {
            if (j === routes.length || routes[j].sortKey !== routes[i].sortKey) {
                self.sortedRoutes.splice(i+1, j-i-1);
                break;
            }
        }
    }

    return RU.makeRegExpSwitch(this.sortedRoutes);
};

RouteSwitch.prototype.toString = function() {
    return this.sortedRoutes.toString();
};


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
        var matcher = m.matcher;
        return {
            pattern: matcher.pattern,
            methods: matcher.methods,
            params: params,
            sortKey: matcher.sortKey,
            path: matcher.path
        };
    } else {
        return null;
    }
};

RouteSwitch.prototype.addRoute = function addRoute(route) {
    var matcher = routeToMatcher(route);
    this.routes.push(matcher);
    this.matcher = this.makeMatcher();
};

RouteSwitch.prototype.addHandler = function addHandler(handler) {
    var path = Object.keys(handler)[0];
    var route = {
        pattern: path,
        methods: handler[path]
    };
    this.addRoute(route);
};

RouteSwitch.prototype.removeRoute = function removeRoute(route) {
    this.routes = this.routes.filter(function(matcher) {
        return matcher.route !== route;
    });
    this.matcher = this.makeMatcher();
};


// Load all handlers from a handler directory hierarchy
// - require index.js if found
// - require all *.js files & recurse otherwise
function loadHandlers(path, options) {
    return readdirStats(path)
    .then(function(handlerStats) {
        var handlers = [];
        var subDirs = [];
        handlerStats.forEach(function(stat) {
            var handlerPath = Path.resolve(stat.name);
            try {
                var handler = options.loader(handlerPath);
                handlers.push(handler);
            } catch (e) {
                if (stat.isDirectory()) {
                    // Try to recurse
                    subDirs.push(handlerPath);
                } else {
                    throw e;
                }
            }
        });
        if (subDirs.length) {
            return Promise.all(subDirs.map(function(path) {
                return loadHandlers(path, options);
            }))
            .then(function(subHandlers) {
                return handlers.concat(subHandlers);
            });
        } else {
            return handlers;
        }
    });
}

/**
 * Create a new router from Swagger 2.0 specs in an array.
 *
 * Each handler is expected to export a 'paths' property. The router will map
 * to the full module.
 *
 * @static
 * @param {array<object>} Array of Swagger 2.0 specs
 * @param {object} [optional] options to provide custom configuration
 * @returns {RouteSwitch}
 */
RouteSwitch.fromHandlers = function fromHandlers(handlers) {
    var allRoutes = [];
    handlers.forEach(function(handler) {
        for (var routePath in handler.paths) {
            allRoutes.push({
                pattern: routePath,
                methods: handler.paths[routePath]
            });
        }
    });
    return new RouteSwitch(allRoutes);
};

/**
 * Create a new router from handler modules exporting a Swagger 2.0 spec in a
 * directory. Handler modules can also export a function, which will be
 * called on load and is then expected to return a Swagger spec.
 *
 * @static
 * @param {array<string>} paths to handler directories
 * @param {object} [optional] options to provide custom configuration
 * @returns {Promise<RouteSwitch>}
 */
RouteSwitch.fromDirectories = function fromDirectories(paths, options) {
    if (!options) {
        options = {};
    }
    if (!options.loader) {
        options.loader = require;
    }
    var self = this;
    if (paths.constructor === String) {
        paths = [paths];
    }
    // Load routes & handlers
    return Promise.all(paths.map(function(path) {
        return loadHandlers(path, options);
    }))
    .then(function(handlerArrays) {
        var handlers;
        if (handlerArrays.length > 1) {
            // concatenate the handler arrays
            handlers = Array.prototype.concat.apply([], handlerArrays);
        } else {
            handlers = handlerArrays[0];
        }

        // Instantiate all handlers
        var handlerPromises = handlers.map(function(handler) {
            return Promise.resolve(handler);
        });
        return Promise.all(handlerPromises)
        .then(function (handlers) {
            return self.fromHandlers(handlers);
        });
    });
};

module.exports = RouteSwitch;
