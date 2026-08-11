import { describe, expect, it, vi } from 'vitest';

import { AsyncSubmissionGate } from './async-submission-gate';

describe('AsyncSubmissionGate', () => {
  it('prevents duplicate concurrent form submissions', async () => {
    let release: (() => void) | undefined;
    const operation = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const gate = new AsyncSubmissionGate();

    const first = gate.run(operation);
    const second = gate.run(operation);
    await expect(second).resolves.toBe(false);
    release?.();
    await expect(first).resolves.toBe(true);
    expect(operation).toHaveBeenCalledOnce();
  });
});
