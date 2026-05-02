// Thin compatibility shim — new code should use lib/scenarios.ts directly
import { hasAnyScenario } from './scenarios';

export { hasAnyScenario as hasExistingSimulation };

// Kept for any remaining direct imports during migration
export function clearState(): void {
  localStorage.removeItem('lfs-scenarios-v2');
  localStorage.removeItem('life-finance-sim-v1');
}
