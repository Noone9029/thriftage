const readRoutes = ['feed', 'search', 'personalized-feed'];

export function selectReadRoute(virtualUserId, iteration) {
  if (!Number.isInteger(virtualUserId) || virtualUserId < 1) {
    throw new Error('virtualUserId must be a positive integer.');
  }
  if (!Number.isInteger(iteration) || iteration < 0) {
    throw new Error('iteration must be a non-negative integer.');
  }
  return readRoutes[(virtualUserId - 1 + iteration) % readRoutes.length];
}
