import type { UserProfile, FinancialState, TimelineEvent, Decision } from './types';
import { RANDOM_EVENTS } from './events';

export const COUNTRY_INFLATION: Record<string, number> = {
  USA: 0.035,
  Mexico: 0.05,
  Argentina: 0.60,
  Spain: 0.04,
  Brazil: 0.08,
  Germany: 0.03,
  Colombia: 0.07,
  Chile: 0.045,
};

export const COUNTRIES = Object.keys(COUNTRY_INFLATION);

export function calcNetWorth(state: FinancialState): number {
  return state.cash + state.savings + state.investments - state.debt;
}

export function createInitialState(profile: UserProfile): FinancialState {
  const monthlyExpenses = profile.monthlyIncome * 0.55;
  const cash = profile.monthlyIncome * 3;
  return {
    year: 0,
    age: profile.age,
    cash,
    savings: cash * 0.5,
    investments: 0,
    debt: 0,
    monthlyIncome: profile.monthlyIncome,
    monthlyExpenses,
    netWorth: cash + cash * 0.5,
    stressLevel: 20,
    happinessLevel: 60,
  };
}

function clamp(val: number, min: number, max: number) {
  return Math.min(max, Math.max(min, val));
}

function randomVariance(base: number, pct: number): number {
  return base + (Math.random() * 2 - 1) * base * pct;
}

export function maybeRandomEvent(year: number): TimelineEvent | null {
  if (Math.random() > 0.35) return null;
  const pool = RANDOM_EVENTS;
  const picked = pool[Math.floor(Math.random() * pool.length)];
  return {
    ...picked,
    id: `${picked.id}-y${year}-${Math.random().toString(36).slice(2, 6)}`,
    year,
    age: 0,
    type: 'random' as const,
  };
}

export function applyEvent(state: FinancialState, event: TimelineEvent): FinancialState {
  const imp = event.impact;
  const newState = { ...state };
  if (imp.cash !== undefined) {
    if (imp.cash < 0) {
      newState.cash = Math.max(0, newState.cash + imp.cash);
    } else {
      newState.cash += imp.cash;
    }
  }
  if (imp.savings !== undefined) newState.savings = Math.max(0, newState.savings + imp.savings);
  if (imp.investments !== undefined) {
    if (imp.investments < 0) {
      newState.investments = Math.max(0, newState.investments * (1 + imp.investments));
    } else {
      newState.investments = newState.investments * (1 + imp.investments);
    }
  }
  if (imp.debt !== undefined) newState.debt = Math.max(0, newState.debt + imp.debt);
  if (imp.income !== undefined) {
    newState.monthlyIncome = Math.max(500, newState.monthlyIncome * (1 + imp.income));
  }
  if (imp.stress !== undefined) newState.stressLevel = clamp(newState.stressLevel + imp.stress, 0, 100);
  if (imp.happiness !== undefined) newState.happinessLevel = clamp(newState.happinessLevel + imp.happiness, 0, 100);
  newState.netWorth = calcNetWorth(newState);
  return newState;
}

export function applyDecision(state: FinancialState, decision: Decision): FinancialState {
  const fakeEvent: TimelineEvent = {
    id: decision.id,
    year: state.year,
    age: state.age,
    type: 'decision',
    title: decision.name,
    description: decision.description,
    impact: decision.impact,
    icon: decision.emoji,
    color: '#7c5aff',
  };
  return applyEvent(state, fakeEvent);
}

