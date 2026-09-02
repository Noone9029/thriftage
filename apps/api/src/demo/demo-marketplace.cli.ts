import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { getPrismaClient, type PrismaClient } from '@thriftage/db';
import sharp from 'sharp';

import { ListingImageProcessor } from '../listing-media/listing-image-processor';
import { SupabaseListingImageStorageAdapter } from '../listing-media/supabase-listing-image-storage.adapter';
import { SupabaseProfileImageStorageAdapter } from '../profiles/supabase-profile-image-storage.adapter';
import {
  DEMO_NAMESPACE,
  activeDemoListings,
  demoAudience,
  demoListings,
  demoQaProfiles,
  demoSellers,
  type DemoListing,
} from './demo-marketplace.manifest';
import { assertDemoSeedTarget } from './demo-safety';

const prisma = getPrismaClient(process.env.DATABASE_URL, { max: 4 });
const repoRoot = path.resolve(__dirname, '../../../..');
const sourceAssetDirectory = path.join(repoRoot, 'apps/api/demo-assets/source');
const imageManifestPath = path.join(repoRoot, 'docs/demo/demo-image-manifest.csv');
const imageStorage = new SupabaseListingImageStorageAdapter();
const profileStorage = new SupabaseProfileImageStorageAdapter();
const imageProcessor = new ListingImageProcessor();

