function Logger() {};

Logger.prototype.log = function() {
    var arguNum = arguments.length;
    if (arguNum == 0) {
        return;
    }
    if (arguments[0]) { //check if we want to log something, this value is boolean type.
        console.dir(new Date());
        for (var i = 1; i < arguNum; i = i + 1) {
            console.dir(arguments[i]);
        }
    }
}

exports.TFLogger = new Logger();