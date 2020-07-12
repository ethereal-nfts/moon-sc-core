const HDWalletProvider = require("@truffle/hdwallet-provider")
const {privateKey, publicKey} = require("./privatekey")

module.exports = {
  networks: {
    development: {
     host: "127.0.0.1",
     port: 8545,
     network_id: "*",
    },
    soliditycoverage: {
     host: "127.0.0.1",
     port: 8545,
     network_id: "*",
    },
    live: {
      provider: function() {
        return new HDWalletProvider(privateKey, "https://mainnet.infura.io/v3/82014a99110c48dabeb8e2d5489599e5")
      },
      network_id: 1,
      gasPrice: 31e9,
      from: publicKey,
      gas: 8000000
    }
  },

  compilers: {
    solc: {
      version: "0.5.16",
      docker: false,
      settings: {
       optimizer: {
         enabled: true,
         runs: 200
       },
       evmVersion: "byzantium"
      }
    }
  },

  plugins: ["solidity-coverage"]
}
