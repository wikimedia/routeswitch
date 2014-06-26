var RouteSwitch = require('./routeswitch');

var r = new RouteSwitch([
        {pattern: '/{foo}/{bar}/html', v: 'looks like html'},
        {pattern: '/{foo}/{bar}/json', v: 'looks like json'}
]);

var m = r.match('/some/thing/json');
if (! m
        || m.route.v !== 'looks like json'
        || m.params.bar !== 'thing') {
    process.exit(1);
}
