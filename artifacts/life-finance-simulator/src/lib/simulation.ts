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

export function clamp(val: number, min: number, max: number) {
  return Math.min(max, Math.max(min, val));
}

function rv(base: number, pct: number): number {
  return base + (Math.random() * 2 - 1) * base * pct;
}

export function createInitialState(profile: UserProfile): FinancialState {
  const monthlyExpenses = profile.monthlyIncome * 0.55;
  const cash = profile.monthlyIncome * 3;
  return {
    year: 0, age: profile.age, cash,
    savings: cash * 0.5, investments: 0, debt: 0,
    monthlyIncome: profile.monthlyIncome, monthlyExpenses,
    netWorth: cash + cash * 0.5,
    stressLevel: 20, happinessLevel: 60,
  };
}

export function applyImpact(state: FinancialState, imp: TimelineEvent['impact']): FinancialState {
  const s = { ...state };
  if (imp.cash !== undefined) s.cash = Math.max(0, s.cash + imp.cash);
  if (imp.savings !== undefined) s.savings = Math.max(0, s.savings + imp.savings);
  if (imp.investments !== undefined) {
    s.investments = imp.investments < 0
      ? Math.max(0, s.investments * (1 + imp.investments))
      : s.investments + imp.investments;
  }
  if (imp.debt !== undefined) s.debt = Math.max(0, s.debt + imp.debt);
  if (imp.income !== undefined) s.monthlyIncome = Math.max(500, s.monthlyIncome * (1 + imp.income));
  if (imp.stress !== undefined) s.stressLevel = clamp(s.stressLevel + imp.stress, 0, 100);
  if (imp.happiness !== undefined) s.happinessLevel = clamp(s.happinessLevel + imp.happiness, 0, 100);
  s.netWorth = calcNetWorth(s);
  return s;
}

export function applyEvent(state: FinancialState, event: TimelineEvent): FinancialState {
  return applyImpact(state, event.impact);
}

export function maybeRandomEvent(year: number, age: number): TimelineEvent | null {
  if (Math.random() > 0.40) return null;
  const pool = RANDOM_EVENTS;
  const picked = pool[Math.floor(Math.random() * pool.length)];
  return {
    ...picked,
    id: `${picked.id}-y${year}-${Math.random().toString(36).slice(2, 6)}`,
    year, age, type: 'random' as const,
  };
}

export function advanceYear(
  state: FinancialState,
  profile: UserProfile
): { newState: FinancialState; triggeredEvents: TimelineEvent[] } {
  const events: TimelineEvent[] = [];
  let s = { ...state };
  const inflation = COUNTRY_INFLATION[profile.country] ?? 0.04;

  s.cash += s.monthlyIncome * 12 - s.monthlyExpenses * 12;
  s.monthlyExpenses = s.monthlyExpenses * (1 + inflation);
  if (s.investments > 0) s.investments = s.investments * (1 + rv(0.07, 0.20));
  if (s.savings > 0) s.savings = s.savings * 1.025;
  if (s.debt > 0) s.debt = s.debt * 1.05;

  s.year += 1;
  s.age += 1;

  const randomEvent = maybeRandomEvent(s.year, s.age);
  if (randomEvent) {
    s = applyEvent(s, randomEvent);
    events.push(randomEvent);
  }

  s.netWorth = calcNetWorth(s);
  s.stressLevel = clamp(s.stressLevel - 2 + Math.random() * 4, 0, 100);
  s.happinessLevel = clamp(s.happinessLevel + (s.netWorth > state.netWorth ? 2 : -1) + (Math.random() * 4 - 2), 0, 100);

  return { newState: s, triggeredEvents: events };
}

// ─── SCORE ──────────────────────────────────────────────────────────────
export function calculateScore(state: FinancialState): number {
  let score = 0;
  const ageBonus = Math.max(0, 65 - state.age);

  // Net worth vs age benchmark ($15k/year of life)
  const nwBenchmark = state.age * 15000;
  score += Math.min(300, (state.netWorth / nwBenchmark) * 200);

  // Savings rate (savings+investments vs income)
  const annualIncome = state.monthlyIncome * 12;
  const savingsRate = (state.savings + state.investments) / Math.max(annualIncome, 1);
  score += Math.min(200, savingsRate * 150);

  // Debt health
  if (state.debt === 0) score += 150;
  else {
    const debtRatio = state.debt / Math.max(state.netWorth + state.debt, 1);
    score += Math.max(0, 150 - debtRatio * 200);
  }

  // Happiness
  score += (state.happinessLevel / 100) * 150;

  // Low stress bonus
  score += Math.max(0, (100 - state.stressLevel) / 100) * 100;

  // Age-adjusted bonus (younger = harder)
  score += ageBonus * 0.5;

  return Math.round(clamp(score, 0, 1000));
}