function stableUuid(label: string): string {
  const bytes = createHash('sha256').update(`${DEMO_NAMESPACE}:${label}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function daysAgo(days: number, hours = 0): Date {
  return new Date(Date.now() - (days * 24 + hours) * 3_600_000);
}

function listingId(listing: DemoListing): string {
  return stableUuid(`listing:${listing.seller}:${slugify(listing.title)}`);
}

function sellerId(username: string): string {
  return stableUuid(`seller:${username}`);
}

function audienceId(index: number): string {
  return stableUuid(`audience:${String(index + 1).padStart(2, '0')}`);
}

function imageKey(listing: DemoListing, position: number): string {
  return `listings/${sellerId(listing.seller)}/${listingId(listing)}/${stableUuid(`image-object:${listingId(listing)}:${position}`)}.webp`;
}

function avatarKey(username: string): string {
  return `profiles/${sellerId(username)}/${stableUuid(`avatar-object:${username}`)}.webp`;
}

async function mapConcurrent<T>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (cursor < items.length) {
        const index = cursor++;
        const item = items[index];
        if (item !== undefined) await worker(item, index);
      }
    }),
  );
}

async function assertReservedIdsAreSafe(): Promise<void> {
  const expectedUserIds = [
    ...demoSellers.map(({ username }) => sellerId(username)),
    ...demoAudience.map((_, index) => audienceId(index)),
  ];
  const conflictingUsers = await prisma.user.findMany({
    select: { authProviderUserId: true, id: true },
    where: {
      id: { in: expectedUserIds },
      NOT: { authProviderUserId: { startsWith: `${DEMO_NAMESPACE}:` } },
    },
  });
  if (conflictingUsers.length > 0)
    throw new Error('Refusing to overwrite a non-demo user at a reserved ID.');

  const expectedListingIds = demoListings.map(listingId);
  const conflictingListings = await prisma.listing.findMany({
    select: { id: true },
    where: {
      id: { in: expectedListingIds },
      seller: { NOT: { authProviderUserId: { startsWith: `${DEMO_NAMESPACE}:` } } },
    },
  });
  if (conflictingListings.length > 0)
    throw new Error('Refusing to overwrite a non-demo listing at a reserved ID.');
}

function avatarSvg(fullName: string, username: string): Buffer {
  const initials = fullName
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const hue =
    Number.parseInt(createHash('sha256').update(username).digest('hex').slice(0, 4), 16) % 360;
  return Buffer.from(
    `<svg width="800" height="800" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="hsl(${hue} 42% 32%)"/><stop offset="1" stop-color="hsl(${(hue + 35) % 360} 46% 58%)"/></linearGradient></defs><rect width="800" height="800" rx="400" fill="url(#g)"/><circle cx="400" cy="400" r="300" fill="none" stroke="rgba(255,255,255,.2)" stroke-width="4"/><text x="400" y="450" text-anchor="middle" font-family="Arial, sans-serif" font-size="230" font-weight="700" fill="#fff">${initials}</text></svg>`,
  );
}

async function seedUsersAndProfiles(): Promise<void> {
  for (const seller of demoSellers) {
    const id = sellerId(seller.username);
    const authProviderUserId = `${DEMO_NAMESPACE}:seller:${seller.username}`;
    await prisma.user.upsert({
      where: { authProviderUserId },
      create: {
        id,
        authProviderUserId,
        fullName: seller.fullName,
        accountStatus: 'ACTIVE',
        role: 'USER',
      },
      update: { fullName: seller.fullName, accountStatus: 'ACTIVE', deletedAt: null },
    });
    const key = avatarKey(seller.username);
    const existing = await prisma.profile.findUnique({
      where: { userId: id },
      select: { profileImageKey: true },
    });
    if (existing?.profileImageKey !== key) {
      const body = await sharp(avatarSvg(seller.fullName, seller.username))
        .webp({ quality: 88 })
        .toBuffer();
      try {
        await profileStorage.upload(key, body);
      } catch {
        // A reserved object can survive an interrupted first run; the deterministic key is safe to reuse.
      }
    }
    await prisma.profile.upsert({
      where: { userId: id },
      create: {
        id: stableUuid(`profile:${seller.username}`),
        userId: id,
        username: seller.username,
        bio: `${seller.bio} Based in ${seller.location}.`,
        university: seller.university,
        profileImageKey: key,
        profileImageUrl: profileStorage.getPublicUrl(key),
      },
      update: {
        username: seller.username,
        bio: `${seller.bio} Based in ${seller.location}.`,
        university: seller.university,
        profileImageKey: key,
        profileImageUrl: profileStorage.getPublicUrl(key),
      },
    });
  }
  for (const [index, audience] of demoAudience.entries()) {
    await prisma.user.upsert({
      where: { authProviderUserId: audience.authProviderUserId },
      create: {
        id: audienceId(index),
        authProviderUserId: audience.authProviderUserId,
        fullName: audience.fullName,
        accountStatus: 'ACTIVE',
        role: 'USER',
      },
      update: { fullName: audience.fullName, accountStatus: 'ACTIVE', deletedAt: null },
    });
  }
}

function listingDates(listing: DemoListing, index: number) {
  const createdAt = daysAgo((index % 16) + 1, index % 8);
  if (listing.status === 'ACTIVE')
    return {
      createdAt,
      submittedAt: createdAt,
      moderatedAt: createdAt,
      activatedAt: createdAt,
      archivedAt: null,
    };
  if (listing.status === 'SOLD')
    return {
      createdAt: daysAgo(70 - index),
      submittedAt: daysAgo(68 - index),
      moderatedAt: daysAgo(67 - index),
      activatedAt: daysAgo(66 - index),
      archivedAt: null,
    };
  if (listing.status === 'PENDING_REVIEW')
    return {
      createdAt,
      submittedAt: daysAgo(1, index),
      moderatedAt: null,
      activatedAt: null,
      archivedAt: null,
    };
  if (listing.status === 'REJECTED')
    return {
      createdAt,
      submittedAt: daysAgo(5),
      moderatedAt: daysAgo(4),
      activatedAt: null,
      archivedAt: null,
    };
  if (listing.status === 'ARCHIVED')
    return {
      createdAt: daysAgo(100 + index),
      submittedAt: daysAgo(98 + index),
      moderatedAt: daysAgo(97 + index),
      activatedAt: daysAgo(96 + index),
      archivedAt: daysAgo(20 + index),
    };
  return { createdAt, submittedAt: null, moderatedAt: null, activatedAt: null, archivedAt: null };
}

async function seedListings(): Promise<void> {
  const categories = new Map(
    (await prisma.category.findMany()).map((item) => [item.slug, item.id]),
  );
  const styles = new Map(
    (await prisma.styleDefinition.findMany()).map((item) => [item.slug, item.id]),
  );
  for (const [index, listing] of demoListings.entries()) {
    const categoryId = categories.get(listing.category);
    if (categoryId === undefined)
      throw new Error(`Missing category ${listing.category}. Run taxonomy seeds first.`);
    const id = listingId(listing);
    const dates = listingDates(listing, index);
    const conditionCopy = listing.condition.toLowerCase().replace('_', ' ');
    const searchableNoun =
      ['jacket', 'hoodie', 'sneakers', 'dress', 'trousers', 'bag'].find((noun) =>
        listing.title.toLowerCase().includes(noun),
      ) ?? listing.garmentRole.toLowerCase();
    const styleCopy = listing.styles.map((style) => style.replaceAll('-', ' ')).join(' and ');
    const description = `A ${listing.color.toLowerCase()} ${searchableNoun} with a ${styleCopy} feel. It is in ${conditionCopy} condition and the photos show the actual synthetic demo item styling.`;
    await prisma.listing.upsert({
      where: { id },
      create: {
        id,
        sellerId: sellerId(listing.seller),
        categoryId,
        title: listing.title,
        description,
        priceMinor: listing.priceMinor,
        currency: 'PKR',
        condition: listing.condition,
        size: listing.size,
        color: listing.color,
        colorFamily: listing.colorFamily,
        fitType: listing.fitType,
        garmentRole: listing.garmentRole,
        sizeSystem: listing.sizeSystem,
        sizeCompatibilityKey: listing.sizeKey,
        status: listing.status,
        rejectionReason: listing.rejectionReason ?? null,
        ...dates,
      },
      update: {
        categoryId,
        title: listing.title,
        description,
        priceMinor: listing.priceMinor,
        condition: listing.condition,
        size: listing.size,
        color: listing.color,
        colorFamily: listing.colorFamily,
        fitType: listing.fitType,
        garmentRole: listing.garmentRole,
        sizeSystem: listing.sizeSystem,
        sizeCompatibilityKey: listing.sizeKey,
        status: listing.status,
        rejectionReason: listing.rejectionReason ?? null,
        submittedAt: dates.submittedAt,
        moderatedAt: dates.moderatedAt,
        activatedAt: dates.activatedAt,
        archivedAt: dates.archivedAt,
      },
    });
    const styleIds = listing.styles.map((slug) => styles.get(slug));
    if (styleIds.some((styleId) => styleId === undefined))
      throw new Error(`Missing style for ${listing.title}.`);
    await prisma.listingStyle.createMany({
      data: styleIds.map((styleDefinitionId) => ({
        listingId: id,
        styleDefinitionId: styleDefinitionId!,
      })),
      skipDuplicates: true,
    });
  }
}

async function sourcePanel(listing: DemoListing, variant: number): Promise<Buffer> {
  const source = await readFile(path.join(sourceAssetDirectory, `${listing.assetGroup}.png`));
  const metadata = await sharp(source).metadata();
  if (metadata.width === undefined || metadata.height === undefined)
    throw new Error(`Invalid source asset ${listing.assetGroup}.`);
  const baseWidth = Math.floor(metadata.width / 5);
  const left = listing.panel * baseWidth;
  const width = listing.panel === 4 ? metadata.width - left : baseWidth;
  interface CropPipeline {
    resize(
      width: number,
      height: number,
      options: { fit: 'contain' | 'cover'; background?: string; position?: string },
    ): CropPipeline;
    png(): CropPipeline;
    modulate(options: { brightness: number; saturation: number }): CropPipeline;
    toBuffer(): Promise<Buffer>;
  }
  const extracted = (
    sharp(source) as unknown as {
      extract(region: { left: number; top: number; width: number; height: number }): CropPipeline;
    }
  ).extract({ left, top: 0, width, height: metadata.height });
  if (variant === 0)
    return extracted.resize(900, 1200, { fit: 'contain', background: '#f4f0e9' }).png().toBuffer();
  if (variant === 1)
    return extracted.resize(900, 1200, { fit: 'cover', position: 'centre' }).png().toBuffer();
  return extracted
    .resize(900, 1200, { fit: 'contain', background: '#ebe5dd' })
    .modulate({ brightness: 1.03, saturation: 0.96 })
    .png()
    .toBuffer();
}

async function seedListingImages(): Promise<void> {
  const work = demoListings.flatMap((listing) =>
    [0, 1, 2].map((position) => ({ listing, position })),
  );
  const expectedKeys = work.map(({ listing, position }) => imageKey(listing, position));
  const existing = new Set(
    (
      await prisma.listingImage.findMany({
        where: { storageKey: { in: expectedKeys } },
        select: { storageKey: true },
      })
    ).map(({ storageKey }) => storageKey),
  );
  await mapConcurrent(work, 5, async ({ listing, position }) => {
    const storageKey = imageKey(listing, position);
    if (existing.has(storageKey)) return;
    const input = await sourcePanel(listing, position);
    const processed = await imageProcessor.process({
      buffer: input,
      mimetype: 'image/png',
      size: input.byteLength,
    });
    try {
      await imageStorage.upload(storageKey, processed.body);
    } catch {
      const signed = await imageStorage.createSignedUrls([storageKey]);
      if (!signed.has(storageKey))
        throw new Error(`Unable to recover reserved image ${storageKey}.`);
    }
    await prisma.listingImage.upsert({
      where: { storageKey },
      create: {
        id: stableUuid(`image:${listingId(listing)}:${position}`),
        listingId: listingId(listing),
        storageKey,
        position,
        width: processed.width,
        height: processed.height,
      },
      update: {
        listingId: listingId(listing),
        position,
        width: processed.width,
        height: processed.height,
      },
    });
  });
}

async function seedStyleProfiles(): Promise<void> {
  const styleIds = new Map(
    (await prisma.styleDefinition.findMany()).map((style) => [style.slug, style.id]),
  );
  for (const profile of demoQaProfiles) {
    const userId = sellerId(profile.username);
    const id = stableUuid(`style-profile:${profile.username}`);
    await prisma.userStyleProfile.upsert({
      where: { userId },
      create: {
        id,
        userId,
        quizStatus: 'COMPLETED',
        quizStep: 6,
        profileVersion: 1,
        currency: 'PKR',
        budgetMinMinor: 0,
        budgetMaxMinor: profile.budgetMaxMinor,
        priorities: ['PRICE', 'AESTHETICS'],
        lifestyles: ['STUDENT'],
        expressions: ['CLASSIC'],
        completedAt: daysAgo(2),
      },
      update: {
        quizStatus: 'COMPLETED',
        quizStep: 6,
        budgetMinMinor: 0,
        budgetMaxMinor: profile.budgetMaxMinor,
        priorities: ['PRICE', 'AESTHETICS'],
        lifestyles: ['STUDENT'],
        expressions: ['CLASSIC'],
        completedAt: daysAgo(2),
      },
    });
    await prisma.userStylePreference.deleteMany({ where: { profileId: id } });
    await prisma.userColorPreference.deleteMany({ where: { profileId: id } });
    await prisma.userFitPreference.deleteMany({ where: { profileId: id } });
    await prisma.userSizePreference.deleteMany({ where: { profileId: id } });
    await prisma.userStylePreference.createMany({
      data: profile.styles.map((slug, index) => ({
        profileId: id,
        styleDefinitionId: styleIds.get(slug)!,
        strength: 5 - index,
      })),
    });
    await prisma.userColorPreference.createMany({
      data: profile.colors.map((colorFamily) => ({
        profileId: id,
        colorFamily,
        sentiment: 'PREFER' as const,
      })),
    });
    await prisma.userFitPreference.create({
      data: { profileId: id, fitType: profile.fit, rank: 1 },
    });
    await prisma.userSizePreference.createMany({
      data: ['TOP', 'BOTTOM', 'DRESS', 'OUTERWEAR'].map((garmentRole) => ({
        profileId: id,
        garmentRole: garmentRole as 'TOP',
        sizeSystem: 'ALPHA' as const,
        sizeKey: profile.size,
      })),
    });
  }
}

async function seedSocialGraph(demoUserId: string): Promise<void> {
  const sellerIds = demoSellers.map(({ username }) => sellerId(username));
  const listingIds = activeDemoListings.map(listingId);
  const targetSellerFollowers = [5, 7, 9, 11, 13, 15, 17, 19, 20, 21, 23, 24] as const;
  const existingFollows = await prisma.follow.findMany({
    select: { followedId: true, followerId: true },
    where: { followedId: { in: sellerIds } },
  });
  const followKeys = new Set(
    existingFollows.map(({ followedId, followerId }) => `${followerId}:${followedId}`),
  );
  const follows: { followedId: string; followerId: string }[] = [];
  const planFollow = (followerId: string, followedId: string): boolean => {
    const key = `${followerId}:${followedId}`;
    if (followKeys.has(key)) return false;
    followKeys.add(key);
    follows.push({ followedId, followerId });
    return true;
  };

  for (const followedId of sellerIds.slice(0, 6)) planFollow(demoUserId, followedId);
  for (const [sellerIndex, followedId] of sellerIds.entries()) {
    let followerCount = existingFollows.filter((follow) => follow.followedId === followedId).length;
    followerCount += follows.filter((follow) => follow.followedId === followedId).length;
    for (let offset = 0; followerCount < targetSellerFollowers[sellerIndex]!; offset += 1) {
      const followerId = audienceId((sellerIndex * 5 + offset) % demoAudience.length);
      if (planFollow(followerId, followedId)) followerCount += 1;
    }
  }
  for (const [index] of demoAudience.slice(0, 4).entries()) {
    planFollow(audienceId(index), demoUserId);
  }
  await prisma.follow.createMany({ data: follows, skipDuplicates: true });

  const likes = demoAudience.flatMap((_, index) =>
    Array.from({ length: 5 }, (__, offset) => ({
      userId: audienceId(index),
      listingId: listingIds[(index * 7 + offset * 5) % listingIds.length]!,
    })),
  );
  likes.push(...listingIds.slice(0, 8).map((id) => ({ userId: demoUserId, listingId: id })));
  await prisma.listingLike.createMany({ data: likes, skipDuplicates: true });
  await prisma.savedListing.createMany({
    data: listingIds.slice(4, 14).map((id) => ({ userId: demoUserId, listingId: id })),
    skipDuplicates: true,
  });
}

const conversationScripts = [
  [
    'Hi! Does the linen shirt run true to size?',
    'It is relaxed through the shoulders; the measurements in the listing are accurate.',
    'Perfect, thank you. I have saved it for my campus wardrobe.',
    'Glad it works for you. I can also add a close-up of the cuff if helpful.',
  ],
  [
    'Is the forest hoodie heavy enough for cooler evenings?',
    'Yes, it is heavyweight fleece without feeling stiff.',
    'Great. Any fading around the cuffs?',
    'Only very light wash character, shown in the detail photo.',
  ],
  [
    'Could the navy trousers work with a slightly cropped blazer?',
    'Yes, the rise is high enough for that proportion.',
    'That is exactly the silhouette I need for a presentation.',
    'The fabric also holds a clean crease through the day.',
  ],
  [
    'Is the vintage denim jacket more blue or grey in daylight?',
    'It reads as a washed mid-blue in natural light.',
    'Nice. I like the authentic fade across the seams.',
    'That is the best part, and there are no hidden stains or repairs.',
  ],
] as const;

async function seedConversationsAndNotifications(demoUserId: string): Promise<void> {
  const conversationListings = [
    activeDemoListings[0]!,
    activeDemoListings[5]!,
    activeDemoListings[10]!,
    activeDemoListings[15]!,
  ];
  for (const [index, listing] of conversationListings.entries()) {
    const id = stableUuid(`conversation:${index}`);
    const lastMessageAt = daysAgo(index + 1);
    await prisma.conversation.upsert({
      where: { id },
      create: {
        id,
        listingId: listingId(listing),
        sellerId: sellerId(listing.seller),
        buyerId: demoUserId,
        lastMessageAt,
        createdAt: daysAgo(index + 3),
      },
      update: { lastMessageAt },
    });
    for (const [messageIndex, body] of conversationScripts[index]!.entries()) {
      const senderId = messageIndex % 2 === 0 ? demoUserId : sellerId(listing.seller);
      await prisma.message.upsert({
        where: { id: stableUuid(`message:${index}:${messageIndex}`) },
        create: {
          id: stableUuid(`message:${index}:${messageIndex}`),
          conversationId: id,
          senderId,
          body,
          moderationState: 'CLEAR',
          readAt: messageIndex < 3 ? lastMessageAt : null,
          createdAt: new Date(
            lastMessageAt.getTime() - (conversationScripts[index]!.length - messageIndex) * 600_000,
          ),
        },
        update: { body, readAt: messageIndex < 3 ? lastMessageAt : null },
      });
    }
    await prisma.notification.upsert({
      where: { dedupeKey: `${DEMO_NAMESPACE}:message:${index}` },
      create: {
        id: stableUuid(`notification:message:${index}`),
        recipientId: demoUserId,
        actorUserId: sellerId(listing.seller),
        listingId: listingId(listing),
        conversationId: id,
        type: 'NEW_MESSAGE',
        title: `New message from @${listing.seller}`,
        body: `A reply is waiting about ${listing.title}.`,
        dedupeKey: `${DEMO_NAMESPACE}:message:${index}`,
        createdAt: lastMessageAt,
      },
      update: {
        title: `New message from @${listing.seller}`,
        body: `A reply is waiting about ${listing.title}.`,
      },
    });
  }
  for (let index = 0; index < 4; index += 1) {
    await prisma.notification.upsert({
      where: { dedupeKey: `${DEMO_NAMESPACE}:follow:${index}` },
      create: {
        id: stableUuid(`notification:follow:${index}`),
        recipientId: demoUserId,
        actorUserId: audienceId(index),
        type: 'NEW_FOLLOWER',
        title: 'New follower',
        body: `${demoAudience[index]!.fullName} followed your closet.`,
        dedupeKey: `${DEMO_NAMESPACE}:follow:${index}`,
        readAt: index < 2 ? daysAgo(2) : null,
        createdAt: daysAgo(index + 1),
      },
      update: { body: `${demoAudience[index]!.fullName} followed your closet.` },
    });
  }
}

async function seedOrdersAndReviews(demoUserId: string): Promise<void> {
  const sold = demoListings.filter((listing) => listing.status === 'SOLD');
  for (const [index, listing] of sold.entries()) {
    const orderId = stableUuid(`order:${index}`);
    const buyerId = index < 4 ? demoUserId : audienceId(index);
    const buyerUsername =
      index < 4 ? 'thriftage_demo' : `demo_shopper_${String(index + 1).padStart(2, '0')}`;
    const completedAt = daysAgo(10 + index * 3);
    const shippingMinor = 25000;
    await prisma.order.upsert({
      where: { id: orderId },
      create: {
        id: orderId,
        orderNumber: `THR-DMO-${String(index + 1).padStart(4, '0')}`,
        idempotencyKey: stableUuid(`order-idempotency:${index}`),
        listingId: listingId(listing),
        buyerId,
        sellerId: sellerId(listing.seller),
        listingTitle: listing.title,
        listingImageKey: imageKey(listing, 0),
        buyerUsername,
        sellerUsername: listing.seller,
        priceMinor: listing.priceMinor,
        itemSubtotalMinor: listing.priceMinor,
        commissionMinor: Math.floor((listing.priceMinor * 1_000 + 5_000) / 10_000),
        sellerNetMinor:
          listing.priceMinor - Math.floor((listing.priceMinor * 1_000 + 5_000) / 10_000),
        financialPolicyVersion: 'marketplace-fees-v1',
        withholdingRuleVersion: 'withholding-unapproved-v1',
        shippingMinor,
        totalMinor: listing.priceMinor + shippingMinor,
        currency: 'PKR',
        paymentMethod: 'CASH_ON_DELIVERY',
        status: 'COMPLETED',
        recipientName: index < 4 ? 'Thriftage Demo' : demoAudience[index]!.fullName,
        deliveryPhone: '+923000000000',
        addressLine1: 'Synthetic staging address',
        city: index % 2 === 0 ? 'Lahore' : 'Karachi',
        region: index % 2 === 0 ? 'Punjab' : 'Sindh',
        countryCode: 'PK',
        deliveryInstructions: 'Synthetic demo order; no real delivery.',
        confirmedAt: new Date(completedAt.getTime() - 5 * 86_400_000),
        shippedAt: new Date(completedAt.getTime() - 3 * 86_400_000),
        deliveredAt: new Date(completedAt.getTime() - 86_400_000),
        completedAt,
        createdAt: new Date(completedAt.getTime() - 6 * 86_400_000),
      },
      update: { status: 'COMPLETED', completedAt, listingImageKey: imageKey(listing, 0) },
    });
    await prisma.payment.upsert({
      where: { orderId },
      create: {
        id: stableUuid(`payment:${index}`),
        orderId,
        method: 'CASH_ON_DELIVERY',
        provider: 'CASH_ON_DELIVERY',
        providerReference: `DEMO-COD-${String(index + 1).padStart(4, '0')}`,
        amountMinor: listing.priceMinor + shippingMinor,
        currency: 'PKR',
        status: 'COLLECTED',
        collectedAt: completedAt,
      },
      update: { status: 'COLLECTED', collectedAt: completedAt },
    });
    await prisma.shipment.upsert({
      where: { orderId },
      create: {
        id: stableUuid(`shipment:${index}`),
        orderId,
        providerDisplayName: 'Synthetic Demo Courier',
        trackingNumber: `DEMO${String(index + 1).padStart(8, '0')}`,
        status: 'DELIVERED',
        shippedAt: new Date(completedAt.getTime() - 3 * 86_400_000),
        deliveredAt: new Date(completedAt.getTime() - 86_400_000),
      },
      update: { status: 'DELIVERED', deliveredAt: new Date(completedAt.getTime() - 86_400_000) },
    });
    const transitions = [
      ['ORDER_CREATED', null, 'PENDING'],
      ['SELLER_CONFIRMED', 'PENDING', 'CONFIRMED'],
      ['MARKED_SHIPPED', 'CONFIRMED', 'SHIPPED'],
      ['MARKED_DELIVERED', 'SHIPPED', 'DELIVERED'],
      ['PAYMENT_STATUS_CHANGED', 'PENDING_COLLECTION', 'COLLECTED'],
      ['COMPLETED', 'DELIVERED', 'COMPLETED'],
    ] as const;
    await prisma.orderEvent.createMany({
      data: transitions.map(([type, previousState, nextState], eventIndex) => ({
        id: stableUuid(`order-event:${index}:${eventIndex}`),
        orderId,
        actorId:
          type === 'ORDER_CREATED'
            ? buyerId
            : type === 'PAYMENT_STATUS_CHANGED'
              ? null
              : sellerId(listing.seller),
        actorType: type === 'PAYMENT_STATUS_CHANGED' ? ('SYSTEM' as const) : ('USER' as const),
        type,
        previousState,
        nextState,
        reason: 'Synthetic staging lifecycle event.',
        createdAt: new Date(completedAt.getTime() - (transitions.length - eventIndex) * 86_400_000),
      })),
      skipDuplicates: true,
    });
    const buyerReviewId = stableUuid(`review:buyer:${index}`);
    await prisma.review.upsert({
      where: { id: buyerReviewId },
      create: {
        id: buyerReviewId,
        orderId,
        reviewerId: buyerId,
        revieweeId: sellerId(listing.seller),
        direction: 'BUYER_TO_SELLER',
        rating: index % 3 === 0 ? 4 : 5,
        text: [
          'Accurate description and careful packaging.',
          'The item arrived clean and exactly as pictured.',
          'Friendly seller and a smooth handoff.',
          'Good condition notes and quick dispatch.',
        ][index % 4]!,
        moderationState: 'VISIBLE',
        createdAt: new Date(completedAt.getTime() + 86_400_000),
      },
      update: { rating: index % 3 === 0 ? 4 : 5, moderationState: 'VISIBLE' },
    });
    if (index < 4) {
      await prisma.review.upsert({
        where: { id: stableUuid(`review:seller:${index}`) },
        create: {
          id: stableUuid(`review:seller:${index}`),
          orderId,
          reviewerId: sellerId(listing.seller),
          revieweeId: buyerId,
          direction: 'SELLER_TO_BUYER',
          rating: 5,
          text: 'Clear communication and a reliable buyer.',
          moderationState: 'VISIBLE',
          createdAt: new Date(completedAt.getTime() + 2 * 86_400_000),
        },
        update: { rating: 5, moderationState: 'VISIBLE' },
      });
    }
    await prisma.notification.upsert({
      where: { dedupeKey: `${DEMO_NAMESPACE}:order:${index}` },
      create: {
        id: stableUuid(`notification:order:${index}`),
        recipientId: buyerId,
        actorUserId: sellerId(listing.seller),
        listingId: listingId(listing),
        orderId,
        reviewId: buyerReviewId,
        type: 'ORDER_COMPLETED',
        title: 'Order completed',
        body: `${listing.title} was delivered and completed.`,
        dedupeKey: `${DEMO_NAMESPACE}:order:${index}`,
        readAt: index % 2 === 0 ? completedAt : null,
        createdAt: completedAt,
      },
      update: { body: `${listing.title} was delivered and completed.` },
    });
  }
  for (const seller of demoSellers) {
    const count = sold.filter((listing) => listing.seller === seller.username).length;
    await prisma.profile.update({
      where: { userId: sellerId(seller.username) },
      data: { completedSalesCount: count },
    });
  }
}

async function seedAdminFixtures(demoUserId: string): Promise<void> {
  const admin = await prisma.user.findFirst({
    where: { role: 'ADMIN', accountStatus: 'ACTIVE', deletedAt: null },
    select: { id: true },
  });
  if (admin === null)
    throw new Error('A staging admin is required for auditable demo moderation fixtures.');
  for (const [index, username] of ['sundaywardrobe', 'secondspinpk', 'modestmusepk'].entries()) {
    const verificationId = stableUuid(`seller-verification:${username}`);
    await prisma.sellerVerification.upsert({
      where: { id: verificationId },
      create: {
        id: verificationId,
        userId: sellerId(username),
        reviewerId: admin.id,
        status: 'VERIFIED',
        method: 'ACCOUNT_REVIEW',
        statement: 'Synthetic staging account reviewed for marketplace QA.',
        decisionReason: 'Profile and completed synthetic transactions are internally consistent.',
        submittedAt: daysAgo(40 + index),
        reviewedAt: daysAgo(35 + index),
      },
      update: { reviewerId: admin.id, status: 'VERIFIED', reviewedAt: daysAgo(35 + index) },
    });
    await prisma.trustAudit.upsert({
      where: { id: stableUuid(`trust-audit:${username}`) },
      create: {
        id: stableUuid(`trust-audit:${username}`),
        actorId: admin.id,
        targetUserId: sellerId(username),
        action: 'SELLER_VERIFICATION_APPROVED',
        reason: 'Synthetic staging verification fixture.',
        sellerVerificationId: verificationId,
        createdAt: daysAgo(35 + index),
      },
      update: { actorId: admin.id, reason: 'Synthetic staging verification fixture.' },
    });
  }
  const target = activeDemoListings.find(
    (listing) => listing.title === 'Vintage Washed Denim Jacket',
  )!;
  const reportId = stableUuid('moderation-report:photo-clarity');
  await prisma.moderationReport.upsert({
    where: { id: reportId },
    create: {
      id: reportId,
      reporterId: demoUserId,
      targetType: 'LISTING',
      listingId: listingId(target),
      reason: 'MISLEADING_CONTENT',
      detail: 'Synthetic QA report asking whether the wash colour is represented clearly.',
      status: 'DISMISSED',
      assignedAdminId: admin.id,
      resolution: 'Photos and description are sufficiently clear; no action required.',
      resolvedAt: daysAgo(3),
      createdAt: daysAgo(4),
    },
    update: {
      status: 'DISMISSED',
      assignedAdminId: admin.id,
      resolution: 'Photos and description are sufficiently clear; no action required.',
      resolvedAt: daysAgo(3),
    },
  });
  await prisma.moderationAudit.upsert({
    where: { id: stableUuid('moderation-audit:report-dismissed') },
    create: {
      id: stableUuid('moderation-audit:report-dismissed'),
      actorId: admin.id,
      action: 'REPORT_DISMISSED',
      reportId,
      reason: 'Synthetic ordinary-content QA report resolved without enforcement.',
      previousState: 'UNDER_REVIEW',
      nextState: 'DISMISSED',
      createdAt: daysAgo(3),
    },
    update: {
      actorId: admin.id,
      reason: 'Synthetic ordinary-content QA report resolved without enforcement.',
    },
  });
  const rejected = demoListings.find((listing) => listing.status === 'REJECTED')!;
  const rejectionReason =
    rejected.rejectionReason ??
    'Synthetic listing needs clearer condition photos before resubmission.';
  await prisma.moderationAudit.upsert({
    where: { id: stableUuid('moderation-audit:listing-rejected') },
    create: {
      id: stableUuid('moderation-audit:listing-rejected'),
      actorId: admin.id,
      action: 'LISTING_REJECTED',
      listingId: listingId(rejected),
      reason: rejectionReason,
      previousState: 'PENDING_REVIEW',
      nextState: 'REJECTED',
      createdAt: daysAgo(4),
    },
    update: { actorId: admin.id, reason: rejectionReason },
  });
  const resubmitted = demoListings.find((listing) => listing.title === 'Pastel Co-ord Shirt')!;
  await prisma.moderationAudit.upsert({
    where: { id: stableUuid('moderation-audit:resubmitted-prior-rejection') },
    create: {
      id: stableUuid('moderation-audit:resubmitted-prior-rejection'),
      actorId: admin.id,
      action: 'LISTING_REJECTED',
      listingId: listingId(resubmitted),
      reason:
        'Earlier submission needed a clearer rear-view image; seller added it and resubmitted.',
      previousState: 'PENDING_REVIEW',
      nextState: 'REJECTED',
      createdAt: daysAgo(3),
    },
    update: {
      actorId: admin.id,
      reason:
        'Earlier submission needed a clearer rear-view image; seller added it and resubmitted.',
    },
  });
}

async function writeImageManifest(): Promise<void> {
  const rows = [
    'listing_id,title,seller,status,position,image_reference,source_asset,source_panel,source_type,usage_basis_or_license,source_url,date_generated,prompt_set',
  ];
  for (const listing of demoListings) {
    for (let position = 0; position < 3; position += 1) {
      rows.push(
        [
          listingId(listing),
          JSON.stringify(listing.title),
          listing.seller,
          listing.status,
          String(position),
          imageKey(listing, position),
          `apps/api/demo-assets/source/${listing.assetGroup}.png`,
          String(listing.panel + 1),
          'SYNTHETIC',
          'Original synthetic image generated with OpenAI image generation; staging demo use',
          '',
          '2026-08-24',
          'thriftage-demo-product-contact-sheets-v1',
        ].join(','),
      );
    }
  }
  await writeFile(imageManifestPath, `${rows.join('\n')}\n`, 'utf8');
}

async function reportDemo(prismaClient: PrismaClient = prisma) {
  const userIds = [
    ...demoSellers.map(({ username }) => sellerId(username)),
    ...demoAudience.map((_, index) => audienceId(index)),
  ];
  const ids = demoListings.map(listingId);
  const [
    users,
    profiles,
    listingsByStatus,
    images,
    likes,
    saves,
    follows,
    orders,
    payments,
    shipments,
    conversations,
    messages,
    notifications,
    styleProfiles,
  ] = await Promise.all([
    prismaClient.user.count({ where: { id: { in: userIds } } }),
    prismaClient.profile.count({ where: { userId: { in: userIds } } }),
    prismaClient.listing.groupBy({
      by: ['status'],
      where: { id: { in: ids } },
      _count: { _all: true },
    }),
    prismaClient.listingImage.count({ where: { listingId: { in: ids } } }),
    prismaClient.listingLike.count({ where: { listingId: { in: ids } } }),
    prismaClient.savedListing.count({ where: { listingId: { in: ids } } }),
    prismaClient.follow.count({
      where: { OR: [{ followerId: { in: userIds } }, { followedId: { in: userIds } }] },
    }),
    prismaClient.order.count({
      where: {
        id: {
          in: demoListings
            .filter((listing) => listing.status === 'SOLD')
            .map((_, index) => stableUuid(`order:${index}`)),
        },
      },
    }),
    prismaClient.payment.count({
      where: {
        id: {
          in: demoListings
            .filter((listing) => listing.status === 'SOLD')
            .map((_, index) => stableUuid(`payment:${index}`)),
        },
      },
    }),
    prismaClient.shipment.count({
      where: {
        id: {
          in: demoListings
            .filter((listing) => listing.status === 'SOLD')
            .map((_, index) => stableUuid(`shipment:${index}`)),
        },
      },
    }),
    prismaClient.conversation.count({
      where: {
        id: { in: Array.from({ length: 4 }, (_, index) => stableUuid(`conversation:${index}`)) },
      },
    }),
    prismaClient.message.count({
      where: {
        conversationId: {
          in: Array.from({ length: 4 }, (_, index) => stableUuid(`conversation:${index}`)),
        },
      },
    }),
    prismaClient.notification.count({ where: { dedupeKey: { startsWith: `${DEMO_NAMESPACE}:` } } }),
    prismaClient.userStyleProfile.count({
      where: { userId: { in: demoQaProfiles.map(({ username }) => sellerId(username)) } },
    }),
  ]);
  const demoReviewIds = Array.from({ length: 8 }, (_, index) =>
    stableUuid(`review:buyer:${index}`),
  ).concat(Array.from({ length: 4 }, (_, index) => stableUuid(`review:seller:${index}`)));
  const demoReviews = await prismaClient.review.count({ where: { id: { in: demoReviewIds } } });
  return {
    users,
    profiles,
    listingsByStatus: Object.fromEntries(
      listingsByStatus.map((row) => [row.status, row._count._all]),
    ),
    images,
    likes,
    saves,
    follows,
    orders,
    payments,
    shipments,
    reviews: demoReviews,
    conversations,
    messages,
    notifications,
    styleProfiles,
  };
}

async function seedDemo(): Promise<void> {
  assertDemoSeedTarget(process.env);
  await assertReservedIdsAreSafe();
  const demoProfile = await prisma.profile.findUnique({
    where: { username: 'thriftage_demo' },
    select: { userId: true },
  });
  if (demoProfile === null)
    throw new Error(
      'The existing thriftage_demo account is required and will not be created or modified by this tool.',
    );
  await seedUsersAndProfiles();
  await seedListings();
  await seedListingImages();
  await seedStyleProfiles();
  await seedSocialGraph(demoProfile.userId);
  await seedConversationsAndNotifications(demoProfile.userId);
  await seedOrdersAndReviews(demoProfile.userId);
  await seedAdminFixtures(demoProfile.userId);
  await writeImageManifest();
  console.log(JSON.stringify(await reportDemo(), null, 2));
}

async function resetDemo(): Promise<void> {
  assertDemoSeedTarget(process.env);
  const userIds = [
    ...demoSellers.map(({ username }) => sellerId(username)),
    ...demoAudience.map((_, index) => audienceId(index)),
  ];
  const listingIds = demoListings.map(listingId);
  const conversationIds = Array.from({ length: 4 }, (_, index) =>
    stableUuid(`conversation:${index}`),
  );
  const orderIds = Array.from({ length: 8 }, (_, index) => stableUuid(`order:${index}`));
  const reportIds = [stableUuid('moderation-report:photo-clarity')];
  await imageStorage.remove(
    demoListings.flatMap((listing) => [0, 1, 2].map((position) => imageKey(listing, position))),
  );
  for (const seller of demoSellers) await profileStorage.remove(avatarKey(seller.username));
  await prisma.$transaction(async (tx) => {
    await tx.notification.deleteMany({
      where: { dedupeKey: { startsWith: `${DEMO_NAMESPACE}:` } },
    });
    await tx.trustAudit.deleteMany({
      where: {
        OR: [
          { targetUserId: { in: userIds } },
          { sellerVerificationId: { not: null }, targetUserId: { in: userIds } },
        ],
      },
    });
    await tx.moderationAudit.deleteMany({
      where: { OR: [{ reportId: { in: reportIds } }, { listingId: { in: listingIds } }] },
    });
    await tx.moderationReport.deleteMany({ where: { id: { in: reportIds } } });
    await tx.sellerVerification.deleteMany({ where: { userId: { in: userIds } } });
    await tx.review.deleteMany({ where: { orderId: { in: orderIds } } });
    await tx.orderEvent.deleteMany({ where: { orderId: { in: orderIds } } });
    await tx.shipment.deleteMany({ where: { orderId: { in: orderIds } } });
    await tx.payment.deleteMany({ where: { orderId: { in: orderIds } } });
    await tx.order.deleteMany({ where: { id: { in: orderIds } } });
    await tx.message.deleteMany({ where: { conversationId: { in: conversationIds } } });
    await tx.conversation.deleteMany({ where: { id: { in: conversationIds } } });
    await tx.listingLike.deleteMany({
      where: { OR: [{ listingId: { in: listingIds } }, { userId: { in: userIds } }] },
    });
    await tx.savedListing.deleteMany({
      where: { OR: [{ listingId: { in: listingIds } }, { userId: { in: userIds } }] },
    });
    await tx.follow.deleteMany({
      where: { OR: [{ followerId: { in: userIds } }, { followedId: { in: userIds } }] },
    });
    await tx.listing.deleteMany({ where: { id: { in: listingIds } } });
    await tx.user.deleteMany({
      where: { id: { in: userIds }, authProviderUserId: { startsWith: `${DEMO_NAMESPACE}:` } },
    });
  });
  console.log(JSON.stringify(await reportDemo(), null, 2));
}

async function main(): Promise<void> {
  const action = process.argv[2] ?? 'seed';
  if (action === 'seed') await seedDemo();
  else if (action === 'reset') await resetDemo();
  else if (action === 'report') {
    assertDemoSeedTarget(process.env);
    console.log(JSON.stringify(await reportDemo(), null, 2));
  } else throw new Error(`Unknown demo marketplace action: ${action}`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Demo marketplace tooling failed.');
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
