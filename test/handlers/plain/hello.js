'use strict';

module.exports = {
    paths: {
        '/v1/hello': {
            get: {
                request_handler: function(handler, req) {
                    return Promise.resolve({
                        status: 200,
                        body: 'Hello, world!'
                    });
                }
            }
        }
    }
};
