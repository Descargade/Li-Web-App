import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp, Plus, Play, Trash2, BarChart2, Trophy,
  GitCompare, Award, ChevronRight, Star, X, AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from "recharts";
import {
  getAllScenarios, setActiveScenarioId, deleteScenario,
  getRiskProfile, SCENARIO_COLORS
} from "@/lib/scenarios";
import { formatCurrency, calculateScore, scoreGrade, gradeColor } from "@/lib/simulation";
import { ACHIEVEMENT_DEFS } from "@/lib/achievements";
import type { Scenario } from "@/lib/types";

function fmtNum(n: number): string {
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(0) + "K";
  return Math.round(n).toString();
}

// ─── SCENARIO CARD ────────────────────────────────────────────────────────────
function ScenarioCard({
  scenario, onPlay, onDelete, rank
}: {
  scenario: Scenario;
  onPlay: () => void;
  onDelete: () => void;
  rank?: { metric: string; isTop: boolean };
}) {
  const [confirming, setConfirming] = useState(false);
  const c = SCENARIO_COLORS[scenario.color];
  const { state } = scenario;
  const score = calculateScore(state.financial);
  const grade = scoreGrade(score);
  const risk = getRiskProfile(state.achievementData.highRiskCount);
  const unlockedCount = state.unlockedAchievements.length;
  const country = state.profile?.country ?? 'USA';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`relative rounded-2xl border p-5 flex flex-col gap-4 transition-all cursor-pointer group ${c.bg} ${c.border}`}
      onClick={onPlay}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl border ${c.border} bg-background/60`}>
            {scenario.emoji}
          </div>
          <div>
            <h3 className={`font-bold text-base leading-tight ${c.text}`}>{scenario.name}</h3>
            {scenario.description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{scenario.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
          {confirming ? (
            <>
              <button onClick={() => { deleteScenario(scenario.id); onDelete(); }}
                className="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 text-xs font-semibold px-2">
                Eliminar
              </button>
              <button onClick={() => setConfirming(false)} className="p-1.5 rounded-lg text-muted-foreground hover:bg-secondary">
                <X className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <button onClick={() => setConfirming(true)}
              className="p-1.5 rounded-lg text-muted-foreground/40 hover:text-red-400 hover:bg-red-400/10 transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-2">
        <div className="p-2.5 rounded-xl bg-background/50 border border-border/30">
          <div className="text-xs text-muted-foreground mb-0.5">Patrimonio neto</div>
          <div className={`text-base font-black ${c.text}`}>
            {formatCurrency(state.financial.netWorth, country)}
          </div>
        </div>
        <div className="p-2.5 rounded-xl bg-background/50 border border-border/30">
          <div className="text-xs text-muted-foreground mb-0.5">Score</div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-black" style={{ color: gradeColor(grade) }}>{grade}</span>
            <span className="text-xs text-muted-foreground">{score} pts</span>
          </div>
        </div>
        <div className="p-2.5 rounded-xl bg-background/50 border border-border/30">
          <div className="text-xs text-muted-foreground mb-0.5">Año actual</div>
          <div className="text-base font-bold text-foreground">
            Año {state.financial.year} · Edad {state.financial.age}
          </div>
        </div>
        <div className="p-2.5 rounded-xl bg-background/50 border border-border/30">
          <div className="text-xs text-muted-foreground mb-0.5">Perfil de riesgo</div>
          <div className={`text-sm font-bold ${risk.color}`}>{risk.label}</div>
        </div>
      </div>

      {/* Achievements + income */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Trophy className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-amber-400 font-semibold">{unlockedCount}</span>
          <span>/ {ACHIEVEMENT_DEFS.length} logros</span>
        </div>
        <div className="flex items-center gap-1">
          <TrendingUp className="w-3.5 h-3.5 text-green-400" />
          <span className="text-green-400 font-semibold">{formatCurrency(state.financial.monthlyIncome, country)}/mes</span>
        </div>
      </div>

      {/* Play button */}
      <button
        onClick={onPlay}
        className={`w-full py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${c.bg} ${c.border} border ${c.text} hover:bg-opacity-80`}
      >
        <Play className="w-3.5 h-3.5" />Jugar esta vida
        <ChevronRight className="w-3.5 h-3.5 ml-auto" />
      </button>
    </motion.div>
  );
}

// ─── COMPARISON VIEW ──────────────────────────────────────────────────────────
function ComparisonView({ scenarios }: { scenarios: Scenario[] }) {
  const [selected, setSelected] = useState<string[]>(scenarios.slice(0, 3).map(s => s.id));

  const visible = scenarios.filter(s => selected.includes(s.id));
  const chartData = [{
    name: 'Patrimonio',
    ...Object.fromEntries(visible.map(s => [s.name, Math.round(s.state.financial.netWorth)])),
  }, {
    name: 'Inversiones',
    ...Object.fromEntries(visible.map(s => [s.name, Math.round(s.state.financial.investments)])),
  }, {
    name: 'Ahorros',
    ...Object.fromEntries(visible.map(s => [s.name, Math.round(s.state.financial.savings)])),
  }];

  const incomeData = visible.map(s => ({
    name: s.name,
    Ingreso: s.state.financial.monthlyIncome * 12,
    Deuda: s.state.financial.debt,
  }));

  // Find best performer per metric
  const bestNetWorth = visible.reduce((a, b) =>
    a.state.financial.netWorth > b.state.financial.netWorth ? a : b, visible[0]);
  const bestScore = visible.reduce((a, b) =>
    calculateScore(a.state.financial) > calculateScore(b.state.financial) ? a : b, visible[0]);
  const leastDebt = visible.reduce((a, b) =>
    a.state.financial.debt < b.state.financial.debt ? a : b, visible[0]);
  const mostAchievements = visible.reduce((a, b) =>
    a.state.unlockedAchievements.length > b.state.unlockedAchievements.length ? a : b, visible[0]);

  return (
    <div className="space-y-6">
      {/* Scenario selector */}
      {scenarios.length > 3 && (
        <div className="flex flex-wrap gap-2">
          {scenarios.map(s => {
            const c = SCENARIO_COLORS[s.color];
            const isSelected = selected.includes(s.id);
            return (
              <button
                key={s.id}
                onClick={() => setSelected(prev =>
                  isSelected ? prev.filter(id => id !== s.id) : [...prev, s.id]
                )}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                  isSelected ? `${c.bg} ${c.border} ${c.text}` : 'bg-secondary/40 border-border/40 text-muted-foreground'
                }`}
              >
                <span>{s.emoji}</span>{s.name}
              </button>
            );
          })}
        </div>
      )}

      {visible.length < 2 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          Selecciona al menos 2 escenarios para comparar
        </div>
      ) : (
        <>
          {/* Ganadores por categoría */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Mayor patrimonio', scenario: bestNetWorth, value: formatCurrency(bestNetWorth?.state.financial.netWorth, bestNetWorth?.state.profile?.country ?? 'USA'), icon: TrendingUp },
              { label: 'Mejor score', scenario: bestScore, value: scoreGrade(calculateScore(bestScore?.state.financial)) + ' · ' + calculateScore(bestScore?.state.financial) + 'pts', icon: Award },
              { label: 'Menor deuda', scenario: leastDebt, value: formatCurrency(leastDebt?.state.financial.debt, leastDebt?.state.profile?.country ?? 'USA'), icon: Star },
              { label: 'Más logros', scenario: mostAchievements, value: mostAchievements?.state.unlockedAchievements.length + ' logros', icon: Trophy },
            ].filter(item => item.scenario).map(item => {
              if (!item.scenario) return null;
              const c = SCENARIO_COLORS[item.scenario.color];
              const Icon = item.icon;
              return (
                <div key={item.label} className={`p-3 rounded-xl border ${c.bg} ${c.border}`}>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Icon className={`w-3.5 h-3.5 ${c.text}`} />
                    <span className="text-xs text-muted-foreground">{item.label}</span>
                  </div>
                  <div className={`text-sm font-bold ${c.text} flex items-center gap-1.5`}>
                    <span>{item.scenario.emoji}</span>{item.scenario.name}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{item.value}</div>
                </div>
              );
            })}
          </div>

          {/* Bar chart: Patrimonio, inversiones, ahorros */}
          <div className="glass rounded-xl p-4">
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-primary" />Activos por escenario
            </h4>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="name" tick={{ fill: 'hsl(215 25% 55%)', fontSize: 11 }} />
                <YAxis tick={{ fill: 'hsl(215 25% 55%)', fontSize: 10 }} tickFormatter={v => '$' + fmtNum(v)} width={52} />
                <Tooltip
                  contentStyle={{ background: 'hsl(222 47% 9%)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8 }}
                  formatter={(v: number) => ['$' + fmtNum(v)]}
                />
                <Legend formatter={v => <span style={{ color: 'hsl(215 25% 70%)', fontSize: 11 }}>{v}</span>} />
                {visible.map(s => (
                  <Bar key={s.id} dataKey={s.name} fill={SCENARIO_COLORS[s.color].chart} radius={[3, 3, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Ingreso anual vs Deuda */}
          <div className="glass rounded-xl p-4">
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-400" />Ingreso anual vs Deuda
            </h4>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={incomeData} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="name" tick={{ fill: 'hsl(215 25% 55%)', fontSize: 10 }} />
                <YAxis tick={{ fill: 'hsl(215 25% 55%)', fontSize: 10 }} tickFormatter={v => '$' + fmtNum(v)} width={52} />
                <Tooltip
                  contentStyle={{ background: 'hsl(222 47% 9%)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8 }}
                  formatter={(v: number) => ['$' + fmtNum(v)]}
                />
                <Legend formatter={v => <span style={{ color: 'hsl(215 25% 70%)', fontSize: 11 }}>{v}</span>} />
                <Bar dataKey="Ingreso" fill="hsl(142 76% 56%)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Deuda" fill="hsl(0 72% 51%)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Head-to-head table */}
          <div className="glass rounded-xl overflow-hidden">
            <div className="p-4 border-b border-border/40">
              <h4 className="text-sm font-semibold">Comparación detallada</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/40">
                    <th className="text-left p-3 text-xs text-muted-foreground font-medium">Métrica</th>
                    {visible.map(s => {
                      const c = SCENARIO_COLORS[s.color];
                      return (
                        <th key={s.id} className={`text-center p-3 text-xs font-bold ${c.text}`}>
                          {s.emoji} {s.name}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: 'Patrimonio neto', getValue: (s: Scenario) => formatCurrency(s.state.financial.netWorth, s.state.profile?.country ?? 'USA'), higher: true },
                    { label: 'Ingreso mensual', getValue: (s: Scenario) => formatCurrency(s.state.financial.monthlyIncome, s.state.profile?.country ?? 'USA'), higher: true },
                    { label: 'Inversiones', getValue: (s: Scenario) => formatCurrency(s.state.financial.investments, s.state.profile?.country ?? 'USA'), higher: true },
                    { label: 'Deuda', getValue: (s: Scenario) => formatCurrency(s.state.financial.debt, s.state.profile?.country ?? 'USA'), higher: false },
                    { label: 'Felicidad', getValue: (s: Scenario) => Math.round(s.state.financial.happinessLevel) + '%', higher: true },
                    { label: 'Estrés', getValue: (s: Scenario) => Math.round(s.state.financial.stressLevel) + '%', higher: false },
                    { label: 'Score', getValue: (s: Scenario) => scoreGrade(calculateScore(s.state.financial)) + ' (' + calculateScore(s.state.financial) + ')', higher: true },
                    { label: 'Perfil de riesgo', getValue: (s: Scenario) => getRiskProfile(s.state.achievementData.highRiskCount).label, higher: null },
                    { label: 'Logros', getValue: (s: Scenario) => s.state.unlockedAchievements.length + ' / ' + ACHIEVEMENT_DEFS.length, higher: true },
                    { label: 'Años simulados', getValue: (s: Scenario) => 'Año ' + s.state.financial.year, higher: true },
                  ].map(row => (
                    <tr key={row.label} className="border-b border-border/20 hover:bg-secondary/10 transition-colors">
                      <td className="p-3 text-xs text-muted-foreground">{row.label}</td>
                      {visible.map(s => {
                        const val = row.getValue(s);
                        const numericVals = row.higher !== null
                          ? visible.map(vs => {
                              const numMatch = row.getValue(vs).match(/[\d,]+(\.\d+)?/);
                              return numMatch ? parseFloat(numMatch[0].replace(/,/g, '')) : 0;
                            })
                          : [];
                        const myNumeric = numericVals.length > 0 ? numericVals[visible.indexOf(s)] : 0;
                        const best = row.higher === true ? Math.max(...numericVals) : Math.min(...numericVals);
                        const isWinner = row.higher !== null && numericVals.length > 1 && myNumeric === best;
                        return (
                          <td key={s.id} className={`p-3 text-center text-sm font-semibold ${isWinner ? 'text-green-400' : 'text-foreground'}`}>
                            {val} {isWinner && '✓'}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── MAIN SCENARIOS HOME ──────────────────────────────────────────────────────
export default function ScenariosHome() {
  const [, setLocation] = useLocation();
  const [scenarios, setScenarios] = useState<Scenario[]>(() => getAllScenarios());
  const [view, setView] = useState<'list' | 'compare'>('list');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const refresh = () => setScenarios(getAllScenarios());

  const playScenario = (id: string) => {
    setActiveScenarioId(id);
    setLocation('/play');
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-primary/8 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-cyan-400/6 blur-3xl" />
      </div>

      <div className="relative max-w-5xl mx-auto px-4 py-8 sm:py-12">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center glow-primary">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <span className="text-sm font-semibold text-muted-foreground tracking-widest uppercase">Life Finance</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-foreground leading-tight">
            Tus vidas <span className="text-primary">alternativas</span>
          </h1>
          <p className="text-muted-foreground mt-3 text-sm max-w-md mx-auto leading-relaxed">
            Simula diferentes caminos financieros año a año y descubre cómo cada decisión cambia tu futuro económico.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
            {[
              { icon: "🎯", label: "Decisiones reales" },
              { icon: "📊", label: "Proyecciones a 20 años" },
              { icon: "🏆", label: "20 logros desbloqueables" },
              { icon: "🔀", label: "Vidas paralelas" },
            ].map(f => (
              <span key={f.label} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full glass text-xs text-muted-foreground font-medium">
                <span>{f.icon}</span>{f.label}
              </span>
            ))}
          </div>
        </motion.div>

        {/* Action bar */}
        <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
          {scenarios.length >= 2 ? (
            <div className="flex gap-1 bg-secondary/50 rounded-xl p-1">
              <button
                onClick={() => setView('list')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${view === 'list' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Mis simulaciones
              </button>
              <button
                onClick={() => setView('compare')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5 ${view === 'compare' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <GitCompare className="w-4 h-4" />Comparar
              </button>
            </div>
          ) : <div />}

          <Button
            onClick={() => setLocation('/new')}
            className="bg-primary glow-primary font-semibold flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />Nueva simulación
          </Button>
        </div>

        {/* Empty state */}
        {scenarios.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-10"
          >
            <div className="text-7xl mb-5 animate-fade-in">🌌</div>
            <h2 className="text-2xl font-black text-foreground mb-2">Empieza tu primera vida</h2>
            <p className="text-muted-foreground text-sm mb-8 max-w-sm mx-auto leading-relaxed">
              Elige tu punto de partida, toma decisiones financieras año a año y mira cómo tu patrimonio evoluciona.
            </p>

            {/* How it works */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto mb-10 text-left">
              {[
                { step: "1", icon: "👤", title: "Define tu perfil", desc: "Nombre, país, ingresos y objetivo de vida." },
                { step: "2", icon: "🎯", title: "Toma decisiones", desc: "Cada año enfrentas oportunidades reales: invertir, estudiar, emprender." },
                { step: "3", icon: "📈", title: "Mira tu futuro", desc: "Proyecciones, análisis IA y comparación entre vidas paralelas." },
              ].map(item => (
                <div key={item.step} className="glass rounded-2xl p-4 flex gap-3 items-start card-lift">
                  <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary text-xs font-black shrink-0 mt-0.5">{item.step}</div>
                  <div>
                    <div className="text-lg mb-1">{item.icon}</div>
                    <div className="font-semibold text-sm text-foreground mb-1">{item.title}</div>
                    <div className="text-xs text-muted-foreground leading-relaxed">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <Button onClick={() => setLocation('/new')} className="bg-primary glow-primary px-10 py-3 font-bold text-base">
              <Plus className="w-4 h-4 mr-2" />Iniciar simulación
            </Button>
            <p className="text-xs text-muted-foreground mt-3">Gratis · Sin cuenta · Todo en tu navegador</p>
          </motion.div>
        )}

        {/* Scenario grid */}
        <AnimatePresence mode="popLayout">
          {view === 'list' && scenarios.length > 0 && (
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              {scenarios.map(scenario => (
                <ScenarioCard
                  key={scenario.id}
                  scenario={scenario}
                  onPlay={() => playScenario(scenario.id)}
                  onDelete={refresh}
                />
              ))}
              {/* Add more card */}
              {scenarios.length < 6 && (
                <motion.button
                  layout
                  onClick={() => setLocation('/new')}
                  className="rounded-2xl border border-dashed border-border/60 p-5 flex flex-col items-center justify-center gap-3 text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-primary/5 transition-all min-h-[200px]"
                >
                  <Plus className="w-8 h-8 opacity-50" />
                  <span className="text-sm font-medium">Nueva vida alternativa</span>
                </motion.button>
              )}
            </motion.div>
          )}

          {view === 'compare' && scenarios.length >= 2 && (
            <motion.div key="compare" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <ComparisonView scenarios={scenarios} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
