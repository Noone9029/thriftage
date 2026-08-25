import type { MetadataRoute } from 'next';

import { publicSiteUrl } from '../lib/site-config';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = publicSiteUrl();
  return [
    { changeFrequency: 'weekly', priority: 1, url: base.toString() },
    { changeFrequency: 'monthly', priority: 0.8, url: new URL('/sell', base).toString() },
    { changeFrequency: 'monthly', priority: 0.8, url: new URL('/beta', base).toString() },
  ];
}
