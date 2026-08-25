import type { Metadata } from 'next';
import Link from 'next/link';

import { BetaForm } from '../../components/beta-form';
import { PhoneFrame } from '../../components/phone-frame';

export const metadata: Metadata = {
  alternates: { canonical: '/beta' },
  description: 'Join the Thriftage private beta as a buyer, seller, or both.',
  title: 'Join the beta',
};

export default function BetaPage() {
  return (
    <main id="main-content" className="subpage-main beta-page">
      <section className="beta-page-hero" aria-labelledby="beta-page-title">
        <div className="beta-page-copy">
          <p className="section-label section-label-light">Private beta · early access</p>
          <h1 id="beta-page-title">Find your style before everyone finds the same thing.</h1>
          <p>
            Join the early-access list for a visual resale feed, social seller discovery, Style
            Profiles, grounded outfit ideas, and a simple path to selling your own pieces.
          </p>
          <ul>
            <li>
              <span aria-hidden="true">✦</span>Personalized discovery that improves with real
              activity
            </li>
            <li>
              <span aria-hidden="true">✦</span>Inventory-grounded Thriftage Stylist recommendations
            </li>
            <li>
              <span aria-hidden="true">✦</span>Seller profiles, reviews, saved items, and in-app
              messaging
            </li>
          </ul>
          <p className="beta-status-note">
            Thriftage is not publicly launched. Joining this list does not create an app account or
            guarantee immediate access.
          </p>
          <Link className="text-link-light" href="/sell">
            Interested in selling? Apply through the seller form →
          </Link>
        </div>
        <div className="beta-page-form-wrap">
          <div>
            <p className="section-label">Get early access</p>
            <h2>Tell us where you fit.</h2>
          </div>
          <BetaForm />
        </div>
        <PhoneFrame
          alt="Thriftage personalized For You feed"
          className="beta-page-phone"
          screen="/product/02-for-you-clean.webp"
        />
      </section>
    </main>
  );
}
