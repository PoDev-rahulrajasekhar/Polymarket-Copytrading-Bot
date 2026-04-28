#!/usr/bin/env ts-node
/**
 * Wallet Balance Utility
 *
 * Prints:
 * - EOA address (from PRIVATE_KEY)
 * - Polymarket proxy wallet address (on-chain)
 * - CLOB Polymarket USD (pUSD) balance + allowance
 * - Available pUSD (balance minus reserved in open BUY orders)
 * - On-chain pUSD balances (EOA + proxy wallet)
 *
 * Usage:
 *   npm run balance
 *   ts-node src/other/wallet-balance.ts
 */

import { Wallet } from "@ethersproject/wallet";
import { AssetType, Chain } from "@polymarket/clob-client-v2";
import { env, POLYMARKET_COLLATERAL_LABEL, POLYMARKET_COLLATERAL_SHORT } from "../config/env";
import { getClobClient } from "../providers/clobclient";
import { displayWalletBalance, getAvailableBalance } from "../utils/balance";
import { getUsdcBalance } from "../utils/usdcBalance";
import { getPolymarketProxyWalletAddress } from "../utils/proxyWallet";

async function main() {
    console.log("💰 WALLET BALANCE");

    const privateKey = env.PRIVATE_KEY;
    if (!privateKey) {
        console.log("❌ PRIVATE_KEY not set in .env");
        process.exit(1);
    }

    const chainId = env.CHAIN_ID as Chain;
    const eoa = new Wallet(privateKey);

    console.log("═══════════════════════════════════════");
    console.log("🔑 WALLET INFO");
    console.log("═══════════════════════════════════════");
    console.log(`Chain ID: ${chainId}`);
    console.log(`EOA Address: ${eoa.address}`);

    // Proxy wallet (on-chain)
    let proxyWallet: string | null = null;
    try {
        proxyWallet = await getPolymarketProxyWalletAddress(eoa.address, chainId);
        console.log(`Proxy Wallet: ${proxyWallet}`);
    } catch (e) {
        console.log(`⚠️  Failed to resolve proxy wallet: ${e instanceof Error ? e.message : String(e)}`);
        console.log(`Proxy Wallet (env default): ${env.PROXY_WALLET_ADDRESS}`);
        proxyWallet = env.PROXY_WALLET_ADDRESS;
    }

    console.log("═══════════════════════════════════════");

    // CLOB balance/allowance + available collateral
    try {
        const clob = await getClobClient();
        await displayWalletBalance(clob);
        const available = await getAvailableBalance(clob, AssetType.COLLATERAL);
        console.log(`Available ${POLYMARKET_COLLATERAL_SHORT} (minus open BUY orders): ${available.toFixed(6)}`);
    } catch (e) {
        console.log(`⚠️  Could not fetch CLOB balance/allowance: ${e instanceof Error ? e.message : String(e)}`);
        console.log("   (Tip: ensure src/data/credential.json exists and CLOB credentials are valid.)");
    }

    // On-chain pUSD balances
    try {
        const [eoaUsdc, proxyUsdc] = await Promise.all([
            getUsdcBalance(eoa.address, chainId),
            proxyWallet ? getUsdcBalance(proxyWallet, chainId) : Promise.resolve(0),
        ]);

        console.log("═══════════════════════════════════════");
        console.log(`⛓️  ON-CHAIN ${POLYMARKET_COLLATERAL_LABEL}`);
        console.log("═══════════════════════════════════════");
        console.log(`EOA ${POLYMARKET_COLLATERAL_SHORT}: ${eoaUsdc.toFixed(6)}`);
        console.log(`Proxy ${POLYMARKET_COLLATERAL_SHORT}: ${proxyUsdc.toFixed(6)}`);
        console.log("═══════════════════════════════════════");
    } catch (e) {
        console.log(`⚠️  Could not fetch on-chain ${POLYMARKET_COLLATERAL_SHORT} balance: ${e instanceof Error ? e.message : String(e)}`);
    }
}

main().catch((e) => {
    console.log("Fatal error", e);
    process.exit(1);
});

