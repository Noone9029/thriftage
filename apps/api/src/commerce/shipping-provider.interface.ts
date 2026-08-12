export const SHIPPING_PROVIDER = Symbol('SHIPPING_PROVIDER');

export interface ShippingProvider {
  validateManualShipment(input: {
    readonly providerDisplayName: string;
    readonly trackingNumber: string | null;
    readonly trackingUrl: string | null;
  }): Promise<void>;
}
