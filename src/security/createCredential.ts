import { ApiKeyCreds, ClobClient, Chain } from "@polymarket/clob-client-v2";
import { writeFileSync, existsSync, readFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { Wallet } from "@ethersproject/wallet";
import { env } from "../config/env";

export const CREDENTIAL_RELATIVE_PATH = "src/data/credential.json";

export function getCredentialPath(): string {
    return resolve(process.cwd(), CREDENTIAL_RELATIVE_PATH);
}

function isValidCreds(c: unknown): c is ApiKeyCreds {
    if (!c || typeof c !== "object") return false;
    const o = c as Record<string, unknown>;
    return (
        typeof o.key === "string" &&
        o.key.length > 0 &&
        typeof o.secret === "string" &&
        o.secret.length > 0 &&
        typeof o.passphrase === "string" &&
        o.passphrase.length > 0
    );
}

/**
 * L1 client for API key derive/create only (EOA signer; no L2 creds yet).
 * `useServerTime` avoids clock-skew rejects on auth headers.
 */
function l1ClientForApiKey(wallet: Wallet, chainId: Chain, host: string): ClobClient {
    return new ClobClient({
        host,
        chain: chainId,
        signer: wallet,
        useServerTime: true,
    });
}

/**
 * Polymarket: existing accounts usually need deriveApiKey; new accounts need createApiKey.
 * Package `createOrDeriveApiKey()` calls create first — if create returns 400, the promise rejects
 * and derive never runs. We derive first, then create.
 */
export async function fetchApiKeyFromServer(wallet: Wallet, chainId: Chain, host: string): Promise<ApiKeyCreds> {
    const client = l1ClientForApiKey(wallet, chainId, host);
    try {
        const derived = await client.deriveApiKey();
        if (isValidCreds(derived)) {
            console.log("CLOB API credentials derived (existing key).");
            return derived;
        }
    } catch {
        // No stored L2 key for this signer yet — fall through to create
    }
    const created = await client.createApiKey();
    if (!isValidCreds(created)) {
        throw new Error("createApiKey returned invalid credentials");
    }
    console.log("CLOB API credentials created (new key).");
    return created;
}

export async function saveCredential(credential: ApiKeyCreds): Promise<void> {
    const credentialPath = getCredentialPath();
    mkdirSync(dirname(credentialPath), { recursive: true });
    writeFileSync(credentialPath, JSON.stringify(credential, null, 2));
}

/**
 * Ensure `src/data/credential.json` exists with valid L2 credentials from Polymarket CLOB (L1 derive/create).
 * Call on startup instead of assuming the file is already present.
 */
export async function ensureCredentialOnDisk(): Promise<ApiKeyCreds> {
    const credentialPath = getCredentialPath();
    if (existsSync(credentialPath)) {
        try {
            const raw = JSON.parse(readFileSync(credentialPath, "utf-8"));
            if (isValidCreds(raw)) {
                return raw as ApiKeyCreds;
            }
        } catch {
            // Re-fetch from server
        }
    }

    const privateKey = env.PRIVATE_KEY;
    if (!privateKey) {
        throw new Error("PRIVATE_KEY is not set in .env — cannot obtain CLOB API credentials.");
    }

    const wallet = new Wallet(privateKey);
    console.log(`Wallet address (signer): ${wallet.address}`);
    const chainId = env.CHAIN_ID as Chain;
    const host = env.CLOB_API_URL;

    const credential = await fetchApiKeyFromServer(wallet, chainId, host);
    await saveCredential(credential);
    console.log(`Credentials saved to ${credentialPath}`);
    return credential;
}

/** @deprecated Prefer ensureCredentialOnDisk(); kept for scripts that expect null on failure */
export async function createCredential(): Promise<ApiKeyCreds | null> {
    try {
        return await ensureCredentialOnDisk();
    } catch (error) {
        console.log(`Error creating credential: ${error instanceof Error ? error.message : String(error)}`);
        return null;
    }
}
