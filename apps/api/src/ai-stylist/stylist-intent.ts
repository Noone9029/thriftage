import type { ColorFamily, FitType, GarmentRole, StylistIntent } from '@thriftage/shared';

export interface StylistContextSnapshot {
  readonly intent?: StylistIntent;
  readonly lastOutfitItems?: readonly { readonly listingId: string; readonly role: GarmentRole }[];
  readonly lastTotalPriceMinor?: number;
}

const stylePhrases = new Map<string, string>([
  ['streetwear', 'streetwear'],
  ['old money', 'old-money'],
  ['vintage', 'vintage'],
  ['gothic', 'gothic'],
  ['y2k', 'y2k'],
  ['minimalist', 'minimalist'],
  ['formal', 'formal'],
  ['smart casual', 'smart-casual'],
  ['athleisure', 'athleisure'],
  ['techwear', 'techwear'],
]);
const colorPhrases = new Map<string, ColorFamily>([
  ['black', 'BLACK'],
  ['white', 'WHITE'],
  ['grey', 'GREY'],
  ['gray', 'GREY'],
  ['brown', 'BROWN'],
  ['beige', 'BEIGE'],
  ['red', 'RED'],
  ['orange', 'ORANGE'],
  ['yellow', 'YELLOW'],
  ['green', 'GREEN'],
  ['blue', 'BLUE'],
  ['purple', 'PURPLE'],
  ['pink', 'PINK'],
]);
const fitPhrases = new Map<string, FitType>([
  ['oversized', 'OVERSIZED'],
  ['relaxed', 'RELAXED'],
  ['regular', 'REGULAR'],
  ['slim', 'SLIM'],
  ['tailored', 'TAILORED'],
]);

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function budgetMinor(message: string): number | null {
  const match = message.match(
    /(?:(?:pkr|rs\.?|rupees?)\s*|(?:under|below|within|budget(?:\s+of)?|max(?:imum)?|keep\s+(?:it\s+)?under)\s*)(\d{1,3}(?:[,.]\d{3})+|\d+(?:\.\d+)?)\s*(k)?\b/i,
  );
  if (match?.[1] === undefined) return null;
  const numeric = Number(match[1].replaceAll(',', ''));
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  const rupees = match[2] === undefined ? numeric : numeric * 1000;
  return Math.round(rupees * 100);
}

function occasion(message: string): StylistIntent['occasion'] {
  if (/university|campus|class\b/i.test(message)) return 'UNIVERSITY';
  if (/wedding|mehndi|shaadi/i.test(message)) return 'WEDDING';
  if (/date\s*night|date\b/i.test(message)) return 'DATE_NIGHT';
  if (/gym|workout|training/i.test(message)) return 'GYM';
  if (/office|work\b|professional/i.test(message)) return 'WORK';
  if (/travel|flight|airport|trip/i.test(message)) return 'TRAVEL';
  if (/formal event|gala|ceremony/i.test(message)) return 'FORMAL_EVENT';
  if (/dinner/i.test(message)) return 'DINNER';
  if (/party/i.test(message)) return 'PARTY';
  if (/casual|chill|everyday/i.test(message)) return 'CASUAL_DAY';
  return null;
}

function requestedRoles(message: string): GarmentRole[] {
  const roles: GarmentRole[] = [];
  if (/shirt|tee|t-shirt|top|hoodie|sweater/i.test(message)) roles.push('TOP');
  if (/pants|trouser|jeans|skirt|bottom/i.test(message)) roles.push('BOTTOM');
  if (/dress\b/i.test(message)) roles.push('DRESS');
  if (/jacket|coat|blazer|outerwear/i.test(message)) roles.push('OUTERWEAR');
  if (/shoe|sneaker|heel|loafer|boot/i.test(message)) roles.push('SHOES');
  if (/bag/i.test(message)) roles.push('BAG');
  if (/jewelry|jewellery/i.test(message)) roles.push('JEWELRY');
  if (/accessor/i.test(message)) roles.push('ACCESSORY');
  return unique(roles);
}

export function isStylistRequestSupported(message: string): boolean {
  if (
    /reveal|show|print|repeat/.test(message.toLowerCase()) &&
    /system prompt|hidden prompt/.test(message.toLowerCase())
  )
    return false;
  const fashionSignal =
    /outfit|wear|style|fashion|look|clothes|clothing|shirt|top|hoodie|dress|pants|trouser|jeans|skirt|jacket|coat|shoe|sneaker|wedding|university|formal|casual|color|colour|fit|cheaper|modest|option/i;
  const clearlyOffTopic =
    /calculus|homework|source code|malware|essay|tax return|medical diagnosis/i;
  return fashionSignal.test(message) && !clearlyOffTopic.test(message);
}

export function isUnsafeStylistRequest(message: string): boolean {
  return /(?:child|minor|kid).{0,30}(?:sexy|sexual|seductive)|(?:sexy|sexual|seductive).{0,30}(?:child|minor|kid)/i.test(
    message,
  );
}

