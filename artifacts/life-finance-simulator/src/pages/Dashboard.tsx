import { useState, useCallback, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp, TrendingDown, RefreshCw, Play, BarChart2,
  Clock, GitCompare, Activity, Wallet, PiggyBank, LineChart,
  AlertTriangle, Zap, Target, X, Menu,
  Check, SkipForward, Award, Trophy, Lock,
  ChevronDown, ArrowLeft, Plus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import {
  getAllScenarios, getActiveScenario, setActiveScenarioId,
  updateScenarioState, SCENARIO_COLORS, getRiskProfile
} from "@/lib/scenarios";
import {
  advanceYear, getCardsForYear, getFeedbackMessages,
  formatCurrency, applyImpact, calculateScore, scoreGrade, gradeColor
} from "@/lib/simulation";
import {
  checkAchievements, updateAchievementData,
  updateAchievementDataPostYear, ACHIEVEMENT_DEFS,
  ACHIEVEMENT_MAP, RARITY_STYLES, CATEGORY_LABELS
} from "@/lib/achievements";
import type {
  SimulationState, FinancialState, TimelineEvent,
  Decision, CardState, YearSummary, UnlockedAchievement,
  Scenario
} from "@/lib/types";

const C = {
  primary: "hsl(252 87% 67%)",
  cyan: "hsl(186 90% 55%)",
  green: "hsl(142 76% 56%)",
  amber: "hsl(38 92% 60%)",
  red: "hsl(0 72% 51%)",
};

function fmtNum(n: number): string {
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(0) + "K";
  return Math.round(n).toString();
}

function Delta({ value, currency, country }: { value: number; currency?: boolean; country?: string }) {
  const pos = value >= 0;
  const display = currency ? formatCurrency(Math.abs(value), country) : fmtNum(Math.abs(value));
  return (
    <span className={`inline-flex items-center gap-0.5 font-semibold text-xs ${pos ? "number-positive" : "number-negative"}`}>
      {pos ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {pos ? "+" : "-"}{display}
    </span>
  );
}

// ─── SCENARIO SWITCHER ────────────────────────────────────────────────────────
function ScenarioSwitcher({
  active, all, onSwitch, onNew
}: {
  active: Scenario;
  all: Scenario[];
  onSwitch: (id: string) => void;
  onNew: () => void;
}) {
  const [open, setOpen] = useState(false);
  const c = SCENARIO_COLORS[active.color];
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all ${c.bg} ${c.border} hover:opacity-80`}
      >
        <span className="text-base">{active.emoji}</span>
        <span className={`text-sm font-bold max-w-[120px] truncate ${c.text}`}>{active.name}</span>
        <ChevronDown className={`w-3.5 h-3.5 ${c.text} transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 mt-2 w-64 bg-background border border-border/60 rounded-xl shadow-2xl z-50 overflow-hidden"
          >
            <div className="p-2">
              <div className="text-xs text-muted-foreground px-2 py-1.5 font-semibold uppercase tracking-wider">
                Mis simulaciones
              </div>
              {all.map(s => {
                const sc = SCENARIO_COLORS[s.color];
                const isActive = s.id === active.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => { onSwitch(s.id); setOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${
                      isActive ? `${sc.bg} ${sc.border} border` : 'hover:bg-secondary/60'
                    }`}
                  >
                    <span className="text-xl">{s.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-semibold truncate ${isActive ? sc.text : 'text-foreground'}`}>{s.name}</div>
                      <div className="text-xs text-muted-foreground">
                        Año {s.state.financial.year} · {formatCurrency(s.state.financial.netWorth, s.state.profile?.country ?? 'USA')}
                      </div>
                    </div>
                    {isActive && <Check className={`w-3.5 h-3.5 shrink-0 ${sc.text}`} />}
                  </button>
                );
              })}
              <div className="border-t border-border/40 mt-1 pt-1">
                <button
                  onClick={() => { onNew(); setOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-all"
                >
                  <Plus className="w-4 h-4" />Nueva simulación
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── ACHIEVEMENT TOAST QUEUE ─────────────────────────────────────────────────
function AchievementToasts({ queue, onDismiss }: {
  queue: UnlockedAchievement[];
  onDismiss: (id: string) => void;
}) {
  if (!queue.length) return null;
  return (
    <div className="fixed bottom-6 right-4 z-[60] flex flex-col gap-2 pointer-events-none" style={{ maxWidth: 320 }}>
      <AnimatePresence mode="popLayout">
        {queue.slice(0, 3).map((ua, i) => {
          const d = ACHIEVEMENT_MAP[ua.id];
          if (!d) return null;
          const style = RARITY_STYLES[d.rarity];
          return (
            <motion.div
              key={ua.id}
              layout
              initial={{ opacity: 0, x: 60, scale: 0.92 }}
              animate={{ opacity: 1 - i * 0.15, x: 0, scale: 1 - i * 0.03 }}
              exit={{ opacity: 0, x: 60, scale: 0.88 }}
              transition={{ type: "spring", damping: 22, stiffness: 280 }}
              className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border shadow-xl backdrop-blur-md ${style.bg} ${style.border}`}
              style={{ zIndex: 60 - i }}
            >
              <div className="text-2xl shrink-0">{d.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className={`text-xs font-bold uppercase tracking-wider ${style.color}`}>Logro desbloqueado</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${style.color} ${style.bg} border ${style.border}`}>{style.label}</span>
                </div>
                <div className="font-bold text-foreground text-sm leading-tight">{d.title}</div>
                <div className="text-xs text-muted-foreground truncate">{d.description}</div>
              </div>
              <button onClick={() => onDismiss(ua.id)} className="text-muted-foreground hover:text-foreground p-1 shrink-0">
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

function useAchievementToasts() {
  const [queue, setQueue] = useState<UnlockedAchievement[]>([]);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const push = useCallback((achievements: UnlockedAchievement[]) => {
    if (!achievements.length) return;
    setQueue(prev => {
      const ids = new Set(prev.map(a => a.id));
      return [...prev, ...achievements.filter(a => !ids.has(a.id))];
    });
    achievements.forEach(a => {
      if (timers.current[a.id]) clearTimeout(timers.current[a.id]);
      timers.current[a.id] = setTimeout(() => {
        setQueue(prev => prev.filter(x => x.id !== a.id));
        delete timers.current[a.id];
      }, 5000);
    });
  }, []);
  const dismiss = useCallback((id: string) => {
    if (timers.current[id]) { clearTimeout(timers.current[id]); delete timers.current[id]; }
    setQueue(prev => prev.filter(a => a.id !== id));
  }, []);
  return { queue, push, dismiss };
}

// ─── TROPHY SHELF ─────────────────────────────────────────────────────────────
function TrophyShelf({ unlockedAchievements }: { unlockedAchievements: UnlockedAchievement[] }) {
  const [filter, setFilter] = useState('all');
  const unlockedIds = new Set(unlockedAchievements.map(a => a.id));
  const categories = ['all','wealth','investment','discipline','risk','balance','milestone'];
  const visible = ACHIEVEMENT_DEFS.filter(d => filter === 'all' || d.category === filter);
  const total = ACHIEVEMENT_DEFS.length;
  const count = unlockedAchievements.length;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-sm font-bold flex items-center gap-2"><Trophy className="w-4 h-4 text-amber-400" />Logros ({count}/{total})</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Desbloqueados por decisiones financieras reales</p>
        </div>
        <div className="w-32">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-muted-foreground">Progreso</span>
            <span className="text-primary font-semibold">{Math.round((count/total)*100)}%</span>
          </div>
          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
            <motion.div animate={{ width: `${(count/total)*100}%` }} transition={{ duration: 0.6 }} className="h-full rounded-full bg-gradient-to-r from-primary to-amber-400" />
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {categories.map(cat => (
          <button key={cat} onClick={() => setFilter(cat)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${filter === cat ? "bg-primary text-white" : "bg-secondary/60 text-muted-foreground hover:bg-secondary"}`}>
            {cat === 'all' ? 'Todos' : CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <AnimatePresence mode="popLayout">
          {visible.map(def => {
            const isUnlocked = unlockedIds.has(def.id);
            const ua = unlockedAchievements.find(a => a.id === def.id);
            const rs = RARITY_STYLES[def.rarity];
            return (
              <motion.div key={def.id} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${isUnlocked ? `${rs.bg} ${rs.border}` : "bg-secondary/20 border-border/30 opacity-50"}`}>
                <div className={`text-2xl shrink-0 ${!isUnlocked ? "grayscale opacity-40" : ""}`}>
                  {isUnlocked ? def.icon : <Lock className="w-5 h-5 text-muted-foreground/40" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-sm font-bold leading-tight ${isUnlocked ? "text-foreground" : "text-muted-foreground"}`}>{def.title}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold border ${rs.color} ${rs.bg} ${rs.border}`}>{rs.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{def.description}</p>
                  {isUnlocked && ua && <p className="text-xs text-primary/70 mt-0.5">Año {ua.unlockedYear} · Edad {ua.unlockedAge}</p>}
                </div>
                {isUnlocked && <Check className={`w-4 h-4 shrink-0 ${rs.color}`} />}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── METRIC CARD ──────────────────────────────────────────────────────────────
function MetricCard({ label, value, prev, icon: Icon, color, country }: {
  label: string; value: number; prev: number; icon: React.ElementType; color: string; country?: string;
}) {
  const pct = prev > 0 ? ((value - prev) / Math.abs(prev)) * 100 : 0;
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
          <span className={`text-xs font-semibold shrink-0 ${pct >= 0 ? "number-positive" : "number-negative"}`}>
            {pct >= 0 ? "+" : ""}{pct.toFixed(0)}%
          </span>
        )}
      </div>
      <div className="text-base font-bold text-foreground">{formatCurrency(value, country)}</div>
    </div>
  );
}

// ─── DECISION CARD ────────────────────────────────────────────────────────────
function DecisionCard({ card, onAccept, onSkip }: {
  card: CardState; onAccept: () => void; onSkip: () => void;
}) {
  const { decision, status } = card;
  const riskStyles: Record<string, string> = {
    LOW: "text-green-400 bg-green-400/10 border-green-400/20",
    MED: "text-amber-400 bg-amber-400/10 border-amber-400/20",
    HIGH: "text-red-400 bg-red-400/10 border-red-400/20",
  };
  const catStyles: Record<string, string> = {
    career: "text-blue-400", investment: "text-primary", lifestyle: "text-pink-400",
    education: "text-yellow-400", health: "text-green-400", family: "text-rose-400", risk: "text-red-400",
  };
  const catLabel: Record<string, string> = {
    career: "Carrera", investment: "Inversión", lifestyle: "Estilo de vida",
    education: "Educación", health: "Salud", family: "Familia", risk: "Riesgo",
  };
  const impactPills = Object.entries(decision.impact)
    .filter(([, v]) => v !== undefined && v !== 0).slice(0, 4)
    .map(([k, v]) => {
      const val = v as number;
      const isGood = (k === 'stress' || k === 'debt') ? val < 0 : val > 0;
      const labels: Record<string, string> = { cash: "Efectivo", savings: "Ahorros", investments: "Inv.", debt: "Deuda", income: "Ingreso", stress: "Estrés", happiness: "Felicidad" };
      const display = k === 'income' || (k === 'investments' && val < 0)
        ? (val > 0 ? "+" : "") + (val * 100).toFixed(0) + "%"
        : (val > 0 ? "+" : "") + (Math.abs(val) >= 1000 ? "$" + fmtNum(Math.abs(val)) : Math.round(val) + (k === 'stress' || k === 'happiness' ? "pts" : ""));
      return { key: k, label: labels[k] || k, display, isGood };
    });

  return (
    <motion.div layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className={`relative rounded-xl border transition-all ${
        status === 'accepted' ? "bg-primary/8 border-primary/40" :
        status === 'skipped' ? "opacity-45 bg-secondary/20 border-border/30" :
        "glass border-border hover:border-primary/30"
      }`}
    >
      {status !== 'pending' && (
        <div className={`absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold z-10 ${status === 'accepted' ? "bg-primary/20 text-primary" : "bg-border/40 text-muted-foreground"}`}>
          {status === 'accepted' ? <Check className="w-3 h-3" /> : <SkipForward className="w-3 h-3" />}
          {status === 'accepted' ? 'Aceptada' : 'Omitida'}
        </div>
      )}
      <div className="p-4">
        <div className="flex items-start gap-3 mb-2">
          <div className="text-2xl shrink-0 mt-0.5">{decision.emoji}</div>
          <div className="min-w-0 flex-1 pr-16">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-foreground text-sm leading-tight">{decision.name}</span>
              <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full border ${riskStyles[decision.risk]}`}>{decision.risk}</span>
            </div>
            <span className={`text-xs font-medium ${catStyles[decision.category] || "text-muted-foreground"}`}>{catLabel[decision.category] || decision.category}</span>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-2">{decision.description}</p>
        {decision.consequence && <p className="text-xs text-primary/80 italic mb-2">↳ {decision.consequence}</p>}
        <div className="flex flex-wrap gap-1 mb-3">
          {impactPills.map(p => (
            <span key={p.key} className={`text-xs px-2 py-0.5 rounded-full font-semibold ${p.isGood ? "bg-green-400/10 text-green-400" : "bg-red-400/10 text-red-400"}`}>
              {p.display} {p.label}
            </span>
          ))}
        </div>
        {status === 'pending' && (
          <div className="flex gap-2">
            <button onClick={onAccept} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-primary/90 hover:bg-primary text-white text-xs font-semibold transition-colors">
              <Check className="w-3.5 h-3.5" />Aceptar
            </button>
            {decision.type === 'opportunity' && (
              <button onClick={onSkip} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-secondary/80 hover:bg-secondary text-muted-foreground hover:text-foreground text-xs font-semibold transition-colors">
                <SkipForward className="w-3.5 h-3.5" />Ignorar
              </button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── YEAR SUMMARY MODAL ───────────────────────────────────────────────────────
function YearSummaryModal({ summary, country, onClose }: {
  summary: YearSummary; country: string; onClose: () => void;
}) {
  const nwDelta = summary.newState.netWorth - summary.prevState.netWorth;
  const incomeDelta = (summary.newState.monthlyIncome - summary.prevState.monthlyIncome) * 12;
  const gColor = gradeColor(summary.scoreGrade);
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.88, opacity: 0, y: 24 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.88, opacity: 0, y: 24 }}
        transition={{ type: "spring", damping: 24, stiffness: 280 }} onClick={e => e.stopPropagation()}
        className="w-full max-w-md glass rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-border/40 flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-widest mb-0.5">Resumen del año</div>
            <h2 className="text-xl font-bold text-foreground">Año {summary.year} completado</h2>
            <p className="text-xs text-muted-foreground">Edad {summary.age} años</p>
          </div>
          <div className="text-center">
            <div className="text-3xl font-black" style={{ color: gColor }}>{summary.scoreGrade}</div>
            <div className="text-xs text-muted-foreground">{summary.score} pts</div>
          </div>
        </div>
        <div className="p-5 space-y-4 max-h-[65vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Cambio en patrimonio", value: nwDelta, currency: true, bad: false },
              { label: "Ingreso anual", value: incomeDelta, currency: true, bad: false },
              { label: "Estrés", value: summary.newState.stressLevel - summary.prevState.stressLevel, currency: false, bad: true },
              { label: "Felicidad", value: summary.newState.happinessLevel - summary.prevState.happinessLevel, currency: false, bad: false },
            ].map(item => {
              const isPos = item.value >= 0; const isGood = item.bad ? !isPos : isPos;
              return (
                <div key={item.label} className={`rounded-xl p-3 ${isGood ? "bg-green-400/8 border border-green-400/15" : "bg-red-400/8 border border-red-400/15"}`}>
                  <div className={`text-base font-bold ${isGood ? "number-positive" : "number-negative"}`}>
                    {isPos ? "+" : ""}{item.currency ? formatCurrency(Math.abs(item.value), country) : Math.round(Math.abs(item.value)) + "pts"}
                  </div>
                  <div className="text-xs text-muted-foreground">{item.label}</div>
                </div>
              );
            })}
          </div>
          {summary.newAchievements.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                <Trophy className="w-3.5 h-3.5" />Logros desbloqueados este año
              </div>
              <div className="space-y-1.5">
                {summary.newAchievements.map(ua => {
                  const def = ACHIEVEMENT_MAP[ua.id]; if (!def) return null;
                  const rs = RARITY_STYLES[def.rarity];
                  return (
                    <div key={ua.id} className={`flex items-center gap-2 p-2.5 rounded-xl border ${rs.bg} ${rs.border}`}>
                      <span className="text-xl">{def.icon}</span>
                      <div>
                        <div className={`text-sm font-bold ${rs.color}`}>{def.title}</div>
                        <div className="text-xs text-muted-foreground">{def.description}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {summary.acceptedDecisions.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Decisiones tomadas ({summary.acceptedDecisions.length})
              </div>
              <div className="space-y-1">
                {summary.acceptedDecisions.map(d => (
                  <div key={d.id} className="flex items-center gap-2 p-2 rounded-lg bg-primary/8 border border-primary/15">
                    <span className="text-base">{d.emoji}</span>
                    <span className="text-xs font-semibold text-foreground flex-1">{d.name}</span>
                    <Check className="w-3 h-3 text-primary shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          )}
          {summary.triggeredEvents.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Eventos del año</div>
              <div className="space-y-1">
                {summary.triggeredEvents.map(ev => (
                  <div key={ev.id} className="flex items-center gap-2 p-2 rounded-lg bg-secondary/40 border border-border/40">
                    <span className="text-base">{ev.icon}</span>
                    <span className="text-xs font-medium text-foreground">{ev.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="space-y-2">
            {summary.feedbackMessages.map((msg, i) => (
              <div key={i} className="flex items-start gap-2 p-3 rounded-xl bg-primary/8 border border-primary/15">
                <Zap className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground">{msg}</p>
              </div>
            ))}
          </div>
          <div className="text-center py-1">
            <div className="text-xs text-muted-foreground mb-0.5">Patrimonio neto actual</div>
            <div className="text-2xl font-black text-primary">{formatCurrency(summary.newState.netWorth, country)}</div>
          </div>
        </div>
        <div className="p-4 border-t border-border/40">
          <Button onClick={onClose} className="w-full bg-primary glow-primary font-semibold" data-testid="btn-summary-close">
            <Play className="w-4 h-4 mr-2" />Siguiente año
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── EVENT POPUP ──────────────────────────────────────────────────────────────
function EventPopup({ event, onClose }: { event: TimelineEvent; onClose: () => void }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }}
        transition={{ type: "spring", damping: 26, stiffness: 300 }} onClick={e => e.stopPropagation()}
        className="w-full max-w-md glass rounded-2xl p-6">
        <div className="text-center mb-5">
          <div className="text-5xl mb-3">{event.icon}</div>
          <h2 className="text-xl font-bold text-foreground">{event.title}</h2>
          <p className="text-muted-foreground mt-1.5 text-sm">{event.description}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-5">
          {Object.entries(event.impact).filter(([, v]) => v !== undefined && v !== 0).map(([k, v]) => {
            const labels: Record<string, string> = { cash: "Efectivo", savings: "Ahorros", investments: "Inversiones", debt: "Deuda", income: "Ingreso", stress: "Estrés", happiness: "Felicidad" };
            const val = v as number; const isPos = val > 0;
            const actuallyGood = (k === 'debt' || k === 'stress') ? !isPos : isPos;
            const display = k === 'income' || (k === 'investments' && val < 0)
              ? (isPos ? "+" : "") + (val * 100).toFixed(0) + "%"
              : (isPos ? "+" : "-") + (Math.abs(val) >= 1000 ? "$" + fmtNum(Math.abs(val)) : Math.round(Math.abs(val)).toString());
            return (
              <div key={k} className={`p-3 rounded-xl text-center ${actuallyGood ? "bg-green-400/10" : "bg-red-400/10"}`}>
                <div className={`text-lg font-bold ${actuallyGood ? "number-positive" : "number-negative"}`}>{display}</div>
                <div className="text-xs text-muted-foreground">{labels[k] || k}</div>
              </div>
            );
          })}
        </div>
        <Button onClick={onClose} className="w-full bg-primary glow-primary" data-testid="btn-event-continue">Continuar</Button>
      </motion.div>
    </motion.div>
  );
}

// ─── TIMELINE ────────────────────────────────────────────────────────────────
function TimelineView({ timeline, history, country }: { timeline: TimelineEvent[]; history: FinancialState[]; country: string }) {
  const [selected, setSelected] = useState<TimelineEvent | null>(null);
  if (timeline.length === 0) return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <Clock className="w-10 h-10 mb-3 opacity-30" />
      <p className="text-sm">Avanza años para ver tu línea de tiempo</p>
    </div>
  );
  const years = Array.from(new Set(timeline.map(e => e.year))).sort((a, b) => a - b);
  return (
    <>
      <div className="overflow-x-auto pb-2">
        <div className="relative flex items-start gap-0 min-w-max px-2">
          <div className="absolute top-8 left-2 right-2 h-0.5 bg-border" />
          {years.map((yr, i) => {
            const evs = timeline.filter(e => e.year === yr);
            const st = history[yr] || history[history.length - 1];
            return (
              <div key={yr} className="relative flex flex-col items-center" style={{ minWidth: 90 }}>
                <div className="flex flex-col-reverse items-center gap-1 mb-2 min-h-[52px] justify-end">
                  {evs.map(ev => (
                    <button key={ev.id} onClick={() => setSelected(ev)} className="w-7 h-7 rounded-full flex items-center justify-center text-xs hover:scale-110 transition-transform border border-white/20" style={{ background: ev.type === 'random' ? '#ef444433' : '#7c5aff33' }} title={ev.title}>{ev.icon}</button>
                  ))}
                </div>
                <div className={`w-3.5 h-3.5 rounded-full border-2 z-10 ${i === years.length - 1 ? "border-primary bg-primary glow-primary" : "border-border bg-background"}`} />
                <div className="mt-1.5 text-xs text-muted-foreground font-medium">Año {yr}</div>
                {st && <div className="mt-0.5 text-xs text-primary font-semibold">{formatCurrency(st.netWorth, country)}</div>}
              </div>
            );
          })}
        </div>
      </div>
      <AnimatePresence>
        {selected && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setSelected(null)}>
            <motion.div initial={{ scale: 0.92 }} animate={{ scale: 1 }} exit={{ scale: 0.92 }} onClick={e => e.stopPropagation()} className="glass rounded-2xl p-5 max-w-sm w-full">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{selected.icon}</span>
                  <div>
                    <h3 className="font-bold text-foreground text-sm">{selected.title}</h3>
                    <p className="text-xs text-muted-foreground">Año {selected.year} · Edad {selected.age}</p>
                  </div>
                </div>
                <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground p-1"><X className="w-4 h-4" /></button>
              </div>
              <p className="text-sm text-muted-foreground">{selected.description}</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ─── CROSS-SCENARIO COMPARE ───────────────────────────────────────────────────
function CrossScenarioCompare({ currentId }: { currentId: string }) {
  const all = getAllScenarios();
  if (all.length < 2) return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3">
      <GitCompare className="w-10 h-10 opacity-30" />
      <p className="text-sm text-center">Crea al menos 2 simulaciones para comparar vidas alternativas.</p>
    </div>
  );
  const chartData = [{
    name: 'Patrimonio',
    ...Object.fromEntries(all.map(s => [s.name, Math.round(s.state.financial.netWorth)])),
  }, {
    name: 'Inversiones',
    ...Object.fromEntries(all.map(s => [s.name, Math.round(s.state.financial.investments)])),
  }, {
    name: 'Ahorros',
    ...Object.fromEntries(all.map(s => [s.name, Math.round(s.state.financial.savings)])),
  }];
  return (
    <div className="space-y-4">
      <div className="glass rounded-xl p-4">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <GitCompare className="w-4 h-4 text-primary" />Activos por escenario
        </h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="name" tick={{ fill: 'hsl(215 25% 55%)', fontSize: 11 }} />
            <YAxis tick={{ fill: 'hsl(215 25% 55%)', fontSize: 10 }} tickFormatter={v => '$' + fmtNum(v)} width={52} />
            <Tooltip contentStyle={{ background: 'hsl(222 47% 9%)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8 }} formatter={(v: number) => ['$' + fmtNum(v)]} />
            <Legend formatter={v => <span style={{ color: 'hsl(215 25% 70%)', fontSize: 11 }}>{v}</span>} />
            {all.map(s => (
              <Bar key={s.id} dataKey={s.name} fill={SCENARIO_COLORS[s.color].chart} radius={[3, 3, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="glass rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border/40">
          <h3 className="text-sm font-semibold">Estadísticas comparadas</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/30">
                <th className="text-left p-3 text-xs text-muted-foreground font-medium">Escenario</th>
                <th className="text-center p-3 text-xs text-muted-foreground font-medium">Patrimonio</th>
                <th className="text-center p-3 text-xs text-muted-foreground font-medium">Score</th>
                <th className="text-center p-3 text-xs text-muted-foreground font-medium">Logros</th>
                <th className="text-center p-3 text-xs text-muted-foreground font-medium">Riesgo</th>
              </tr>
            </thead>
            <tbody>
              {all.map(s => {
                const c = SCENARIO_COLORS[s.color];
                const sc = calculateScore(s.state.financial);
                const grade = scoreGrade(sc);
                const risk = getRiskProfile(s.state.achievementData.highRiskCount);
                const isCurrent = s.id === currentId;
                return (
                  <tr key={s.id} className={`border-b border-border/20 ${isCurrent ? `${c.bg}` : 'hover:bg-secondary/10'} transition-colors`}>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{s.emoji}</span>
                        <div>
                          <div className={`text-sm font-semibold ${isCurrent ? c.text : 'text-foreground'}`}>{s.name}</div>
                          <div className="text-xs text-muted-foreground">Año {s.state.financial.year}</div>
                        </div>
                        {isCurrent && <span className={`text-xs px-1.5 py-0.5 rounded-full ${c.bg} ${c.text} border ${c.border} font-semibold`}>Activo</span>}
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      <div className="font-bold text-sm text-foreground">{formatCurrency(s.state.financial.netWorth, s.state.profile?.country ?? 'USA')}</div>
                    </td>
                    <td className="p-3 text-center">
                      <span className="text-base font-black" style={{ color: gradeColor(grade) }}>{grade}</span>
                      <div className="text-xs text-muted-foreground">{sc} pts</div>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Trophy className="w-3.5 h-3.5 text-amber-400" />
                        <span className="text-sm font-semibold text-amber-400">{s.state.unlockedAchievements.length}</span>
                      </div>
                    </td>
                    <td className={`p-3 text-center text-sm font-semibold ${risk.color}`}>{risk.label}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── SCORE BADGE ──────────────────────────────────────────────────────────────
function ScoreBadge({ score, unlockedCount }: { score: number; unlockedCount: number }) {
  const grade = scoreGrade(score);
  const color = gradeColor(grade);
  return (
    <div className="flex items-center gap-2 glass rounded-xl px-3 py-2">
      <Award className="w-4 h-4 shrink-0" style={{ color }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-xs text-muted-foreground leading-none mb-0.5">Score financiero</div>
            <div className="flex items-baseline gap-1">
              <span className="text-base font-black" style={{ color }}>{grade}</span>
              <span className="text-xs text-muted-foreground">{score} pts</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground leading-none mb-0.5">Logros</div>
            <div className="flex items-center gap-1">
              <Trophy className="w-3 h-3 text-amber-400" />
              <span className="text-sm font-bold text-amber-400">{unlockedCount}</span>
              <span className="text-xs text-muted-foreground">/{ACHIEVEMENT_DEFS.length}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN DASHBOARD ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const [, setLocation] = useLocation();

  // Load active scenario
  const [activeScenario, setActiveScenario] = useState<Scenario | null>(() => getActiveScenario());
  const [simState, setSimState] = useState<SimulationState | null>(() => getActiveScenario()?.state ?? null);
  const [allScenarios, setAllScenarios] = useState<Scenario[]>(() => getAllScenarios());

  const [cards, setCards] = useState<CardState[]>([]);
  const [advancing, setAdvancing] = useState(false);
  const [pendingEvent, setPendingEvent] = useState<TimelineEvent | null>(null);
  const [yearSummary, setYearSummary] = useState<YearSummary | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { queue: toastQueue, push: pushToasts, dismiss: dismissToast } = useAchievementToasts();

  useEffect(() => {
    if (!activeScenario?.state.profile) { setLocation("/"); return; }
    if (cards.length === 0) refreshCards(activeScenario.state.financial);
    const initial = checkAchievements(activeScenario.state, activeScenario.state.unlockedAchievements.map(a => a.id));
    if (initial.length > 0) {
      const updatedState = { ...activeScenario.state, unlockedAchievements: [...activeScenario.state.unlockedAchievements, ...initial] };
      save(updatedState);
    }
  }, [activeScenario?.id]);

  const refreshCards = (state: FinancialState) => {
    setCards(getCardsForYear(state).map(d => ({ decision: d, status: 'pending' as const })));
  };

  const save = useCallback((state: SimulationState) => {
    if (!activeScenario) return;
    setSimState(state);
    updateScenarioState(activeScenario.id, state);
    setActiveScenario(prev => prev ? { ...prev, state } : null);
  }, [activeScenario?.id]);

  const switchScenario = (id: string) => {
    setActiveScenarioId(id);
    const newScenario = getAllScenarios().find(s => s.id === id) ?? null;
    setActiveScenario(newScenario);
    setSimState(newScenario?.state ?? null);
    setAllScenarios(getAllScenarios());
    setCards([]);
    setSidebarOpen(false);
    if (newScenario) refreshCards(newScenario.state.financial);
  };

  const acceptCard = (idx: number) => {
    if (!simState) return;
    const card = cards[idx];
    if (card.status !== 'pending') return;
    const newFinancial = applyImpact(simState.financial, card.decision.impact);
    const event: TimelineEvent = {
      id: `d-${card.decision.id}-y${simState.financial.year}`,
      year: simState.financial.year, age: simState.financial.age,
      type: 'decision', title: card.decision.name, description: card.decision.description,
      impact: card.decision.impact, icon: card.decision.emoji, color: '#7c5aff',
    };
    let updated: SimulationState = updateAchievementData(
      { ...simState, financial: newFinancial, timeline: [...simState.timeline, event] },
      card.decision.id, card.decision.risk, card.decision.category
    );
    const newlyUnlocked = checkAchievements(updated, updated.unlockedAchievements.map(a => a.id));
    if (newlyUnlocked.length > 0) {
      updated = { ...updated, unlockedAchievements: [...updated.unlockedAchievements, ...newlyUnlocked] };
      pushToasts(newlyUnlocked);
    }
    save(updated);
    setCards(prev => prev.map((c, i) => i === idx ? { ...c, status: 'accepted' as const } : c));
  };

  const skipCard = (idx: number) => {
    setCards(prev => prev.map((c, i) => i === idx ? { ...c, status: 'skipped' as const } : c));
  };

  const advanceOneYear = () => {
    if (!simState?.profile || !activeScenario || advancing) return;
    setAdvancing(true);
    setSidebarOpen(false);
    const prevState = { ...simState.financial };
    const acceptedDecisions = cards.filter(c => c.status === 'accepted').map(c => c.decision);
    setTimeout(() => {
      const { newState, triggeredEvents } = advanceYear(simState.financial, simState.profile!);
      const feedbackMessages = getFeedbackMessages(newState, prevState, acceptedDecisions.length);
      const score = calculateScore(newState);
      const grade = scoreGrade(score);
      let updated: SimulationState = updateAchievementDataPostYear(
        { ...simState, financial: newState, history: [...simState.history, { ...newState }], timeline: [...simState.timeline, ...triggeredEvents], score },
        prevState.netWorth
      );
      const newlyUnlocked = checkAchievements(updated, updated.unlockedAchievements.map(a => a.id));
      if (newlyUnlocked.length > 0) updated = { ...updated, unlockedAchievements: [...updated.unlockedAchievements, ...newlyUnlocked] };
      save(updated);
      setAdvancing(false);
      const summary: YearSummary = { year: newState.year, age: newState.age, prevState, newState, acceptedDecisions, triggeredEvents, feedbackMessages, score, scoreGrade: grade, newAchievements: newlyUnlocked };
      if (triggeredEvents.length > 0) { setPendingEvent(triggeredEvents[0]); setTimeout(() => setYearSummary(summary), 2400); }
      else setYearSummary(summary);
    }, 700);
  };

  const closeSummary = () => {
    if (!simState) return;
    const summary = yearSummary;
    setYearSummary(null);
    if (summary?.newAchievements.length) pushToasts(summary.newAchievements);
    refreshCards(simState.financial);
  };

  if (!activeScenario?.state.profile || !simState) return null;

  const { financial, history, profile, timeline } = simState;
  const prev = history.length > 1 ? history[history.length - 2] : history[0];
  const score = simState.score || calculateScore(financial);
  const unlockedCount = simState.unlockedAchievements.length;
  const scenarioColor = SCENARIO_COLORS[activeScenario.color];

  const chartData = history.map(h => ({
    year: `A${h.year}`,
    "Patrimonio": Math.round(h.netWorth),
    "Ahorros": Math.round(h.savings),
    "Inversiones": Math.round(h.investments),
  }));
  const pieData = [
    { name: "Efectivo", value: Math.max(0, financial.cash), color: C.cyan },
    { name: "Ahorros", value: Math.max(0, financial.savings), color: C.primary },
    { name: "Inversiones", value: Math.max(0, financial.investments), color: C.green },
  ].filter(d => d.value > 0);

  const pendingCount = cards.filter(c => c.status === 'pending').length;
  const acceptedCount = cards.filter(c => c.status === 'accepted').length;
  const allCardsDone = cards.length > 0 && cards.every(c => c.status !== 'pending');

  // ── SIDEBAR ──────────────────────────────────────────────────────────────
  const SidebarContent = () => (
    <div className="flex flex-col gap-3 p-4">
      <ScoreBadge score={score} unlockedCount={unlockedCount} />
      <div className="grid grid-cols-2 gap-2">
        <MetricCard label="Efectivo" value={financial.cash} prev={prev.cash} icon={Wallet} color={C.cyan} country={profile.country} />
        <MetricCard label="Ahorros" value={financial.savings} prev={prev.savings} icon={PiggyBank} color={C.primary} country={profile.country} />
        <MetricCard label="Inversiones" value={financial.investments} prev={prev.investments} icon={LineChart} color={C.green} country={profile.country} />
        <MetricCard label="Deuda" value={financial.debt} prev={prev.debt} icon={AlertTriangle} color={C.red} country={profile.country} />
      </div>
      <div className="glass rounded-xl p-3 space-y-2">
        {[
          { label: "Estrés", value: financial.stressLevel, bad: true, color: financial.stressLevel > 60 ? C.red : C.amber },
          { label: "Felicidad", value: financial.happinessLevel, bad: false, color: C.green },
        ].map(bar => (
          <div key={bar.label}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">{bar.label}</span>
              <span className={bar.bad && bar.value > 60 ? "number-negative" : "number-positive"}>{Math.round(bar.value)}%</span>
            </div>
            <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
              <motion.div animate={{ width: `${bar.value}%` }} transition={{ duration: 0.5 }} className="h-full rounded-full" style={{ background: bar.color }} />
            </div>
          </div>
        ))}
      </div>
      <motion.button
        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
        onClick={advanceOneYear}
        disabled={advancing || !!yearSummary}
        data-testid="btn-advance-year"
        className={`w-full py-3 rounded-xl font-semibold text-white text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed ${allCardsDone ? "bg-primary glow-primary" : "bg-primary/70"}`}
      >
        {advancing
          ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}><RefreshCw className="w-4 h-4" /></motion.div>
          : <><Play className="w-4 h-4" />Avanzar año {financial.year + 1}</>
        }
      </motion.button>
      {!allCardsDone && pendingCount > 0 && (
        <p className="text-center text-xs text-muted-foreground">
          {pendingCount} decisión{pendingCount > 1 ? 'es' : ''} pendiente{pendingCount > 1 ? 's' : ''}
        </p>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-60 -left-60 w-[400px] h-[400px] rounded-full bg-primary/8 blur-3xl" />
        <div className="absolute -bottom-60 -right-60 w-[400px] h-[400px] rounded-full bg-accent/8 blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative border-b border-border/50 px-4 sm:px-5 py-3 flex items-center justify-between backdrop-blur-sm bg-background/80 sticky top-0 z-30 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <button className="lg:hidden p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors shrink-0" onClick={() => setSidebarOpen(v => !v)}>
            <Menu className="w-4 h-4" />
          </button>
          {/* Back to scenarios */}
          <button onClick={() => setLocation('/')} className="hidden sm:flex items-center gap-1 px-2 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors text-xs font-medium shrink-0">
            <ArrowLeft className="w-3.5 h-3.5" />Mis vidas
          </button>
          {/* Scenario switcher */}
          <ScenarioSwitcher
            active={activeScenario}
            all={allScenarios}
            onSwitch={switchScenario}
            onNew={() => setLocation('/new')}
          />
          <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
            <span>·</span><span>{profile.name}</span>
            <span>·</span><span>Edad {financial.age}</span>
            <span>·</span><span className="text-primary font-semibold">Año {financial.year}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {unlockedCount > 0 && (
            <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-400/10 border border-amber-400/20">
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs font-bold text-amber-400">{unlockedCount}</span>
            </div>
          )}
          <motion.div key={financial.netWorth} initial={{ scale: 1.04 }} animate={{ scale: 1 }}>
            <div className="text-xs text-muted-foreground hidden sm:block">Patrimonio neto</div>
            <div className="text-sm sm:text-base font-bold text-primary">{formatCurrency(financial.netWorth, profile.country)}</div>
          </motion.div>
        </div>
      </header>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
            <motion.aside initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} transition={{ type: "spring", damping: 28, stiffness: 300 }} className="fixed top-0 left-0 h-full w-72 bg-background border-r border-border/60 z-50 overflow-y-auto lg:hidden">
              <div className="flex items-center justify-between p-4 border-b border-border/40">
                <span className="font-semibold text-sm">Panel de control</span>
                <button onClick={() => setSidebarOpen(false)} className="p-1 text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
              </div>
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Layout */}
      <div className="relative flex">
        <aside className="hidden lg:flex w-72 xl:w-80 shrink-0 flex-col border-r border-border/50 overflow-y-auto sticky top-[57px] h-[calc(100vh-57px)]">
          <SidebarContent />
        </aside>

        <main className="flex-1 min-w-0 p-4 sm:p-5">
          <Tabs defaultValue="decisions">
            <TabsList className="mb-4 bg-secondary/50 flex-wrap h-auto gap-y-1 w-full sm:w-auto">
              <TabsTrigger value="decisions" data-testid="tab-decisions" className="text-xs sm:text-sm relative">
                <Target className="w-3.5 h-3.5 mr-1" />Decisiones
                {pendingCount > 0 && (
                  <span className="ml-1.5 w-4 h-4 rounded-full bg-primary text-white text-xs flex items-center justify-center font-bold">{pendingCount}</span>
                )}
              </TabsTrigger>
              <TabsTrigger value="overview" data-testid="tab-overview" className="text-xs sm:text-sm"><Activity className="w-3.5 h-3.5 mr-1" />Resumen</TabsTrigger>
              <TabsTrigger value="timeline" data-testid="tab-timeline" className="text-xs sm:text-sm"><Clock className="w-3.5 h-3.5 mr-1" />Timeline</TabsTrigger>
              <TabsTrigger value="compare" data-testid="tab-compare" className="text-xs sm:text-sm"><GitCompare className="w-3.5 h-3.5 mr-1" />Comparar</TabsTrigger>
              <TabsTrigger value="analysis" data-testid="tab-analysis" className="text-xs sm:text-sm"><BarChart2 className="w-3.5 h-3.5 mr-1" />Análisis</TabsTrigger>
            </TabsList>

            {/* ── DECISIONS ── */}
            <TabsContent value="decisions" className="mt-0">
              <div className={`rounded-xl p-4 mb-4 flex items-center justify-between flex-wrap gap-2 border ${scenarioColor.bg} ${scenarioColor.border}`}>
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                    <span>{activeScenario.emoji}</span>{activeScenario.name}
                  </div>
                  <h2 className="text-lg font-bold text-foreground">Año {financial.year + 1} — Elige tu camino</h2>
                  <p className="text-xs text-muted-foreground">
                    {allCardsDone
                      ? `${acceptedCount} decisión${acceptedCount !== 1 ? 'es' : ''} tomada${acceptedCount !== 1 ? 's' : ''}. Listo para avanzar.`
                      : `${pendingCount} decisión${pendingCount !== 1 ? 'es' : ''} pendiente${pendingCount !== 1 ? 's' : ''}.`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-center"><div className="text-lg font-black text-primary">{acceptedCount}</div><div className="text-xs text-muted-foreground">Aceptadas</div></div>
                  <div className="text-center"><div className="text-lg font-black text-muted-foreground">{cards.filter(c => c.status === 'skipped').length}</div><div className="text-xs text-muted-foreground">Ignoradas</div></div>
                  <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={advanceOneYear} disabled={advancing || !!yearSummary}
                    className="px-4 py-2 rounded-xl bg-primary text-white font-semibold text-sm flex items-center gap-2 glow-primary disabled:opacity-50 disabled:cursor-not-allowed">
                    {advancing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}Avanzar
                  </motion.button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {cards.map((card, idx) => (
                  <DecisionCard key={card.decision.id} card={card} onAccept={() => acceptCard(idx)} onSkip={() => skipCard(idx)} />
                ))}
              </div>
            </TabsContent>

            {/* ── OVERVIEW ── */}
            <TabsContent value="overview" className="space-y-4 mt-0">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { label: "Patrimonio neto", value: financial.netWorth, prevVal: prev.netWorth, color: C.primary },
                  { label: "Ingreso mensual", value: financial.monthlyIncome, prevVal: prev.monthlyIncome, color: C.green },
                  { label: "Gastos mensuales", value: financial.monthlyExpenses, prevVal: prev.monthlyExpenses, color: C.amber },
                ].map(item => (
                  <div key={item.label} className="glass rounded-xl p-4">
                    <div className="text-xs text-muted-foreground mb-1">{item.label}</div>
                    <div className="text-xl font-bold" style={{ color: item.color }}>{formatCurrency(item.value, profile.country)}</div>
                    <Delta value={item.value - item.prevVal} currency country={profile.country} />
                  </div>
                ))}
              </div>
              <div className="glass rounded-xl p-4">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" />Evolución del patrimonio</h3>
                {chartData.length > 1 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="gnw" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={C.primary} stopOpacity={0.3} /><stop offset="95%" stopColor={C.primary} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="ginv" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={C.green} stopOpacity={0.2} /><stop offset="95%" stopColor={C.green} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="year" tick={{ fill: "hsl(215 25% 55%)", fontSize: 10 }} />
                      <YAxis tick={{ fill: "hsl(215 25% 55%)", fontSize: 10 }} tickFormatter={v => "$" + fmtNum(v)} width={52} />
                      <Tooltip contentStyle={{ background: "hsl(222 47% 9%)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8 }} formatter={(v: number) => [formatCurrency(v, profile.country)]} />
                      <Area type="monotone" dataKey="Patrimonio" stroke={C.primary} fill="url(#gnw)" strokeWidth={2} dot={false} />
                      <Area type="monotone" dataKey="Inversiones" stroke={C.green} fill="url(#ginv)" strokeWidth={1.5} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">Avanza al menos un año para ver la evolución</div>
                )}
              </div>
              <div className="glass rounded-xl p-4">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Target className="w-4 h-4 text-accent" />Progreso hacia tu objetivo</h3>
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
                        <motion.div animate={{ width: `${pct}%` }} transition={{ duration: 0.8 }} className="h-full rounded-full bg-gradient-to-r from-primary to-accent" />
                      </div>
                    </div>
                  );
                })()}
              </div>
            </TabsContent>

            {/* ── TIMELINE ── */}
            <TabsContent value="timeline" className="mt-0">
              <div className="glass rounded-xl p-4">
                <h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><Clock className="w-4 h-4 text-accent" />Línea de vida financiera</h3>
                <TimelineView timeline={timeline} history={history} country={profile.country} />
              </div>
            </TabsContent>

            {/* ── COMPARE (cross-scenario) ── */}
            <TabsContent value="compare" className="mt-0">
              <CrossScenarioCompare currentId={activeScenario.id} />
            </TabsContent>

            {/* ── ANALYSIS ── */}
            <TabsContent value="analysis" className="space-y-4 mt-0">
              <div className="glass rounded-xl p-4">
                <TrophyShelf unlockedAchievements={simState.unlockedAchievements} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="glass rounded-xl p-4">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><BarChart2 className="w-4 h-4 text-primary" />Ahorros e Inversiones</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={chartData.slice(-6)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="year" tick={{ fill: "hsl(215 25% 55%)", fontSize: 10 }} />
                      <YAxis tick={{ fill: "hsl(215 25% 55%)", fontSize: 10 }} tickFormatter={v => "$" + fmtNum(v)} width={48} />
                      <Tooltip contentStyle={{ background: "hsl(222 47% 9%)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8 }} formatter={(v: number) => [formatCurrency(v, profile.country)]} />
                      <Bar dataKey="Ahorros" fill={C.primary} radius={[3, 3, 0, 0]} />
                      <Bar dataKey="Inversiones" fill={C.green} radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="glass rounded-xl p-4">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Activity className="w-4 h-4 text-cyan-400" />Composición del patrimonio</h3>
                  {pieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value" paddingAngle={4}>
                          {pieData.map((entry, i) => <Cell key={i} fill={entry.color} stroke="transparent" />)}
                        </Pie>
                        <Tooltip contentStyle={{ background: "hsl(222 47% 9%)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8 }} formatter={(v: number) => [formatCurrency(v, profile.country)]} />
                        <Legend formatter={(value) => <span style={{ color: "hsl(215 25% 55%)", fontSize: 11 }}>{value}</span>} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">Sin activos todavía</div>
                  )}
                </div>
              </div>
              <div className="glass rounded-xl p-4">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Award className="w-4 h-4 text-accent" />Métricas globales</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "Años simulados", value: financial.year + " años", color: C.primary },
                    { label: "Ingreso acumulado", value: formatCurrency(history.reduce((s, h) => s + h.monthlyIncome * 12, 0), profile.country), color: C.green },
                    { label: "Eventos totales", value: timeline.length + " eventos", color: C.cyan },
                    { label: "Score financiero", value: score + " pts", color: gradeColor(scoreGrade(score)) },
                  ].map(item => (
                    <div key={item.label} className="text-center p-3 glass rounded-xl">
                      <div className="text-xl font-bold" style={{ color: item.color }}>{item.value}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </main>
      </div>

      {/* Overlays */}
      <AnimatePresence>
        {pendingEvent && !yearSummary && <EventPopup event={pendingEvent} onClose={() => setPendingEvent(null)} />}
      </AnimatePresence>
      <AnimatePresence>
        {yearSummary && <YearSummaryModal summary={yearSummary} country={profile.country} onClose={closeSummary} />}
      </AnimatePresence>
      <AchievementToasts queue={toastQueue} onDismiss={dismissToast} />
    </div>
  );
}
