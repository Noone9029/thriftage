import type { MetadataRoute } from 'next';

import { publicSiteUrl } from '../lib/site-config';

export default function robots(): MetadataRoute.Robots {
  const base = publicSiteUrl();
  return {
    rules: { allow: '/', disallow: ['/api/'], userAgent: '*' },
    sitemap: new URL('/sitemap.xml', base).toString(),
  };
}
