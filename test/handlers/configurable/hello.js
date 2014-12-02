'use strict';

module.exports = function (conf) {
    return {
        paths: {
            '/v1/fortune': {
                get: {
                    request_handler: function(handler, req) {
                        return Promise.resolve({
                            status: 200,
                            body: conf.fortune()
                        });
                    }
                }
            }
        }
    };
};
