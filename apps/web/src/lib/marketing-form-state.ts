export interface MarketingFormState {
  readonly fieldErrors: Readonly<Record<string, readonly string[]>>;
  readonly message: string;
  readonly status: 'IDLE' | 'SUCCESS' | 'DUPLICATE' | 'VALIDATION_ERROR' | 'RATE_LIMITED' | 'ERROR';
}

export const initialMarketingFormState: MarketingFormState = {
  fieldErrors: {},
  message: '',
  status: 'IDLE',
};
