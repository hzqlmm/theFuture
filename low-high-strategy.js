var util = require('util');
var _ = require('underscore');
var config = require('./config.js');
var EventEmitter = require('events').EventEmitter;
var Logger = require('./the-future-logger.js').TFLogger;

var account = config.account;
var secret = config.secret;

var drops = 1000000;
var maxAmountAllowed = 10;

function Strategy(remote) {
    var self = this;

    this._remote = remote;
    this._account = remote.account(account);

    this._buyMarkets = [];
    this._sellMarkets = [];
    this._sequences = [];
    this._offers = [];
    this._profitRatioIGive = 1 / 100000;
    this._profitRatioIWant = 1 / 500;

    this.getOffers();
}

util.inherits(Strategy, EventEmitter);

Strategy.prototype.getOffers = function() {
    var self = this;
    self._remote.requestAccountOffers(account, function() {
        self._offers = arguments[1].offers; //the second parameters are offers info
        Logger.log(true, "right now the offers this account have:", self._offers);
    });
}

Strategy.prototype.createOffer = function createOffer(pays, gets) {
    var self = this;

    if (typeof pays == 'obeject') {
        var offers = _.filter(self._offers, function(offer) {
            return offer.taker_pays.currency == pays.currency && offer.taker_pays.issuer == pays.issuer;
        });

        config.log(true, 'offers check here:', offers);
        if (offers != undefined) {
            return;
        }

        self._offers.push({
            taker_pays: pays
        });

    }

    if (typeof gets == 'obeject') {
        var offers = _.filter(self._offers, function(offer) {
            return offer.taker_gets.currency == gets.currency && offer.taker_gets.issuer == gets.issuer;
        });

        config.log(true, 'offers check here:', offers);
        if (offers != undefined) {
            return;
        }

        self._offers.push({
            taker_gets: gets
        });
    }

    Logger.log(true, "we make a deal here:", pays, gets);

    self._remote.transaction()
        .offerCreate(account, pays, gets)
        .secret(secret).once("success", function(data) {
            self.getOffers();
        }).submit();
}

Strategy.prototype.whenBuyPriceChange = function(market) {
    this._buyMarkets = _.reject(this._buyMarkets, function(item) {
        return item._name == market._name;
    });

    this._buyMarkets.push(market);

    this.makeADealIfReachProfitRatio();
}

Strategy.prototype.makeADealIfReachProfitRatio = function() {
    var buyMarket = _.max(this._buyMarkets, function(item) {
        return item._lowestPrice;
    });

    var sellMarket = _.min(this._sellMarkets, function(item) {
        return item._highestPrice;
    });
    Logger.log(true, 'buyMarkets:', this._buyMarkets, 'sellMarket:', this._sellMarkets);

    var profitIGive;
    if (buyMarket._lowestPrice - sellMarket._highestPrice > this._profitRatioIWant * sellMarket._highestPrice) {
        var totalIGetForBuy = maxAmountAllowed * drops;

        profitIGive = buyMarket._lowestPrice * this._profitRatioIGive;
        var totalIPayForBuy = {
            'currency': buyMarket._currency,
            'value': (buyMarket._lowestPrice - profitIGive) * totalIGetForBuy / drops + '',
            'issuer': buyMarket._issuer
        }

        this.createOffer(totalIPayForBuy, totalIGetForBuy);

        var totalIPayForSell = maxAmountAllowed * drops;

        profitIGive = sellMarket._highestPrice * this._profitRatioIGive;
        var totalIGetForSell = {
            'currency': sellMarket._currency,
            'value': (sellMarket._highestPrice + profitIGive) * totalIPayForSell / drops + '',
            'issuer': sellMarket._issuer
        }

        this.createOffer(totalIPayForSell, totalIGetForSell);



        Logger.log(false, totalIPayForBuy, totalIGetForBuy, totalIPayForSell, totalIGetForSell);
    }
}

Strategy.prototype.whenSellPriceChange = function(market) {
    this._sellMarkets = _.reject(this._sellMarkets, function(item) {
        return item._name = market._name;
    });

    this._sellMarkets.push(market);

    this.makeADealIfReachProfitRatio();
}

Strategy.prototype.removeMarket = function(name) {
    this.removeListener(name + '-buy-price-change', this.whenBuyPriceChange);
    this.removeListener(name + '-sell-price-change', this.whenSellPriceChange);
}

exports.LHStrategy = Strategy;