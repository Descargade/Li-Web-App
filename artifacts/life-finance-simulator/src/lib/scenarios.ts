import type { Scenario, ScenariosStore, ScenarioColor, UserProfile, SimulationState } from './types';
import { createInitialState, calculateScore } from './simulation';

const STORE_KEY = 'lfs-scenarios-v2';
const LEGACY_KEY = 'life-finance-sim-v1';

// ─── COLOR PALETTE ────────────────────────────────────────────────────────────
export const SCENARIO_COLORS: Record<ScenarioColor, {
  dot: string; bg: string; border: string; text: string; chart: string; label: string;
}> = {
  violet: { dot: 'bg-primary',     bg: 'bg-primary/10',     border: 'border-primary/40',     text: 'text-primary',     chart: 'hsl(252 87% 67%)', label: 'Violeta' },
  cyan:   { dot: 'bg-cyan-400',    bg: 'bg-cyan-400/10',    border: 'border-cyan-400/40',    text: 'text-cyan-400',    chart: 'hsl(186 90% 55%)', label: 'Cyan' },
  green:  { dot: 'bg-green-400',   bg: 'bg-green-400/10',   border: 'border-green-400/40',   text: 'text-green-400',   chart: 'hsl(142 76% 56%)', label: 'Verde' },
  amber:  { dot: 'bg-amber-400',   bg: 'bg-amber-400/10',   border: 'border-amber-400/40',   text: 'text-amber-400',   chart: 'hsl(38 92% 60%)',  label: 'Ámbar' },
  rose:   { dot: 'bg-rose-400',    bg: 'bg-rose-400/10',    border: 'border-rose-400/40',    text: 'text-rose-400',    chart: 'hsl(351 83% 61%)', label: 'Rosa' },
  orange: { dot: 'bg-orange-400',  bg: 'bg-orange-400/10',  border: 'border-orange-400/40',  text: 'text-orange-400',  chart: 'hsl(25 95% 60%)',  label: 'Naranja' },
};

export const SCENARIO_EMOJIS = ['🌱','💰','🚀','⚖️','🎯','🏆','💼','📈','🌎','🔮','⚡','🌊','🧭','🦁','🤝','🌙'];

function defaultAchievementData() {
  return {
    acceptedDecisionIds: [],
    highRiskCount: 0,
    hadDebt: false,
    investmentDecisionCount: 0,
    careerDecisionCount: 0,
    consecutiveGrowthYears: 0,
  };
}

// ─── STORE LOAD / SAVE ────────────────────────────────────────────────────────
function loadStore(): ScenariosStore {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const store = JSON.parse(raw) as ScenariosStore;
      // back-fill achievementData for older saves
      store.scenarios = store.scenarios.map(sc => ({
        ...sc,
        state: {
          ...sc.state,
          unlockedAchievements: sc.state.unlockedAchievements ?? [],
          achievementData: sc.state.achievementData ?? defaultAchievementData(),
        },
      }));
      return store;
    }
  } catch { /* corrupt */ }

  // Try migrating from legacy single-scenario storage
  try {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const legacyState = JSON.parse(legacy) as SimulationState;
      if (legacyState.profile) {
        const migrated: Scenario = {
          id: crypto.randomUUID(),
          name: 'Mi simulación',
          description: 'Importada de versión anterior',
          color: 'violet',
          emoji: '📈',
          createdAt: legacyState.createdAt,
          state: {
            ...legacyState,
            unlockedAchievements: legacyState.unlockedAchievements ?? [],
            achievementData: legacyState.achievementData ?? defaultAchievementData(),
          },
        };
        const store: ScenariosStore = { scenarios: [migrated], activeId: migrated.id, version: 1 };
        saveStore(store);
        localStorage.removeItem(LEGACY_KEY);
        return store;
      }
    }
  } catch { /* ignore */ }

  return { scenarios: [], activeId: null, version: 1 };
}

function saveStore(store: ScenariosStore): void {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch { /* storage full */ }
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────
export function getAllScenarios(): Scenario[] {
  return loadStore().scenarios;
}

export function getActiveScenarioId(): string | null {
  return loadStore().activeId;
}

export function getActiveScenario(): Scenario | null {
  const store = loadStore();
  return store.scenarios.find(s => s.id === store.activeId) ?? store.scenarios[0] ?? null;
}

export function getScenarioById(id: string): Scenario | null {
  return loadStore().scenarios.find(s => s.id === id) ?? null;
}

export function setActiveScenarioId(id: string): void {
  const store = loadStore();
  store.activeId = id;
  saveStore(store);
}

export function createScenario(opts: {
  name: string;
  description: string;
  color: ScenarioColor;
  emoji: string;
  profile: UserProfile;
}): Scenario {
  const financial = createInitialState(opts.profile);
  const state: SimulationState = {
    profile: opts.profile,
    financial,
    history: [{ ...financial }],
    timeline: [],
    scenarioA: [],
    scenarioB: [],
    isComparing: false,
    createdAt: new Date().toISOString(),
    score: calculateScore(financial),
    unlockedAchievements: [],
    achievementData: defaultAchievementData(),
  };
  const scenario: Scenario = {
    id: crypto.randomUUID(),
    name: opts.name,
    description: opts.description,
    color: opts.color,
    emoji: opts.emoji,
    createdAt: new Date().toISOString(),
    state,
  };
  const store = loadStore();
  store.scenarios.push(scenario);
  store.activeId = scenario.id;
  saveStore(store);
  return scenario;
}

export function updateScenarioState(id: string, state: SimulationState): void {
  const store = loadStore();
  const idx = store.scenarios.findIndex(s => s.id === id);
  if (idx >= 0) { store.scenarios[idx].state = state; saveStore(store); }
}

export function deleteScenario(id: string): void {
  const store = loadStore();
  store.scenarios = store.scenarios.filter(s => s.id !== id);
  if (store.activeId === id) {
    store.activeId = store.scenarios[0]?.id ?? null;
  }
  saveStore(store);
}

export function hasAnyScenario(): boolean {
  return loadStore().scenarios.length > 0;
}

// ─── COMPARISON HELPERS ───────────────────────────────────────────────────────
export function getRiskProfile(highRiskCount: number): { label: string; color: string; level: number } {
  if (highRiskCount >= 4) return { label: 'Agresivo', color: 'text-red-400', level: 3 };
  if (highRiskCount >= 2) return { label: 'Moderado', color: 'text-amber-400', level: 2 };
  return { label: 'Conservador', color: 'text-green-400', level: 1 };
}
