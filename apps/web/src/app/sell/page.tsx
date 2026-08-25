import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import { PhoneFrame } from '../../components/phone-frame';
import { SellerForm } from '../../components/seller-form';

export const metadata: Metadata = {
  alternates: { canonical: '/sell' },
  description: 'Apply for the Thriftage seller beta and give your closet a second life.',
  title: 'Sell your closet',
};

const sellerBenefits = [
  [
    'Style-led discovery',
    'Your pieces can be found through taste and fit signals—not only exact searches.',
  ],
  [
    'A real seller profile',
    'Keep listings, reputation, reviews, and marketplace activity together.',
  ],
  [
    'Conversation in one place',
    'Answer buyer questions without publishing private contact details.',
  ],
] as const;

export default function SellPage() {
  return (
    <main id="main-content" className="subpage-main">
      <section className="sell-hero" aria-labelledby="sell-page-title">
        <div className="sell-hero-copy">
          <p className="section-label">For closet sellers, resellers, and creators</p>
          <h1 id="sell-page-title">Your closet has another life in it.</h1>
          <p>
            Thriftage makes selling feel like fashion—not paperwork. Show the piece clearly, meet
            interested buyers in-app, and grow a seller presence that belongs to your style.
          </p>
          <div className="hero-actions">
            <a className="button button-forest" href="#seller-application">
              Apply as a seller <span aria-hidden="true">↓</span>
            </a>
            <Link className="button button-outline" href="/beta">
              Join as a buyer
            </Link>
          </div>
        </div>
        <div className="sell-hero-media">
          <div className="sell-editorial-strip">
            <Image
              alt="Streetwear seller pieces from the Thriftage demo marketplace"
              fill
              priority
              sizes="(max-width: 800px) 94vw, 56vw"
              src="/product/lahorelayers.webp"
            />
          </div>
          <PhoneFrame
            alt="A Thriftage seller profile with listings and reputation"
            className="sell-page-phone"
            priority
            screen="/product/05-seller-profile-clean.webp"
          />
        </div>
      </section>

      <section className="seller-process" aria-labelledby="seller-process-title">
        <div>
          <p className="section-label">Simple by design</p>
          <h2 id="seller-process-title">From wardrobe to listing.</h2>
        </div>
        <ol>
          <li>
            <span>01</span>
            <h3>Photograph it honestly</h3>
            <p>Use clear angles and show the details a buyer should know.</p>
          </li>
          <li>
            <span>02</span>
            <h3>Describe the piece</h3>
            <p>Add condition, size, category, price, and useful context.</p>
          </li>
          <li>
            <span>03</span>
            <h3>Connect in-app</h3>
            <p>Keep questions and transaction context inside Thriftage.</p>
          </li>
          <li>
            <span>04</span>
            <h3>Build your reputation</h3>
            <p>Eligible completed transactions can contribute to reviews and ratings.</p>
          </li>
        </ol>
      </section>

      <section className="seller-benefits" aria-labelledby="seller-benefits-title">
        <div className="seller-benefit-image">
          <Image
            alt="A coordinated modest fashion wardrobe in the Thriftage demo catalog"
            fill
            sizes="(max-width: 800px) 94vw, 45vw"
            src="/product/modestmusepk.webp"
          />
        </div>
        <div>
          <p className="section-label">Why sell here</p>
          <h2 id="seller-benefits-title">
            A marketplace designed around the piece and the person.
          </h2>
          {sellerBenefits.map(([title, detail]) => (
            <article key={title}>
              <h3>{title}</h3>
              <p>{detail}</p>
            </article>
          ))}
          <p className="seller-terms-note">
            Commission, fees, and formal seller terms are not announced yet. Applying only registers
            interest in the beta.
          </p>
        </div>
      </section>

      <section
        className="seller-application"
        id="seller-application"
        aria-labelledby="application-title"
      >
        <div className="seller-application-copy">
          <p className="section-label section-label-light">Seller beta</p>
          <h2 id="application-title">Introduce your closet.</h2>
          <p>
            We’re shaping the first seller group across different styles, cities, and closet sizes.
            This short application is not a contract and does not create an app account.
          </p>
        </div>
        <SellerForm />
      </section>
    </main>
  );
}
