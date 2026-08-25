export interface SiteLink {
  readonly href: string | undefined;
  readonly label: string;
}

function optionalPublicUrl(value: string | undefined): string | undefined {
  if (value === undefined || value.trim() === '') return undefined;
  try {
    const parsed = new URL(value);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function publicSiteUrl(): URL {
  const configured = optionalPublicUrl(process.env.NEXT_PUBLIC_SITE_URL);
  const vercelHost = process.env.VERCEL_URL?.trim();
  const deploymentUrl =
    vercelHost === undefined || vercelHost === ''
      ? undefined
      : optionalPublicUrl(`https://${vercelHost}`);
  return new URL(configured ?? deploymentUrl ?? 'http://localhost:3001');
}

export function policyLinks(): readonly SiteLink[] {
  return [
    { href: optionalPublicUrl(process.env.NEXT_PUBLIC_PRIVACY_URL), label: 'Privacy' },
    { href: optionalPublicUrl(process.env.NEXT_PUBLIC_TERMS_URL), label: 'Terms' },
    {
      href: optionalPublicUrl(process.env.NEXT_PUBLIC_COMMUNITY_GUIDELINES_URL),
      label: 'Community Guidelines',
    },
    { href: optionalPublicUrl(process.env.NEXT_PUBLIC_SUPPORT_URL), label: 'Support' },
  ];
}
