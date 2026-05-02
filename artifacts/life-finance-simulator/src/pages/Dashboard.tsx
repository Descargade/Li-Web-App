import { useState, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp, TrendingDown, RefreshCw, Play, BarChart2,
  Clock, GitCompare, Activity, Wallet, PiggyBank, LineChart,
  AlertTriangle, ChevronRight, Zap, Target, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { loadState, saveState, clearState, createNewState } from "@/lib/storage";
import {
  advanceYear, getDecisionsForYear, getFeedbackMessage,
  formatCurrency, calcNetWorth
} from "@/lib/simulation";
import type { SimulationState, FinancialState, TimelineEvent, Decision } from "@/lib/types";

const CHART_COLORS = {
  primary: "hsl(252 87% 67%)",
  cyan: "hsl(186 90% 55%)",
  green: "hsl(142 76% 56%)",
  amber: "hsl(38 92% 60%)",
  red: "hsl(0 72% 51%)",
};

function AnimatedNumber({ value, prefix = "", className = "" }: { value: number; prefix?: string; className?: string }) {
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    let start = display;
    const end = value;
    if (start === end) return;
    const steps = 20;
    const inc = (end - start) / steps;
    let count = 0;
    const timer = setInterval(() => {
      count++;
      start += inc;
      setDisplay(start);
      if (count >= steps) {
        setDisplay(end);
        clearInterval(timer);
      }
    }, 20);
    return () => clearInterval(timer);
  }, [value]);

  const isNeg = display < 0;
  return (
    <span className={`${isNeg ? "number-negative" : ""} ${className}`}>
      {prefix}{Math.abs(display) >= 1000
        ? (isNeg ? "-" : "") + formatNumber(Math.abs(display))
        : (isNeg ? "-" : "") + Math.abs(Math.round(display)).toString()}
    </span>
  );
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "K";
  return Math.round(n).toString();
}

function MetricCard({
  label, value, prev, icon: Icon, color, country
}: {
  label: string; value: number; prev: number; icon: React.ElementType; color: string; country?: string;
}) {
  const pct = prev > 0 ? ((value - prev) / Math.abs(prev)) * 100 : 0;
  const up = pct >= 0;
  return (
    <motion.div
      layout
      className="glass rounded-xl p-4 flex flex-col gap-2 hover:bg-white/5 transition-colors"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: color + "25" }}>
            <Icon className="w-3.5 h-3.5" style={{ color }} />
          </div>
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
        </div>
        {prev !== value && (
          <div className={`flex items-center gap-0.5 text-xs font-medium ${up ? "number-positive" : "number-negative"}`}>
            {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(pct).toFixed(1)}%
          </div>
        )}
      </div>
      <div className="text-xl font-bold text-foreground">
        {formatCurrency(value, country)}
      </div>
    </motion.div>
  );
}

function DecisionCard({ decision, onSelect, disabled }: { decision: Decision; onSelect: (d: Decision) => void; disabled: boolean }) {
  const riskColor = { LOW: "text-green-400 bg-green-400/10", MED: "text-amber-400 bg-amber-400/10", HIGH: "text-red-400 bg-red-400/10" };
  const impactKeys = Object.entries(decision.impact).filter(([, v]) => v !== undefined && v !== 0);

  return (
    <motion.button
      whileHover={disabled ? {} : { y: -2 }}
      whileTap={disabled ? {} : { scale: 0.98 }}
      onClick={() => !disabled && onSelect(decision)}
      disabled={disabled}
      data-testid={`btn-decision-${decision.id}`}
      className={`w-full text-left p-4 rounded-xl border transition-all ${
        disabled
          ? "opacity-40 cursor-not-allowed glass"
          : "glass glass-hover border-border hover:border-primary/40 cursor-pointer"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">{decision.emoji}</span>
          <span className="text-sm font-semibold text-foreground">{decision.name}</span>
        </div>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${riskColor[decision.risk]}`}>
          {decision.risk}
        </span>
      </div>
      <p className="text-xs text-muted-foreground mb-2">{decision.description}</p>
      <div className="flex flex-wrap gap-1">
        {impactKeys.slice(0, 3).map(([k, v]) => {
          const isPos = (v as number) > 0;
          const labels: Record<string, string> = {
            cash: "Efectivo", savings: "Ahorros", investments: "Inversiones",
            debt: "Deuda", income: "Ingreso", stress: "Estrés", happiness: "Felicidad"
          };
          const debtOrStress = k === "debt" || k === "stress";
          const actuallyGood = debtOrStress ? !isPos : isPos;
          return (
            <span
              key={k}
              className={`text-xs px-1.5 py-0.5 rounded font-medium ${actuallyGood ? "bg-green-400/10 text-green-400" : "bg-red-400/10 text-red-400"}`}
            >
              {actuallyGood ? "+" : ""}{labels[k] || k}
            </span>
          );
        })}
      </div>
    </motion.button>
  );
}

