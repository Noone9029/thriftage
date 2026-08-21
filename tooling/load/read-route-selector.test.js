import { describe, expect, it } from 'vitest';

import { selectReadRoute } from './read-route-selector.js';

describe('selectReadRoute', () => {
  it('distributes thirty virtual users evenly across the read mix', () => {
    const routes = Array.from({ length: 30 }, (_, index) => selectReadRoute(index + 1, 0));

    expect(routes.filter((route) => route === 'feed')).toHaveLength(10);
    expect(routes.filter((route) => route === 'search')).toHaveLength(10);
    expect(routes.filter((route) => route === 'personalized-feed')).toHaveLength(10);
  });

  it('rotates each virtual user through all routes across iterations', () => {
    expect([0, 1, 2].map((iteration) => selectReadRoute(1, iteration))).toEqual([
      'feed',
      'search',
      'personalized-feed',
    ]);
  });

  it.each([
    [0, 0],
    [1.5, 0],
    [1, -1],
    [1, 0.5],
  ])('rejects invalid VU/iteration pair %s/%s', (virtualUserId, iteration) => {
    expect(() => selectReadRoute(virtualUserId, iteration)).toThrow();
  });
});
