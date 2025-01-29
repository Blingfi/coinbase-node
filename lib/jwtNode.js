const { sign } = require('jsonwebtoken');
const crypto = require('crypto');

const EXPIRATION_MINUTES = 2;
const ALGORITHM = 'ES256';

/**
 * Referenced from https://docs.cdp.coinbase.com/coinbase-app/docs/quickstart
 */
function signJWT(params) {
    const { url, method, apiPrivKey, apiPubKey, } = params;

    const urlWithEndpoint = url.slice(8);
    const uri = `${method} ${urlWithEndpoint}`;
    const timestampMs = Date.now();
    const payload = {
        iss: 'cdp',
        nbf: Math.floor(timestampMs / 1000),
        exp: Math.floor(timestampMs / 1000) + 60 * EXPIRATION_MINUTES,
        sub: apiPubKey,
        uri,
    };
    const header = {
        alg: ALGORITHM,
        kid: apiPubKey,
        nonce: crypto.randomBytes(16).toString('hex'),
    };
    const options = {
        algorithm: ALGORITHM,
        header: header,
    };
    return sign(payload, apiPrivKey, options);
}

module.exports = { signJWT };
