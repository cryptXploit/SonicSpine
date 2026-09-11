export type EntitlementStatus = 'FREE' | 'PRO' | 'ERROR' | 'UNKNOWN';

export interface EntitlementService {
  /**
   * Initializes the monetization SDK safely depending on the platform.
   */
  initialize(): Promise<void>;

  /**
   * Returns the user's current entitlement status.
   */
  checkEntitlement(): Promise<EntitlementStatus>;

  /**
   * Initiates the purchase flow for the PRO tier.
   */
  purchasePro(): Promise<boolean>;

  /**
   * Restores previous purchases.
   */
  restorePurchases(): Promise<boolean>;
}
