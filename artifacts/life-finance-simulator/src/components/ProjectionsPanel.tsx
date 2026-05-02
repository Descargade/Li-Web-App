import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp, Clock, Target, Zap, AlertTriangle,
  Info, CheckCircle2, ChevronRight, RefreshCw, Lightbulb
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from "recharts";
import {
  buildProjections, SCENARIO_CONFIGS, fmtCompact,
  type ProjectionInsight, type ProjectedMilestone,
  type ChartDataPoint, type ProjectionsResult, type ScenarioId
} from "@/lib/projections";
import { formatCurrency } from "@/lib/simulation";
import type { SimulationState } from "@/lib/types";

// ─── TYPES ────────────────────────────────────────────────────────────────────
type Horizon = 5 | 10 | 20;

// ─── CUSTOM TOOLTIP ───────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label, country }: {
  active?: boolean; payload?: { name: string; value: number; color: string }[];
  label?: string; country: string;
}) {
  if (!active || !payload?.length) return null;
  const sorted = [...payload].sort((a, b) => b.value - a.value);
  return (
    <div className="bg-background border border-border/60 rounded-xl shadow-2xl p-3 text-xs min-w-[180px]">
      <div className="font-semibold text-foreground mb-2 pb-1.5 border-b border-border/40">{label}</div>
      {sorted.map(p => (
        <div key={p.name} className="flex items-center justify-between gap-4 py-0.5">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
            <span className="text-muted-foreground">{SCENARIO_CONFIGS[p.name as ScenarioId]?.label ?? p.name}</span>
          </div>
          <span className="font-bold" style={{ color: p.color }}>
            {formatCurrency(p.value, country)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── SCENARIO SUMMARY CARD ────────────────────────────────────────────────────
function ScenarioSummaryCard({
  id, result, horizon, country
}: {
  id: ScenarioId; result: ProjectionsResult; horizon: Horizon; country: string;
}) {
  const cfg = SCENARIO_CONFIGS[id];
  const points = result.scenarios[id];
  const targetIdx = Math.min(horizon - 1, points.length - 1);
  const target = points[targetIdx];
  if (!target) return null;

  const growthPct = result.currentNetWorth > 0
    ? ((target.netWorth - result.currentNetWorth) / result.currentNetWorth) * 100
    : 0;
  const isPositive = target.netWorth > result.currentNetWorth;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex-1 min-w-0 rounded-xl p-4 border transition-all"
      style={{ background: cfg.gradientStart.replace('0.25', '0.06'), borderColor: cfg.color + '33' }}
    >
      <div className="flex items-center gap-1.5 mb-2">
        <span className="w-2 h-2 rounded-full" style={{ background: cfg.color }} />
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: cfg.color }}>{cfg.label}</span>
      </div>
      <div className="text-xl font-black text-foreground mb-0.5" style={{ color: cfg.color }}>
        {formatCurrency(target.netWorth, country)}
      </div>
      <div className={`text-xs font-semibold mb-2 ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
        {isPositive ? '+' : ''}{growthPct.toFixed(0)}% vs hoy
      </div>
      <div className="text-xs text-muted-foreground leading-snug line-clamp-2">{cfg.description}</div>
    </motion.div>
  );
}

// ─── MILESTONE TIMELINE ───────────────────────────────────────────────────────
function MilestoneTimeline({
  result, country
}: { result: ProjectionsResult; country: string }) {
  const allMilestones = result.milestones.base;
  const visible = allMilestones.filter(m => m.reached || m.simYear !== null || !m.reached);

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        <Target className="w-3.5 h-3.5" />Hitos proyectados (escenario base)
      </h4>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {visible.map(m => {
          const optHit = result.milestones.optimistic.find(om => om.amount === m.amount);
          const yearsEarlier = (m.simYear && optHit?.simYear)
            ? m.simYear - optHit.simYear
            : 0;
          return (
            <div
              key={m.amount}
              className={`rounded-xl p-3 border transition-all ${
                m.reached
                  ? 'bg-green-400/8 border-green-400/25'
                  : m.simYear !== null
                  ? 'bg-secondary/30 border-border/40'
                  : 'bg-secondary/10 border-border/20 opacity-50'
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xl">{m.icon}</span>
                {m.reached && <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />}
              </div>
              <div className="text-xs font-bold text-foreground mb-0.5">{m.label}</div>
              <div className="text-xs text-muted-foreground">
                {formatCurrency(m.amount, country)}
              </div>
              {m.reached ? (
                <div className="text-xs text-green-400 font-semibold mt-1">✓ Alcanzado</div>
              ) : m.simYear !== null ? (
                <div className="mt-1 space-y-0.5">
                  <div className="text-xs font-semibold text-primary">Año {m.simYear} · Edad {m.age}</div>
                  {yearsEarlier > 0 && (
                    <div className="text-xs text-green-400">{yearsEarlier}a antes en OPT</div>
                  )}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground/50 mt-1">No proyectado</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── INSIGHT CARD ─────────────────────────────────────────────────────────────
function InsightCard({ insight }: { insight: ProjectionInsight }) {
  const styles: Record<ProjectionInsight['type'], { bg: string; border: string; icon: React.ElementType; color: string }> = {
    gap:         { bg: 'bg-primary/8',  border: 'border-primary/20',   icon: TrendingUp,    color: 'text-primary' },
    milestone:   { bg: 'bg-cyan-400/8', border: 'border-cyan-400/20',  icon: Target,        color: 'text-cyan-400' },
    warning:     { bg: 'bg-amber-400/8',border: 'border-amber-400/20', icon: AlertTriangle, color: 'text-amber-400' },
    opportunity: { bg: 'bg-green-400/8',border: 'border-green-400/20', icon: Lightbulb,     color: 'text-green-400' },
  };
  const s = styles[insight.type];
  const Icon = s.icon;

  return (
    <div className={`flex gap-3 p-3 rounded-xl border ${s.bg} ${s.border}`}>
      <div className="flex items-start gap-2 min-w-0">
        <span className="text-lg shrink-0 mt-0.5">{insight.icon}</span>
        <div className="min-w-0">
          <div className={`text-xs font-bold mb-0.5 ${s.color}`}>{insight.title}</div>
          <div className="text-xs text-foreground/80 leading-relaxed">{insight.detail}</div>
        </div>
      </div>
    </div>
  );
}

// ─── WHAT-IF COMPARISON ───────────────────────────────────────────────────────
function WhatIfSection({ result, country }: { result: ProjectionsResult; country: string }) {
  const base10 = result.scenarios.base[9]?.netWorth ?? 0;
  const opt10 = result.scenarios.optimistic[9]?.netWorth ?? 0;
  const pes10 = result.scenarios.pessimistic[9]?.netWorth ?? 0;

  const scenarios = [
    { label: 'Si tomas las mejores decisiones', value: opt10, color: 'text-green-400', barColor: 'bg-green-400' },
    { label: 'Con tu ritmo actual', value: base10, color: 'text-primary', barColor: 'bg-primary' },
    { label: 'Si evitas invertir y te endeudas', value: pes10, color: 'text-amber-400', barColor: 'bg-amber-400' },
  ].sort((a, b) => b.value - a.value);

  const maxVal = Math.max(...scenarios.map(s => Math.abs(s.value)));

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        <Zap className="w-3.5 h-3.5" />¿Qué pasa en 10 años si...?
      </h4>
      <div className="space-y-3">
        {scenarios.map(s => (
          <div key={s.label}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">{s.label}</span>
              <span className={`text-xs font-bold ${s.color}`}>{formatCurrency(s.value, country)}</span>
            </div>
            <div className="h-2 bg-secondary/50 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${maxVal > 0 ? Math.max(5, (Math.abs(s.value) / maxVal) * 100) : 5}%` }}
                transition={{ duration: 0.7, ease: "easeOut" }}
                className={`h-full rounded-full ${s.barColor}`}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── MAIN PROJECTIONS PANEL ───────────────────────────────────────────────────
export function ProjectionsPanel({ state }: { state: SimulationState }) {
  const [horizon, setHorizon] = useState<Horizon>(10);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [version, setVersion] = useState(0);
  const country = state.profile?.country ?? 'USA';

  const result = useMemo(() => buildProjections(state), [state, version]);

  const visibleChartData: ChartDataPoint[] = useMemo(
    () => result.chartData.slice(0, horizon),
    [result, horizon]
  );

  const refresh = () => {
    setIsRefreshing(true);
    setTimeout(() => { setVersion(v => v + 1); setIsRefreshing(false); }, 600);
  };

  const riskProfileStyles: Record<string, string> = {
    Conservador: 'text-green-400 bg-green-400/10 border-green-400/25',
    Equilibrado: 'text-primary bg-primary/10 border-primary/25',
    Agresivo:    'text-red-400 bg-red-400/10 border-red-400/25',
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-400/15 border border-cyan-400/30 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Proyecciones Financieras</h3>
            <p className="text-xs text-muted-foreground">Basadas en tu estado actual y estilo de decisión</p>
          </div>
          <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${riskProfileStyles[result.riskProfile]}`}>
            {result.riskProfile}
          </div>
        </div>
        <button
          onClick={refresh}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-cyan-400 bg-cyan-400/10 border border-cyan-400/25 hover:bg-cyan-400/20 transition-all disabled:opacity-60"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* Horizon selector */}
      <div className="flex items-center gap-2">
        <Clock className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Horizonte:</span>
        <div className="flex gap-1 bg-secondary/40 rounded-lg p-0.5">
          {([5, 10, 20] as Horizon[]).map(h => (
            <button
              key={h}
              onClick={() => setHorizon(h)}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                horizon === h
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {h} años
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">
          · Año {result.currentYear + horizon} · Edad {result.currentAge + horizon}
        </span>
      </div>

      {/* Scenario summary cards */}
      <div className="flex gap-3 flex-wrap sm:flex-nowrap">
        {(['optimistic', 'base', 'pessimistic'] as ScenarioId[]).map(id => (
          <ScenarioSummaryCard key={id} id={id} result={result} horizon={horizon} country={country} />
        ))}
      </div>

      {/* Main chart */}
      <div className="glass rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-foreground">Evolución del patrimonio neto</h4>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {(['optimistic', 'base', 'pessimistic'] as ScenarioId[]).map(id => (
              <div key={id} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: SCENARIO_CONFIGS[id].color }} />
                <span>{SCENARIO_CONFIGS[id].label}</span>
              </div>
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={`${horizon}-${version}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
          >
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={visibleChartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradOpt" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="hsl(142 76% 50%)" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="hsl(142 76% 50%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradBase" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="hsl(252 87% 67%)" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="hsl(252 87% 67%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradPes" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="hsl(38 92% 60%)" stopOpacity={0.22} />
                    <stop offset="95%" stopColor="hsl(38 92% 60%)" stopOpacity={0} />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />

                <XAxis
                  dataKey="label"
                  tick={{ fill: 'hsl(215 25% 55%)', fontSize: 10 }}
                  interval={horizon === 5 ? 0 : horizon === 10 ? 1 : 3}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: 'hsl(215 25% 55%)', fontSize: 10 }}
                  tickFormatter={v => '$' + fmtCompact(v)}
                  width={58}
                  tickLine={false}
                  axisLine={false}
                />

                <Tooltip content={<CustomTooltip country={country} />} />

                {/* Reference line at current net worth */}
                <ReferenceLine
                  y={result.currentNetWorth}
                  stroke="rgba(255,255,255,0.15)"
                  strokeDasharray="4 4"
                  label={{ value: 'Hoy', fill: 'hsl(215 25% 45%)', fontSize: 9, position: 'insideTopRight' }}
                />

                {/* Milestone reference lines */}
                {[100_000, 250_000, 500_000, 1_000_000]
                  .filter(m => m > result.currentNetWorth && m < (result.scenarios.optimistic[horizon - 1]?.netWorth ?? 0) * 1.1)
                  .map(m => (
                    <ReferenceLine
                      key={m}
                      y={m}
                      stroke="rgba(255,255,255,0.08)"
                      strokeDasharray="2 4"
                      label={{ value: '$' + fmtCompact(m), fill: 'hsl(215 25% 40%)', fontSize: 9, position: 'insideTopRight' }}
                    />
                  ))
                }

                <Area
                  type="monotone"
                  dataKey="optimistic"
                  stroke="hsl(142 76% 50%)"
                  strokeWidth={2}
                  fill="url(#gradOpt)"
                  dot={false}
                  activeDot={{ r: 4, fill: 'hsl(142 76% 50%)', strokeWidth: 0 }}
                />
                <Area
                  type="monotone"
                  dataKey="base"
                  stroke="hsl(252 87% 67%)"
                  strokeWidth={2.5}
                  fill="url(#gradBase)"
                  dot={false}
                  activeDot={{ r: 4, fill: 'hsl(252 87% 67%)', strokeWidth: 0 }}
                />
                <Area
                  type="monotone"
                  dataKey="pessimistic"
                  stroke="hsl(38 92% 60%)"
                  strokeWidth={1.5}
                  fill="url(#gradPes)"
                  dot={false}
                  activeDot={{ r: 4, fill: 'hsl(38 92% 60%)', strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>
        </AnimatePresence>

        {/* Net worth at horizon comparison */}
        <div className="mt-3 pt-3 border-t border-border/30 grid grid-cols-3 gap-2 text-center">
          {(['optimistic', 'base', 'pessimistic'] as ScenarioId[]).map(id => {
            const pt = result.scenarios[id][horizon - 1];
            const cfg = SCENARIO_CONFIGS[id];
            const delta = pt ? pt.netWorth - result.currentNetWorth : 0;
            const pct = result.currentNetWorth > 0 ? (delta / result.currentNetWorth) * 100 : 0;
            return (
              <div key={id}>
                <div className="text-xs text-muted-foreground mb-0.5">{cfg.label} en {horizon}a</div>
                <div className="text-sm font-bold" style={{ color: cfg.color }}>
                  {pt ? formatCurrency(pt.netWorth, country) : '—'}
                </div>
                {pt && (
                  <div className={`text-xs font-semibold ${delta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {delta >= 0 ? '+' : ''}{pct.toFixed(0)}%
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* What-if section */}
      <div className="glass rounded-xl p-4">
        <WhatIfSection result={result} country={country} />
      </div>

      {/* Milestones */}
      <div className="glass rounded-xl p-4">
        <MilestoneTimeline result={result} country={country} />
      </div>

      {/* Insights connecting to advisor */}
      {result.insights.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5" />Insights para tus decisiones
          </h4>
          <div className="space-y-2">
            {result.insights.map((insight, i) => (
              <InsightCard key={i} insight={insight} />
            ))}
          </div>
        </div>
      )}

      {/* Footer note */}
      <div className="flex items-start gap-2 p-3 rounded-xl bg-secondary/20 border border-border/30">
        <Info className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Las proyecciones se calculan dinámicamente desde tu año {result.currentYear} de simulación, 
          usando tu tasa de ahorro real ({Math.round((state.financial.monthlyIncome - state.financial.monthlyExpenses) / Math.max(1, state.financial.monthlyIncome) * 100)}%), 
          inversiones actuales y perfil de riesgo <strong className="text-foreground">{result.riskProfile}</strong>. 
          Avanzan automáticamente conforme tomas decisiones en el simulador.
        </p>
      </div>
    </div>
  );
}
