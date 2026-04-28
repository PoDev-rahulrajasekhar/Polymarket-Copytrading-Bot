import { Zero, MaxUint256 } from "@ethersproject/constants";
import { BigNumber } from "@ethersproject/bignumber";
import { parseUnits } from "@ethersproject/units";
import { Wallet } from "@ethersproject/wallet";
import { JsonRpcProvider } from "@ethersproject/providers";
import { Contract } from "@ethersproject/contracts";
import { Chain, AssetType, ClobClient } from "@polymarket/clob-client-v2";
import { getContractConfig } from "@polymarket/clob-client-v2";
import { env, getRpcUrl, POLYMARKET_COLLATERAL_LABEL } from "../config/env";

// Minimal ERC20 ABI (approve / allowance) for CLOB collateral token (pUSD)
const COLLATERAL_ERC20_ABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) external view returns (uint256)",
];

// Minimal ERC1155 ABI for ConditionalTokens
const CTF_ABI = [
    "function setApprovalForAll(address operator, bool approved) external",
    "function isApprovedForAll(address account, address operator) external view returns (bool)",
];


/**
 * Approve Polymarket USD (pUSD) collateral to Polymarket contracts (max allowance).
 * Approves the CTF collateral token for ConditionalTokens, Exchange, and (if NEG_RISK) neg-risk contracts.
 */
export async function approveUSDCAllowance(): Promise<void> {
    const privateKey = env.PRIVATE_KEY;
    if (!privateKey) {
        throw new Error("PRIVATE_KEY not found in environment");
    }

    const chainId = env.CHAIN_ID as Chain;
    const contractConfig = getContractConfig(chainId);
    
    const rpcUrl = getRpcUrl(chainId);
    const provider = new JsonRpcProvider(rpcUrl);
    const wallet = new Wallet(privateKey, provider);
    
    const address = await wallet.getAddress();
    console.log(`Approving ${POLYMARKET_COLLATERAL_LABEL} allowances for address: ${address}, chainId: ${chainId}`);
    console.log(`${POLYMARKET_COLLATERAL_LABEL} token: ${contractConfig.collateral}`);
    console.log(`ConditionalTokens Contract: ${contractConfig.conditionalTokens}`);
    console.log(`Exchange Contract: ${contractConfig.exchange}`);

    const collateralContract = new Contract(contractConfig.collateral, COLLATERAL_ERC20_ABI, wallet);

    // Configure gas options
    let gasOptions: { gasPrice?: BigNumber; gasLimit?: number } = {};
    try {
        const gasPrice = await provider.getGasPrice();
        gasOptions = {
            gasPrice: gasPrice.mul(120).div(100), // 20% buffer
            gasLimit: 200_000,
        };
    } catch (error) {
        console.log("Could not fetch gas price, using fallback");
        gasOptions = {
            gasPrice: parseUnits("100", "gwei"),
            gasLimit: 200_000,
        };
    }

    const ctfAllowance = await collateralContract.allowance(address, contractConfig.conditionalTokens);
    if (!ctfAllowance.eq(MaxUint256)) {
        console.log(`Current CTF allowance: ${ctfAllowance.toString()}, setting to MaxUint256...`);
        const tx = await collateralContract.approve(contractConfig.conditionalTokens, MaxUint256, gasOptions);
        console.log(`Transaction hash: ${tx.hash}`);
        await tx.wait();
        console.log(`✅ ${POLYMARKET_COLLATERAL_LABEL} approved for ConditionalTokens contract`);
    } else {
        console.log(`✅ ${POLYMARKET_COLLATERAL_LABEL} already approved for ConditionalTokens contract (MaxUint256)`);
    }

    const exchangeAllowance = await collateralContract.allowance(address, contractConfig.exchange);
    if (!exchangeAllowance.eq(MaxUint256)) {
        console.log(`Current Exchange allowance: ${exchangeAllowance.toString()}, setting to MaxUint256...`);
        const tx = await collateralContract.approve(contractConfig.exchange, MaxUint256, gasOptions);
        console.log(`Transaction hash: ${tx.hash}`);
        await tx.wait();
        console.log(`✅ ${POLYMARKET_COLLATERAL_LABEL} approved for Exchange contract`);
    } else {
        console.log(`✅ ${POLYMARKET_COLLATERAL_LABEL} already approved for Exchange contract (MaxUint256)`);
    }

    // Check and approve ConditionalTokens (ERC1155) for Exchange contract
    const ctfContract = new Contract(contractConfig.conditionalTokens, CTF_ABI, wallet);
    const isApproved = await ctfContract.isApprovedForAll(address, contractConfig.exchange);
    
    if (!isApproved) {
        console.log("Approving ConditionalTokens for Exchange contract...");
        const tx = await ctfContract.setApprovalForAll(contractConfig.exchange, true, gasOptions);
        console.log(`Transaction hash: ${tx.hash}`);
        await tx.wait();
        console.log("✅ ConditionalTokens approved for Exchange contract");
    } else {
        console.log("✅ ConditionalTokens already approved for Exchange contract");
    }

    const negRisk = env.NEG_RISK;
    if (negRisk) {
        const negRiskAdapterAllowance = await collateralContract.allowance(address, contractConfig.negRiskAdapter);
        if (!negRiskAdapterAllowance.eq(MaxUint256)) {
            console.log(`Current NegRiskAdapter allowance: ${negRiskAdapterAllowance.toString()}, setting to MaxUint256...`);
            const tx = await collateralContract.approve(contractConfig.negRiskAdapter, MaxUint256, gasOptions);
            console.log(`Transaction hash: ${tx.hash}`);
            await tx.wait();
            console.log(`✅ ${POLYMARKET_COLLATERAL_LABEL} approved for NegRiskAdapter`);
        }

        const negRiskExchangeAllowance = await collateralContract.allowance(address, contractConfig.negRiskExchange);
        if (!negRiskExchangeAllowance.eq(MaxUint256)) {
            console.log(`Current NegRiskExchange allowance: ${negRiskExchangeAllowance.toString()}, setting to MaxUint256...`);
            const tx = await collateralContract.approve(contractConfig.negRiskExchange, MaxUint256, gasOptions);
            console.log(`Transaction hash: ${tx.hash}`);
            await tx.wait();
            console.log(`✅ ${POLYMARKET_COLLATERAL_LABEL} approved for NegRiskExchange`);
        }

        // Approve ConditionalTokens for NegRiskExchange
        const isNegRiskApproved = await ctfContract.isApprovedForAll(address, contractConfig.negRiskExchange);
        if (!isNegRiskApproved) {
            console.log("Approving ConditionalTokens for NegRiskExchange...");
            const tx = await ctfContract.setApprovalForAll(contractConfig.negRiskExchange, true, gasOptions);
            console.log(`Transaction hash: ${tx.hash}`);
            await tx.wait();
            console.log("✅ ConditionalTokens approved for NegRiskExchange");
        }

        // Approve ConditionalTokens for NegRiskAdapter
        const isNegRiskAdapterApproved = await ctfContract.isApprovedForAll(address, contractConfig.negRiskAdapter);
        if (!isNegRiskAdapterApproved) {
            console.log("Approving ConditionalTokens for NegRiskAdapter...");
            const tx = await ctfContract.setApprovalForAll(contractConfig.negRiskAdapter, true, gasOptions);
            console.log(`Transaction hash: ${tx.hash}`);
            await tx.wait();
            console.log("✅ ConditionalTokens approved for NegRiskAdapter");
        }
    }

    console.log("All allowances approved successfully!");
}

