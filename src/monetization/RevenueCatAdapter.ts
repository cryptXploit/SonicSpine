import { Capacitor } from '@capacitor/core';
import { Purchases, LOG_LEVEL } from '@revenuecat/purchases-capacitor';
import { EntitlementService, EntitlementStatus } from './EntitlementService';

export class RevenueCatAdapter implements EntitlementService {
  private isInitialized = false;

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // We only want to initialize RevenueCat on native devices. 
    // On web, we will gracefully degrade to a FREE mock or avoid calling it entirely.
    if (!Capacitor.isNativePlatform()) {
      console.log('RevenueCat is not supported on Web. Defaulting to FREE mode.');
      this.isInitialized = true;
      return;
    }

    try {
      const apiKey = import.meta.env.VITE_REVENUECAT_PUBLIC_KEY;
      
      if (!apiKey) {
        console.warn('VITE_REVENUECAT_PUBLIC_KEY is not defined. Monetization disabled.');
        this.isInitialized = true;
        return;
      }

      await Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG });
      
      if (Capacitor.getPlatform() === 'android') {
        await Purchases.configure({ apiKey });
      } 
      // Add iOS config block here if iOS support is needed later.

      this.isInitialized = true;
    } catch (e) {
      console.error('Failed to initialize RevenueCat:', e);
    }
  }

  public async checkEntitlement(): Promise<EntitlementStatus> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!Capacitor.isNativePlatform()) {
      return 'FREE'; // Web fallback
    }

    try {
      const customerInfo = await Purchases.getCustomerInfo();
      // Assuming 'pro' is the entitlement identifier setup in RevenueCat dashboard
      if (customerInfo.customerInfo.entitlements.active['pro']) {
        return 'PRO';
      }
      return 'FREE';
    } catch (e) {
      console.error('Error fetching customer info:', e);
      return 'ERROR';
    }
  }

  public async purchasePro(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) {
      alert('Purchases are only available on the mobile app.');
      return false;
    }

    try {
      const offerings = await Purchases.getOfferings();
      if (offerings.current !== null && offerings.current.availablePackages.length !== 0) {
        // Buy the first available package
        const packageToBuy = offerings.current.availablePackages[0];
        const purchaseResult = await Purchases.purchasePackage({ aPackage: packageToBuy });
        
        if (purchaseResult.customerInfo.entitlements.active['pro']) {
          return true;
        }
      }
      return false;
    } catch (e: any) {
      if (e.code === 'PURCHASE_CANCELLED') {
        console.log('User cancelled purchase.');
      } else {
        console.error('Purchase failed:', e);
      }
      return false;
    }
  }

  public async restorePurchases(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) {
      return false;
    }

    try {
      const restoreResult = await Purchases.restorePurchases();
      if (restoreResult.customerInfo.entitlements.active['pro']) {
        return true;
      }
      return false;
    } catch (e) {
      console.error('Restore failed:', e);
      return false;
    }
  }
}

// Export a singleton instance
export const entitlementService = new RevenueCatAdapter();
