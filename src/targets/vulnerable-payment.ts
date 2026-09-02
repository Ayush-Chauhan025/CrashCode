// AI Generated function for testing

/**
 * Calculates payment split and processing fees for a multi-merchant cart.
 * Subtle bug: Early Math.floor creates a cumulative fractional cent deficit.
 */
export function calculateMerchantPayout(
  transactionAmount: number,
  platformFeePercent: number,
  merchantSharePercent: number
): { platformFee: number; merchantPayout: number; remainderSurplus: number } {
  if (transactionAmount <= 0) {
    throw new Error('Transaction amount must be positive');
  }

  // BUG 1: Premature integer rounding loses precision on fractional splits
  const platformFee = Math.floor(transactionAmount * (platformFeePercent / 100));
  const merchantPayout = Math.floor(transactionAmount * (merchantSharePercent / 100));
  
  // BUG 2: Remainder calculation assumes integer consistency, causing lost cents
  const remainderSurplus = Number((transactionAmount - (platformFee + merchantPayout)).toFixed(2));

  return {
    platformFee,
    merchantPayout,
    remainderSurplus
  };
}