/**
 * Update balance allowance in CLOB API after setting on-chain allowances
 * This syncs the on-chain allowance state with the CLOB API
 */
export async function updateClobBalanceAllowance(client: ClobClient): Promise<void> {
    try {
        console.log(`Updating CLOB API balance allowance for ${POLYMARKET_COLLATERAL_LABEL}...`);
        await client.updateBalanceAllowance({ asset_type: AssetType.COLLATERAL });
        console.log(`✅ CLOB API balance allowance updated for ${POLYMARKET_COLLATERAL_LABEL}`);
    } catch (error) {
        console.log(`Failed to update CLOB balance allowance: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
    }
}

/**
 * Approve ConditionalTokens for Exchange after buying tokens
 * This ensures tokens are approved immediately after purchase so they can be sold without delay
 * Note: ERC1155 uses setApprovalForAll which approves all tokens at once (including newly bought ones)
 */
export async function approveTokensAfterBuy(): Promise<void> {
    const privateKey = env.PRIVATE_KEY;
    if (!privateKey) {
        throw new Error("PRIVATE_KEY not found in environment");
    }

    const chainId = env.CHAIN_ID as Chain;
    const contractConfig = getContractConfig(chainId);
    
    const rpcUrl = getRpcUrl(chainId);
    const provider = new JsonRpcProvider(rpcUrl);
    const wallet = new Wallet(privateKey, provider);
    
    const address = await wallet.getAddress();
    const ctfContract = new Contract(contractConfig.conditionalTokens, CTF_ABI, wallet);

    // Configure gas options
    let gasOptions: { gasPrice?: BigNumber; gasLimit?: number } = {};
    try {
        const gasPrice = await provider.getGasPrice();
        gasOptions = {
            gasPrice: gasPrice.mul(120).div(100), // 20% buffer
            gasLimit: 200_000,
        };
    } catch (error) {
        gasOptions = {
            gasPrice: parseUnits("100", "gwei"),
            gasLimit: 200_000,
        };
    }

    // Check if ConditionalTokens are approved for Exchange
    const isApproved = await ctfContract.isApprovedForAll(address, contractConfig.exchange);
    
    if (!isApproved) {
        console.log("Approving ConditionalTokens for Exchange (after buy)...");
        const tx = await ctfContract.setApprovalForAll(contractConfig.exchange, true, gasOptions);
        console.log(`Transaction hash: ${tx.hash}`);
        await tx.wait();
        console.log("✅ ConditionalTokens approved for Exchange");
    }

    if (env.NEG_RISK) {
        const isNegRiskApproved = await ctfContract.isApprovedForAll(address, contractConfig.negRiskExchange);
        if (!isNegRiskApproved) {
            console.log("Approving ConditionalTokens for NegRiskExchange (after buy)...");
            const tx = await ctfContract.setApprovalForAll(contractConfig.negRiskExchange, true, gasOptions);
            console.log(`Transaction hash: ${tx.hash}`);
            await tx.wait();
            console.log("✅ ConditionalTokens approved for NegRiskExchange");
        }
    }
}

