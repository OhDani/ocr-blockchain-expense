const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });
require("@nomicfoundation/hardhat-toolbox");
// Clean private key (strip quotes, whitespace, \r)
const cleanKey = (process.env.PRIVATE_KEY || "").replace(/['"\\s\r\n]/g, "").trim();
const getAccounts = () => {
    if (!cleanKey) return [];
    // Ensure 0x prefix
    return [cleanKey.startsWith("0x") ? cleanKey : "0x" + cleanKey];
};

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
    solidity: "0.8.20",
    networks: {
        sepolia: {
            url: process.env.SEPOLIA_URL || "https://ethereum-sepolia-rpc.publicnode.com",
            accounts: getAccounts(),
        },
    },
    paths: {
        sources: "./contracts",
        tests: "./test",
        cache: "./cache",
        artifacts: "./artifacts",
    },
};
