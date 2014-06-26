"use strict";
var RU = require('regexp-utils');

function naiveRFC6570ToRegExp (path) {
    // We only support simple variable names for now
    var keys = [];
    var re = RU.escapeRegExp(path)
            // Braces are escaped here; literal braces are expected to be
            // percent-encoded in the passed-in path.
            .replace(/\\{([a-zA-Z0-9]+)\\}/g, function(_, key) {
        keys.push(key);
        return '([^\/]+)';
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
    if (pattern && pattern.constructor === String) {
        var pathMatcher = naiveRFC6570ToRegExp(pattern);
        keys = pathMatcher.keys;
        pattern = pathMatcher.regexp;
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

module.exports = RouteSwitch;
