var RouteSwitch = require('./routeswitch');

var r = new RouteSwitch([
        {pattern: '/{foo}/{bar}/html', methods: 'looks like html'},
        {pattern: '/{foo}/{bar}/json', methods: 'looks like json'},
        {pattern: '/{foo}/baz/{+path}', methods: 'looks like some arbitrary path'},
        {pattern: '', methods: 'the empty path'}
]);

var m = r.match('/some/thing/html');
if (! m
        || m.methods !== 'looks like html'
        || m.params.bar !== 'thing') {
    process.exit(1);
}
var m = r.match('/some/thing/json');
if (! m
        || m.methods !== 'looks like json'
        || m.params.bar !== 'thing') {
    process.exit(1);
}
var m = r.match('/some/baz/some/long/path');
if (! m
        || m.methods !== 'looks like some arbitrary path'
        || m.params.path !== 'some/long/path') {
    process.exit(1);
}
var m = r.match('');
if (! m || m.methods !== 'the empty path') {
    process.exit(1);
}
