import type { Metadata, Viewport } from 'next';
import { Fraunces, Manrope } from 'next/font/google';

import { AnalyticsBridge } from '../components/analytics-bridge';
import { SiteFooter } from '../components/site-footer';
import { SiteHeader } from '../components/site-header';
import { publicSiteUrl } from '../lib/site-config';
import './globals.css';

const manrope = Manrope({
  display: 'swap',
  subsets: ['latin'],
  variable: '--font-body',
});
const fraunces = Fraunces({
  display: 'swap',
  subsets: ['latin'],
  variable: '--font-display',
});

export const metadata: Metadata = {
  metadataBase: publicSiteUrl(),
  title: {
    default: 'Thriftage — Style finds you here',
    template: '%s | Thriftage',
  },
  description:
    'Discover resale pieces shaped around your style, get grounded outfit ideas, and give your closet a second life with Thriftage.',
  alternates: { canonical: '/' },
  openGraph: {
    description:
      'A personalized social fashion resale marketplace for discovering, styling, buying, and selling real wardrobe pieces.',
    siteName: 'Thriftage',
    title: 'Thriftage — Style finds you here',
    type: 'website',
    url: '/',
  },
  twitter: {
    card: 'summary_large_image',
    description: 'Personalized fashion discovery. Real wardrobes. A better way to thrift.',
    title: 'Thriftage — Style finds you here',
  },
};

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#F6F2EA',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      className={`${manrope.variable} ${fraunces.variable}`}
      data-scroll-behavior="smooth"
      lang="en"
    >
      <body>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <SiteHeader />
        {children}
        <SiteFooter />
        <AnalyticsBridge />
      </body>
    </html>
  );
}