function EventPopup({ event, onClose }: { event: TimelineEvent; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-lg glass rounded-t-3xl p-8 pb-12"
      >
        <div className="text-center mb-6">
          <div className="text-6xl mb-3">{event.icon}</div>
          <h2 className="text-2xl font-bold text-foreground">{event.title}</h2>
          <p className="text-muted-foreground mt-2 text-sm">{event.description}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-6">
          {Object.entries(event.impact).filter(([, v]) => v !== undefined && v !== 0).map(([k, v]) => {
            const labels: Record<string, string> = {
              cash: "Efectivo", savings: "Ahorros", investments: "Inversiones",
              debt: "Deuda", income: "Ingreso %", stress: "Estrés", happiness: "Felicidad"
            };
            const debtOrStress = k === "debt" || k === "stress";
            const val = v as number;
            const isPos = val > 0;
            const actuallyGood = debtOrStress ? !isPos : isPos;
            const display = k === "income" || k === "investments"
              ? (isPos ? "+" : "") + (val * 100).toFixed(0) + "%"
              : (isPos ? "+" : "") + (val >= 1000 || val <= -1000 ? "$" + formatNumber(Math.abs(val)) : Math.round(val).toString());
            return (
              <div key={k} className={`p-3 rounded-xl text-center ${actuallyGood ? "bg-green-400/10" : "bg-red-400/10"}`}>
                <div className={`text-lg font-bold ${actuallyGood ? "number-positive" : "number-negative"}`}>{display}</div>
                <div className="text-xs text-muted-foreground">{labels[k] || k}</div>
              </div>
            );
          })}
        </div>
        <Button onClick={onClose} className="w-full bg-primary glow-primary" data-testid="btn-event-continue">
          Continuar
        </Button>
      </motion.div>
    </motion.div>
  );
}

