import { createPrismaClient } from './client';

interface SeedCategory {
  readonly description: string;
  readonly name: string;
  readonly parentSlug?: string;
  readonly slug: string;
  readonly sortOrder: number;
}

const categories: readonly SeedCategory[] = [
  {
    description: 'Clothing across everyday, occasion, and statement wardrobes.',
    name: 'Clothing',
    slug: 'clothing',
    sortOrder: 10,
  },
  {
    description: 'T-shirts, shirts, blouses, knitwear, and outer layers.',
    name: 'Tops',
    parentSlug: 'clothing',
    slug: 'tops',
    sortOrder: 10,
  },
  {
    description: 'Jeans, trousers, skirts, shorts, and other bottoms.',
    name: 'Bottoms',
    parentSlug: 'clothing',
    slug: 'bottoms',
    sortOrder: 20,
  },
  {
    description: 'Dresses, jumpsuits, and coordinated one-piece looks.',
    name: 'Dresses & One-Pieces',
    parentSlug: 'clothing',
    slug: 'dresses-one-pieces',
    sortOrder: 30,
  },
  {
    description: 'Sneakers, formal shoes, sandals, boots, and more.',
    name: 'Shoes',
    slug: 'shoes',
    sortOrder: 20,
  },
  {
    description: 'Everyday, performance, and collectible sneakers.',
    name: 'Sneakers',
    parentSlug: 'shoes',
    slug: 'sneakers',
    sortOrder: 10,
  },
  {
    description: 'Boots, loafers, heels, and other non-sneaker footwear.',
    name: 'Other Footwear',
    parentSlug: 'shoes',
    slug: 'other-footwear',
    sortOrder: 20,
  },
  {
    description: 'Bags, jewelry, watches, eyewear, and finishing pieces.',
    name: 'Accessories',
    slug: 'accessories',
    sortOrder: 30,
  },
  {
    description: 'Handbags, shoulder bags, totes, backpacks, and wallets.',
    name: 'Bags & Wallets',
    parentSlug: 'accessories',
    slug: 'bags-wallets',
    sortOrder: 10,
  },
  {
    description: 'Jewelry, watches, eyewear, belts, hats, and scarves.',
    name: 'Small Accessories',
    parentSlug: 'accessories',
    slug: 'small-accessories',
    sortOrder: 20,
  },
] as const;

async function seed(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl === undefined || databaseUrl.trim() === '') {
    throw new Error('DATABASE_URL is required to seed categories.');
  }

  const prisma = createPrismaClient(databaseUrl);
  try {
    const idsBySlug = new Map<string, string>();
    for (const category of categories) {
      const parentId =
        category.parentSlug === undefined ? null : (idsBySlug.get(category.parentSlug) ?? null);
      if (category.parentSlug !== undefined && parentId === null) {
        throw new Error(`Parent category ${category.parentSlug} must be seeded first.`);
      }
      const record = await prisma.category.upsert({
        create: {
          description: category.description,
          isActive: true,
          name: category.name,
          parentId,
          slug: category.slug,
          sortOrder: category.sortOrder,
        },
        update: {
          description: category.description,
          name: category.name,
          parentId,
          sortOrder: category.sortOrder,
        },
        where: { slug: category.slug },
      });
      idsBySlug.set(category.slug, record.id);
    }
  } finally {
    await prisma.$disconnect();
  }
}

void seed();
