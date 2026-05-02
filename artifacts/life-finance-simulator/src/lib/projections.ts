import type { SimulationState, FinancialState } from './types';
import { COUNTRY_INFLATION } from './simulation';
import { getRiskProfile } from './scenarios';

export type ScenarioId = 'optimistic' | 'base' | 'pessimistic';
export type RiskProfile = 'Conservador' | 'Equilibrado' | 'Agresivo';

export interface ProjectionPoint {
  simYear: number;       // simulation year number
  age: number;
  netWorth: number;
  savings: number;
  investments: number;
  income: number;
  expenses: number;
  debt: number;
  label: string;         // "Año 5"
}

export interface ProjectedMilestone {
  amount: number;
  label: string;
  icon: string;
  simYear: number | null;   // null = not reached in projection
  age: number | null;
  reached: boolean;         // already reached in current state
}

export interface ScenarioConfig {
  id: ScenarioId;
  label: string;
  labelShort: string;
  description: string;
  color: string;
  gradientStart: string;
  gradientEnd: string;
}

export const SCENARIO_CONFIGS: Record<ScenarioId, ScenarioConfig> = {
  optimistic: {
    id: 'optimistic',
    label: 'Optimista',
    labelShort: 'OPT',
    description: 'Buenas decisiones, crecimiento de ingresos fuerte y rendimientos de mercado superiores.',
    color: 'hsl(142 76% 50%)',
    gradientStart: 'rgba(34,197,94,0.25)',
    gradientEnd: 'rgba(34,197,94,0)',
  },
  base: {
    id: 'base',
    label: 'Base',
    labelShort: 'BASE',
    description: 'Comportamiento financiero promedio, decisiones mixtas, rendimientos históricos.',
    color: 'hsl(252 87% 67%)',
    gradientStart: 'rgba(124,90,255,0.25)',
    gradientEnd: 'rgba(124,90,255,0)',
  },
  pessimistic: {
    id: 'pessimistic',
    label: 'Pesimista',
    labelShort: 'PES',
    description: 'Malas decisiones, eventos negativos, rendimientos bajos y menor crecimiento de ingresos.',
    color: 'hsl(38 92% 60%)',
    gradientStart: 'rgba(245,158,11,0.20)',
    gradientEnd: 'rgba(245,158,11,0)',
  },
};

