import type { ModelingSource } from '@/api/ont/modeling';

/** Protect reviewed input once publishing has started; this does not mean success. */
export function hasPublicationStarted(publication: ModelingSource['publication'] | undefined): boolean {
  return Boolean(publication?.completed.length || publication?.inFlight);
}
