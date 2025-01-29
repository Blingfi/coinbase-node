"use strict";
const request = require('request'),
    handleError = require('./errorHandler').handleError,
    handleHttpError = require('./errorHandler').handleHttpError,
    Base = require('./Base'),
    Account = require('./model/Account'),
    Address = require('./model/Address'),
    Buy = require('./model/Buy'),
    Checkout = require('./model/Checkout'),
    Deposit = require('./model/Deposit'),
    Merchant = require('./model/Merchant'),
    Notification = require('./model/Notification'),
    Order = require('./model/Order'),
    PaymentMethod = require('./model/PaymentMethod'),
    Sell = require('./model/Sell'),
    Transaction = require('./model/Transaction'),
    User = require('./model/User'),
    Withdrawal = require('./model/Withdrawal'),
    crypto = require('crypto'),
    _ = require('lodash'),
    qs = require('querystring'),
    assign = require('object-assign'),
    CERT_STORE = require('./CoinbaseCertStore');

const { signJWT } = require('./jwtNode.js');

const BASE_URI = 'https://api.coinbase.com/v2/';
const TOKEN_ENDPOINT_URI = 'https://api.coinbase.com/oauth/token';
const MODELS = {
  'account': Account,
  'address': Address,
  'buy': Buy,
  'checkout': Checkout,
  'deposit': Deposit,
  'merchant': Merchant,
  'notification': Notification,
  'order': Order,
  'payment_method': PaymentMethod,
  'sell': Sell,
  'transaction': Transaction,
  'user': User,
  'withdrawal': Withdrawal
};

//
// constructor
//
// opts = {
//   'apiKey'       : apyKey,
//   'apiSecret'    : apySecret,
//   'baseApiUri'   : baseApiUri,
//   'tokenUri'     : tokenUri,
//   'strictSSL'    : strictSSL,
//   'accessToken'  : accessToken,
//   'refreshToken' : refreshToken,
//   'version'      : version
// };
function ClientBase(opts) {

  if (!(this instanceof ClientBase)) {
    return new ClientBase(opts);
  }

  // assign defaults and options to the context
  assign(this, {
    baseApiUri: BASE_URI,
    tokenUri: TOKEN_ENDPOINT_URI,
    caFile: CERT_STORE,
    strictSSL: true,
    timeout: 5000,
  }, opts);

  // check for the different auth strategies
  const api = !!(this.apiKey && this.apiSecret);
  const oauth = !!this.accessToken;

  // XOR
  if (!(api ^ oauth)) {
    throw new Error('you must either provide an "accessToken" or the "apiKey" & "apiSecret" parameters');
  }
}

ClientBase.prototype = Object.create(Base.prototype);

//
// private methods
//

ClientBase.prototype._setAccessToken = function(path) {

  // OAuth access token
  if (this.accessToken) {
    if (path.indexOf('?') > -1) {
      return path + '&access_token=' + this.accessToken;
    }
    return path + '?access_token=' + this.accessToken;
  }
  return path
};

ClientBase.prototype._generateSignature = function(path, method, bodyStr) {
  const timestamp = Math.floor(Date.now() / 1000);
  const message = timestamp + method + '/v2/' + path + bodyStr;
  const signature = crypto.createHmac('sha256', this.apiSecret).update(message).digest('hex');

  return {
    'digest': signature,
    'timestamp': timestamp
  };
};

ClientBase.prototype._generateReqOptions = function(url, path, body, method, headers) {

  const bodyStr = body ? JSON.stringify(body) : '';

  // specify the options
  const options = {
    'url': url,
    'strictSSL': this.strictSSL,
    'body': bodyStr,
    'method': method,
    'timeout': this.timeout,
    'headers': {
      'Content-Type': 'application/json',
      'User-Agent': 'coinbase/node/1.0.4'
    }
  };

  options.headers = assign(options.headers, headers);

  // add additional headers when we're using the "api key" and "api secret"
  if (this.apiSecret && this.apiKey) {
    const sig = this._generateSignature(path, method, bodyStr);

    // With the new CDP API keys, requests need to include a JWT in the header or the op will be marked as unauthorized
    const jwt = signJWT({
      url,
      method,
      apiPubKey: this.apiKey,
      apiPrivKey: this.apiSecret,
    });

    options.headers = assign(options.headers, {
      'CB-ACCESS-KEY': this.apiKey,
      'CB-ACCESS-SIGN': sig.digest,
      'CB-ACCESS-TIMESTAMP': sig.timestamp,
      // Using the latest date found at https://docs.cdp.coinbase.com/coinbase-app/docs/changelog
      'CB-VERSION': '2025-01-28',
      'Authorization': `Bearer ${jwt}`
    })
  }

  return options;
};