export function advanceYear(
  state: FinancialState,
  profile: UserProfile
): { newState: FinancialState; triggeredEvents: TimelineEvent[] } {
  const events: TimelineEvent[] = [];
  let s = { ...state };

  const inflation = COUNTRY_INFLATION[profile.country] ?? 0.04;

  // Annual income (12 months)
  const annualIncome = s.monthlyIncome * 12;
  const annualExpenses = s.monthlyExpenses * 12;
  const annualSurplus = annualIncome - annualExpenses;

  // Add surplus to cash
  s.cash += annualSurplus;

  // Apply inflation to expenses
  s.monthlyExpenses = s.monthlyExpenses * (1 + inflation);

  // Investment returns (avg 7% ± variance)
  if (s.investments > 0) {
    const returnRate = randomVariance(0.07, 0.15);
    s.investments = s.investments * (1 + returnRate);
  }

  // Savings interest (2%)
  if (s.savings > 0) {
    s.savings = s.savings * 1.02;
  }

  // Debt interest (5%)
  if (s.debt > 0) {
    s.debt = s.debt * 1.05;
  }

  // Advance time
  s.year += 1;
  s.age += 1;

  // Maybe random event
  const randomEvent = maybeRandomEvent(s.year);
  if (randomEvent) {
    randomEvent.age = s.age;
    s = applyEvent(s, randomEvent);
    events.push(randomEvent);
  }

  // Recalculate net worth
  s.netWorth = calcNetWorth(s);

  // Stress/happiness drift over time
  s.stressLevel = clamp(s.stressLevel - 2 + Math.random() * 4, 0, 100);
  s.happinessLevel = clamp(s.happinessLevel + (s.netWorth > state.netWorth ? 2 : -2) + (Math.random() * 4 - 2), 0, 100);

  return { newState: s, triggeredEvents: events };
}

export function getDecisionsForYear(state: FinancialState, year: number): Decision[] {
  const ALL_DECISIONS: Decision[] = [
    {
      id: 'job-change',
      name: 'Cambiar de trabajo',
      description: 'Nuevas oportunidades, mayor ingreso pero transición costosa.',
      risk: 'MED',
      emoji: '💼',
      impact: {
        income: 0.25 + Math.random() * 0.15,
        cash: -5000,
        stress: 20,
        happiness: 10,
      },
    },
    {
      id: 'invest-stocks',
      name: 'Invertir en bolsa',
      description: 'Poner $10,000 en el mercado. Retorno promedio del 7% anual, con riesgo.',
      risk: 'MED',
      emoji: '📈',
      impact: {
        cash: -10000,
        investments: 10000,
        stress: 10,
      },
    },
    {
      id: 'buy-house',
      name: 'Comprar una casa',
      description: 'Gran deuda pero activo que aprecia. Felicidad garantizada.',
      risk: 'HIGH',
      emoji: '🏠',
      impact: {
        debt: 200000,
        cash: -30000,
        happiness: 30,
        stress: 25,
      },
    },
    {
      id: 'save-aggressive',
      name: 'Ahorrar agresivamente',
      description: 'Guardar el 30% extra del ingreso mensual en cuenta de ahorro.',
      risk: 'LOW',
      emoji: '🏦',
      impact: {
        savings: state.monthlyIncome * 3.6,
        cash: -(state.monthlyIncome * 3.6),
        stress: 10,
        happiness: -5,
      },
    },
    {
      id: 'entrepreneurship',
      name: 'Emprender',
      description: 'Invertir en tu propio negocio. Alto riesgo, alta recompensa.',
      risk: 'HIGH',
      emoji: '🚀',
      impact: Math.random() > 0.5
        ? { cash: -30000, income: 2.0, happiness: 40, stress: 40 }
        : { cash: -30000, stress: 50, happiness: -10 },
    },
    {
      id: 'travel',
      name: 'Viaje soñado',
      description: 'Tomarte un año sabático y viajar. Cuida tu bienestar mental.',
      risk: 'LOW',
      emoji: '✈️',
      impact: {
        cash: -8000,
        happiness: 40,
        stress: -30,
      },
    },
    {
      id: 'education',
      name: 'Educación / MBA',
      description: 'Invertir en ti mismo. Deuda ahora, ingresos premium después.',
      risk: 'MED',
      emoji: '🎓',
      impact: {
        debt: 40000,
        income: 0.35,
        stress: 15,
        happiness: 15,
      },
    },
    {
      id: 'pay-debt',
      name: 'Pagar deudas',
      description: 'Destinar el 50% del efectivo a reducir deudas pendientes.',
      risk: 'LOW',
      emoji: '💳',
      impact: {
        cash: -(state.cash * 0.5),
        debt: -(state.cash * 0.5),
        stress: -20,
        happiness: 10,
      },
    },
    {
      id: 'freelance',
      name: 'Freelance extra',
      description: 'Trabajo adicional en las noches y fines de semana. +20% ingresos.',
      risk: 'LOW',
      emoji: '💻',
      impact: {
        income: 0.20,
        stress: 25,
        happiness: 5,
      },
    },
    {
      id: 'reduce-expenses',
      name: 'Recortar gastos',
      description: 'Modo ahorro extremo. Menos diversión, más dinero guardado.',
      risk: 'LOW',
      emoji: '✂️',
      impact: {
        savings: state.monthlyIncome * 2,
        stress: 5,
        happiness: -10,
      },
    },
    {
      id: 'real-estate',
      name: 'Inversión inmobiliaria',
      description: 'Comprar propiedad para rentar. Ingreso pasivo mensual.',
      risk: 'HIGH',
      emoji: '🏢',
      impact: {
        cash: -50000,
        debt: 150000,
        income: 0.15,
        stress: 15,
        happiness: 20,
      },
    },
    {
      id: 'health-insurance',
      name: 'Seguro completo',
      description: 'Protección ante emergencias. Tranquilidad ante lo inesperado.',
      risk: 'LOW',
      emoji: '🛡️',
      impact: {
        cash: -3600,
        stress: -15,
        happiness: 10,
      },
    },
  ];

  // Filter out decisions that don't make sense for current state
  let filtered = ALL_DECISIONS.filter(d => {
    if (d.id === 'pay-debt' && state.debt < 1000) return false;
    if (d.id === 'invest-stocks' && state.cash < 10000) return false;
    if (d.id === 'buy-house' && state.cash < 30000) return false;
    if (d.id === 'real-estate' && state.cash < 50000) return false;
    return true;
  });

  // Shuffle and pick 4
  filtered = filtered.sort(() => Math.random() - 0.5);
  return filtered.slice(0, 4);
}

