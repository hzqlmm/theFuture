var util = require('util');
var _ = require('underscore');

var EventEmitter = require('events').EventEmitter;

var config = require('./config.js');
var account = config.account;
var secret = config.secret;

var drops = 1000000;
var maxAmountAllowed = 10 * drops;

function Market(remote, issuer, currency, name) {
    EventEmitter.call(this);

    var self = this;

    this._account = remote.account(account);

    this._account.on('entry', function(data) {
        remote.requestAccountOffers(account, function() {
            var offers = arguments[1].offers; //the second parameters are offers info
            self._sequences = _.filter(self._sequences, function(sequence) {
                var seqs = _.map(offers, function(offer) {
                    return offer.seq;
                });

                return _.contains(seqs, sequence);
            })
        });
    });

    this._index = 0;

    this._name = name;
    this._issuer = issuer;
    this._remote = remote;
    this._currency = currency;

    this._lowestPrice = 0;
    this._highestPrice = 0;

    this._buyXrpBook = remote.book("XRP", "", this._currency, this._issuer); //means I can buy xro from this book
    this._sellXrpBook = remote.book(this._currency, this._issuer, "XRP", ""); //means I can sell xrp in this book

    this._buyMarkets = [];
    this._sellMarkets = [];

    this._sequences = [];

    this._buyXrpBook.on('model', function(offers) {
        // if (self._sequences.length > 0) {
        //     return;
        // }
        self.log(true, self._name + ' buy price change index:' + self._index++);

        var cheapestOne = offers[0];

        var lowestPrice;
        if (cheapestOne.quality == undefined) {
            lowestPrice = (cheapestOne.TakerPays.value / cheapestOne.TakerGets) * drops;
        } else {
            lowestPrice = cheapestOne.quality * drops;
        }

        if (self._lowestPrice != 0 && lowestPrice == self._lowestPrice) {
            // return;
        }

        self._lowestPrice = lowestPrice;

        var market = {
            _name: self._name,
            _issuer: self._issuer,
            _currency: self._currency,
            _lowestPrice: self._lowestPrice
        }

        self.log(false, market);

        self._buyMarkets = _.reject(self._buyMarkets, function(item) {
            return item._name == market._name;
        });
        self._buyMarkets.push(market);

        self.emit(self._name + '-buy-price-change', market);
        self.on(self._name + '-buy-price-change', self.whenBuyPriceChange);


        // self.on(self._name + '-buy-price-change', self.whenBuyPriceChange);

    });

    this._sellXrpBook.on('model', function(offers) {
        // if (self._sequences.length > 0) {
        //     return;
        // }
        self.log(true, self._name + ' sell price change index:' + self._index++);

        var highestOffer = offers[0];

        var highestPrice = (highestOffer.TakerGets.value / highestOffer.TakerPays) * drops;

        if (self._highestPrice != 0 && highestPrice == self._highestPrice) {
            // return;
        }

        self._highestPrice = highestPrice;

        var market = {
            _name: self._name,
            _issuer: self._issuer,
            _currency: self._currency,
            _highestPrice: self._highestPrice,
        }

        self.log(false, market);

        self._sellMarkets = _.reject(self._sellMarkets, function(item) {
            return item._name == market._name;
        });
        self._sellMarkets.push(market);

        self.emit(this._name + '-sell-price-change', market);
    });
}

util.inherits(Market, EventEmitter);


Market.prototype.buyFromSeller = function(pays, gets) {
    this.createOffer(pays, gets);
}

Market.prototype.sellToBuyer = function(pays, gets) {
    this.createOffer(pays, gets);
}

Market.prototype.createOffer = function createOffer(pays, gets) {
    var self = this;

    self.log(true, "we make a deal here:", pays, gets);
    // self._remote.transaction()
    //     .offerCreate(account, pays, gets)
    //     .secret(secret).once("success", function(data) {
    //             var sequence = data.transaction.Sequence;
    //             self.log(true, "the sequence of this deal is:" + sequence);
    //             self._sequences.push(sequence);
    //         }.submit();
}

