var bunyan = require('bunyan');

var logger = bunyan.createLogger({
    name: 'theFuture',
    streams: [{
        level: 'info',
        path: './log/ripple-info' + new Date().toJSON() + '.js'
    }, {
        level: 'error',
        path: './log/ripple-error' + new Date().toJSON() + '.js' // log ERROR and above to a file
    }]
});

function Logger() {};

Logger.prototype.log = function() {
    var self = this;
    var arguNum = arguments.length;
    if (arguNum == 0) {
        return;
    }
    if (arguments[0]) { //check if we want to log something, this value is boolean type.
        for (var i = 1; i < arguNum; i = i + 1) {
            logger.info(arguments[i]);
        }
    }
};

process.on('uncaughtException', function(err) {
    // prevent infinite recursion
    process.removeListener('uncaughtException', arguments.callee);

    // bonus: log the exception
    logger.error(err);
});

exports.TFLogger = new Logger();