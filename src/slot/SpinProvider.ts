import type { SpinRequest, SpinResult } from '../types/slot';

/**
 * Source of spin outcomes. Implement this against a real backend later; the
 * game loop only depends on this interface, never a concrete provider.
 */
export interface SpinProvider {
  spin(request: SpinRequest): Promise<SpinResult>;
}