// Rates indexed by [scenario][riskProfile]
const RATES: Record<ScenarioId, Record<RiskProfile, {
  incomeGrowth: number;    // annual
  investReturn: number;    // annual
  expenseGrowthExtra: number; // added to inflation
  savingsRateAdjust: number;  // added to current savings rate
  debtPayoffRate: number;  // fraction of monthly income applied to debt
  shockEvery: number;      // years between negative shocks (0 = none)
  shockSize: number;       // fraction of netWorth lost in shock
}>> = {
  optimistic: {
    Conservador: { incomeGrowth: 0.05, investReturn: 0.08, expenseGrowthExtra: -0.005, savingsRateAdjust: 0.07,  debtPayoffRate: 0.25, shockEvery: 0,  shockSize: 0 },
    Equilibrado: { incomeGrowth: 0.07, investReturn: 0.11, expenseGrowthExtra: -0.010, savingsRateAdjust: 0.10,  debtPayoffRate: 0.30, shockEvery: 0,  shockSize: 0 },
    Agresivo:    { incomeGrowth: 0.09, investReturn: 0.14, expenseGrowthExtra: -0.015, savingsRateAdjust: 0.12,  debtPayoffRate: 0.35, shockEvery: 0,  shockSize: 0 },
  },
  base: {
    Conservador: { incomeGrowth: 0.03, investReturn: 0.05, expenseGrowthExtra: 0,       savingsRateAdjust: 0,     debtPayoffRate: 0.12, shockEvery: 0,  shockSize: 0 },
    Equilibrado: { incomeGrowth: 0.04, investReturn: 0.07, expenseGrowthExtra: 0,       savingsRateAdjust: 0,     debtPayoffRate: 0.15, shockEvery: 0,  shockSize: 0 },
    Agresivo:    { incomeGrowth: 0.06, investReturn: 0.09, expenseGrowthExtra: 0,       savingsRateAdjust: 0,     debtPayoffRate: 0.18, shockEvery: 0,  shockSize: 0 },
  },
  pessimistic: {
    Conservador: { incomeGrowth: 0.01, investReturn: 0.02, expenseGrowthExtra: 0.01,    savingsRateAdjust: -0.06, debtPayoffRate: 0.06, shockEvery: 7,  shockSize: 0.08 },
    Equilibrado: { incomeGrowth: 0.015,investReturn: 0.03, expenseGrowthExtra: 0.015,   savingsRateAdjust: -0.08, debtPayoffRate: 0.08, shockEvery: 6,  shockSize: 0.10 },
    Agresivo:    { incomeGrowth: 0.02, investReturn: 0.02, expenseGrowthExtra: 0.02,    savingsRateAdjust: -0.10, debtPayoffRate: 0.10, shockEvery: 5,  shockSize: 0.15 },
  },
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function getRisk(state: SimulationState): RiskProfile {
  const r = getRiskProfile(state.achievementData.highRiskCount);
  if (r.label === 'Agresivo') return 'Agresivo';
  if (r.label === 'Moderado') return 'Equilibrado';
  return 'Conservador';
}

function currentSavingsRate(f: FinancialState): number {
  if (f.monthlyIncome <= 0) return 0.10;
  const surplus = f.monthlyIncome - f.monthlyExpenses;
  return Math.max(0.02, Math.min(0.55, surplus / f.monthlyIncome));
}

function investmentAllocation(riskProfile: RiskProfile, scenario: ScenarioId): number {
  // Fraction of monthly surplus going to investments vs savings
  const base: Record<RiskProfile, number> = { Conservador: 0.25, Equilibrado: 0.40, Agresivo: 0.55 };
  const adj: Record<ScenarioId, number> = { optimistic: 0.08, base: 0, pessimistic: -0.10 };
  return Math.max(0, Math.min(0.70, base[riskProfile] + adj[scenario]));
}

// ─── SINGLE SCENARIO PROJECTION ───────────────────────────────────────────────
export function projectScenario(
  state: SimulationState,
  scenarioId: ScenarioId,
  horizonYears: number
): ProjectionPoint[] {
  const f = state.financial;
  const country = state.profile?.country ?? 'USA';
  const inflation = COUNTRY_INFLATION[country] ?? 0.035;
  const riskProfile = getRisk(state);
  const rates = RATES[scenarioId][riskProfile];
  const invAlloc = investmentAllocation(riskProfile, scenarioId);

  // Derive base savings rate from current state
  const baseSavingsRate = currentSavingsRate(f);
  const adjSavingsRate = Math.max(0.03, Math.min(0.70, baseSavingsRate + rates.savingsRateAdjust));
  const expenseGrowthRate = inflation + rates.expenseGrowthExtra;

  const points: ProjectionPoint[] = [];

  // Start state
  let income = f.monthlyIncome;
  let expenses = f.monthlyExpenses;
  let savings = Math.max(0, f.savings);
  let investments = Math.max(0, f.investments);
  let debt = Math.max(0, f.debt);
  let cash = Math.max(0, f.cash);

  for (let i = 1; i <= horizonYears; i++) {
    // Annual compounding
    income *= (1 + rates.incomeGrowth);
    expenses *= (1 + expenseGrowthRate);
    expenses = Math.min(expenses, income * 0.90); // expenses can't exceed 90% of income

    const annualSurplus = Math.max(0, (income - expenses) * 12);
    const toSavings = annualSurplus * (adjSavingsRate * (1 - invAlloc));
    const toInvestments = annualSurplus * adjSavingsRate * invAlloc;

    savings += toSavings;
    savings *= 1.025; // savings account interest ~2.5%

    investments = (investments + toInvestments) * (1 + rates.investReturn);

    // Debt payoff: apply monthly payment
    const monthlyDebtPayment = income * rates.debtPayoffRate;
    debt = Math.max(0, debt - monthlyDebtPayment * 12);
    debt *= 1.08; // interest on remaining debt ~8%
    debt = Math.max(0, debt - monthlyDebtPayment * 12); // apply again after interest

    // Emergency cash: target 3 months expenses, grows slowly
    cash = Math.min(cash * 1.01, expenses * 3);

    // Pessimistic shock events
    if (rates.shockEvery > 0 && i % rates.shockEvery === 0) {
      const nw = cash + savings + investments - debt;
      const shock = Math.max(0, nw) * rates.shockSize;
      if (investments > shock * 0.6) investments -= shock * 0.6;
      if (savings > shock * 0.4) savings -= shock * 0.4;
    }

    const netWorth = cash + savings + investments - debt;
    points.push({
      simYear: f.year + i,
      age: f.age + i,
      netWorth: Math.round(netWorth),
      savings: Math.round(Math.max(0, savings)),
      investments: Math.round(Math.max(0, investments)),
      income: Math.round(income),
      expenses: Math.round(expenses),
      debt: Math.round(Math.max(0, debt)),
      label: `Año ${f.year + i}`,
    });
  }

  return points;
}

// ─── MILESTONE DETECTION ──────────────────────────────────────────────────────
const WEALTH_MILESTONES = [
  { amount: 25_000,   label: 'Primeros $25K',     icon: '🌱' },
  { amount: 50_000,   label: 'Fondo $50K',         icon: '🪴' },
  { amount: 100_000,  label: 'Primer $100K',        icon: '🎯' },
  { amount: 250_000,  label: 'Cuarto de millón',    icon: '🏆' },
  { amount: 500_000,  label: 'Medio millón',         icon: '💎' },
  { amount: 1_000_000,label: 'Primer millón',        icon: '🚀' },
];

export function detectMilestones(
  currentNetWorth: number,
  points: ProjectionPoint[]
): ProjectedMilestone[] {
  return WEALTH_MILESTONES.map(m => {
    if (currentNetWorth >= m.amount) {
      return { ...m, simYear: null, age: null, reached: true };
    }
    const hit = points.find(p => p.netWorth >= m.amount);
    return {
      ...m,
      simYear: hit ? hit.simYear : null,
      age: hit ? hit.age : null,
      reached: false,
    };
  });
}

// ─── FULL PROJECTIONS RESULT ──────────────────────────────────────────────────
export interface ProjectionsResult {
  riskProfile: RiskProfile;
  currentYear: number;
  currentAge: number;
  currentNetWorth: number;
  scenarios: {
    optimistic: ProjectionPoint[];
    base: ProjectionPoint[];
    pessimistic: ProjectionPoint[];
  };
  milestones: {
    optimistic: ProjectedMilestone[];
    base: ProjectedMilestone[];
    pessimistic: ProjectedMilestone[];
  };
  chartData: ChartDataPoint[];
  insights: ProjectionInsight[];
}

export interface ChartDataPoint {
  simYear: number;
  age: number;
  label: string;
  optimistic: number;
  base: number;
  pessimistic: number;
}

export interface ProjectionInsight {
  type: 'gap' | 'milestone' | 'warning' | 'opportunity';
  title: string;
  detail: string;
  icon: string;
}

export function buildProjections(state: SimulationState): ProjectionsResult {
  const f = state.financial;
  const riskProfile = getRisk(state);

  const optPoints = projectScenario(state, 'optimistic', 20);
  const basePoints = projectScenario(state, 'base', 20);
  const pesPoints = projectScenario(state, 'pessimistic', 20);

  // Merge into chart data
  const chartData: ChartDataPoint[] = optPoints.map((p, i) => ({
    simYear: p.simYear,
    age: p.age,
    label: p.label,
    optimistic: p.netWorth,
    base: basePoints[i].netWorth,
    pessimistic: pesPoints[i].netWorth,
  }));

  const milestones = {
    optimistic: detectMilestones(f.netWorth, optPoints),
    base: detectMilestones(f.netWorth, basePoints),
    pessimistic: detectMilestones(f.netWorth, pesPoints),
  };

  // Generate contextual insights
  const insights: ProjectionInsight[] = [];

  // Gap between scenarios at 10 years
  const opt10 = optPoints[9]?.netWorth ?? 0;
  const pes10 = pesPoints[9]?.netWorth ?? 0;
  const gap10 = opt10 - pes10;
  if (gap10 > 10000) {
    insights.push({
      type: 'gap',
      title: `Diferencia de $${fmtCompact(gap10)} en 10 años`,
      detail: `Entre el escenario optimista y pesimista hay $${fmtCompact(gap10)} de diferencia al año ${f.year + 10}. Tus decisiones de hoy definen en cuál terminas.`,
      icon: '📊',
    });
  }

  // When base hits $100K
  const hit100k = milestones.base.find(m => m.amount === 100_000);
  if (hit100k && !hit100k.reached && hit100k.simYear) {
    const yearsAway = hit100k.simYear - f.year;
    insights.push({
      type: 'milestone',
      title: `$100K en ${yearsAway} año${yearsAway !== 1 ? 's' : ''} (escenario base)`,
      detail: `A tu ritmo actual llegarías a $100K alrededor del año ${hit100k.simYear}, con ${hit100k.age} años. El escenario optimista lo adelantaría.`,
      icon: '🎯',
    });
  } else if (hit100k?.reached) {
    insights.push({
      type: 'opportunity',
      title: 'Ya superaste los $100K',
      detail: `Estás en terreno positivo. Tu siguiente hito es alcanzar $250K. Enfócate en aumentar tus inversiones para acelerarlo.`,
      icon: '✅',
    });
  }

  // Savings rate impact
  const savingsRate = currentSavingsRate(f);
  if (savingsRate < 0.15 && f.monthlyIncome > 2000) {
    const potentialExtra = f.monthlyIncome * 0.10 * 12 * 10; // 10% more savings for 10 years
    insights.push({
      type: 'opportunity',
      title: `+10% de ahorro = +$${fmtCompact(potentialExtra)} en 10 años`,
      detail: `Si aumentaras tu tasa de ahorro del ${Math.round(savingsRate * 100)}% actual a ${Math.round((savingsRate + 0.10) * 100)}%, generarías aproximadamente $${fmtCompact(potentialExtra)} adicionales en 10 años.`,
      icon: '💡',
    });
  }

  // Risk profile note
  if (riskProfile === 'Conservador') {
    const baseOpt10 = opt10 - (basePoints[9]?.netWorth ?? 0);
    if (baseOpt10 > 20000) {
      insights.push({
        type: 'opportunity',
        title: `Potencial adicional de $${fmtCompact(baseOpt10)} con más riesgo`,
        detail: `Un perfil de riesgo equilibrado podría generar $${fmtCompact(baseOpt10)} más en 10 años gracias a mejores rendimientos en inversiones.`,
        icon: '⚡',
      });
    }
  }

  // Pessimistic warning
  const pes20 = pesPoints[19]?.netWorth ?? 0;
  if (pes20 < f.netWorth) {
    insights.push({
      type: 'warning',
      title: 'El escenario pesimista reduce tu patrimonio',
      detail: `En el peor caso, a 20 años tu patrimonio podría ser menor al actual. Mantener un fondo de emergencia y reducir deuda es tu seguro contra este riesgo.`,
      icon: '⚠️',
    });
  }

  return {
    riskProfile,
    currentYear: f.year,
    currentAge: f.age,
    currentNetWorth: f.netWorth,
    scenarios: { optimistic: optPoints, base: basePoints, pessimistic: pesPoints },
    milestones,
    chartData,
    insights,
  };
}

function fmtCompact(n: number): string {
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (Math.abs(n) >= 1_000) return Math.round(n / 1_000) + 'K';
  return Math.round(n).toString();
}

export { fmtCompact };
