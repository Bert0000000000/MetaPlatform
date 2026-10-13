import { afterEach, expect, it, vi } from 'vitest';
import { copyText } from './clipboard';

const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
afterEach(() => {
  if (original) Object.defineProperty(navigator, 'clipboard', original);
  else Reflect.deleteProperty(navigator, 'clipboard');
});

it('waits for the native clipboard write to finish', async () => {
  let resolve!: () => void;
  const write = vi.fn(() => new Promise<void>(done => { resolve = done; }));
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: write }, configurable: true });
  let finished = false;
  const pending = copyText('ont.test.ind.customer.sample').then(() => { finished = true; });
  expect(write).toHaveBeenCalledWith('ont.test.ind.customer.sample');
  await Promise.resolve();
  expect(finished).toBe(false);
  resolve();
  await pending;
  expect(finished).toBe(true);
});

it('rejects when the browser denies clipboard access', async () => {
  const denied = new DOMException('denied', 'NotAllowedError');
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn().mockRejectedValue(denied) }, configurable: true,
  });
  await expect(copyText('ont.test.ind.customer.sample')).rejects.toBe(denied);
});