export function getFeedbackMessage(current: FinancialState, previous: FinancialState | null): string {
  const messages: string[] = [];

  if (current.debt > current.netWorth * 0.5 && current.debt > 0) {
    messages.push('Tu deuda supera el 50% de tu patrimonio. Considera priorizar pagos antes de invertir más.');
  }
  if (current.savings > current.monthlyIncome * 0.3 * 12) {
    messages.push('Excelente disciplina de ahorro. Tu futuro yo te lo agradecerá.');
  }
  if (current.stressLevel > 70) {
    messages.push('Niveles de estrés críticos. El bienestar también es parte de la riqueza.');
  }
  if (previous && current.netWorth > previous.netWorth * 1.15) {
    messages.push('Crecimiento patrimonial excepcional este año. Estás en el camino correcto.');
  }
  if (current.investments === 0) {
    messages.push('No tienes inversiones activas. La inflación erosiona tu dinero cada año.');
  }
  if (current.cash < current.monthlyExpenses * 3) {
    messages.push('Fondo de emergencia bajo. Mantén al menos 3 meses de gastos en efectivo.');
  }
  if (current.happinessLevel > 75 && current.netWorth > 100000) {
    messages.push('Equilibrio financiero y personal. Pocas personas logran esto. Sigue así.');
  }
  if (current.age > 50 && current.savings < current.monthlyIncome * 24) {
    messages.push('Con más de 50 años, la planificación del retiro se vuelve urgente.');
  }

  if (messages.length === 0) {
    const defaults = [
      'Avanzas a paso firme. Las decisiones constantes construyen riqueza duradera.',
      'Cada año cuenta. Pequeñas mejoras hoy generan grandes resultados mañana.',
      'La clave del éxito financiero es la consistencia, no la suerte.',
    ];
    return defaults[Math.floor(Math.random() * defaults.length)];
  }

  return messages[Math.floor(Math.random() * messages.length)];
}

export function formatCurrency(amount: number, country?: string): string {
  const localeMap: Record<string, { locale: string; currency: string }> = {
    USA: { locale: 'en-US', currency: 'USD' },
    Mexico: { locale: 'es-MX', currency: 'MXN' },
    Argentina: { locale: 'es-AR', currency: 'ARS' },
    Spain: { locale: 'es-ES', currency: 'EUR' },
    Brazil: { locale: 'pt-BR', currency: 'BRL' },
    Germany: { locale: 'de-DE', currency: 'EUR' },
    Colombia: { locale: 'es-CO', currency: 'COP' },
    Chile: { locale: 'es-CL', currency: 'CLP' },
  };
  const cfg = country ? (localeMap[country] ?? localeMap['USA']) : localeMap['USA'];
  return new Intl.NumberFormat(cfg.locale, {
    style: 'currency',
    currency: cfg.currency,
    maximumFractionDigits: 0,
  }).format(amount);
}
