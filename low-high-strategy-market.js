var util = require('util');
var _ = require('underscore');
var EventEmitter = require('events').EventEmitter;
var Logger = require('./the-future-logger.js').TFLogger;

var config = require('./config.js');
var drops = config.drops;
var secret = config.secret;
var account = config.account;
var maxAmountAllowed = 10 * drops;

function Market(remote, issuer, currency, name, strategy) {
    EventEmitter.call(this);

    var self = this;

    this._index = 0;

    this._name = name;
    this._issuer = issuer;
    this._remote = remote;
    this._currency = currency;
    this._strategy = strategy;

    this._lowestPrice = 0;
    this._highestPrice = 0;

    this._paysSequences = [];
    this._getsSequences = [];

    this._buyXrpBook = remote.book("XRP", "", this._currency, this._issuer); //means I can buy xro from this book
    this._sellXrpBook = remote.book(this._currency, this._issuer, "XRP", ""); //means I can sell xrp in this book

    this._buyXrpBook.on('model', function(offers) {
        Logger.log(false, self._name + ' buy price change index:' + self._index++);

        var cheapestOne = offers[0];

        if (cheapestOne.TakerPays.currency != self._currency || (self._lowestPrice != 0 && self._lowestPrice == cheapestOne.TakerPays.value)) {
            return;
        }

        if (cheapestOne.quality == undefined) {
            self._lowestPrice = (cheapestOne.TakerPays.value / cheapestOne.TakerGets) * drops;
        } else {
            self._lowestPrice = cheapestOne.quality * drops;
        }

        var market = {
            _name: self._name,
            _issuer: self._issuer,
            _currency: self._currency,
            _lowestPrice: self._lowestPrice
        }

        Logger.log(false, market);

        self._strategy.emit(self._name + '-buy-price-change', market);
        self._strategy.on(self._name + '-buy-price-change', self._strategy.whenBuyPriceChange);
    });

    this._sellXrpBook.on('model', function(offers) {
        Logger.log(false, self._name + ' sell price change index:' + self._index++);

        var highestOffer = offers[0];

        if (highestOffer.TakerGets.currency != self._currency || (self._highestPrice != 0 && self._highestPrice == highestOffer.TakerGets.value)) {
            return;
        }

        var highestPrice = (highestOffer.TakerGets.value / highestOffer.TakerPays) * drops;

        self._highestPrice = highestPrice;

        var market = {
            _name: self._name,
            _issuer: self._issuer,
            _currency: self._currency,
            _highestPrice: self._highestPrice,
        }

        Logger.log(false, market);

        self._strategy.emit(self._name + '-sell-price-change', market);
        self._strategy.on(self._name + '-sell-price-change', self._strategy.whenSellPriceChange);
    });
}

util.inherits(Market, EventEmitter);

exports.LHSMarket = Market;