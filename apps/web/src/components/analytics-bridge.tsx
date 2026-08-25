'use client';

import { useEffect } from 'react';

import { emitMarketingEvent, type MarketingEventName } from '../lib/analytics';

const knownEvents = new Set<MarketingEventName>([
  'hero_beta_clicked',
  'hero_sell_clicked',
  'beta_form_submitted',
  'seller_form_submitted',
  'section_viewed',
]);

function isKnownEvent(value: string): value is MarketingEventName {
  return knownEvents.has(value as MarketingEventName);
}

export function AnalyticsBridge() {
  useEffect(() => {
    const click = (event: MouseEvent) => {
      const target =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>('[data-analytics-event]')
          : null;
      const name = target?.dataset.analyticsEvent;
      if (name !== undefined && isKnownEvent(name)) {
        emitMarketingEvent({
          name,
          ...(target?.dataset.analyticsLabel === undefined
            ? {}
            : { properties: { label: target.dataset.analyticsLabel } }),
        });
      }
    };

    const seen = new WeakSet<Element>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || seen.has(entry.target)) continue;
          seen.add(entry.target);
          const section = (entry.target as HTMLElement).dataset.analyticsSection;
          if (section !== undefined) {
            emitMarketingEvent({ name: 'section_viewed', properties: { section } });
          }
        }
      },
      { threshold: 0.35 },
    );
    document
      .querySelectorAll('[data-analytics-section]')
      .forEach((element) => observer.observe(element));
    document.addEventListener('click', click);
    return () => {
      document.removeEventListener('click', click);
      observer.disconnect();
    };
  }, []);

  return null;
}
