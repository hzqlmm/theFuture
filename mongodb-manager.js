var mongodb = require("mongodb");
var mongodb_server = require('./config.js').mongodb_server;

var mongoserver = new mongodb.Server(mongodb_server.host, mongodb_server.port, mongodb_server.server_options);
var db = new mongodb.Db('the-future', mongoserver, mongodb_server.db_options);

function getCryptoOption(callback) {
    db.open(function(err, db) {
        // Fetch a collection to insert document into
        var collection = db.collection("crypto");
        // Insert a single document
        collection.findOne({
            key: 'kissingate'
        }, function(err, item) {
            callback(item);
            db.close();
        })
    });
}

function getNextSequence(name, callback) {
    db.open(function(err, db) {
        // Fetch a collection to insert document into
        var collection = db.collection("counters");
        // Insert a single document
        collection.findAndModify({
                _id: name
            }, [
                ['seq', 1]
            ], {
                $inc: {
                    seq: 1
                }
            }, {
                new: true
            },
            function(err, result) {
                callback(result);
                db.close();
            })
    });
}

exports.getNextSequence = getNextSequence;
exports.getCryptoOption = getCryptoOption;