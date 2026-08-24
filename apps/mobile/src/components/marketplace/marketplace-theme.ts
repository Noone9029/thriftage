import type { ViewStyle } from 'react-native';

export const marketplaceColors = {
  accent: '#F06543',
  accentDeep: '#C94C2E',
  accentSoft: '#FCE6DC',
  background: '#F6F2EA',
  border: '#E3DDD2',
  borderStrong: '#CDC4B7',
  danger: '#A63D3A',
  dangerSoft: '#F9E7E4',
  forest: '#163D32',
  forestDeep: '#0E2B23',
  forestSoft: '#DFE9E3',
  gold: '#C99032',
  ink: '#111815',
  muted: '#68716C',
  mutedLight: '#909791',
  paper: '#FFFCF7',
  sand: '#ECE5D8',
  success: '#24705A',
  successSoft: '#E1EEE8',
  text: '#1B2521',
  white: '#FFFFFF',
} as const;

export const marketplaceSpacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  section: 40,
} as const;

export const marketplaceRadii = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  hero: 30,
  pill: 999,
} as const;

export const marketplaceShadows = {
  card: {
    elevation: 2,
    shadowColor: '#10231C',
    shadowOffset: { height: 3, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
  } satisfies ViewStyle,
  floating: {
    elevation: 8,
    shadowColor: '#10231C',
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.17,
    shadowRadius: 18,
  } satisfies ViewStyle,
} as const;

const wholePriceFormatter = new Intl.NumberFormat('en-PK', {
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});
const decimalPriceFormatter = new Intl.NumberFormat('en-PK', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

export function formatMoney(priceMinor: number, currency: string): string {
  const amount = priceMinor / 100;
  const formatter = priceMinor % 100 === 0 ? wholePriceFormatter : decimalPriceFormatter;
  return `${currency} ${formatter.format(amount)}`;
}
