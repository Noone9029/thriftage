import Link from 'next/link';

import { policyLinks } from '../lib/site-config';
import { BrandLogo } from './brand-logo';

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-grid">
        <div className="footer-brand">
          <BrandLogo reversed />
          <p>
            Curated resale. Real wardrobes.
            <br />
            Better style.
          </p>
          <span>Pakistan-first. Global-ready.</span>
        </div>
        <div className="footer-column">
          <h2>Explore</h2>
          <Link href="/#discover">Discover</Link>
          <Link href="/#how-it-works">How it works</Link>
          <Link href="/#stylist">AI Stylist</Link>
          <Link href="/#safety">Safety</Link>
        </div>
        <div className="footer-column">
          <h2>Join</h2>
          <Link href="/beta">Join the beta</Link>
          <Link href="/sell">Seller interest</Link>
        </div>
        <div className="footer-column footer-policies">
          <h2>Support</h2>
          {policyLinks().map((link) =>
            link.href === undefined ? (
              <span aria-disabled="true" key={link.label} title="Link will be added when approved">
                {link.label} <small>Coming soon</small>
              </span>
            ) : (
              <a href={link.href} key={link.label}>
                {link.label}
              </a>
            ),
          )}
        </div>
      </div>
      <div className="footer-bottom">
        <span>© {new Date().getUTCFullYear()} Thriftage</span>
        <span>Style finds you here.</span>
      </div>
    </footer>
  );
}
