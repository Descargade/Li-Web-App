import { useState, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp, TrendingDown, RefreshCw, Play, BarChart2,
  Clock, GitCompare, Activity, Wallet, PiggyBank, LineChart,
  AlertTriangle, ChevronRight, Zap, Target, X, Menu
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { loadState, saveState, clearState } from "@/lib/storage";
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
    <div className="glass rounded-xl p-3 flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ background: color + "25" }}>
            <Icon className="w-3 h-3" style={{ color }} />
          </div>
          <span className="text-xs font-medium text-muted-foreground truncate">{label}</span>
        </div>
        {prev !== value && (
          <div className={`flex items-center gap-0.5 text-xs font-medium shrink-0 ${up ? "number-positive" : "number-negative"}`}>
            {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(pct).toFixed(0)}%
          </div>
        )}
      </div>
      <div className="text-base font-bold text-foreground leading-tight">
        {formatCurrency(value, country)}
      </div>
    </div>
  );
}

function DecisionCard({ decision, onSelect, disabled }: { decision: Decision; onSelect: (d: Decision) => void; disabled: boolean }) {
  const riskColor = { LOW: "text-green-400 bg-green-400/10", MED: "text-amber-400 bg-amber-400/10", HIGH: "text-red-400 bg-red-400/10" };
  const impactKeys = Object.entries(decision.impact).filter(([, v]) => v !== undefined && v !== 0);

  return (
    <motion.button
      whileHover={disabled ? {} : { y: -1 }}
      whileTap={disabled ? {} : { scale: 0.99 }}
      onClick={() => !disabled && onSelect(decision)}
      disabled={disabled}
      data-testid={`btn-decision-${decision.id}`}
      className={`w-full text-left p-3 rounded-xl border transition-all ${
        disabled
          ? "opacity-40 cursor-not-allowed glass"
          : "glass border-border hover:border-primary/40 cursor-pointer"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base shrink-0">{decision.emoji}</span>
          <span className="text-sm font-semibold text-foreground leading-tight">{decision.name}</span>
        </div>
        <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full shrink-0 ${riskColor[decision.risk]}`}>
          {decision.risk}
        </span>
      </div>
      <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{decision.description}</p>
      <div className="flex flex-wrap gap-1">
        {impactKeys.slice(0, 3).map(([k, v]) => {
          const isPos = (v as number) > 0;
          const labels: Record<string, string> = {
            cash: "Efectivo", savings: "Ahorros", investments: "Inv.",
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
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: "spring", damping: 26, stiffness: 320 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-md glass rounded-2xl p-6 sm:p-8"
      >
        <div className="text-center mb-5">
          <div className="text-5xl mb-3">{event.icon}</div>
          <h2 className="text-xl font-bold text-foreground">{event.title}</h2>
          <p className="text-muted-foreground mt-1.5 text-sm">{event.description}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-5">
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
              : (isPos ? "+" : "") + (Math.abs(val) >= 1000 ? "$" + formatNumber(Math.abs(val)) : Math.round(val).toString());
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
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Clock className="w-10 h-10 mb-3 opacity-30" />
        <p className="text-sm">Avanza años para ver tu línea de tiempo</p>
      </div>
    );
  }

  const years = Array.from(new Set(timeline.map(e => e.year))).sort((a, b) => a - b);

  return (
    <>
      <div className="overflow-x-auto pb-2">
        <div className="relative flex items-start gap-0 min-w-max px-2">
          <div className="absolute top-8 left-2 right-2 h-0.5 bg-border" />
          {years.map((yr, i) => {
            const eventsThisYear = timeline.filter(e => e.year === yr);
            const state = history[yr] || history[history.length - 1];
            return (
              <div key={yr} className="relative flex flex-col items-center" style={{ minWidth: 90 }}>
                <div className="flex flex-col-reverse items-center gap-1 mb-2 min-h-[52px] justify-end">
                  {eventsThisYear.map(ev => (
                    <button
                      key={ev.id}
                      onClick={() => setSelected(ev)}
                      data-testid={`timeline-event-${ev.id}`}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs hover:scale-110 transition-transform border border-white/20"
                      style={{ background: ev.type === "random" ? "#ef444433" : "#7c5aff33" }}
                      title={ev.title}
                    >
                      {ev.icon}
                    </button>
                  ))}
                </div>
                <div className={`w-3.5 h-3.5 rounded-full border-2 z-10 ${i === years.length - 1 ? "border-primary bg-primary glow-primary" : "border-border bg-background"}`} />
                <div className="mt-1.5 text-xs text-muted-foreground font-medium">Año {yr}</div>
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
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="glass rounded-2xl p-5 max-w-sm w-full"
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{selected.icon}</span>
                  <div>
                    <h3 className="font-bold text-foreground text-sm">{selected.title}</h3>
                    <p className="text-xs text-muted-foreground">Año {selected.year} · Edad {selected.age}</p>
                  </div>
                </div>
                <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground p-1">
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
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <GitCompare className="w-10 h-10 mb-3 opacity-30" />
        <p className="text-sm">Guarda escenarios usando los botones de arriba</p>
      </div>
    );
  }

  const maxLen = Math.max(state.scenarioA.length, state.scenarioB.length);
  const data = Array.from({ length: maxLen }).map((_, i) => ({
    year: `Año ${i}`,
    "Escenario A": state.scenarioA[i]?.netWorth ?? null,
    "Escenario B": state.scenarioB[i]?.netWorth ?? null,
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis dataKey="year" tick={{ fill: "hsl(215 25% 55%)", fontSize: 10 }} />
        <YAxis tick={{ fill: "hsl(215 25% 55%)", fontSize: 10 }} tickFormatter={v => "$" + formatNumber(v)} />
        <Tooltip
          contentStyle={{ background: "hsl(222 47% 9%)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
          formatter={(v: number) => ["$" + formatNumber(v)]}
        />
        <Legend />
        <Bar dataKey="Escenario A" fill={CHART_COLORS.primary} radius={[3, 3, 0, 0]} />
        <Bar dataKey="Escenario B" fill={CHART_COLORS.cyan} radius={[3, 3, 0, 0]} />
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
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

    const newFinancial = { ...simState.financial };
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

    save({ ...simState, financial: newFinancial, timeline: [...simState.timeline, event] });
    setDecisionMade(true);
  };

  const advanceOneYear = () => {
    if (!simState?.profile || advancing) return;
    setAdvancing(true);
    setSidebarOpen(false);

    setTimeout(() => {
      const prev = simState.financial;
      const { newState, triggeredEvents } = advanceYear(simState.financial, simState.profile!);
      const msg = getFeedbackMessage(newState, prev);

      save({
        ...simState,
        financial: newState,
        history: [...simState.history, { ...newState }],
        timeline: [...simState.timeline, ...triggeredEvents],
      });

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
    save({ ...simState, [slot === "A" ? "scenarioA" : "scenarioB"]: [...simState.history] });
  };

  const reset = () => { clearState(); setLocation("/"); };

  if (!simState?.profile) return null;

  const { financial, history, profile, timeline } = simState;
  const prev = history.length > 1 ? history[history.length - 2] : history[0];

  const chartData = history.map((h) => ({
    year: `A${h.year}`,
    "Patrimonio": Math.round(h.netWorth),
    "Ahorros": Math.round(h.savings),
    "Inversiones": Math.round(h.investments),
  }));

  const pieData = [
    { name: "Efectivo", value: Math.max(0, financial.cash), color: CHART_COLORS.cyan },
    { name: "Ahorros", value: Math.max(0, financial.savings), color: CHART_COLORS.primary },
    { name: "Inversiones", value: Math.max(0, financial.investments), color: CHART_COLORS.green },
  ].filter(d => d.value > 0);

  const SidebarContent = () => (
    <div className="flex flex-col gap-3 p-4">
      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-2">
        <MetricCard label="Efectivo" value={financial.cash} prev={prev.cash} icon={Wallet} color={CHART_COLORS.cyan} country={profile.country} />
        <MetricCard label="Ahorros" value={financial.savings} prev={prev.savings} icon={PiggyBank} color={CHART_COLORS.primary} country={profile.country} />
        <MetricCard label="Inversiones" value={financial.investments} prev={prev.investments} icon={LineChart} color={CHART_COLORS.green} country={profile.country} />
        <MetricCard label="Deuda" value={financial.debt} prev={prev.debt} icon={AlertTriangle} color={CHART_COLORS.red} country={profile.country} />
      </div>

      {/* Wellbeing bars */}
      <div className="glass rounded-xl p-3 space-y-2">
        {[
          { label: "Estrés", value: financial.stressLevel, bad: true, color: financial.stressLevel > 60 ? CHART_COLORS.red : CHART_COLORS.amber },
          { label: "Felicidad", value: financial.happinessLevel, bad: false, color: CHART_COLORS.green },
        ].map(bar => (
          <div key={bar.label}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">{bar.label}</span>
              <span className={bar.bad && bar.value > 60 ? "number-negative" : "number-positive"}>{Math.round(bar.value)}%</span>
            </div>
            <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
              <motion.div
                animate={{ width: `${bar.value}%` }}
                transition={{ duration: 0.5 }}
                className="h-full rounded-full"
                style={{ background: bar.color }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Feedback */}
      {feedback && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
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
        className="w-full py-3 rounded-xl bg-primary font-semibold text-white text-sm flex items-center justify-center gap-2 glow-primary disabled:opacity-60 disabled:cursor-not-allowed"
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
            Decisiones — Año {financial.year}
          </span>
        </div>
        <div className="space-y-2">
          {decisions.map(d => (
            <DecisionCard key={d.id} decision={d} onSelect={handleDecision} disabled={decisionMade} />
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-60 -left-60 w-[400px] h-[400px] rounded-full bg-primary/8 blur-3xl" />
        <div className="absolute -bottom-60 -right-60 w-[400px] h-[400px] rounded-full bg-accent/8 blur-3xl" />
      </div>

      {/* Top bar */}
      <header className="relative border-b border-border/50 px-4 sm:px-6 py-3 flex items-center justify-between backdrop-blur-sm bg-background/80 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          {/* Mobile sidebar toggle */}
          <button
            className="lg:hidden p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            onClick={() => setSidebarOpen(v => !v)}
            data-testid="btn-sidebar-toggle"
          >
            <Menu className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-primary/20 flex items-center justify-center">
              <TrendingUp className="w-3 h-3 text-primary" />
            </div>
            <span className="font-bold text-sm">LifeFinance</span>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
            <span>{profile.name}</span>
            <span>·</span>
            <span>Edad {financial.age}</span>
            <span>·</span>
            <span>Año {financial.year}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <motion.div
            key={financial.netWorth}
            initial={{ scale: 1.04 }}
            animate={{ scale: 1 }}
            className="text-right"
          >
            <div className="text-xs text-muted-foreground hidden sm:block">Patrimonio neto</div>
            <div className="text-sm sm:text-base font-bold text-primary">{formatCurrency(financial.netWorth, profile.country)}</div>
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

      {/* Mobile overlay sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="fixed top-0 left-0 h-full w-72 bg-background border-r border-border/60 z-50 overflow-y-auto lg:hidden"
            >
              <div className="flex items-center justify-between p-4 border-b border-border/40">
                <span className="font-semibold text-sm">Panel de control</span>
                <button onClick={() => setSidebarOpen(false)} className="p-1 text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main layout */}
      <div className="relative flex">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex w-72 xl:w-80 shrink-0 flex-col border-r border-border/50 overflow-y-auto sticky top-[57px] h-[calc(100vh-57px)]">
          <SidebarContent />
        </aside>

        {/* Main content — scrolls independently */}
        <main className="flex-1 min-w-0 p-4 sm:p-5">
          <Tabs defaultValue="overview">
            <TabsList className="mb-4 bg-secondary/50 flex-wrap h-auto gap-y-1 w-full sm:w-auto">
              <TabsTrigger value="overview" data-testid="tab-overview" className="text-xs sm:text-sm">
                <Activity className="w-3.5 h-3.5 mr-1" />Resumen
              </TabsTrigger>
              <TabsTrigger value="timeline" data-testid="tab-timeline" className="text-xs sm:text-sm">
                <Clock className="w-3.5 h-3.5 mr-1" />Línea de tiempo
              </TabsTrigger>
              <TabsTrigger value="compare" data-testid="tab-compare" className="text-xs sm:text-sm">
                <GitCompare className="w-3.5 h-3.5 mr-1" />Comparar
              </TabsTrigger>
              <TabsTrigger value="analysis" data-testid="tab-analysis" className="text-xs sm:text-sm">
                <BarChart2 className="w-3.5 h-3.5 mr-1" />Análisis
              </TabsTrigger>
            </TabsList>

            {/* OVERVIEW */}
            <TabsContent value="overview" className="space-y-4 mt-0">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { label: "Patrimonio neto", value: financial.netWorth, color: CHART_COLORS.primary },
                  { label: "Ingreso mensual", value: financial.monthlyIncome, color: CHART_COLORS.green },
                  { label: "Gastos mensuales", value: financial.monthlyExpenses, color: CHART_COLORS.amber },
                ].map(item => (
                  <div key={item.label} className="glass rounded-xl p-4">
                    <div className="text-xs text-muted-foreground mb-1">{item.label}</div>
                    <div className="text-xl font-bold" style={{ color: item.color }}>
                      {formatCurrency(item.value, profile.country)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="glass rounded-xl p-4">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  Evolución del patrimonio
                </h3>
                {chartData.length > 1 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="gradientNW" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradientInv" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={CHART_COLORS.green} stopOpacity={0.2} />
                          <stop offset="95%" stopColor={CHART_COLORS.green} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="year" tick={{ fill: "hsl(215 25% 55%)", fontSize: 10 }} />
                      <YAxis tick={{ fill: "hsl(215 25% 55%)", fontSize: 10 }} tickFormatter={v => "$" + formatNumber(v)} width={52} />
                      <Tooltip
                        contentStyle={{ background: "hsl(222 47% 9%)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8 }}
                        formatter={(v: number) => [formatCurrency(v, profile.country)]}
                      />
                      <Area type="monotone" dataKey="Patrimonio" stroke={CHART_COLORS.primary} fill="url(#gradientNW)" strokeWidth={2} dot={false} />
                      <Area type="monotone" dataKey="Inversiones" stroke={CHART_COLORS.green} fill="url(#gradientInv)" strokeWidth={1.5} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">
                    Avanza al menos un año para ver la evolución
                  </div>
                )}
              </div>

              <div className="glass rounded-xl p-4">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Target className="w-4 h-4 text-accent" />
                  Progreso hacia tu objetivo
                </h3>
                {(() => {
                  const targets: Record<string, { amount: number; label: string }> = {
                    house: { amount: 250000, label: "Comprar casa ($250K)" },
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

            {/* TIMELINE */}
            <TabsContent value="timeline" className="mt-0">
              <div className="glass rounded-xl p-4">
                <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-accent" />
                  Tu línea de vida financiera
                </h3>
                <TimelineView timeline={timeline} history={history} country={profile.country} />
              </div>
            </TabsContent>

            {/* COMPARE */}
            <TabsContent value="compare" className="mt-0">
              <div className="glass rounded-xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <GitCompare className="w-4 h-4 text-primary" />
                    Comparar escenarios
                  </h3>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => saveScenario("A")} data-testid="btn-save-scenario-a" className="text-xs border-border">
                      Guardar como A
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => saveScenario("B")} data-testid="btn-save-scenario-b" className="text-xs border-border">
                      Guardar como B
                    </Button>
                  </div>
                </div>
                <CompareView state={simState} />
              </div>
            </TabsContent>

            {/* ANALYSIS */}
            <TabsContent value="analysis" className="space-y-4 mt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="glass rounded-xl p-4">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-primary" />
                    Ahorros e Inversiones
                  </h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={chartData.slice(-6)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="year" tick={{ fill: "hsl(215 25% 55%)", fontSize: 10 }} />
                      <YAxis tick={{ fill: "hsl(215 25% 55%)", fontSize: 10 }} tickFormatter={v => "$" + formatNumber(v)} width={48} />
                      <Tooltip
                        contentStyle={{ background: "hsl(222 47% 9%)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8 }}
                        formatter={(v: number) => [formatCurrency(v, profile.country)]}
                      />
                      <Bar dataKey="Ahorros" fill={CHART_COLORS.primary} radius={[3, 3, 0, 0]} />
                      <Bar dataKey="Inversiones" fill={CHART_COLORS.green} radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="glass rounded-xl p-4">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-cyan-400" />
                    Composición actual
                  </h3>
                  {pieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value" paddingAngle={4}>
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

              <div className="glass rounded-xl p-4">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
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
                    <div key={item.label} className="text-center p-3 glass rounded-xl">
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