function TimelineView({ timeline, history, country }: { timeline: TimelineEvent[]; history: FinancialState[]; country: string }) {
  const [selected, setSelected] = useState<TimelineEvent | null>(null);
  if (timeline.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
        <Clock className="w-10 h-10 mb-3 opacity-30" />
        <p className="text-sm">Avanza años para ver tu línea de tiempo</p>
      </div>
    );
  }

  const years = Array.from(new Set(timeline.map(e => e.year))).sort((a, b) => a - b);

  return (
    <>
      <div className="overflow-x-auto pb-4">
        <div className="relative min-w-max flex items-start gap-0">
          {/* Horizontal line */}
          <div className="absolute top-8 left-0 right-0 h-0.5 bg-border" />

          {years.map((yr, i) => {
            const eventsThisYear = timeline.filter(e => e.year === yr);
            const state = history[yr] || history[history.length - 1];
            return (
              <div key={yr} className="relative flex flex-col items-center" style={{ minWidth: 100 }}>
                {/* Events above line */}
                <div className="flex flex-col-reverse items-center gap-1 mb-2 min-h-[60px] justify-end">
                  {eventsThisYear.map(ev => (
                    <button
                      key={ev.id}
                      onClick={() => setSelected(ev)}
                      data-testid={`timeline-event-${ev.id}`}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-sm hover:scale-110 transition-transform border border-white/20"
                      style={{ background: ev.type === "random" ? "#ef444433" : "#7c5aff33" }}
                      title={ev.title}
                    >
                      {ev.icon}
                    </button>
                  ))}
                </div>
                {/* Year node */}
                <div className={`w-4 h-4 rounded-full border-2 z-10 ${i === years.length - 1 ? "border-primary bg-primary glow-primary" : "border-border bg-background"}`} />
                {/* Year label */}
                <div className="mt-2 text-xs text-muted-foreground font-medium">Año {yr}</div>
                {state && (
                  <div className="mt-0.5 text-xs text-primary font-semibold">{formatCurrency(state.netWorth, country)}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={() => setSelected(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="glass rounded-2xl p-6 max-w-sm w-full"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{selected.icon}</span>
                  <div>
                    <h3 className="font-bold text-foreground">{selected.title}</h3>
                    <p className="text-xs text-muted-foreground">Año {selected.year} · Edad {selected.age}</p>
                  </div>
                </div>
                <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-sm text-muted-foreground">{selected.description}</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function CompareView({ state }: { state: SimulationState }) {
  const hasA = state.scenarioA.length > 0;
  const hasB = state.scenarioB.length > 0;

  if (!hasA && !hasB) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
        <GitCompare className="w-10 h-10 mb-3 opacity-30" />
        <p className="text-sm">Guarda escenarios usando los botones de abajo</p>
      </div>
    );
  }

  const maxLen = Math.max(state.scenarioA.length, state.scenarioB.length);
  const data = Array.from({ length: maxLen }).map((_, i) => ({
    year: i,
    "Escenario A": state.scenarioA[i]?.netWorth ?? null,
    "Escenario B": state.scenarioB[i]?.netWorth ?? null,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis dataKey="year" tick={{ fill: "hsl(215 25% 55%)", fontSize: 11 }} tickFormatter={v => `Año ${v}`} />
        <YAxis tick={{ fill: "hsl(215 25% 55%)", fontSize: 11 }} tickFormatter={v => "$" + formatNumber(v)} />
        <Tooltip
          contentStyle={{ background: "hsl(222 47% 9%)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
          labelFormatter={v => `Año ${v}`}
          formatter={(v: number) => ["$" + formatNumber(v)]}
        />
        <Legend />
        <Bar dataKey="Escenario A" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} />
        <Bar dataKey="Escenario B" fill={CHART_COLORS.cyan} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const [simState, setSimState] = useState<SimulationState | null>(loadState);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [decisionMade, setDecisionMade] = useState(false);
  const [pendingEvent, setPendingEvent] = useState<TimelineEvent | null>(null);
  const [feedback, setFeedback] = useState<string>("");
  const [advancing, setAdvancing] = useState(false);

  useEffect(() => {
    if (!simState?.profile) {
      setLocation("/");
      return;
    }
    if (decisions.length === 0) {
      setDecisions(getDecisionsForYear(simState.financial, simState.financial.year));
    }
  }, []);

  const save = useCallback((state: SimulationState) => {
    setSimState(state);
    saveState(state);
  }, []);

  const handleDecision = (decision: Decision) => {
    if (!simState || decisionMade) return;

    const newFinancial = {
      ...simState.financial,
    };

    // Apply financial impacts manually
    const imp = decision.impact;
    if (imp.cash !== undefined) newFinancial.cash = Math.max(0, newFinancial.cash + (imp.cash as number));
    if (imp.savings !== undefined) newFinancial.savings = Math.max(0, newFinancial.savings + (imp.savings as number));
    if (imp.investments !== undefined) {
      const v = imp.investments as number;
      newFinancial.investments = v < 0
        ? Math.max(0, newFinancial.investments * (1 + v))
        : newFinancial.investments + v;
    }
    if (imp.debt !== undefined) newFinancial.debt = Math.max(0, newFinancial.debt + (imp.debt as number));
    if (imp.income !== undefined) newFinancial.monthlyIncome = Math.max(500, newFinancial.monthlyIncome * (1 + (imp.income as number)));
    if (imp.stress !== undefined) newFinancial.stressLevel = Math.min(100, Math.max(0, newFinancial.stressLevel + (imp.stress as number)));
    if (imp.happiness !== undefined) newFinancial.happinessLevel = Math.min(100, Math.max(0, newFinancial.happinessLevel + (imp.happiness as number)));
    newFinancial.netWorth = calcNetWorth(newFinancial);

    const event: TimelineEvent = {
      id: `decision-${decision.id}-y${simState.financial.year}`,
      year: simState.financial.year,
      age: simState.financial.age,
      type: "decision",
      title: decision.name,
      description: decision.description,
      impact: decision.impact,
      icon: decision.emoji,
      color: "#7c5aff",
    };

    const updated: SimulationState = {
      ...simState,
      financial: newFinancial,
      timeline: [...simState.timeline, event],
    };
    save(updated);
    setDecisionMade(true);
  };

  const advanceOneYear = () => {
    if (!simState?.profile || advancing) return;
    setAdvancing(true);

    setTimeout(() => {
      const prev = simState.financial;
      const { newState, triggeredEvents } = advanceYear(simState.financial, simState.profile!);
      const msg = getFeedbackMessage(newState, prev);

      const updated: SimulationState = {
        ...simState,
        financial: newState,
        history: [...simState.history, { ...newState }],
        timeline: [...simState.timeline, ...triggeredEvents],
      };

      save(updated);
      setFeedback(msg);
      setDecisionMade(false);
      setDecisions(getDecisionsForYear(newState, newState.year));
      setAdvancing(false);

      if (triggeredEvents.length > 0) {
        setPendingEvent(triggeredEvents[0]);
      }
    }, 600);
  };

  const saveScenario = (slot: "A" | "B") => {
    if (!simState) return;
    const updated: SimulationState = {
      ...simState,
      [slot === "A" ? "scenarioA" : "scenarioB"]: [...simState.history],
    };
    save(updated);
  };

  const reset = () => {
    clearState();
    setLocation("/");
  };

  if (!simState?.profile) return null;

  const { financial, history, profile, timeline } = simState;
  const prev = history.length > 1 ? history[history.length - 2] : history[0];

  const chartData = history.map((h, i) => ({
    year: `Año ${h.year}`,
    "Patrimonio neto": Math.round(h.netWorth),
    Ahorros: Math.round(h.savings),
    Inversiones: Math.round(h.investments),
    Deuda: Math.round(h.debt),
  }));

  const pieData = [
    { name: "Efectivo", value: Math.max(0, financial.cash), color: CHART_COLORS.cyan },
    { name: "Ahorros", value: Math.max(0, financial.savings), color: CHART_COLORS.primary },
    { name: "Inversiones", value: Math.max(0, financial.investments), color: CHART_COLORS.green },
  ].filter(d => d.value > 0);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-60 -left-60 w-[500px] h-[500px] rounded-full bg-primary/8 blur-3xl" />
        <div className="absolute -bottom-60 -right-60 w-[500px] h-[500px] rounded-full bg-accent/8 blur-3xl" />
      </div>

      {/* Top bar */}
      <header className="relative border-b border-border/50 px-6 py-3 flex items-center justify-between backdrop-blur-sm bg-background/80 sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-primary/20 flex items-center justify-center">
              <TrendingUp className="w-3 h-3 text-primary" />
            </div>
            <span className="font-bold text-sm">LifeFinance</span>
          </div>
          <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground">
            <span>{profile.name}</span>
            <span>·</span>
            <span>Edad {financial.age}</span>
            <span>·</span>
            <span>Año {financial.year}</span>
            <span>·</span>
            <span>{profile.country}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <motion.div
            key={financial.netWorth}
            initial={{ scale: 1.05, color: "hsl(142 76% 56%)" }}
            animate={{ scale: 1, color: "hsl(210 40% 94%)" }}
            className="text-right hidden sm:block"
          >
            <div className="text-xs text-muted-foreground">Patrimonio neto</div>
            <div className="text-lg font-bold">{formatCurrency(financial.netWorth, profile.country)}</div>
          </motion.div>
          <button
            data-testid="btn-reset"
            onClick={reset}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="relative flex gap-0 h-[calc(100vh-57px)]">
        {/* Left sidebar */}
        <aside className="w-72 shrink-0 border-r border-border/50 flex flex-col p-4 gap-4 overflow-y-auto">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-2">
            <MetricCard label="Efectivo" value={financial.cash} prev={prev.cash} icon={Wallet} color={CHART_COLORS.cyan} country={profile.country} />
            <MetricCard label="Ahorros" value={financial.savings} prev={prev.savings} icon={PiggyBank} color={CHART_COLORS.primary} country={profile.country} />
            <MetricCard label="Inversiones" value={financial.investments} prev={prev.investments} icon={LineChart} color={CHART_COLORS.green} country={profile.country} />
            <MetricCard label="Deuda" value={financial.debt} prev={prev.debt} icon={AlertTriangle} color={CHART_COLORS.red} country={profile.country} />
          </div>

          {/* Stress / Happiness */}
          <div className="glass rounded-xl p-3 space-y-2">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">Estrés</span>
                <span className={financial.stressLevel > 60 ? "number-negative" : "number-positive"}>{Math.round(financial.stressLevel)}%</span>
              </div>
              <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                <motion.div
                  animate={{ width: `${financial.stressLevel}%` }}
                  className="h-full rounded-full"
                  style={{ background: financial.stressLevel > 60 ? CHART_COLORS.red : CHART_COLORS.amber }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">Felicidad</span>
                <span className="number-positive">{Math.round(financial.happinessLevel)}%</span>
              </div>
              <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                <motion.div
                  animate={{ width: `${financial.happinessLevel}%` }}
                  className="h-full rounded-full"
                  style={{ background: CHART_COLORS.green }}
                />
              </div>
            </div>
          </div>

          {/* Feedback */}
          {feedback && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass rounded-xl p-3 border border-primary/20"
            >
              <div className="flex items-start gap-2">
                <Zap className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground">{feedback}</p>
              </div>
            </motion.div>
          )}

          {/* Advance button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={advanceOneYear}
            disabled={advancing}
            data-testid="btn-advance-year"
            className="w-full py-3.5 rounded-xl bg-primary font-semibold text-white text-sm flex items-center justify-center gap-2 glow-primary disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {advancing ? (
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}>
                <RefreshCw className="w-4 h-4" />
              </motion.div>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Avanzar 1 año
              </>
            )}
          </motion.button>

          {/* Decisions */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Decisiones del año {financial.year}
              </span>
            </div>
            <div className="space-y-2">
              {decisions.map(d => (
                <DecisionCard
                  key={d.id}
                  decision={d}
                  onSelect={handleDecision}
                  disabled={decisionMade}
                />
              ))}
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-5">
          <Tabs defaultValue="overview" className="h-full flex flex-col">
            <TabsList className="self-start mb-4 bg-secondary/50">
              <TabsTrigger value="overview" data-testid="tab-overview">
                <Activity className="w-3.5 h-3.5 mr-1.5" />Resumen
              </TabsTrigger>
              <TabsTrigger value="timeline" data-testid="tab-timeline">
                <Clock className="w-3.5 h-3.5 mr-1.5" />Línea de tiempo
              </TabsTrigger>
              <TabsTrigger value="compare" data-testid="tab-compare">
                <GitCompare className="w-3.5 h-3.5 mr-1.5" />Comparar
              </TabsTrigger>
              <TabsTrigger value="analysis" data-testid="tab-analysis">
                <BarChart2 className="w-3.5 h-3.5 mr-1.5" />Análisis
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="flex-1 space-y-5">
              {/* Hero numbers */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: "Patrimonio neto", value: financial.netWorth, color: CHART_COLORS.primary },
                  { label: "Ingreso mensual", value: financial.monthlyIncome, color: CHART_COLORS.green },
                  { label: "Gastos mensuales", value: financial.monthlyExpenses, color: CHART_COLORS.amber },
                ].map(item => (
                  <div key={item.label} className="glass rounded-xl p-5">
                    <div className="text-xs text-muted-foreground mb-1">{item.label}</div>
                    <div className="text-2xl font-bold" style={{ color: item.color }}>
                      {formatCurrency(item.value, profile.country)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Net worth chart */}
              <div className="glass rounded-xl p-5">
                <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  Evolución del patrimonio
                </h3>
                {chartData.length > 1 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="gradientNW" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradientSav" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={CHART_COLORS.cyan} stopOpacity={0.2} />
                          <stop offset="95%" stopColor={CHART_COLORS.cyan} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="year" tick={{ fill: "hsl(215 25% 55%)", fontSize: 10 }} />
                      <YAxis tick={{ fill: "hsl(215 25% 55%)", fontSize: 10 }} tickFormatter={v => "$" + formatNumber(v)} />
                      <Tooltip
                        contentStyle={{ background: "hsl(222 47% 9%)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8 }}
                        formatter={(v: number) => [formatCurrency(v, profile.country)]}
                      />
                      <Area type="monotone" dataKey="Patrimonio neto" stroke={CHART_COLORS.primary} fill="url(#gradientNW)" strokeWidth={2} dot={false} />
                      <Area type="monotone" dataKey="Inversiones" stroke={CHART_COLORS.green} fill="url(#gradientSav)" strokeWidth={1.5} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">
                    Avanza al menos un año para ver la evolución
                  </div>
                )}
              </div>

              {/* Goal progress */}
              <div className="glass rounded-xl p-5">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Target className="w-4 h-4 text-accent" />
                  Progreso hacia tu objetivo: <span className="text-accent capitalize ml-1">{profile.goal}</span>
                </h3>
                {(() => {
                  const targets: Record<string, { amount: number; label: string }> = {
                    house: { amount: 250000, label: "Ahorrar para casa ($250K)" },
                    retirement: { amount: 500000, label: "Fondo de retiro ($500K)" },
                    travel: { amount: 50000, label: "Fondo de viajes ($50K)" },
                    freedom: { amount: 300000, label: "Independencia financiera ($300K)" },
                  };
                  const target = targets[profile.goal] || targets.freedom;
                  const pct = Math.min(100, (financial.netWorth / target.amount) * 100);
                  return (
                    <div>
                      <div className="flex justify-between text-xs mb-2">
                        <span className="text-muted-foreground">{target.label}</span>
                        <span className="text-primary font-semibold">{pct.toFixed(1)}%</span>
                      </div>
                      <div className="h-3 bg-secondary rounded-full overflow-hidden">
                        <motion.div
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.8, ease: "easeOut" }}
                          className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                        />
                      </div>
                    </div>
                  );
                })()}
              </div>
            </TabsContent>

            <TabsContent value="timeline" className="flex-1">
              <div className="glass rounded-xl p-5">
                <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-accent" />
                  Tu línea de vida financiera
                </h3>
                <TimelineView timeline={timeline} history={history} country={profile.country} />
              </div>
            </TabsContent>

            <TabsContent value="compare" className="flex-1 space-y-4">
              <div className="glass rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <GitCompare className="w-4 h-4 text-primary" />
                    Comparar escenarios
                  </h3>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => saveScenario("A")}
                      data-testid="btn-save-scenario-a"
                      className="text-xs border-border"
                    >
                      Guardar como A
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => saveScenario("B")}
                      data-testid="btn-save-scenario-b"
                      className="text-xs border-border"
                    >
                      Guardar como B
                    </Button>
                  </div>
                </div>
                <CompareView state={simState} />
              </div>
            </TabsContent>

            <TabsContent value="analysis" className="flex-1 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="glass rounded-xl p-5">
                  <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-primary" />
                    Ingresos vs Gastos
                  </h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={chartData.slice(-6)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="year" tick={{ fill: "hsl(215 25% 55%)", fontSize: 10 }} />
                      <YAxis tick={{ fill: "hsl(215 25% 55%)", fontSize: 10 }} tickFormatter={v => "$" + formatNumber(v)} />
                      <Tooltip
                        contentStyle={{ background: "hsl(222 47% 9%)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8 }}
                        formatter={(v: number) => [formatCurrency(v, profile.country)]}
                      />
                      <Bar dataKey="Ahorros" fill={CHART_COLORS.primary} radius={[3, 3, 0, 0]} />
                      <Bar dataKey="Inversiones" fill={CHART_COLORS.green} radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="glass rounded-xl p-5">
                  <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-cyan-400" />
                    Composición actual
                  </h3>
                  {pieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="value" paddingAngle={4}>
                          {pieData.map((entry, i) => (
                            <Cell key={i} fill={entry.color} stroke="transparent" />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ background: "hsl(222 47% 9%)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8 }}
                          formatter={(v: number) => [formatCurrency(v, profile.country)]}
                        />
                        <Legend formatter={(value) => <span style={{ color: "hsl(215 25% 55%)", fontSize: 11 }}>{value}</span>} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">Sin activos todavía</div>
                  )}
                </div>
              </div>

              {/* Summary stats */}
              <div className="glass rounded-xl p-5">
                <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                  <ChevronRight className="w-4 h-4 text-accent" />
                  Resumen total
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: "Años simulados", value: financial.year, suffix: " años", color: CHART_COLORS.primary },
                    { label: "Ingreso acumulado", value: history.reduce((s, h) => s + h.monthlyIncome * 12, 0), isCurrency: true },
                    { label: "Eventos ocurridos", value: timeline.length, suffix: " eventos", color: CHART_COLORS.cyan },
                    { label: "Ratio ahorro", value: Math.round(((financial.savings + financial.investments) / (financial.netWorth || 1)) * 100), suffix: "%", color: CHART_COLORS.green },
                  ].map(item => (
                    <div key={item.label} className="text-center">
                      <div className="text-xl font-bold" style={{ color: item.color || CHART_COLORS.amber }}>
                        {item.isCurrency ? formatCurrency(item.value, profile.country) : item.value + (item.suffix || "")}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </main>
      </div>

      {/* Event popup */}
      <AnimatePresence>
        {pendingEvent && (
          <EventPopup event={pendingEvent} onClose={() => setPendingEvent(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
