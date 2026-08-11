import { z } from 'zod';

export const categorySlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(60)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase words separated by hyphens.');

export const categorySchema = z.strictObject({
  description: z.string().nullable(),
  id: z.string().uuid(),
  isActive: z.boolean(),
  name: z.string().min(2).max(80),
  parentId: z.string().uuid().nullable(),
  slug: categorySlugSchema,
  sortOrder: z.number().int().nonnegative(),
});

export const categoryTreeNodeSchema: z.ZodType<CategoryTreeNode> = categorySchema.extend({
  children: z.lazy(() => z.array(categoryTreeNodeSchema)),
});

export interface CategoryTreeNode extends z.infer<typeof categorySchema> {
  readonly children: readonly CategoryTreeNode[];
}

const optionalNullableText = (maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength)
    .transform((value) => (value === '' ? null : value))
    .nullable()
    .optional();

export const categoryCreateInputSchema = z.strictObject({
  description: optionalNullableText(240),
  name: z.string().trim().min(2).max(80),
  parentId: z.string().uuid().nullable().optional(),
  slug: categorySlugSchema,
  sortOrder: z.number().int().nonnegative().max(10_000).default(0),
});

export const categoryUpdateInputSchema = categoryCreateInputSchema
  .omit({ parentId: true })
  .partial()
  .extend({ isActive: z.boolean().optional() })
  .refine((input) => Object.keys(input).length > 0, 'At least one category field is required.');

export type Category = z.infer<typeof categorySchema>;
export type CategoryCreateInput = z.infer<typeof categoryCreateInputSchema>;
export type CategoryUpdateInput = z.infer<typeof categoryUpdateInputSchema>;
