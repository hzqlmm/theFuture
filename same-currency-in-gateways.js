var util = require('util');
var _ = require('underscore');
var config = require('./config.js');
var account = config.account;
var secret = config.secret;
var EventEmitter = require('events').EventEmitter;

var drops = 1000000;
var maxAmountAllowed = 100 * drops;

var Market = function(remote, issuer, currency, name) {
    EventEmitter.call(this);

    this._name = name;
    this._issuer = issuer;
    this._currency = currency;

    //we talk about xrp here, so we use numberic type to represent it
    this._priceIBuy = 0;
    this._priceISell = 0;
    this._amountIBuy = 0;
    this._amountISell = 0;

    this._buyXrpBook = remote.book("XRP", "", _currency, _issuer); //means I can buy xro from this book
    this._sellXrpBook = remote.book(_currency, _issuer, "XRP"); //means I can sell xrp in this book

    _buyXrpBook.on('model', function(offers) {
        var cheapestOne = offers[0];

        _priceIBuy = cheapestOne.quality * drops;
        _amountIBuy = cheapestOne.TakerGets;

        if (cheapestOne.hasOwnProperty('taker_gets_funded')) {
            _amountIBuy = d.taker_gets_funded;
        }

        this.emit('buy-price-change');
    });

    _sellXrpBook.on('model', function(offers) {
        var highestOffer = offers[0];

        _priceISell = (d.TakerGets.value / d.TakerPays) * drops;
        _amountISell = highestOffer.TakerPays;

        if (highestOffer.hasOwnProperty('taker_gets_funded')) {
            _amountISell = highestOffer.taker_pays_funded;
        }

        this.emit('sell-price-change');
    });

    function buyFromSeller(pays, gets) {
        remote.transaction()
            .offerCreate(account, pays, gets)
            .secret(secret)
            .submit();
    }

    function sellToBuyer(pays, gets) {
        remote.transaction()
            .offerCreate(account, pays, gets)
            .secret(secret)
            .submit();
    }

    function addMarketListener(otherMarket) {
        otherMarket.on('sell-price-change', function() {
            if (_priceIBuy < otherMarket._priceISell) {
                var totalIGetForBuy = _max([_amountIBuy, otherMarket._amountISell, maxAmountAllowed]);
                var totalIPayForBuy = {
                    issuer: _issuer,
                    currency: _currency,
                    value: _priceIBuy * totalIGetForBuy
                }
                buyFromSeller(totalIPayForBuy, totalIGetForBuy);

                var totalIPayForSell = totalIPayForBuy.value / otherMarket._priceISell;
                var totalIGetForSell = {
                    issuer: otherMarket._issuer,
                    currency: otherMarket._currency,
                    value: totalIPayForBuy.value
                }
                sellToBuyer(totalIPayForSell, totalIGetForSell);
            }
        });

        otherMarket.on('buy-price-change', function() {
            if (_priceISell > otherMarket._priceIBuy) {
                var totalIGetForBuy = _max([_amountISell, otherMarket._amountIBuy, maxAmountAllowed]);
                var totalIPayForBuy = {
                    issuer: otherMarket._issuer,
                    currency: otherMarket._currency,
                    value: otherMarket._priceIBuy * totalIGetForBuy
                }
                buyFromSeller(totalIPayForBuy, totalIGetForBuy);

                var totalIPayForSell = totalIPayForBuy.value / _priceISell;
                var totalIGetForSell = {
                    issuer: _issuer,
                    currency: _currency,
                    value: totalIPayForBuy.value
                }
                sellToBuyer(totalIPayForSell, totalIGetForSell);
            }
        });

    }
}