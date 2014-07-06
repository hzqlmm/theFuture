require('./date-extend.js');
var bunyan = require('bunyan');
var server_options = {};
var db_options = {
    w: -1
};

var mongodb = require("mongodb");
var mongoserver = new mongodb.Server('localhost', 27017, server_options);
var db = new mongodb.Db('test', mongoserver, db_options);

Logger.prototype.getNextSequence = function(name) {
    var ret = db.collection('counters').findAndModify({
        query: {
            _id: name
        },
        update: {
            $inc: {
                seq: 1
            }
        },
        new: true
    }, function(err, result) {
        db.close();
    });

    return ret.seq;
}

function Logger() {
    this.logger;
    this.getNewLog();
    setInternal(this.getNewLog, 86400000); //we will get new log each day.
};

Logger.prototype.getNewLog = function() {
    var self = this;

    var logId = getNextSequence('logId');
    var date = new Date().format('MM-dd-yyyy');

    self.logger = bunyan.createLogger({
        name: 'theFuture',
        streams: [{
            level: 'info',
            path: './log/ripple-info-' + logId + date + '.js'
        }, {
            level: 'error',
            path: './log/ripple-error' + logId + date + '.js' // log ERROR and above to a file
        }]
    });
}

Logger.prototype.log = function() {
    var self = this;
    var arguNum = arguments.length;
    if (arguNum == 0) {
        return;
    }
    if (arguments[0]) { //check if we want to log something, this value is boolean type.
        delete arguments[0];
        logger.info(arguments);
    }
};

Logger.prototype.getLogId = function() {

}



process.on('uncaughtException', function(err) {
    // prevent infinite recursion
    process.removeListener('uncaughtException', arguments.callee);

    // bonus: log the exception
    logger.error(err);
});

exports.TFLogger = new Logger();