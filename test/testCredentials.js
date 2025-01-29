/**
 * Script used to test connection to the Coinbase App API with the new CDP API token.
 * The token can be generated here: https://www.coinbase.com/settings/api
 * Requires environment variables `apiKeyName`, `apiPrivateKey`, and `accountId`
 */

const coinbase = require('..');

const API_KEY_NAME = process.env["apiKeyName"];
// depending on the test environment, '\n' gets escaped as '\\n' which ES256 won't like
const API_PRIVATE_KEY = process.env["apiPrivateKey"].replace(/\\n/g, '\n');
const ACCOUNT_ID = process.env["accountId"];

const Client = coinbase.Client;
const coinbaseClient = new Client({
    apiKeyName: API_KEY_NAME,
    apiPrivateKey: API_PRIVATE_KEY
});

function getAccount() {
    return new Promise((resolve, reject) => {
        coinbaseClient.getAccount(ACCOUNT_ID, (err, acct) => {
            if (!err) {
                resolve(acct); // return the account
            } else {
                reject("Credentials were invalid");
            }
        });
    });
}

getAccount()
    .then(account => {
        // Print success message if the promise is resolved
        console.log(`Successfully got account details of ${ACCOUNT_ID}`);
    })
    .catch(error => {
        // Print error message if the promise is rejected
        console.error("Failed to get account details:", error);
    });
