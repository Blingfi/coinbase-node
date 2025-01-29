const { sign } = require('jsonwebtoken');
const crypto = require('crypto');

const EXPIRATION_MINUTES = 2;
const ES256 = 'ES256';

/**
 * Referenced from https://docs.cdp.coinbase.com/coinbase-app/docs/quickstart
 */
function signJWT(params) {
    const { url, method, apiKeyName, apiPrivateKey } = params;

    const urlWithEndpoint = url.slice(8);
    const uri = `${method} ${urlWithEndpoint}`;
    const timestampMs = Date.now();
    const payload = {
        iss: 'cdp',
        nbf: Math.floor(timestampMs / 1000),
        exp: Math.floor(timestampMs / 1000) + 60 * EXPIRATION_MINUTES,
        sub: apiKeyName,
        uri,
    };
    const header = {
        alg: ES256,
        kid: apiKeyName,
        nonce: crypto.randomBytes(16).toString('hex'),
    };
    const options = {
        algorithm: ES256,
        header: header,
    };
    return sign(payload, apiPrivateKey, options);
}

module.exports = { signJWT };
