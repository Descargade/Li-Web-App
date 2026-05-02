import type { SimulationState, UnlockedAchievement, AchievementDef } from './types';

// ─── ACHIEVEMENT DEFINITIONS ────────────────────────────────────────────────
// Conditions are pure functions evaluated against SimulationState.
// They must return true to unlock. Each is only ever unlocked once.

export const ACHIEVEMENT_DEFS: AchievementDef[] = [
  // ── WEALTH MILESTONES ────────────────────────────────────────────
  {
    id: 'net-worth-25k',
    title: 'Primeros pasos',
    description: 'Alcanza un patrimonio neto de $25,000.',
    icon: '🌱',
    category: 'wealth',
    rarity: 'common',
    condition: (s) => s.financial.netWorth >= 25_000,
  },
  {
    id: 'net-worth-100k',
    title: 'Seis cifras',
    description: 'Alcanza un patrimonio neto de $100,000.',
    icon: '💰',
    category: 'wealth',
    rarity: 'uncommon',
    condition: (s) => s.financial.netWorth >= 100_000,
  },
  {
    id: 'net-worth-250k',
    title: 'Cuarto de millón',
    description: 'Tu patrimonio supera los $250,000.',
    icon: '📦',
    category: 'wealth',
    rarity: 'rare',
    condition: (s) => s.financial.netWorth >= 250_000,
  },
  {
    id: 'net-worth-1m',
    title: 'Millonario',
    description: 'Tu patrimonio neto supera $1,000,000. Nivel élite.',
    icon: '🏆',
    category: 'wealth',
    rarity: 'legendary',
    condition: (s) => s.financial.netWorth >= 1_000_000,
  },

  // ── INVESTMENT ───────────────────────────────────────────────────
  {
    id: 'first-investment',
    title: 'Primer inversor',
    description: 'Realizas tu primera inversión en el mercado.',
    icon: '📈',
    category: 'investment',
    rarity: 'common',
    condition: (s) => s.financial.investments > 0,
  },
  {
    id: 'investments-50k',
    title: 'Portafolio sólido',
    description: 'Tu cartera de inversiones supera los $50,000.',
    icon: '📊',
    category: 'investment',
    rarity: 'uncommon',
    condition: (s) => s.financial.investments >= 50_000,
  },
  {
    id: 'investments-3-types',
    title: 'Diversificado',
    description: 'Aceptas al menos 3 decisiones de inversión diferentes.',
    icon: '🔀',
    category: 'investment',
    rarity: 'uncommon',
    condition: (s) => s.achievementData.investmentDecisionCount >= 3,
  },
  {
    id: 'passive-income',
    title: 'Ingreso pasivo',
    description: 'Tus inversiones superan un año de tu salario.',
    icon: '💸',
    category: 'investment',
    rarity: 'rare',
    condition: (s) => s.financial.investments >= s.financial.monthlyIncome * 12,
  },

  // ── DISCIPLINE ───────────────────────────────────────────────────
  {
    id: 'debt-free',
    title: 'Sin deudas',
    description: 'Eliminas toda tu deuda después de haberla acumulado.',
    icon: '🔓',
    category: 'discipline',
    rarity: 'uncommon',
    condition: (s) => s.achievementData.hadDebt && s.financial.debt < 500,
  },
  {
    id: 'saver',
    title: 'Ahorrador nato',
    description: 'Tus ahorros superan un año completo de tu salario.',
    icon: '🏦',
    category: 'discipline',
    rarity: 'uncommon',
    condition: (s) => s.financial.savings >= s.financial.monthlyIncome * 12,
  },
  {
    id: 'emergency-fund',
    title: 'Fondo de emergencia',
    description: 'Tienes al menos 6 meses de gastos en reserva.',
    icon: '🛡️',
    category: 'discipline',
    rarity: 'common',
    condition: (s) => s.financial.savings >= s.financial.monthlyExpenses * 6,
  },
  {
    id: 'consistent-growth',
    title: 'Crecimiento constante',
    description: 'Tu patrimonio crece durante 5 años consecutivos.',
    icon: '📉→📈',
    category: 'discipline',
    rarity: 'rare',
    condition: (s) => s.achievementData.consecutiveGrowthYears >= 5,
  },

  // ── RISK ─────────────────────────────────────────────────────────
  {
    id: 'risk-taker',
    title: 'Jugador audaz',
    description: 'Aceptas 3 o más decisiones de alto riesgo.',
    icon: '🎲',
    category: 'risk',
    rarity: 'uncommon',
    condition: (s) => s.achievementData.highRiskCount >= 3,
  },
  {
    id: 'entrepreneur',
    title: 'Emprendedor',
    description: 'Lanzas tu propio negocio o consultoría.',
    icon: '🚀',
    category: 'risk',
    rarity: 'rare',
    condition: (s) =>
      s.achievementData.acceptedDecisionIds.includes('entrepreneurship') ||
      s.achievementData.acceptedDecisionIds.includes('consulting'),
  },
  {
    id: 'crypto-survivor',
    title: 'Crypto survivor',
    description: 'Inviertes en cripto y tu patrimonio sigue positivo.',
    icon: '🪙',
    category: 'risk',
    rarity: 'uncommon',
    condition: (s) =>
      s.achievementData.acceptedDecisionIds.includes('invest-crypto') &&
      s.financial.netWorth > 0,
  },

  // ── BALANCE ──────────────────────────────────────────────────────
  {
    id: 'zen',
    title: 'Zen financiero',
    description: 'Felicidad > 75 y estrés < 30 al mismo tiempo.',
    icon: '🧘',
    category: 'balance',
    rarity: 'rare',
    condition: (s) =>
      s.financial.happinessLevel > 75 && s.financial.stressLevel < 30,
  },
  {
    id: 'career-climber',
    title: 'Escalador de carrera',
    description: 'Aceptas 3 o más decisiones de carrera.',
    icon: '🪜',
    category: 'balance',
    rarity: 'uncommon',
    condition: (s) => s.achievementData.careerDecisionCount >= 3,
  },

  // ── MILESTONE ────────────────────────────────────────────────────
  {
    id: 'year-5',
    title: 'Cinco años simulados',
    description: 'Completas 5 años en la simulación.',
    icon: '📅',
    category: 'milestone',
    rarity: 'common',
    condition: (s) => s.financial.year >= 5,
  },
  {
    id: 'year-10',
    title: 'Veterano',
    description: 'Completas 10 años en la simulación.',
    icon: '🎖️',
    category: 'milestone',
    rarity: 'uncommon',
    condition: (s) => s.financial.year >= 10,
  },
  {
    id: 'year-20',
    title: 'Visión a largo plazo',
    description: 'Completas 20 años en la simulación.',
    icon: '🔭',
    category: 'milestone',
    rarity: 'rare',
    condition: (s) => s.financial.year >= 20,
  },
];

