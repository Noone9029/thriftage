export const marketplaceColors = {
  accent: '#D66B45',
  background: '#F4F0E7',
  border: '#E4DED2',
  danger: '#A53A34',
  forest: '#123F33',
  muted: '#6C716C',
  paper: '#FFFDF8',
  success: '#17664F',
  text: '#1B2621',
  white: '#FFFFFF',
} as const;

export function formatMoney(priceMinor: number, currency: string): string {
  const amount = priceMinor / 100;
  return `${currency} ${new Intl.NumberFormat('en-PK', {
    maximumFractionDigits: priceMinor % 100 === 0 ? 0 : 2,
    minimumFractionDigits: priceMinor % 100 === 0 ? 0 : 2,
  }).format(amount)}`;
}
