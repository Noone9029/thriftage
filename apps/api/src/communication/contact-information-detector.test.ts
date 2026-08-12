import { describe, expect, it } from 'vitest';

import { ContactInformationDetector } from './contact-information-detector';

describe('ContactInformationDetector', () => {
  const detector = new ContactInformationDetector();

  it.each([
    ['call +92 (300) 123-4567', 'PHONE_NUMBER'],
    ['email name@example.com', 'EMAIL_ADDRESS'],
    ['name at gmail dot com', 'EMAIL_ADDRESS'],
    ['open wa.me/923001234567', 'WHATSAPP'],
    ['zero three zero zero one two three four five six seven', 'OBFUSCATED_CONTACT'],
  ])('blocks high-confidence contact: %s', (text, category) => {
    expect(detector.inspect(text)).toContainEqual(
      expect.objectContaining({ blocked: true, category }),
    );
  });

  it('flags a social handle without blocking and allows clean fashion chat', () => {
    expect(detector.inspect('find me @vintagecloset')).toContainEqual(
      expect.objectContaining({ blocked: false, category: 'SOCIAL_HANDLE' }),
    );
    expect(detector.inspect('Is the jacket true to size?')).toEqual([]);
  });
});
