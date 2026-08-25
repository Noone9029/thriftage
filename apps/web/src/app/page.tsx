import Image from 'next/image';
import Link from 'next/link';

import { BetaForm } from '../components/beta-form';
import { PhoneFrame } from '../components/phone-frame';

const journey = [
  ['01', 'Tell us your style', 'Build a quick Style Profile around what you actually wear.'],
  ['02', 'See better matches', 'Browse eligible resale pieces ranked around your preferences.'],
  ['03', 'Save what feels right', 'Likes, saves, and activity keep shaping the feed over time.'],
] as const;

const buySteps = [
  ['Discover', 'Browse visual feeds and search by the details that matter.'],
  ['Message', 'Ask the seller questions without sharing private contact details.'],
  ['Buy', 'Place an eligible order with clear seller and item context.'],
  ['Receive', 'Follow the transaction record through delivery and completion.'],
] as const;

const trustPoints = [
  ['Seller reputation', 'Profiles, ratings, reviews, and visible marketplace activity.'],
  ['In-app conversation', 'Questions and order context stay together inside Thriftage.'],
  ['Reporting and blocking', 'Controls are available when a listing or interaction feels wrong.'],
  ['Marketplace moderation', 'Reports can be reviewed and actioned by authorized operators.'],
] as const;

export default function HomePage() {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    description: 'A personalized social fashion resale marketplace.',
    name: 'Thriftage',
  };

  return (
    <main id="main-content">
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        type="application/ld+json"
      />

      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <h1 id="hero-title">
            Style finds
            <br />
            you here<span>.</span>
          </h1>
          <p>
            A personalized thrift feed for real style. Discover pieces you’ll actually wear, sell
            what you’re ready to pass on, and build outfits from real marketplace finds.
          </p>
          <div className="hero-actions">
            <Link
              className="button button-forest"
              data-analytics-event="hero_beta_clicked"
              href="/beta"
            >
              Join the beta <span aria-hidden="true">→</span>
            </Link>
            <Link className="button button-outline" href="#how-it-works">
              See how it works
            </Link>
          </div>
          <div className="hero-trust-line">
            <span aria-hidden="true">✦</span>
            <p>Real resale inventory. Protected in-app conversation. Built for everyday closets.</p>
          </div>
        </div>
        <div className="hero-stage" aria-label="Thriftage product preview">
          <PhoneFrame
            alt="Thriftage Discover screen showing a visual feed of resale fashion"
            className="hero-phone"
            priority
            screen="/product/01-discover-clean.webp"
          />
          <div className="hero-garment-card" aria-label="Featured resale product">
            <div
              className="catalog-crop catalog-lahore-1"
              role="img"
              aria-label="Forest green hoodie"
            />
            <div>
              <span>Tops · Good</span>
              <strong>Oversized Forest Green Hoodie</strong>
              <b>PKR 3,250</b>
            </div>
          </div>
          <div className="hero-stitch" aria-hidden="true" />
        </div>
      </section>

      <section className="narrative-band" id="how-it-works" aria-labelledby="narrative-title">
        <p id="narrative-title">One marketplace. Two sides of a better wardrobe.</p>
        <div>
          <span>Find pieces shaped around your taste.</span>
          <span aria-hidden="true">↔</span>
          <span>Give your own pieces a second chapter.</span>
        </div>
      </section>

      <section
        className="discovery-section reveal"
        id="discover"
        data-analytics-section="personalized-discovery"
        aria-labelledby="discovery-title"
      >
        <div className="discovery-media">
          <PhoneFrame
            alt="Thriftage Style Profile result showing structured preferences"
            className="profile-phone"
            screen="/product/10-style-profile-clean.webp"
          />
          <article className="match-card">
            <div
              className="catalog-crop catalog-lahore-1"
              role="img"
              aria-label="Forest green hoodie"
            />
            <div className="match-card-copy">
              <span>Style match</span>
              <strong>25%</strong>
              <p>Similar to pieces you engaged with and a silhouette you prefer.</p>
            </div>
          </article>
        </div>
        <div className="discovery-copy">
          <p className="section-label">Personalized discovery</p>
          <h2 id="discovery-title">
            A feed that gets <em>your</em> style.
          </h2>
          <p className="section-lede">
            Tell Thriftage what you like, then let your saves and activity refine what appears.
            Match scores are deterministic and shown only when the listing has enough information.
          </p>
          <ol className="journey-list">
            {journey.map(([number, title, detail]) => (
              <li key={number}>
                <span>{number}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="product-proof reveal" aria-labelledby="proof-title">
        <div className="product-proof-heading">
          <p className="section-label">Real product proof</p>
          <h2 id="proof-title">Find what fits your style, not just your search.</h2>
          <p>
            From campus staples to modest occasionwear, the demo marketplace shows how very
            different closets can live in one considered feed.
          </p>
        </div>
        <div className="wardrobe-strips">
          <figure>
            <Image
              alt="Everyday campus wardrobe pieces in the Thriftage demo catalog"
              fill
              sizes="(max-width: 760px) 90vw, 47vw"
              src="/product/campuscloset.webp"
            />
            <figcaption>Campus everyday</figcaption>
          </figure>
          <figure>
            <Image
              alt="Modest fashion pieces in the Thriftage demo catalog"
              fill
              sizes="(max-width: 760px) 90vw, 47vw"
              src="/product/modestmusepk.webp"
            />
            <figcaption>Modest occasionwear</figcaption>
          </figure>
        </div>
      </section>

      <section
        className="stylist-section reveal"
        id="stylist"
        data-analytics-section="ai-stylist"
        aria-labelledby="stylist-title"
      >
        <div className="stylist-copy">
          <p className="section-label section-label-light">Thriftage Stylist</p>
          <h2 id="stylist-title">Your personal stylist, built into your feed.</h2>
          <p>
            Ask for an occasion, budget, color, or style. Every suggestion is grounded in eligible
            Thriftage marketplace inventory—never invented products.
          </p>
          <div className="stylist-prompt">
            <span>Build me a university outfit under PKR 8,000.</span>
            <b aria-hidden="true">→</b>
          </div>
          <p className="stylist-accuracy">
            No virtual try-on. No body analysis. Just useful outfit ideas built from pieces you can
            actually explore.
          </p>
        </div>
        <div className="stylist-media">
          <PhoneFrame
            alt="Thriftage Stylist screen for starting an inventory-grounded outfit"
            className="stylist-phone"
            screen="/product/11-stylist-clean.webp"
          />
          <article className="outfit-board">
            <header>
              <span>Your university outfit</span>
              <small>All from Thriftage</small>
            </header>
            <div className="outfit-item">
              <div className="catalog-crop catalog-campus-1" role="img" aria-label="Navy hoodie" />
              <p>
                University Navy Hoodie <b>PKR 2,400</b>
              </p>
            </div>
            <div className="outfit-item">
              <div
                className="catalog-crop catalog-campus-2"
                role="img"
                aria-label="Light-wash jeans"
              />
              <p>
                Relaxed Light-Wash Jeans <b>PKR 2,500</b>
              </p>
            </div>
            <div className="outfit-item">
              <div
                className="catalog-crop catalog-campus-5"
                role="img"
                aria-label="Black sneakers"
              />
              <p>
                Black Everyday Sneakers <b>PKR 1,800</b>
              </p>
            </div>
            <footer>
              <span>Total</span>
              <strong>PKR 6,700</strong>
            </footer>
          </article>
        </div>
      </section>

      <section className="buy-section reveal" aria-labelledby="buy-title">
        <div className="buy-copy">
          <p className="section-label">From find to wardrobe</p>
          <h2 id="buy-title">Thrifting, with the context kept intact.</h2>
          <p>
            See the item, know the seller, ask the question, and keep the transaction in one place.
            Cash on delivery supports the initial Pakistan marketplace experience where eligible.
          </p>
          <ol className="buy-steps">
            {buySteps.map(([title, detail], index) => (
              <li key={title}>
                <span>0{index + 1}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div className="buy-phones">
          <PhoneFrame
            alt="Thriftage listing detail with price, seller, and style match"
            className="buy-phone-primary"
            screen="/product/04-listing-detail-clean.webp"
          />
          <PhoneFrame
            alt="Thriftage in-app conversation list"
            className="buy-phone-secondary"
            screen="/product/08-messages-clean.webp"
          />
        </div>
      </section>

      <section className="sell-section reveal" aria-labelledby="sell-title">
        <div className="sell-image-panel">
          <Image
            alt="A coordinated row of seller wardrobe pieces from the Thriftage demo marketplace"
            fill
            sizes="(max-width: 800px) 100vw, 48vw"
            src="/product/lahorelayers.webp"
          />
        </div>
        <div className="sell-copy">
          <p className="section-label">Sell your closet</p>
          <h2 id="sell-title">
            Your closet has <em>another life</em> in it.
          </h2>
          <p>
            Photograph the pieces you’re ready to pass on, create a clear listing, meet buyers
            in-app, and build a seller profile around your style.
          </p>
          <ol className="sell-steps" aria-label="Selling process">
            <li>
              <span>1</span>Photograph
            </li>
            <li>
              <span>2</span>List
            </li>
            <li>
              <span>3</span>Connect
            </li>
            <li>
              <span>4</span>Sell
            </li>
          </ol>
          <Link
            className="button button-forest"
            data-analytics-event="hero_sell_clicked"
            href="/sell"
          >
            Sell on Thriftage <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>

      <section
        className="trust-section reveal"
        id="safety"
        data-analytics-section="trust-safety"
        aria-labelledby="trust-title"
      >
        <div className="trust-copy">
          <p className="section-label">Social marketplace · calm safeguards</p>
          <h2 id="trust-title">Shop people, not just products.</h2>
          <p>
            Get to know the closet behind the piece. Thriftage combines public seller reputation
            with private in-app communication and practical controls when something feels wrong.
          </p>
          <div className="trust-list">
            {trustPoints.map(([title, detail]) => (
              <article key={title}>
                <span aria-hidden="true">✦</span>
                <div>
                  <h3>{title}</h3>
                  <p>{detail}</p>
                </div>
              </article>
            ))}
          </div>
          <blockquote>Better pieces. Longer lives.</blockquote>
        </div>
        <div className="trust-media">
          <PhoneFrame
            alt="Seller profile showing listings, followers, sales, and ratings"
            className="trust-phone"
            screen="/product/05-seller-profile-clean.webp"
          />
          <div
            className="conversation-card"
            aria-label="Example protected marketplace conversation"
          >
            <header>
              <span>@secondspink</span>
              <small>Vintage Washed Denim Jacket</small>
            </header>
            <p className="message message-out">
              Does the color read more blue or grey in daylight?
            </p>
            <p className="message message-in">
              A washed mid-blue in natural light. I can share another detail photo in-app.
            </p>
            <footer>Keep it inside Thriftage.</footer>
          </div>
        </div>
      </section>

      <section className="seller-recruitment reveal" aria-labelledby="recruit-title">
        <div>
          <p className="section-label section-label-light">For early sellers</p>
          <h2 id="recruit-title">Bring the closet. We’ll bring the discovery.</h2>
        </div>
        <div>
          <p>
            Closet sellers, thrift resellers, and fashion creators can apply for the seller beta.
            Build a profile, reach style-aligned discovery, and keep buyer conversations in one
            place.
          </p>
          <p className="seller-note">
            Early business terms are still being finalized; no fees or income promises are implied.
          </p>
          <Link className="button button-coral" href="/sell">
            Apply as a seller <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>

      <section
        className="beta-cta reveal"
        data-analytics-section="beta-cta"
        aria-labelledby="beta-title"
      >
        <div className="beta-cta-copy">
          <p className="section-label section-label-light">Private beta</p>
          <h2 id="beta-title">Your next favorite is waiting.</h2>
          <p>
            Join as a buyer, seller, or both. We’ll let you know when the next early-access places
            open.
          </p>
        </div>
        <BetaForm compact />
        <div className="beta-garment" aria-hidden="true">
          <div className="catalog-crop catalog-lahore-1" />
        </div>
      </section>
    </main>
  );
}
