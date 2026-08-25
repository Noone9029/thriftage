'use client';

export type MarketingEventName =
  | 'hero_beta_clicked'
  | 'hero_sell_clicked'
  | 'beta_form_submitted'
  | 'seller_form_submitted'
  | 'section_viewed';

export interface MarketingEventDetail {
  readonly name: MarketingEventName;
  readonly properties?: Readonly<Record<string, string>>;
}

declare global {
  interface WindowEventMap {
    'thriftage:analytics': CustomEvent<MarketingEventDetail>;
  }
}

export function emitMarketingEvent(detail: MarketingEventDetail): void {
  window.dispatchEvent(new CustomEvent('thriftage:analytics', { detail }));
}