ClientBase.prototype._getHttp = function (path, args, callback, headers) {
  let params = '';
  if (args && !_.isEmpty(args)) {
    params = '?' + qs.stringify(args);
  }

  const url = this.baseApiUri + this._setAccessToken(path + params);

  const opts = this._generateReqOptions(url, path + params, null, 'GET', headers);

  request.get(opts, function onGet(err, response, body) {
    if (!handleHttpError(err, response, callback)) {
      if (!body) {
        //console.error("Error: empty response");
        callback(new Error("empty response"), null);
      } else {
        try {
          const obj = JSON.parse(body);
          callback(null, obj);
        } catch (parseError) {
          callback(parseError, null);
        }
      }
    }
  });
};


ClientBase.prototype._postHttp = function(path, body, callback, headers) {

  const url = this.baseApiUri + this._setAccessToken(path);
  body = body || {}

  const options = this._generateReqOptions(url, path, body, 'POST', headers);

  request.post(options, function onPost(err, response, body) {
    if (!handleHttpError(err, response, callback)) {
      if (body) {
        const obj = JSON.parse(body);
        callback(null, obj);
      } else {
        callback(null, body);
      }
    }
  });
};

ClientBase.prototype._putHttp = function(path, body, callback, headers) {

  const url = this.baseApiUri + this._setAccessToken(path);

  const options = this._generateReqOptions(url, path, body, 'PUT', headers);

  request.put(options, function onPut(err, response, body) {
    if (!handleHttpError(err, response, callback)) {
      if (body) {
        const obj = JSON.parse(body);
        callback(null, obj);
      } else {
        callback(null, body);
      }
    }
  });
};


ClientBase.prototype._deleteHttp = function(path, callback, headers) {
  const url = this.baseApiUri + this._setAccessToken(path);
  request.del(url, this._generateReqOptions(url, path, null, 'DELETE', headers),
      function onDel(err, response, body) {
        if (!handleHttpError(err, response, callback)) {
          callback(null, body);
        }
      });
};

//
// opts = {
//   'colName'        : colName,
//   'next_uri'       : next_uri,
//   'starting_after' : starting_after,
//   'ending_before'  : ending_before,
//   'limit'          : limit,
//   'order'          : order
// };
// ```
//
ClientBase.prototype._getAllHttp = function(opts, callback, headers) {
  const self = this;
  let args = {};
  let path;
  if (this.hasField(opts, 'next_uri')) {
    path = opts.next_uri.replace('/v2/', '');
    args = null;
  } else {
    path = opts.colName;
    if (this.hasField(opts, 'starting_after')) {
      args.starting_after = opts.starting_after;
    }
    if (this.hasField(opts, 'ending_before')) {
      args.ending_before = opts.ending_before;
    }
    if (this.hasField(opts, 'limit')) {
      args.limit = opts.limit;
    }
    if (this.hasField(opts, 'order')) {
      args.order = opts.order;
    }
  }

  this._getHttp(path, args, function onGet(err, result) {
    if (!handleError(err, result, callback)) {
      let objs = [];
      if (result.data.length !== 0) {
        const ObjFunc = self._stringToClass(result.data[0].resource);
        objs = _.map(result.data, function onMap(obj) {
          return new ObjFunc(self, obj);
        });
      }
      callback(null, objs, result.pagination);
    }
  }, headers);
};

//
// args = {
// 'path'     : path,
// 'params'   : params,
// }
//
ClientBase.prototype._getOneHttp = function(args, callback, headers) {
  const self = this;
  this._getHttp(args.path, args.params, function onGet(err, obj) {
    if (!handleError(err, obj, callback)) {
      if (obj.data.resource) {
        const ObjFunc = self._stringToClass(obj.data.resource);
        callback(null, new ObjFunc(self, obj.data));
      } else {
        callback(null, obj);
      }
    }
  }, headers);
};

//
// opts = {
// 'colName'  : colName,
// 'params'   : args
// }
//
ClientBase.prototype._postOneHttp = function(opts, callback, headers) {
  const self = this;
  const body = opts.params;
  this._postHttp(opts.colName, body, function onPost(err, obj) {
    if (!handleError(err, obj, callback)) {
      if (obj.data.resource) {
        const ObjFunc = self._stringToClass(obj.data.resource);
        callback(null, new ObjFunc(self, obj.data));
      } else {
        callback(null, obj);
      }
    }
  }, headers);
};

ClientBase.prototype._stringToClass = function(name) {
  return MODELS[name]
};

module.exports = ClientBase;