export const ACHIEVEMENT_MAP = Object.fromEntries(
  ACHIEVEMENT_DEFS.map(a => [a.id, a])
);

// ─── CHECK FOR NEW ACHIEVEMENTS ─────────────────────────────────────────────
// Returns only newly-unlocked achievements (not in alreadyUnlocked set).
export function checkAchievements(
  state: SimulationState,
  alreadyUnlocked: string[]
): UnlockedAchievement[] {
  const unlocked = new Set(alreadyUnlocked);
  const newlyUnlocked: UnlockedAchievement[] = [];

  for (const def of ACHIEVEMENT_DEFS) {
    if (unlocked.has(def.id)) continue;
    try {
      if (def.condition(state)) {
        newlyUnlocked.push({
          id: def.id,
          unlockedYear: state.financial.year,
          unlockedAge: state.financial.age,
        });
      }
    } catch {
      // condition threw (e.g. missing data) — skip silently
    }
  }

  return newlyUnlocked;
}

// ─── UPDATE ACHIEVEMENT DATA FROM ACCEPTED DECISION ─────────────────────────
// Call this when a decision is accepted, before checking achievements.
export function updateAchievementData(
  state: SimulationState,
  decisionId: string,
  decisionRisk: 'LOW' | 'MED' | 'HIGH',
  decisionCategory: string
): SimulationState {
  const prev = state.achievementData;
  return {
    ...state,
    achievementData: {
      ...prev,
      acceptedDecisionIds: prev.acceptedDecisionIds.includes(decisionId)
        ? prev.acceptedDecisionIds
        : [...prev.acceptedDecisionIds, decisionId],
      highRiskCount: decisionRisk === 'HIGH' ? prev.highRiskCount + 1 : prev.highRiskCount,
      investmentDecisionCount:
        decisionCategory === 'investment' ? prev.investmentDecisionCount + 1 : prev.investmentDecisionCount,
      careerDecisionCount:
        decisionCategory === 'career' ? prev.careerDecisionCount + 1 : prev.careerDecisionCount,
      hadDebt: prev.hadDebt,
      consecutiveGrowthYears: prev.consecutiveGrowthYears,
    },
  };
}

// ─── UPDATE ACHIEVEMENT DATA AFTER YEAR ADVANCE ─────────────────────────────
export function updateAchievementDataPostYear(
  state: SimulationState,
  prevNetWorth: number
): SimulationState {
  const grew = state.financial.netWorth > prevNetWorth;
  const prevData = state.achievementData;
  return {
    ...state,
    achievementData: {
      ...prevData,
      hadDebt: prevData.hadDebt || state.financial.debt > 1000,
      consecutiveGrowthYears: grew
        ? prevData.consecutiveGrowthYears + 1
        : 0,
    },
  };
}

export const RARITY_STYLES: Record<string, { border: string; bg: string; label: string; color: string }> = {
  common:    { border: 'border-border/60',    bg: 'bg-secondary/40',    label: 'Común',    color: 'text-muted-foreground' },
  uncommon:  { border: 'border-primary/40',   bg: 'bg-primary/8',       label: 'Especial', color: 'text-primary' },
  rare:      { border: 'border-cyan-400/40',  bg: 'bg-cyan-400/8',      label: 'Raro',     color: 'text-cyan-400' },
  legendary: { border: 'border-amber-400/50', bg: 'bg-amber-400/8',     label: 'Legendario', color: 'text-amber-400' },
};

export const CATEGORY_LABELS: Record<string, string> = {
  wealth: 'Riqueza', investment: 'Inversión', discipline: 'Disciplina',
  risk: 'Riesgo', balance: 'Equilibrio', milestone: 'Hito',
};
