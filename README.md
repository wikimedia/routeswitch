# RouteSwitch

Simple and fast regexp-based switcher on regexps or URL patterns. Supports
building a switcher from Swagger 2.0 API specs.

[![Build
-Status](https://travis-ci.org/gwicke/routeswitch.svg?branch=master)](https://travis-ci.org/gwicke/routeswitch)

## Installation
`npm install routeswitch`

## Documentation
Path specs are defined in a subset of [RFC
6570](http://tools.ietf.org/html/rfc6570) URL patterns:

- `/{foo}/{bar}` -- matches two non-empty path components
- `/{foo}/{bar}/` -- only matches with trailing slash
- `/foo{/bar}` -- optionally matches a slash and a path component, if not
  empty
- `/{+foo}` -- matches any non-empty path, including slashes

In the event of route overlaps, the most specific & shortest routes will win:

1) regexps
2) paths with fixed segments
3) paths with templated segments

Examples:
- `/foo/{bar}` gets a higher precedence than `/{some}/{thing}` and `/{some}`

### Construction
#### `RouteSwitch.fromDirectory(path, [logMethod]) -> Promise<RouteSwitch>`
Loads all modules in a directory tree. Modules can either directly export a
Swagger 2.0 spec with optional additional data (such as a reference to a
handler), or they can export a function returning a promise for the spec.
Returns a promise for a RouteSwitch.

#### `RouteSwitch.fromHandlers(specs) -> RouteSwitch`
Builds a RouteSwitch directly from an array of Swagger specs.

#### `new RouteSwitch(routes) -> RouteSwitch`
Low-level construction. Routes are objects with the following members:

- `pattern`: either a `RegExp`, or a URL pattern
- `methods`: an arbitrary object, which will be returned as a member on
  successful `.match(uri)`. Typically this is the object providing the method
  handlers for the route defined by `pattern`.

### Dynamic route addition / removal
#### `RouteSwitch.addRoute(route)`
Add a route to a RouteSwitch instance.

#### `RouteSwitch.removeRoute(route)`
Remove a route from a RouteSwitch instance.

### Matching
#### `RouteSwitch.match(uri) -> (null | object)`
Returns null when there is no match. On match, it returns an object containing

- `pattern`: the matched URL pattern
- `methods`: the original Swagger spec object defined for this pattern,
  keyed on method (lowercase)
- `params`: Named parameters defined in the URL pattern

### Example schema
```javascript
{
    paths: {
        '/v1/{domain}': {
            put: {
                summary: "Create or update a domain",
                // optionally, more swagger docs optionally
                request_handler: this.putDomain.bind(this)
            }
        },
        '/v1/{domain}/': {
            get: {
                summary: "List buckets and tables for a domain",
                request_handler: this.listBuckets.bind(this)
            }
        },
        '/v1/{domain}/{bucket}': {
            put: {
                summary: "Create or update a bucket",
                request_handler: this.putBucket.bind(this)
            },
            get: {
                summary: "Get bucket metadata",
                request_handler: this.getBucket.bind(this)
            }
        },
        '/v1/{domain}/{bucket}/': {
            get: {
                request_handler: this.handleAll.bind(this)
            }
        },
        '/v1/{domain}/{bucket}/{+rest}': {
            all: {
                request_handler: this.handleAll.bind(this)
            }
        }
    }
};
```
