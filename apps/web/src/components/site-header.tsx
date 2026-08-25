import Link from 'next/link';

import { BrandLogo } from './brand-logo';

const nav = [
  { href: '/#discover', label: 'Discover' },
  { href: '/#how-it-works', label: 'How it works' },
  { href: '/sell', label: 'Sell' },
  { href: '/#stylist', label: 'AI Stylist' },
  { href: '/#safety', label: 'Safety' },
];

function NavigationLinks() {
  return (
    <>
      {nav.map((item) => (
        <Link href={item.href} key={item.href}>
          {item.label}
        </Link>
      ))}
    </>
  );
}

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <BrandLogo />
        <nav className="desktop-nav" aria-label="Primary navigation">
          <NavigationLinks />
        </nav>
        <Link className="button button-coral header-cta" href="/beta">
          Join the beta
        </Link>
        <details className="mobile-nav">
          <summary aria-label="Open navigation">
            <span />
            <span />
          </summary>
          <nav aria-label="Mobile navigation">
            <NavigationLinks />
            <Link className="button button-coral" href="/beta">
              Join the beta
            </Link>
          </nav>
        </details>
      </div>
    </header>
  );
}
