var util = require('util');
var _ = require('underscore');
var config = require('./config.js');
var account = config.account;
var secret = config.secret;
var EventEmitter = require('events').EventEmitter;

var drops = 1000000;
var maxAmountAllowed = 100 * drops;

function Market(remote, issuer, currency, name) {
    EventEmitter.call(this);
    var self = this;

    this._name = name;
    this._issuer = issuer;
    this._currency = currency;

    //we talk about xrp here, so we use numberic type to represent it
    this._priceIBuy = 0;
    this._amountIBuy = 0;

    this._priceISell = 0;
    this._amountISell = 0;

    this._buyXrpBook = remote.book("XRP", "", this._currency, this._issuer); //means I can buy xro from this book
    this._sellXrpBook = remote.book(this._currency, this._issuer, "XRP", ""); //means I can sell xrp in this book

    this._markets = [];

    this._buyXrpBook.on('model', function(offers) {
        var cheapestOne = offers[0];

        if (cheapestOne.quality == undefined) {
            self._priceIBuy = (cheapestOne.TakerPays.value / cheapestOne.TakerGets) * drops;
        } else {
            self._priceIBuy = cheapestOne.quality * drops;
        }

        self._amountIBuy = cheapestOne.TakerGets;

        if (cheapestOne.hasOwnProperty('taker_gets_funded')) {
            self._amountIBuy = cheapestOne.taker_gets_funded;
        }

        var market = {
            _issuer: self._issuer,
            _currency: self._currency,
            _priceIBuy: self._priceIBuy,
            _amountIBuy: self._amountIBuy
        }
        self.emit(self._name + '-buy-price-change', market);
    });

    this._sellXrpBook.on('model', function(offers) {
        var highestOffer = offers[0];

        self._priceISell = (highestOffer.TakerGets.value / highestOffer.TakerPays) * drops;
        self._amountISell = highestOffer.TakerPays;

        if (highestOffer.hasOwnProperty('taker_gets_funded')) {
            self._amountISell = highestOffer.taker_pays_funded;
        }

        var market = {
            _issuer: self._issuer,
            _currency: self._currency,
            _priceISell: self._priceISell,
            _amountISell: self._amountISell
        }
        self.emit(this._name + '-sell-price-change', market);
    });
}

util.inherits(Market, EventEmitter);


Market.prototype.buyFromSeller = function(pays, gets) {
    createOffer(pays, gets);
}

Market.prototype.sellToBuyer = function(pays, gets) {
    createOffer(pays, gets);
}

Market.prototype.createOffer = function createOffer(pays, gets) {
    console.log('createOffer' + pays);
    console.log('createOffer' + gets);
    // remote.transaction()
    //     .offerCreate(account, pays, gets)
    //     .secret(secret)
    //     .submit();
}

Market.prototype.addMarketName = function(name) {
    this._markets.push(name);
    this.on(name + '-buy-price-change', this.whenBuyPriceChange);
    this.on(name + '-sell-price-change', this.whenSellPriceChange);
    this.emit(name + '-buy-price-change', {
        _priceIBuy: '0.027',
        _priceISell: '0.030'
    })
};

Market.prototype.addMarket = function(market) {
    market.on(market._name + '-buy-price-change', this.whenBuyPriceChange);
    market.on(market._name + '-sell-price-change', this.whenSellPriceChange);
};

Market.prototype.whenBuyPriceChange = function(market) {
    console.log('_priceISell: ' + this._priceISell + ' _priceIBuy: ' + market._priceIBuy);
    if (this._priceISell > market._priceIBuy) {
        var totalIGetForBuy = _max([this._amountISell, market._amountIBuy, maxAmountAllowed]);
        var totalIPayForBuy = {
            issuer: market._issuer,
            currency: market._currency,
            value: market._priceIBuy * totalIGetForBuy
        }
        buyFromSeller(totalIPayForBuy, totalIGetForBuy);

        var totalIPayForSell = totalIPayForBuy.value / _priceISell;
        var totalIGetForSell = {
            issuer: this._issuer,
            currency: this._currency,
            value: totalIPayForBuy.value
        }
        sellToBuyer(totalIPayForSell, totalIGetForSell);
    }
}

Market.prototype.whenSellPriceChange = function(market) {
    console.log('_priceISell' + this._priceIBuy + ' _priceIBuy' + market._priceISell);
    if (this._priceIBuy < market._priceISell) {
        var totalIGetForBuy = _max([this._amountIBuy, market._amountISell, maxAmountAllowed]);
        var totalIPayForBuy = {
            issuer: this._issuer,
            currency: this._currency,
            value: this._priceIBuy * totalIGetForBuy
        }
        buyFromSeller(totalIPayForBuy, totalIGetForBuy);

        var totalIPayForSell = totalIPayForBuy.value / market._priceISell;
        var totalIGetForSell = {
            issuer: market._issuer,
            currency: market._currency,
            value: totalIPayForBuy.value
        }
        sellToBuyer(totalIPayForSell, totalIGetForSell);
    }
}

Market.prototype.removeMarket = function(name) {
    _.without(this._markets, name + '-buy-price-change', name + '-sell-price-change');
    this.removeListener(name + '-buy-price-change', this.whenBuyPriceChange);
    this.removeListener(name + '-sell-price-change', this.whenSellPriceChange);
}

exports.Market = Market;