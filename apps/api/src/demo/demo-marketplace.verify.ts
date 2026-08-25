import { getPrismaClient } from '@thriftage/db';

import { SupabaseListingImageStorageAdapter } from '../listing-media/supabase-listing-image-storage.adapter';
import { PersonalizationService } from '../personalization/personalization.service';
import { DEMO_NAMESPACE, demoQaProfiles } from './demo-marketplace.manifest';
import { assertDemoSeedTarget } from './demo-safety';

const prisma = getPrismaClient(process.env.DATABASE_URL, { max: 4 });

function assertInvariant(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

async function main(): Promise<void> {
  assertDemoSeedTarget(process.env);
  const syntheticUsers = await prisma.user.findMany({
    select: { id: true },
    where: { authProviderUserId: { startsWith: `${DEMO_NAMESPACE}:` } },
  });
  const userIds = syntheticUsers.map(({ id }) => id);
  const listings = await prisma.listing.findMany({
    include: { _count: { select: { images: true } } },
    where: { sellerId: { in: userIds } },
  });
  assertInvariant(listings.length === 75, 'Expected exactly 75 synthetic listings.');
  assertInvariant(
    listings.every(({ _count }) => _count.images === 3),
    'Every synthetic listing must have exactly three images.',
  );

  const orders = await prisma.order.findMany({
    include: { events: true, listing: true, payment: true, reviews: true, shipment: true },
    where: { orderNumber: { startsWith: 'THR-DMO-' } },
  });
  assertInvariant(orders.length === 8, 'Expected exactly eight synthetic completed orders.');
  for (const order of orders) {
    assertInvariant(
      order.buyerId !== order.sellerId,
      `Order ${order.orderNumber} is a self-purchase.`,
    );
    assertInvariant(
      order.status === 'COMPLETED' && order.listing.status === 'SOLD',
      `Order ${order.orderNumber} is not coherently completed.`,
    );
    assertInvariant(
      order.totalMinor === order.priceMinor + order.shippingMinor,
      `Order ${order.orderNumber} total is invalid.`,
    );
    assertInvariant(
      order.payment?.status === 'COLLECTED' && order.payment.amountMinor === order.totalMinor,
      `Order ${order.orderNumber} payment is invalid.`,
    );
    assertInvariant(
      order.shipment?.status === 'DELIVERED',
      `Order ${order.orderNumber} shipment is invalid.`,
    );
    assertInvariant(
      order.events.length === 6,
      `Order ${order.orderNumber} lifecycle is incomplete.`,
    );
    assertInvariant(
      order.reviews.some(({ direction }) => direction === 'BUYER_TO_SELLER'),
      `Order ${order.orderNumber} needs a buyer review.`,
    );
  }

  const personalization = new PersonalizationService(prisma);
  const rankings = [];
  for (const profile of demoQaProfiles) {
    const user = await prisma.profile.findUnique({
      where: { username: profile.username },
      select: { userId: true },
    });
    assertInvariant(user !== null, `Missing QA profile ${profile.username}.`);
    const ranked = await personalization.rankForYou(user.userId, new Date());
    const top = ranked.ranked.slice(0, 6);
    const titles = new Map(
      (
        await prisma.listing.findMany({
          where: { id: { in: top.map(({ id }) => id) } },
          select: { id: true, title: true },
        })
      ).map((listing) => [listing.id, listing.title]),
    );
    rankings.push({
      profile: profile.username,
      top: top.map(({ id, match }) => ({
        title: titles.get(id),
        score: match.score,
        reasons: match.reasons,
      })),
    });
  }
  const rankingSignatures = rankings.map(({ top }) => top.map(({ title }) => title).join('|'));
  assertInvariant(
    new Set(rankingSignatures).size === rankings.length,
    'QA profiles did not produce differentiated ranking orders.',
  );

  const outfitPlans = [
    {
      name: 'Athleisure under PKR 5,000',
      titles: ['Cobalt Performance Tee', 'Black Training Leggings', 'Black Everyday Sneakers'],
      maxMinor: 500_000,
    },
    {
      name: 'Minimal campus under PKR 8,000',
      titles: ['Minimal White Linen Shirt', 'Stone Wide-Leg Trousers', 'Black Everyday Sneakers'],
      maxMinor: 800_000,
    },
    {
      name: 'Streetwear under PKR 10,000',
      titles: [
        'Washed Graphic-Free Tee',
        'Black Utility Cargo Trousers',
        'Black High-Top Sneakers',
      ],
      maxMinor: 1_000_000,
    },
    {
      name: 'Smart casual under PKR 15,000',
      titles: ['Ivory Oxford Shirt', 'Navy Tailored Trousers', 'Brown Penny Loafers'],
      maxMinor: 1_500_000,
    },
    {
      name: 'Wedding guest under PKR 15,000',
      titles: [
        'Deep Green Wedding Guest Dress',
        'Pearl Drop Earrings',
        'Modern Square-Toe Sandals',
      ],
      maxMinor: 1_500_000,
    },
  ];
  const outfits = [];
  for (const plan of outfitPlans) {
    const items = await prisma.listing.findMany({
      where: { status: 'ACTIVE', title: { in: plan.titles } },
      select: { garmentRole: true, priceMinor: true, title: true },
    });
    const totalMinor = items.reduce((sum, item) => sum + item.priceMinor, 0);
    assertInvariant(
      items.length === plan.titles.length && totalMinor <= plan.maxMinor,
      `${plan.name} is not satisfiable.`,
    );
    outfits.push({ name: plan.name, totalMinor, items });
  }

  const sampleImages = await prisma.listingImage.findMany({
    orderBy: [{ listingId: 'asc' }, { position: 'asc' }],
    select: { height: true, storageKey: true, width: true },
    take: 5,
    where: { listing: { sellerId: { in: userIds } } },
  });
  const signed = await new SupabaseListingImageStorageAdapter().createSignedUrls(
    sampleImages.map(({ storageKey }) => storageKey),
  );
  const imageDelivery = [];
  for (const image of sampleImages) {
    const url = signed.get(image.storageKey);
    assertInvariant(url !== undefined, 'A sample image did not receive a signed URL.');
    const response = await fetch(url);
    assertInvariant(response.ok, `Image delivery failed with HTTP ${response.status}.`);
    imageDelivery.push({
      host: new URL(url).host,
      status: response.status,
      width: image.width,
      height: image.height,
    });
  }

  const demoAccount = await prisma.profile.findUnique({
    where: { username: 'thriftage_demo' },
    select: { user: { select: { authProviderUserId: true, id: true } } },
  });
  assertInvariant(
    demoAccount !== null && !demoAccount.user.authProviderUserId.startsWith(`${DEMO_NAMESPACE}:`),
    'Existing demo account ownership changed unexpectedly.',
  );

  console.log(
    JSON.stringify(
      {
        integrity: {
          listings: listings.length,
          imagesPerListing: 3,
          orders: orders.length,
          selfPurchases: 0,
          collectedPayments: orders.length,
          deliveredShipments: orders.length,
        },
        rankings,
        outfits,
        imageDelivery,
        demoAccountPreserved: true,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Demo verification failed.');
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit();
  });
