import { Side, OrderType, type UserMarketOrderV2, CreateOrderOptions } from "@polymarket/clob-client-v2";
import type { TradePayload } from "../utils/types";

/**
 * Options for copying a trade
 */
export interface CopyTradeOptions {
    /**
     * The trade payload to copy
     */
    trade: TradePayload;
    
    /**
     * Multiplier for the trade size (default: 1.0)
     * Example: 0.5 = copy with 50% of the original size
     */
    sizeMultiplier?: number;
    
    /**
     * Maximum amount to spend on a BUY order (Polymarket USD / pUSD).
     * If not set, uses the calculated amount from size and price
     */
    maxAmount?: number;
    
    /**
     * Fixed token amount for BUY (overrides sizeMultiplier/maxAmount when set).
     * pUSD notional ≈ trade.price * orderSizeTokens.
     */
    orderSizeTokens?: number;
    
    /**
     * Fixed pUSD amount for BUY (fast path, no price calc).
     * Overrides orderSizeTokens when set.
     */
    orderAmountUsdc?: number;
    
    /**
     * Order type for market orders (default: FAK)
     */
    orderType?: OrderType.FOK | OrderType.FAK;
    
    /**
     * Tick size for the order (default: "0.01")
     */
    tickSize?: CreateOrderOptions["tickSize"];
    
    /**
     * Whether to use negRisk exchange (default: false)
     */
    negRisk?: boolean;
}

/**
 * Result of placing a copied trade order
 */
export interface CopyTradeResult {
    /**
     * Whether the order was successfully placed
     */
    success: boolean;
    
    /**
     * Order ID if successful
     */
    orderID?: string;
    
    /**
     * Error message if failed
     */
    error?: string;
    
    /**
     * Transaction hashes
     */
    transactionHashes?: string[];
    
    /**
     * The market order that was created
     */
    marketOrder?: UserMarketOrderV2;
}

