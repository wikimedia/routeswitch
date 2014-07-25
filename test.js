var RouteSwitch = require('./routeswitch');

var r = new RouteSwitch([
        {pattern: '/{foo}/{bar}/html', v: 'looks like html'},
        {pattern: '/{foo}/{bar}/json', v: 'looks like json'},
        {pattern: '/{foo}/baz/{+path}', v: 'looks like some arbitrary path'},
        {pattern: '', v: 'the empty path'}
]);

var m = r.match('/some/thing/html');
if (! m
        || m.route.v !== 'looks like html'
        || m.params.bar !== 'thing') {
    process.exit(1);
}
var m = r.match('/some/thing/json');
if (! m
        || m.route.v !== 'looks like json'
        || m.params.bar !== 'thing') {
    process.exit(1);
}
var m = r.match('/some/baz/some/long/path');
if (! m
        || m.route.v !== 'looks like some arbitrary path'
        || m.params.path !== 'some/long/path') {
    process.exit(1);
}
var m = r.match('');
if (! m || m.route.v !== 'the empty path') {
    process.exit(1);
}
