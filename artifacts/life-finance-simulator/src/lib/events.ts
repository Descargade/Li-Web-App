import type { TimelineEvent } from './types';

type EventTemplate = Omit<TimelineEvent, 'id' | 'year' | 'age' | 'type'>;

export const RANDOM_EVENTS: EventTemplate[] = [
  {
    title: 'Crisis económica global',
    description: 'Una recesión sacude los mercados. Tus inversiones caen y el mercado laboral se contrae.',
    impact: { investments: -0.30, income: -0.15, stress: 40, happiness: -20 },
    icon: '📉',
    color: '#ef4444',
  },
  {
    title: 'Promoción laboral',
    description: '¡Tu esfuerzo fue reconocido! Ascenso con aumento significativo de sueldo.',
    impact: { income: 0.25, happiness: 20, stress: -10 },
    icon: '🏆',
    color: '#f59e0b',
  },
  {
    title: 'Emergencia médica',
    description: 'Una hospitalización inesperada genera gastos imprevistos.',
    impact: { cash: -15000, stress: 50, happiness: -15 },
    icon: '🏥',
    color: '#ef4444',
  },
  {
    title: 'Herencia inesperada',
    description: 'Un familiar lejano te dejó un legado que cambia tu situación financiera.',
    impact: { cash: 50000, happiness: 30, stress: -5 },
    icon: '💰',
    color: '#22c55e',
  },
  {
    title: 'Oportunidad tech startup',
    description: 'Te ofrecen invertir $20,000 en una startup promisoria. Alto riesgo.',
    impact: Math.random() > 0.45
      ? { cash: -20000, investments: 60000, happiness: 40 }
      : { cash: -20000, stress: 30, happiness: -15 },
    icon: '💡',
    color: '#8b5cf6',
  },
  {
    title: 'Robo y fraude digital',
    description: 'Víctima de un fraude financiero. Pérdida de fondos en cuenta.',
    impact: { cash: -5000, stress: 30, happiness: -20 },
    icon: '🚨',
    color: '#ef4444',
  },
  {
    title: 'Bebé en camino',
    description: 'Una nueva vida llega. Gastos adicionales pero una felicidad sin precio.',
    impact: { cash: -10000, income: -0.1, happiness: 40, stress: 20 },
    icon: '👶',
    color: '#ec4899',
  },
  {
    title: 'Premio en sorteo',
    description: 'Un golpe de suerte inesperado. Ganar algo siempre anima.',
    impact: { cash: 10000, happiness: 25 },
    icon: '🎰',
    color: '#f59e0b',
  },
  {
    title: 'Reforma tributaria',
    description: 'El gobierno sube impuestos a tu nivel de ingresos. Impacto en flujo de caja.',
    impact: { income: -0.08, stress: 20, happiness: -10 },
    icon: '📋',
    color: '#f97316',
  },
  {
    title: 'Boom del mercado inmobiliario',
    description: 'Los precios de propiedades disparan. Si tienes bienes raíces, te beneficias.',
    impact: { investments: 0.20, happiness: 15 },
    icon: '🏘️',
    color: '#22c55e',
  },
  {
    title: 'Recesión global severa',
    description: 'Contracción económica prolongada. Ingresos e inversiones golpeados.',
    impact: { income: -0.15, investments: -0.20, stress: 35, happiness: -15 },
    icon: '🌊',
    color: '#ef4444',
  },
  {
    title: 'Bono extraordinario',
    description: 'Tu empresa tuvo un año excelente y comparte las ganancias contigo.',
    impact: { cash: 15000, happiness: 30, stress: -10 },
    icon: '🎁',
    color: '#22c55e',
  },
  {
    title: 'Accidente vehicular',
    description: 'Un accidente inesperado genera gastos de reparación y médicos.',
    impact: { cash: -8000, stress: 25, happiness: -10 },
    icon: '🚗',
    color: '#ef4444',
  },
  {
    title: 'Proyecto freelance exitoso',
    description: 'Un cliente grande pagó bien por tu expertise. Ingreso extra considerable.',
    impact: { cash: 12000, happiness: 20, stress: -5 },
    icon: '🌟',
    color: '#06b6d4',
  },
  {
    title: 'Desempleo temporal',
    description: 'Reestructuración en tu empresa. Período de búsqueda laboral.',
    impact: { income: -0.80, stress: 60, happiness: -30 },
    icon: '😰',
    color: '#ef4444',
  },
  {
    title: 'Salud de hierro',
    description: 'Un chequeo médico muestra excelentes resultados. Menor gasto en salud.',
    impact: { cash: 2000, happiness: 15, stress: -10 },
    icon: '💪',
    color: '#22c55e',
  },
  {
    title: 'Cripto en alza',
    description: 'Las criptomonedas que compraste hace tiempo se disparan.',
    impact: { investments: 0.50, happiness: 25 },
    icon: '🪙',
    color: '#f59e0b',
  },
  {
    title: 'Colapso cripto',
    description: 'El mercado crypto se desploma. Si tenías posiciones, hay pérdidas.',
    impact: { investments: -0.40, stress: 30, happiness: -20 },
    icon: '🔻',
    color: '#ef4444',
  },
];
