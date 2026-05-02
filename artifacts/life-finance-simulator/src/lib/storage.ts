import type { SimulationState, UserProfile } from './types';
import { createInitialState, calculateScore } from './simulation';

const KEY = 'life-finance-sim-v1';

export function loadState(): SimulationState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SimulationState;
  } catch {
    return null;
  }
}

export function saveState(state: SimulationState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch { /* storage full */ }
}

export function clearState(): void {
  localStorage.removeItem(KEY);
}

export function createNewState(profile: UserProfile): SimulationState {
  const financial = createInitialState(profile);
  return {
    profile,
    financial,
    history: [{ ...financial }],
    timeline: [],
    scenarioA: [],
    scenarioB: [],
    isComparing: false,
    createdAt: new Date().toISOString(),
    score: calculateScore(financial),
  };
}

export function hasExistingSimulation(): boolean {
  const state = loadState();
  return state !== null && state.profile !== null;
}
