import type { SimulationState, FinancialState, AchievementData } from './types';
import { formatCurrency, calculateScore, scoreGrade } from './simulation';
import { getRiskProfile } from './scenarios';
import { ACHIEVEMENT_MAP } from './achievements';

export type RiskProfile = 'Conservador' | 'Equilibrado' | 'Agresivo';
export type Severity = 'critical' | 'warning' | 'info';
export type Trend = 'improving' | 'stable' | 'declining';

export interface Risk {
  title: string;
  severity: Severity;
  detail: string;
}

export interface Opportunity {
  title: string;
  detail: string;
}

export interface AdvisorReport {
  generatedYear: number;
  generatedAge: number;
  riskProfile: RiskProfile;
  situation: string;
  risks: Risk[];
  opportunities: Opportunity[];
  recommendation: string;
  nextAction: string;
  trend: Trend;
  score: number;
  scoreGrade: 'S' | 'A' | 'B' | 'C' | 'D';
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function fc(n: number, country?: string) {
  return formatCurrency(Math.abs(n), country ?? 'USA');
}

function months(income: number, amount: number): number {
  if (!income) return 0;
  return Math.round((amount / income) * 10) / 10;
}

function pct(a: number, b: number): string {
  if (!b) return '0%';
  return Math.round((a / b) * 100) + '%';
}

function getRisk(data: AchievementData): RiskProfile {
  const r = getRiskProfile(data.highRiskCount);
  if (r.label === 'Agresivo') return 'Agresivo';
  if (r.label === 'Moderado') return 'Equilibrado';
  return 'Conservador';
}

function getTrend(history: FinancialState[]): Trend {
  if (history.length < 3) return 'stable';
  const last = history[history.length - 1].netWorth;
  const prev = history[history.length - 3].netWorth;
  const delta = (last - prev) / (Math.abs(prev) || 1);
  if (delta > 0.08) return 'improving';
  if (delta < -0.05) return 'declining';
  return 'stable';
}

// ─── SITUATION ANALYSIS ───────────────────────────────────────────────────────
function buildSituation(
  state: SimulationState,
  riskProfile: RiskProfile,
  country: string
): string {
  const f = state.financial;
  const { achievementData, history } = state;

  const savingsMonths = months(f.monthlyExpenses, f.savings);
  const debtMonths = months(f.monthlyIncome, f.debt);
  const investPct = pct(f.investments, f.netWorth > 0 ? f.netWorth : 1);
  const savingsRate = f.monthlyIncome > 0
    ? Math.round(((f.monthlyIncome - f.monthlyExpenses) / f.monthlyIncome) * 100)
    : 0;

  const nwDesc = f.netWorth >= 1_000_000
    ? `un patrimonio de élite de ${fc(f.netWorth, country)}`
    : f.netWorth >= 250_000
    ? `un sólido patrimonio de ${fc(f.netWorth, country)}`
    : f.netWorth >= 50_000
    ? `un patrimonio emergente de ${fc(f.netWorth, country)}`
    : f.netWorth > 0
    ? `un patrimonio inicial de ${fc(f.netWorth, country)}`
    : `un patrimonio neto negativo de -${fc(f.netWorth, country)}`;

  const profileNote = riskProfile === 'Conservador'
    ? 'Tu estilo conservador prioriza la estabilidad sobre el crecimiento acelerado.'
    : riskProfile === 'Agresivo'
    ? 'Tu perfil agresivo ha apostado por el crecimiento acelerado asumiendo riesgo elevado.'
    : 'Tu enfoque equilibrado combina seguridad con oportunidades de crecimiento.';

  const decisionCount = achievementData.acceptedDecisionIds.length;
  const debtContext = f.debt > 0
    ? ` Tu deuda de ${fc(f.debt, country)} representa ${debtMonths} meses de ingreso.`
    : ' Actualmente estás libre de deudas, lo cual fortalece tu posición.';

  const growthNote = history.length >= 3
    ? ` En los últimos 3 años tu patrimonio ha ${f.netWorth > history[Math.max(0, history.length - 4)].netWorth ? 'crecido' : 'disminuido'}.`
    : '';

  return `A los ${f.age} años (año ${f.year} de simulación) acumulas ${nwDesc}, ` +
    `con una tasa de ahorro del ${savingsRate}% e inversiones que representan el ${investPct} de tu patrimonio. ` +
    debtContext + growthNote +
    ` Hasta ahora has tomado ${decisionCount} decisión${decisionCount !== 1 ? 'es' : ''} financiera${decisionCount !== 1 ? 's' : ''}. ` +
    profileNote;
}

// ─── RISK DETECTION ───────────────────────────────────────────────────────────
function detectRisks(state: SimulationState, country: string): Risk[] {
  const f = state.financial;
  const { achievementData, history } = state;
  const risks: Risk[] = [];

  // Critical: Negative net worth
  if (f.netWorth < 0) {
    risks.push({
      title: 'Patrimonio neto negativo',
      severity: 'critical',
      detail: `Tu deuda supera tus activos totales en ${fc(Math.abs(f.netWorth), country)}. Sin acción inmediata esto se agravará con el tiempo.`,
    });
  }

  // Critical: Extreme debt ratio
  const debtMonths = f.monthlyIncome > 0 ? f.debt / f.monthlyIncome : 0;
  if (debtMonths >= 12) {
    risks.push({
      title: 'Deuda crítica',
      severity: 'critical',
      detail: `Tu deuda de ${fc(f.debt, country)} equivale a ${debtMonths.toFixed(1)} meses de ingreso. Supera el umbral seguro de 6 meses.`,
    });
  } else if (debtMonths >= 6) {
    risks.push({
      title: 'Deuda elevada',
      severity: 'warning',
      detail: `Con ${fc(f.debt, country)} de deuda (${debtMonths.toFixed(1)} meses de ingreso), tu margen de maniobra es limitado. Prioriza su reducción.`,
    });
  }

  // Critical: Extreme stress
  if (f.stressLevel >= 80) {
    risks.push({
      title: 'Estrés financiero extremo',
      severity: 'critical',
      detail: `Un nivel de estrés de ${Math.round(f.stressLevel)}% puede deteriorar tu capacidad de toma de decisiones. Considera decisiones de bienestar.`,
    });
  } else if (f.stressLevel >= 65) {
    risks.push({
      title: 'Estrés financiero elevado',
      severity: 'warning',
      detail: `Con ${Math.round(f.stressLevel)}% de estrés, tu bienestar está comprometido. El estrés sostenido reduce la calidad de tus decisiones a largo plazo.`,
    });
  }

  // No emergency fund
  const emergencyMonths = f.monthlyExpenses > 0 ? f.savings / f.monthlyExpenses : 0;
  if (emergencyMonths < 3 && f.year > 1) {
    risks.push({
      title: 'Fondo de emergencia insuficiente',
      severity: f.year > 3 ? 'warning' : 'info',
      detail: `Tienes ahorros para ${emergencyMonths.toFixed(1)} meses de gastos. El mínimo recomendado es 3–6 meses (${fc(f.monthlyExpenses * 3, country)}).`,
    });
  }

  // No investments after 3+ years
  if (f.investments === 0 && f.year >= 3) {
    risks.push({
      title: 'Capital sin trabajar',
      severity: 'warning',
      detail: `Llevas ${f.year} años sin inversiones. Tu dinero pierde poder adquisitivo frente a la inflación sin generar rendimientos.`,
    });
  }

  // Declining happiness
  if (f.happinessLevel < 30) {
    risks.push({
      title: 'Bienestar comprometido',
      severity: 'warning',
      detail: `Tu nivel de felicidad de ${Math.round(f.happinessLevel)}% es preocupantemente bajo. La sostenibilidad financiera requiere también bienestar emocional.`,
    });
  }

  // Declining trajectory
  if (history.length >= 4) {
    const last3 = history.slice(-4);
    const declining = last3.every((h, i) => i === 0 || h.netWorth <= last3[i - 1].netWorth);
    if (declining) {
      risks.push({
        title: 'Tendencia negativa continuada',
        severity: 'warning',
        detail: `Tu patrimonio ha caído durante 3 años consecutivos. Es momento de revisar tus gastos e ingresos estructuralmente.`,
      });
    }
  }

  // High risk with high debt (dangerous combo)
  if (achievementData.highRiskCount >= 3 && f.debt > f.monthlyIncome * 6) {
    risks.push({
      title: 'Alto riesgo con deuda elevada',
      severity: 'critical',
      detail: `Combinar ${achievementData.highRiskCount} decisiones de alto riesgo con ${fc(f.debt, country)} de deuda es financieramente peligroso. Las pérdidas podrían ser irreversibles.`,
    });
  }

  // Idle cash
  if (f.cash > f.monthlyIncome * 6 && f.investments < f.cash * 0.3) {
    risks.push({
      title: 'Exceso de efectivo improductivo',
      severity: 'info',
      detail: `Tienes ${fc(f.cash, country)} en efectivo, lo que supera 6 meses de ingreso. El efectivo excesivo pierde valor frente a la inflación.`,
    });
  }

  return risks.slice(0, 4); // max 4 risks
}

// ─── OPPORTUNITY DETECTION ────────────────────────────────────────────────────
function detectOpportunities(
  state: SimulationState,
  riskProfile: RiskProfile,
  country: string
): Opportunity[] {
  const f = state.financial;
  const { achievementData, unlockedAchievements } = state;
  const opportunities: Opportunity[] = [];

  const surplusMonthly = f.monthlyIncome - f.monthlyExpenses;
  const emergencyMonths = f.monthlyExpenses > 0 ? f.savings / f.monthlyExpenses : 0;
  const unlockedIds = new Set(unlockedAchievements.map(a => a.id));

  // Investment opportunity (has surplus, no debt crisis)
  if (f.investments < f.monthlyIncome * 6 && surplusMonthly > 200 && f.debt < f.monthlyIncome * 6) {
    const investTarget = Math.min(surplusMonthly * 0.4, 1500);
    opportunities.push({
      title: 'Potencial de inversión disponible',
      detail: `Con un excedente mensual de ${fc(surplusMonthly, country)}, podrías destinar ${fc(investTarget, country)}/mes a inversiones y generar crecimiento compuesto a largo plazo.`,
    });
  }

  // Near milestone achievement
  const nearMilestones: { id: string; label: string; pct: number }[] = [];
  if (!unlockedIds.has('net-worth-25k') && f.netWorth > 15000)
    nearMilestones.push({ id: 'net-worth-25k', label: 'Primeros $25K de patrimonio', pct: (f.netWorth / 25000) * 100 });
  if (!unlockedIds.has('net-worth-100k') && f.netWorth > 60000)
    nearMilestones.push({ id: 'net-worth-100k', label: 'Los $100K de patrimonio', pct: (f.netWorth / 100000) * 100 });
  if (!unlockedIds.has('net-worth-250k') && f.netWorth > 150000)
    nearMilestones.push({ id: 'net-worth-250k', label: 'Cuarto de millón', pct: (f.netWorth / 250000) * 100 });
  if (nearMilestones.length > 0) {
    const closest = nearMilestones[nearMilestones.length - 1];
    opportunities.push({
      title: `Cerca del hito: "${ACHIEVEMENT_MAP[closest.id]?.title ?? closest.label}"`,
      detail: `Estás al ${closest.pct.toFixed(0)}% de alcanzar "${closest.label}". Con tu ritmo actual, podrías lograrlo en los próximos 1–3 años.`,
    });
  }

  // Career growth opportunity
  if (achievementData.careerDecisionCount < 2 && f.year >= 3 && riskProfile !== 'Conservador') {
    opportunities.push({
      title: 'Acelerador de ingresos desaprovechado',
      detail: `Solo has tomado ${achievementData.careerDecisionCount} decisión${achievementData.careerDecisionCount !== 1 ? 'es' : ''} de carrera. Aumentar tu ingreso tiene efecto multiplicador sobre todos tus objetivos.`,
    });
  }

  // Debt-free opportunity
  if (f.debt > 0 && f.debt < f.monthlyIncome * 3) {
    opportunities.push({
      title: 'A un paso de la libertad de deuda',
      detail: `Tu deuda de ${fc(f.debt, country)} es equivalente a solo ${months(f.monthlyIncome, f.debt)} meses de ingreso. Eliminarla abriría un flujo mensual libre de ${fc(f.debt / 12, country)}.`,
    });
  }

  // Emergency fund nearly complete
  if (emergencyMonths >= 3 && emergencyMonths < 6 && f.savings < f.monthlyExpenses * 6) {
    opportunities.push({
      title: 'Fondo de emergencia casi completo',
      detail: `Tienes ${emergencyMonths.toFixed(1)} meses cubiertos. Alcanzar 6 meses (${fc(f.monthlyExpenses * 6, country)}) te daría estabilidad para asumir mayores riesgos.`,
    });
  }

  // High income, low investment (Agresivo profile)
  if (riskProfile === 'Agresivo' && f.monthlyIncome > 5000 && f.investments < f.monthlyIncome * 12) {
    opportunities.push({
      title: 'Apalancamiento de alto ingreso',
      detail: `Con ${fc(f.monthlyIncome, country)}/mes de ingreso, tu cartera de inversiones de ${fc(f.investments, country)} está por debajo de tu potencial de perfil agresivo.`,
    });
  }

  // Good stress/happiness balance → can take more risk
  if (f.stressLevel < 40 && f.happinessLevel > 65 && riskProfile === 'Conservador') {
    opportunities.push({
      title: 'Condiciones ideales para crecer',
      detail: `Tu estrés bajo (${Math.round(f.stressLevel)}%) y alta felicidad (${Math.round(f.happinessLevel)}%) indican que estás en posición de asumir algo más de riesgo calculado.`,
    });
  }

  return opportunities.slice(0, 3);
}

// ─── MAIN RECOMMENDATION ──────────────────────────────────────────────────────
function buildRecommendation(
  f: FinancialState,
  data: AchievementData,
  riskProfile: RiskProfile,
  country: string
): string {
  const debtMonths = f.monthlyIncome > 0 ? f.debt / f.monthlyIncome : 0;
  const emergencyMonths = f.monthlyExpenses > 0 ? f.savings / f.monthlyExpenses : 0;
  const surplusMonthly = f.monthlyIncome - f.monthlyExpenses;

  if (f.netWorth < 0) {
    return `Tu prioridad absoluta es revertir el patrimonio negativo. Reduce gastos al mínimo y aplica todo superávit a liquidar deudas. No hay inversión que supere el retorno de eliminar pasivos con intereses altos.`;
  }
  if (debtMonths >= 10) {
    return `Con una deuda de ${fc(f.debt, country)} que representa ${debtMonths.toFixed(1)} meses de ingreso, tu prioridad debe ser la reducción agresiva de deuda. Cada peso pagado hoy te ahorra intereses futuros y libera capacidad de inversión.`;
  }
  if (emergencyMonths < 2 && f.year >= 2) {
    return `Sin un colchón de emergencia mínimo, cualquier evento inesperado te forzará a endeudarte. Antes de invertir o gastar, construye un fondo de ${fc(f.monthlyExpenses * 3, country)} (3 meses de gastos).`;
  }
  if (f.investments === 0 && f.year >= 4 && surplusMonthly > 0) {
    return `Llevas ${f.year} años sin invertir. ${riskProfile === 'Conservador' ? 'Incluso opciones conservadoras como fondos de renta fija' : 'Una cartera diversificada'} superarán a largo plazo el retorno del efectivo parado. Es el momento de comenzar.`;
  }
  if (riskProfile === 'Agresivo' && data.highRiskCount >= 5 && f.debt > f.monthlyIncome * 4) {
    return `Tu perfil agresivo está generando presión financiera. Con ${fc(f.debt, country)} de deuda, reducir la exposición al riesgo temporalmente te permitirá consolidar antes de volver a acelerar.`;
  }
  if (f.stressLevel >= 70) {
    return `El estrés de ${Math.round(f.stressLevel)}% está afectando tu toma de decisiones. Invertir en bienestar no es un gasto, es una estrategia: decisiones claras producen mejores resultados financieros.`;
  }
  if (riskProfile === 'Conservador' && f.investments < f.monthlyIncome * 6 && emergencyMonths >= 4) {
    return `Tu base financiera es sólida. Ahora el mayor riesgo es NO invertir. Con tu fondo de emergencia cubierto, cada mes sin invertir es un mes de rendimientos compuestos perdidos.`;
  }
  if (riskProfile === 'Equilibrado') {
    return `Mantén tu equilibrio actual: ${pct(f.savings, f.monthlyIncome * 12)} de tus ingresos anuales en ahorros y aumenta gradualmente tu exposición a inversiones hasta el 30% de tu patrimonio neto.`;
  }
  return `Continúa con tu estrategia actual. Tu posición financiera es razonablemente sólida. Enfócate en incrementar tu tasa de inversión del ${pct(f.investments, f.monthlyIncome * 12)} actual hacia el 20–30% de tus ingresos anuales.`;
}

// ─── NEXT ACTION ─────────────────────────────────────────────────────────────
function buildNextAction(
  f: FinancialState,
  data: AchievementData,
  riskProfile: RiskProfile,
  country: string
): string {
  const debtMonths = f.monthlyIncome > 0 ? f.debt / f.monthlyIncome : 0;
  const emergencyMonths = f.monthlyExpenses > 0 ? f.savings / f.monthlyExpenses : 0;
  const surplusMonthly = Math.max(0, f.monthlyIncome - f.monthlyExpenses);
  const investAmount = Math.min(surplusMonthly * 0.35, 2000);

  if (f.netWorth < 0 || debtMonths >= 10) {
    const payoff = Math.min(surplusMonthly * 0.6, f.debt);
    return `Destina ${fc(payoff, country)}/mes exclusivamente a amortización de deuda durante el próximo año. Congela decisiones de inversión hasta que tu deuda baje de ${fc(f.monthlyIncome * 6, country)}.`;
  }
  if (emergencyMonths < 3) {
    const needed = Math.max(0, f.monthlyExpenses * 3 - f.savings);
    const monthly = Math.min(surplusMonthly * 0.5, needed / 12);
    return `Ahorra ${fc(monthly, country)}/mes durante el próximo año para completar tu fondo de emergencia. Meta: ${fc(f.monthlyExpenses * 3, country)} (${Math.round(needed / monthly)} meses al ritmo propuesto).`;
  }
  if (f.investments === 0 && surplusMonthly > 200) {
    return `Este año, acepta al menos una decisión de inversión. Comienza con ${fc(investAmount, country)} en un fondo o instrumento ${riskProfile === 'Conservador' ? 'de bajo riesgo' : riskProfile === 'Agresivo' ? 'de alto rendimiento' : 'diversificado'}. El primer paso es el más importante.`;
  }
  if (riskProfile === 'Agresivo' && data.highRiskCount >= 3) {
    return `Acepta 1–2 decisiones de alta rentabilidad este año, pero asegúrate de que tu deuda no supere ${fc(f.monthlyIncome * 4, country)} antes de comprometerte. Riesgo sin base sólida es especulación.`;
  }
  if (riskProfile === 'Conservador' && emergencyMonths >= 4) {
    return `Este año da el paso de invertir al menos ${fc(investAmount, country)} en algún instrumento de bajo riesgo. Tu colchón de emergencia te protege. No invertir tiene un costo real: la inflación erosiona tu efectivo.`;
  }
  return `Mantén tu ritmo de ahorro e intenta incrementar tu ingreso aceptando alguna decisión de carrera este año. Un aumento del 10% en ingresos (${fc(f.monthlyIncome * 0.1, country)}/mes) tiene mayor impacto que recortar gastos.`;
}

// ─── MAIN GENERATOR ──────────────────────────────────────────────────────────
export function generateAdvisorReport(state: SimulationState): AdvisorReport {
  const country = state.profile?.country ?? 'USA';
  const f = state.financial;
  const riskProfile = getRisk(state.achievementData);
  const score = calculateScore(f);
  const grade = scoreGrade(score);
  const trend = getTrend(state.history);

  return {
    generatedYear: f.year,
    generatedAge: f.age,
    riskProfile,
    situation: buildSituation(state, riskProfile, country),
    risks: detectRisks(state, country),
    opportunities: detectOpportunities(state, riskProfile, country),
    recommendation: buildRecommendation(f, state.achievementData, riskProfile, country),
    nextAction: buildNextAction(f, state.achievementData, riskProfile, country),
    trend,
    score,
    scoreGrade: grade,
  };
}