export function deriveStylistIntent(
  message: string,
  previous: StylistContextSnapshot | null,
  anchorListingId: string | undefined,
  maximumOptions: number,
): StylistIntent {
  const normalized = message.toLowerCase();
  const prior = previous?.intent;
  const explicitBudget = budgetMinor(message);
  const requestedStyles = [...stylePhrases.entries()]
    .filter(([phrase]) => normalized.includes(phrase))
    .map(([, slug]) => slug);
  const colors = [...colorPhrases.entries()]
    .filter(([phrase]) => new RegExp(`\\b${phrase}\\b`, 'i').test(message))
    .map(([, color]) => color);
  const excludedColors = [...colorPhrases.entries()]
    .filter(([phrase]) => new RegExp(`(?:no|not|avoid|without)\\s+${phrase}\\b`, 'i').test(message))
    .map(([, color]) => color);
  const fits = [...fitPhrases.entries()]
    .filter(([phrase]) => normalized.includes(phrase))
    .map(([, fit]) => fit);
  const optionMatch = message.match(/\b([1-9])\b(?:\s+[a-z-]+){0,8}\s+(?:outfit\s+)?options?\b/i);
  const wantsCheaper = /cheaper|less expensive|lower budget/i.test(message);
  const differentShoes =
    /different|replace|change/.test(normalized) && /shoe|sneaker/.test(normalized);
  const keepOuterwear = /keep\s+(?:the\s+)?(?:jacket|coat|blazer|outerwear)/i.test(message);
  const previousItems = previous?.lastOutfitItems ?? [];
  let lockedListingIds = prior?.lockedListingIds ?? [];
  if (keepOuterwear) {
    lockedListingIds = unique([
      ...lockedListingIds,
      ...previousItems.filter(({ role }) => role === 'OUTERWEAR').map(({ listingId }) => listingId),
    ]);
  }
  if (differentShoes && previousItems.length > 0) {
    lockedListingIds = previousItems
      .filter(({ role }) => role !== 'SHOES')
      .map(({ listingId }) => listingId);
  }
  const cheaperBudget = wantsCheaper
    ? Math.max(
        100,
        Math.floor((prior?.budgetMaxMinor ?? previous?.lastTotalPriceMinor ?? 1_000_000) * 0.8),
      )
    : null;
  const refinement: StylistIntent['refinement'] = wantsCheaper
    ? 'CHEAPER'
    : differentShoes
      ? 'DIFFERENT_SHOES'
      : /more formal/i.test(message)
        ? 'MORE_FORMAL'
        : /more casual|less formal/i.test(message)
          ? 'MORE_CASUAL'
          : /more modest/i.test(message)
            ? 'MORE_MODEST'
            : /different colou?r/i.test(message)
              ? 'DIFFERENT_COLORS'
              : /another|different option/i.test(message)
                ? 'ANOTHER_OPTION'
                : /bolder/i.test(message)
                  ? 'BOLDER'
                  : requestedStyles.length > 0 && prior !== undefined
                    ? 'STYLE_SHIFT'
                    : 'NONE';
  return {
    anchorListingId: anchorListingId ?? prior?.anchorListingId ?? null,
    budgetMaxMinor: explicitBudget ?? cheaperBudget ?? prior?.budgetMaxMinor ?? null,
    budgetMinMinor: prior?.budgetMinMinor ?? null,
    colors: unique(colors.filter((value) => !excludedColors.includes(value))).slice(0, 5),
    currency: prior?.currency ?? 'PKR',
    excludedColors: unique([...(prior?.excludedColors ?? []), ...excludedColors]).slice(0, 5),
    freeTextObjective: message,
    lockedListingIds,
    modesty: /modest/i.test(message) ? true : (prior?.modesty ?? null),
    occasion: occasion(message) ?? prior?.occasion ?? null,
    optionCount: Math.min(
      maximumOptions,
      Number(optionMatch?.[1] ?? (refinement === 'ANOTHER_OPTION' ? 1 : (prior?.optionCount ?? 1))),
    ),
    preferredFits: fits.length > 0 ? unique(fits) : (prior?.preferredFits ?? []),
    refinement,
    requestedGarmentRoles: unique([
      ...(prior?.requestedGarmentRoles ?? []),
      ...requestedRoles(message),
    ]).slice(0, 8),
    requestedStyles:
      requestedStyles.length > 0 ? unique(requestedStyles) : (prior?.requestedStyles ?? []),
    sizeConstraints: prior?.sizeConstraints ?? [],
  };
}

export function deterministicConversationTitle(message: string): string {
  const intentOccasion = occasion(message);
  if (intentOccasion !== null)
    return `${intentOccasion
      .replaceAll('_', ' ')
      .toLowerCase()
      .replace(/^./, (c) => c.toUpperCase())} outfit`;
  const trimmed = message.trim().replace(/\s+/g, ' ');
  return trimmed.length <= 60 ? trimmed : `${trimmed.slice(0, 57)}...`;
}