export function scoreGrade(score: number): 'S' | 'A' | 'B' | 'C' | 'D' {
  if (score >= 850) return 'S';
  if (score >= 700) return 'A';
  if (score >= 550) return 'B';
  if (score >= 400) return 'C';
  return 'D';
}

export function gradeColor(grade: 'S' | 'A' | 'B' | 'C' | 'D'): string {
  const map = { S: '#f59e0b', A: '#22c55e', B: '#06b6d4', C: '#8b5cf6', D: '#ef4444' };
  return map[grade];
}

// ─── DECISION POOL ───────────────────────────────────────────────────────
export function buildDecisionPool(state: FinancialState): Decision[] {
  const inc = state.monthlyIncome;

  const pool: Decision[] = [
    // ── CAREER ──────────────────────────────────────────
    {
      id: 'job-raise', name: 'Negociar aumento salarial',
      description: 'Preparaste tu caso y pediste un 15% de aumento. Tu jefe lo considera.',
      consequence: '+15% ingreso permanente. Más responsabilidades.',
      risk: 'LOW', emoji: '📊', type: 'opportunity', category: 'career',
      impact: { income: 0.15, stress: 8, happiness: 15 },
    },
    {
      id: 'job-change', name: 'Cambiar de empresa',
      description: 'Una empresa rival te ofrece 30% más. Hay costos de transición.',
      consequence: '+25-40% ingreso. Costo inicial. Mayor estrés los primeros meses.',
      risk: 'MED', emoji: '💼', type: 'opportunity', category: 'career',
      impact: { income: 0.25 + Math.random() * 0.15, cash: -4000, stress: 22, happiness: 12 },
    },
    {
      id: 'freelance', name: 'Proyecto freelance',
      description: 'Un cliente te contacta para un proyecto de 3 meses fuera del horario laboral.',
      consequence: '+20% ingresos extra. Noches largas pero vale la pena.',
      risk: 'LOW', emoji: '💻', type: 'opportunity', category: 'career',
      impact: { income: 0.18, stress: 20, cash: 2500, happiness: 10 },
    },
    {
      id: 'startup-offer', name: 'Oferta de startup tech',
      description: 'Una startup ofrece 45% más sueldo + equity. El futuro es incierto.',
      consequence: 'Alto potencial de ganancia o de fracaso total.',
      risk: 'HIGH', emoji: '🦄', type: 'opportunity', category: 'career',
      impact: { income: 0.45, stress: 38, happiness: 22 },
    },
    {
      id: 'side-business', name: 'Negocio paralelo',
      description: 'Lanzas una tienda online o servicio pequeño en tu tiempo libre.',
      consequence: '+12% ingresos. Alto en energía al principio.',
      risk: 'MED', emoji: '🛒', type: 'opportunity', category: 'career',
      impact: { cash: -2000, income: 0.12, stress: 18, happiness: 22 },
    },
    {
      id: 'remote-work', name: 'Trabajo 100% remoto',
      description: 'Negocias trabajar desde casa permanentemente. Ahorras en transporte.',
      consequence: 'Ahorro en gastos + más felicidad y menos estrés.',
      risk: 'LOW', emoji: '🏡', type: 'opportunity', category: 'career',
      impact: { savings: inc * 0.8, stress: -18, happiness: 20 },
    },
    {
      id: 'consulting', name: 'Consultoría independiente',
      description: 'Dejar el empleo fijo para ofrecer consultoría. Más riesgo, más libertad.',
      consequence: '+50% ingreso potencial. 0% seguridad. Requiere clientes.',
      risk: 'HIGH', emoji: '🎯', type: 'opportunity', category: 'career',
      impact: Math.random() > 0.5
        ? { cash: -5000, income: 0.50, stress: 30, happiness: 35 }
        : { cash: -5000, income: -0.20, stress: 45, happiness: -15 },
    },

    // ── INVESTMENT ──────────────────────────────────────
    {
      id: 'invest-etf', name: 'ETF de índice global',
      description: 'Invertir automáticamente cada mes en un fondo diversificado.',
      consequence: 'Crecimiento constante sin gestión activa. Recomendado a largo plazo.',
      risk: 'LOW', emoji: '📈', type: 'opportunity', category: 'investment',
      impact: { cash: -(inc * 2), investments: inc * 2, stress: -3, happiness: 5 },
    },
    {
      id: 'invest-stocks', name: 'Acciones individuales',
      description: 'Analizar y comprar acciones de empresas específicas.',
      consequence: 'Alto potencial si aciertas. Más esfuerzo de seguimiento.',
      risk: 'MED', emoji: '📊', type: 'opportunity', category: 'investment',
      impact: { cash: -Math.min(10000, state.cash * 0.4), investments: Math.min(10000, state.cash * 0.4), stress: 10 },
    },
    {
      id: 'invest-crypto', name: 'Invertir en criptomonedas',
      description: 'Apostar $5,000 en Bitcoin y altcoins. El mercado crypto es extremo.',
      consequence: Math.random() > 0.45 ? 'Tu cartera sube 180%. ¡Increíble!' : 'Caída del 55%. El crypto es brutal.',
      risk: 'HIGH', emoji: '🪙', type: 'opportunity', category: 'investment',
      impact: Math.random() > 0.45
        ? { cash: -5000, investments: 14000, happiness: 35 }
        : { cash: -5000, stress: 32, happiness: -18 },
    },
    {
      id: 'real-estate', name: 'Inversión inmobiliaria',
      description: 'Comprar propiedad para arrendar. Alta deuda, ingresos pasivos.',
      consequence: 'Flujo positivo de caja mensual a largo plazo.',
      risk: 'HIGH', emoji: '🏢', type: 'opportunity', category: 'investment',
      impact: { cash: -50000, debt: 150000, income: 0.15, stress: 18, happiness: 20 },
    },
    {
      id: 'save-aggressive', name: 'Ahorro agresivo',
      description: 'Reducir gastos y guardar el 30% del ingreso este año.',
      consequence: 'Fondo de emergencia sólido. Menos salidas, más paz mental.',
      risk: 'LOW', emoji: '🏦', type: 'opportunity', category: 'investment',
      impact: { savings: inc * 3.6, cash: -(inc * 3.6), stress: 8, happiness: -5 },
    },
    {
      id: 'pay-debt', name: 'Pagar deudas pendientes',
      description: 'Destinar el 50% del efectivo disponible a liquidar deudas.',
      consequence: 'Menos carga financiera, mejor historial crediticio.',
      risk: 'LOW', emoji: '💳', type: 'opportunity', category: 'investment',
      impact: { cash: -(state.cash * 0.5), debt: -(state.cash * 0.5), stress: -22, happiness: 12 },
    },
    {
      id: 'emergency-fund', name: 'Fondo de emergencia',
      description: 'Separar 6 meses de gastos en una cuenta de fácil acceso.',
      consequence: 'Tranquilidad ante imprevistos. Esencial para la salud financiera.',
      risk: 'LOW', emoji: '🛡️', type: 'opportunity', category: 'investment',
      impact: { savings: inc * 6, cash: -(inc * 6), stress: -12, happiness: 8 },
    },

    // ── LIFESTYLE ──────────────────────────────────────
    {
      id: 'travel-dream', name: 'Viaje soñado',
      description: 'Un mes en Europa o Asia. Recargas energías y ganas perspectiva de vida.',
      consequence: 'Menos dinero, mucha más felicidad y perspectiva.',
      risk: 'LOW', emoji: '✈️', type: 'opportunity', category: 'lifestyle',
      impact: { cash: -8000, happiness: 42, stress: -32 },
    },
    {
      id: 'buy-car', name: 'Comprar auto nuevo',
      description: 'El auto que siempre quisiste. Crédito a 5 años.',
      consequence: 'Felicidad inmediata, deuda moderada. El auto deprecia desde el día 1.',
      risk: 'MED', emoji: '🚗', type: 'opportunity', category: 'lifestyle',
      impact: { debt: 28000, cash: -5000, happiness: 25, stress: 10 },
    },
    {
      id: 'buy-house', name: 'Comprar primera casa',
      description: 'Dejar de pagar renta y construir patrimonio propio.',
      consequence: 'Gran deuda hipotecaria, pero estabilidad y activo apreciable.',
      risk: 'HIGH', emoji: '🏠', type: 'opportunity', category: 'lifestyle',
      impact: { debt: 200000, cash: -30000, happiness: 38, stress: 28 },
    },
    {
      id: 'reduce-expenses', name: 'Recortar gastos',
      description: 'Cancelar suscripciones, comer en casa, modo ahorro total.',
      consequence: 'Dinero extra cada mes. Requiere disciplina.',
      risk: 'LOW', emoji: '✂️', type: 'opportunity', category: 'lifestyle',
      impact: { savings: inc * 2, stress: 5, happiness: -8 },
    },
    {
      id: 'weekend-retreat', name: 'Retiro de bienestar',
      description: 'Un fin de semana de desconexión total. Spa, naturaleza, meditación.',
      consequence: 'Estrés baja drásticamente. Vale la inversión.',
      risk: 'LOW', emoji: '🧘', type: 'opportunity', category: 'lifestyle',
      impact: { cash: -1500, stress: -28, happiness: 20 },
    },

    // ── HEALTH ────────────────────────────────────────
    {
      id: 'health-insurance', name: 'Seguro médico completo',
      description: 'Contratar un plan completo de salud con cobertura amplia.',
      consequence: 'Protección total ante emergencias. Tranquilidad para la familia.',
      risk: 'LOW', emoji: '⚕️', type: 'opportunity', category: 'health',
      impact: { cash: -3600, stress: -16, happiness: 12 },
    },
    {
      id: 'gym-wellness', name: 'Plan de salud integral',
      description: 'Gym + nutrición + chequeos regulares. Invierte en tu cuerpo.',
      consequence: 'Mejor salud a largo plazo. Menos gastos médicos futuros.',
      risk: 'LOW', emoji: '💪', type: 'opportunity', category: 'health',
      impact: { cash: -2400, stress: -20, happiness: 25 },
    },

    // ── FAMILY ───────────────────────────────────────
    {
      id: 'start-family', name: 'Ampliar la familia',
      description: 'Decidir tener un hijo. Cambia todo: gastos, prioridades y felicidad.',
      consequence: 'Gastos +$15K/año. Felicidad que no se mide con dinero.',
      risk: 'MED', emoji: '👨‍👩‍👧', type: 'opportunity', category: 'family',
      impact: { cash: -10000, income: -0.08, happiness: 45, stress: 25 },
    },
    {
      id: 'help-family', name: 'Apoyo a familiares',
      description: 'Un familiar necesita ayuda económica. Decides apoyarlo.',
      consequence: 'Sacrificio financiero personal pero fortalece vínculos.',
      risk: 'LOW', emoji: '🤝', type: 'event', category: 'family',
      impact: { cash: -8000, happiness: 15, stress: 10 },
    },

    // ── EDUCATION ────────────────────────────────────
    {
      id: 'mba', name: 'Cursar un MBA',
      description: 'Dos años de maestría. Red de contactos + salto salarial del 40%.',
      consequence: 'Deuda alta, pero el ROI a 5 años suele ser muy positivo.',
      risk: 'MED', emoji: '🎓', type: 'opportunity', category: 'education',
      impact: { debt: 45000, income: 0.40, stress: 18, happiness: 18 },
    },
    {
      id: 'online-courses', name: 'Certificaciones tech',
      description: 'Certificaciones en cloud, IA o datos. Bajo costo, alto retorno.',
      consequence: '+10% ingreso por habilidades más demandadas del mercado.',
      risk: 'LOW', emoji: '🎯', type: 'opportunity', category: 'education',
      impact: { cash: -1500, income: 0.10, stress: 5, happiness: 15 },
    },
    {
      id: 'coaching', name: 'Coaching financiero',
      description: 'Contratar un coach que te ayude a optimizar tus finanzas personales.',
      consequence: 'Mejor disciplina y estrategia financiera durante el año.',
      risk: 'LOW', emoji: '🧠', type: 'opportunity', category: 'education',
      impact: { cash: -2000, savings: inc * 1.5, stress: -8, happiness: 10 },
    },

    // ── RISK ─────────────────────────────────────────
    {
      id: 'entrepreneurship', name: 'Lanzar tu empresa',
      description: 'Renunciar y apostar todo en tu propio startup. Todo o nada.',
      consequence: 'Si funciona: ingresos 3x. Si falla: pérdida total.',
      risk: 'HIGH', emoji: '🚀', type: 'opportunity', category: 'risk',
      impact: Math.random() > 0.45
        ? { cash: -30000, income: 2.0, happiness: 50, stress: 40 }
        : { cash: -30000, stress: 55, happiness: -20 },
    },
    {
      id: 'angel-invest', name: 'Invertir en startup amiga',
      description: 'Un amigo con una startup te pide $15,000 a cambio de equity.',
      consequence: Math.random() > 0.35 ? 'La startup despega. Tu inversión vale 5x.' : 'La startup cierra. Pierdes todo.',
      risk: 'HIGH', emoji: '👼', type: 'opportunity', category: 'risk',
      impact: Math.random() > 0.35
        ? { cash: -15000, investments: 75000, happiness: 30 }
        : { cash: -15000, stress: 25, happiness: -10 },
    },
  ];

  // Filter out contextually invalid decisions
  return pool.filter(d => {
    if (d.id === 'pay-debt' && state.debt < 1000) return false;
    if (d.id === 'invest-stocks' && state.cash < 8000) return false;
    if (d.id === 'real-estate' && state.cash < 50000) return false;
    if (d.id === 'buy-house' && state.cash < 30000) return false;
    if (d.id === 'save-aggressive' && state.cash < inc * 3) return false;
    if (d.id === 'emergency-fund' && state.cash < inc * 6) return false;
    if (d.id === 'angel-invest' && state.cash < 15000) return false;
    if (d.id === 'entrepreneurship' && state.cash < 30000) return false;
    return true;
  });
}