Market.prototype.addMarket = function(market) {
    market.on(market._name + '-buy-price-change', this.whenBuyPriceChange);
    market.on(market._name + '-sell-price-change', this.whenSellPriceChange);
};

Market.prototype.whenBuyPriceChange = function(market) {
    this._buyMarkets = _.reject(this._buyMarkets, function(item) {
        return item._name == market._name;
    });

    this._buyMarkets.push(market);

    var lowestPriceMarket = _.min(this._buyMarkets, function(item) {
        return item._lowestPrice;
    });

    var highestPriceMarket = _.max(this._sellMarkets, function(item) {
        return item._highestPrice;
    });
    this.log(true, 'list _buyMarkets AND _sellMarkets', this._buyMarkets, this._sellMarkets);

    if (highestPriceMarket._highestPrice - lowestPriceMarket._lowestPrice > 0.0002) {
        var totalIGetForBuy = maxAmountAllowed;
        var totalIPayForBuy = {
            name: lowestPriceMarket._name,
            issuer: lowestPriceMarket._issuer,
            currency: lowestPriceMarket._currency,
            value: (lowestPriceMarket._lowestPrice * maxAmountAllowed) / drops
        }

        this.buyFromSeller(totalIPayForBuy, totalIGetForBuy);

        var totalIPayForSell = (totalIPayForBuy.value / highestPriceMarket._highestPrice) * drops;
        var totalIGetForSell = {
            issuer: highestPriceMarket._issuer,
            currency: highestPriceMarket._currency,
            value: totalIPayForBuy.value
        }
        this.sellToBuyer(totalIPayForSell, totalIGetForSell);

        this.log(false, totalIPayForBuy, totalIGetForBuy, totalIPayForSell, totalIGetForSell);

    }
}

Market.prototype.whenSellPriceChange = function(market) {
    this._sellMarkets = _.reject(this._sellMarkets, function(item) {
        return item._name = market._name;
    });

    this._sellMarkets.push(market);

    var lowestPriceMarket = _.min(this._buyMarkets, function(item) {
        return item._lowestPrice;
    });

    var highestPriceMarket = _.max(this._sellMarkets, function(item) {
        return item._highestPrice;
    });
    this.log(true, 'list _buyMarkets AND _sellMarkets', this._buyMarkets, this._sellMarkets);


    if (highestPriceMarket._highestPrice - lowestPriceMarket._lowestPrice > 0.0002) {
        var totalIGetForBuy = maxAmountAllowed;
        var totalIPayForBuy = {
            name: lowestPriceMarket._name,
            issuer: lowestPriceMarket._issuer,
            currency: lowestPriceMarket._currency,
            value: (lowestPriceMarket._lowestPrice * totalIGetForBuy) / drops
        }

        this.buyFromSeller(totalIPayForBuy, totalIGetForBuy);

        var totalIPayForSell = maxAmountAllowed;
        var totalIGetForSell = {
            issuer: highestPriceMarket._issuer,
            currency: highestPriceMarket._currency,
            value: (highestPriceMarket._highestPrice * totalIPayForSell) / drops
        }
        this.sellToBuyer(totalIPayForSell, totalIGetForSell);

        this.log(true, totalIPayForBuy, totalIGetForBuy, totalIPayForSell, totalIGetForSell);

    }
}

Market.prototype.removeMarket = function(name) {
    _.without(this._buyMarkets, name + '-buy-price-change', name + '-sell-price-change');
    this.removeListener(name + '-buy-price-change', this.whenBuyPriceChange);
    this.removeListener(name + '-sell-price-change', this.whenSellPriceChange);
}

Market.prototype.log = function() {
    var arguNum = arguments.length;
    if (arguNum == 0) {
        return;
    }
    if (arguments[0]) { //check if we want to log something, this value is boolean type.
        for (var i = 1; i < arguNum; i = i + 1) {
            console.dir(arguments[i]);
        }
    }
}


exports.LHSMarket = Market;