# Moon SC Core

Core smart contracts for the [Moon](http://moon.dev "MoonCoin") deflationary cryptocurrency.

## Using this repository

### installation
You will need to install [ganache](https://www.trufflesuite.com/ganache "ganache") and [truffle](https://www.trufflesuite.com/docs/truffle/getting-started/installation "truffle").
After installing ganache and truffle, clone this repository and run `npm install` to install all packages.
Next, copy `privatekey-example.js` to `privatekey.js` and enter your keys.

### commands
To run tests, `npm run test`

To run migrations on local ganache blockchain:
- `ganache-cli --deterministic`
- `npm run migrate-dev`

To reset and run migrations on local ganche, instead run `npm run migrate-dev-reset`

To migrate to live chain, run `npm run migrate-live`

❤ Moon ❤