export function getCardsForYear(state: FinancialState): Decision[] {
  const pool = buildDecisionPool(state);
  const shuffled = pool.sort(() => Math.random() - 0.5);

  // Ensure category variety — pick 1 from career, 1 from investment, then fill up to 5
  const byCategory: Record<string, Decision[]> = {};
  for (const d of shuffled) {
    if (!byCategory[d.category]) byCategory[d.category] = [];
    byCategory[d.category].push(d);
  }

  const picks: Decision[] = [];
  const priorityOrder = ['career', 'investment', 'lifestyle', 'education', 'health', 'family', 'risk'];
  const used = new Set<string>();

  for (const cat of priorityOrder) {
    const catDecisions = byCategory[cat] || [];
    for (const d of catDecisions) {
      if (!used.has(d.id) && picks.length < 5) {
        picks.push(d);
        used.add(d.id);
        break;
      }
    }
    if (picks.length >= 5) break;
  }

  // Fill up to 5 if needed
  for (const d of shuffled) {
    if (!used.has(d.id) && picks.length < 5) {
      picks.push(d);
      used.add(d.id);
    }
    if (picks.length >= 5) break;
  }

  return picks;
}

// ─── FEEDBACK ────────────────────────────────────────────────────────────
export function getFeedbackMessages(current: FinancialState, previous: FinancialState | null, acceptedCount: number): string[] {
  const messages: string[] = [];

  if (previous && current.netWorth > previous.netWorth * 1.20)
    messages.push('Crecimiento patrimonial excepcional. Estás en el top 10% de tu grupo de edad.');
  if (previous && current.netWorth < previous.netWorth * 0.90)
    messages.push('Tu patrimonio retrocedió este año. Revisa tus gastos y decisiones.');
  if (current.debt > current.netWorth * 0.5 && current.debt > 5000)
    messages.push('Tu deuda supera el 50% de tu patrimonio. Prioriza pagarla antes de invertir.');
  if (current.investments > current.monthlyIncome * 12)
    messages.push('Tus inversiones superan un año de ingreso. Excelente hábito de inversión.');
  if (current.stressLevel > 72)
    messages.push('Niveles de estrés críticos. El burnout tiene costo financiero real.');
  if (current.stressLevel < 25 && current.happinessLevel > 70)
    messages.push('Equilibrio perfecto. Dinero y bienestar alineados. Pocas personas logran esto.');
  if (current.investments === 0 && current.year > 2)
    messages.push('Sigues sin invertir. La inflación erosiona tu efectivo cada año.');
  if (current.cash < current.monthlyExpenses * 3)
    messages.push('Fondo de emergencia peligrosamente bajo. Un imprevisto puede ser catastrófico.');
  if (current.age > 50 && current.savings < current.monthlyIncome * 24)
    messages.push('Con más de 50 años, el retiro se acerca. Aumenta tu ahorro urgentemente.');
  if (acceptedCount === 0)
    messages.push('No tomaste ninguna decisión este año. La inercia también tiene un costo.');
  if (acceptedCount >= 3)
    messages.push('Año muy activo. Las decisiones múltiples pueden generar efectos compuestos.');

  if (messages.length === 0) {
    const defaults = [
      'Avanzas a paso firme. La consistencia construye riqueza duradera.',
      'Cada decisión cuenta. Los pequeños pasos de hoy son grandes logros mañana.',
      'La riqueza no es un destino, es un hábito diario.',
    ];
    messages.push(defaults[Math.floor(Math.random() * defaults.length)]);
  }

  return messages.slice(0, 2);
}

// ─── CURRENCY ────────────────────────────────────────────────────────────
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
  return new Intl.NumberFormat(cfg.locale, { style: 'currency', currency: cfg.currency, maximumFractionDigits: 0 }).format(amount);
}
