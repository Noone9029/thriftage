import { getPrismaClient } from './client';

const styles = [
  [
    'f0000000-0000-4000-8000-000000000001',
    'streetwear',
    'Streetwear',
    'Relaxed, graphic, and urban everyday style.',
  ],
  [
    'f0000000-0000-4000-8000-000000000002',
    'old-money',
    'Old Money',
    'Refined heritage pieces and understated tailoring.',
  ],
  [
    'f0000000-0000-4000-8000-000000000003',
    'vintage',
    'Vintage',
    'Distinctive pieces inspired by earlier decades.',
  ],
  [
    'f0000000-0000-4000-8000-000000000004',
    'gothic',
    'Gothic',
    'Dark palettes, dramatic details, and expressive silhouettes.',
  ],
  [
    'f0000000-0000-4000-8000-000000000005',
    'y2k',
    'Y2K',
    'Playful late-1990s and early-2000s styling.',
  ],
  [
    'f0000000-0000-4000-8000-000000000006',
    'minimalist',
    'Minimalist',
    'Clean lines, versatile shapes, and restrained palettes.',
  ],
  [
    'f0000000-0000-4000-8000-000000000007',
    'formal',
    'Formal',
    'Polished occasionwear and traditional tailoring.',
  ],
  [
    'f0000000-0000-4000-8000-000000000008',
    'smart-casual',
    'Smart Casual',
    'Relaxed wardrobe staples with a polished finish.',
  ],
  [
    'f0000000-0000-4000-8000-000000000009',
    'athleisure',
    'Athleisure',
    'Comfort-led active pieces for everyday wear.',
  ],
  [
    'f0000000-0000-4000-8000-000000000010',
    'techwear',
    'Techwear',
    'Utility-led silhouettes and technical detailing.',
  ],
] as const;

async function main(): Promise<void> {
  const prisma = getPrismaClient();
  await prisma.$transaction(
    async (transaction) => {
      for (const [sortOrder, [id, slug, displayName, description]] of styles.entries()) {
        await transaction.styleDefinition.upsert({
          create: { description, displayName, id, slug, sortOrder },
          update: { description, displayName, sortOrder },
          where: { slug },
        });
      }

      await transaction.recommendationConfiguration.upsert({
        create: {
          id: 'f1000000-0000-4000-8000-000000000001',
          isActive: true,
          version: 'rules-v1',
        },
        update: {},
        where: { version: 'rules-v1' },
      });
    },
    {
      maxWait: 15_000,
      timeout: 30_000,
    },
  );
}

void main().finally(async () => getPrismaClient().$disconnect());
