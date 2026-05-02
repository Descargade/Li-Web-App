import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, AlertTriangle, TrendingUp, Lightbulb,
  ChevronRight, RefreshCw, ShieldAlert, Info,
  Target, Sparkles, TrendingDown, Minus
} from "lucide-react";
import { generateAdvisorReport, type AdvisorReport } from "@/lib/advisor";
import type { SimulationState } from "@/lib/types";

// ─── SEVERITY STYLES ──────────────────────────────────────────────────────────
const SEVERITY = {
  critical: { icon: ShieldAlert, bg: "bg-red-400/10", border: "border-red-400/25", text: "text-red-400", dot: "bg-red-400" },
  warning:  { icon: AlertTriangle, bg: "bg-amber-400/10", border: "border-amber-400/25", text: "text-amber-400", dot: "bg-amber-400" },
  info:     { icon: Info, bg: "bg-blue-400/10", border: "border-blue-400/25", text: "text-blue-400", dot: "bg-blue-400" },
};

const PROFILE_STYLES = {
  Conservador: { bg: "bg-green-400/10", border: "border-green-400/30", text: "text-green-400" },
  Equilibrado: { bg: "bg-primary/10",   border: "border-primary/30",   text: "text-primary" },
  Agresivo:    { bg: "bg-red-400/10",   border: "border-red-400/30",   text: "text-red-400" },
};

const TREND_STYLES = {
  improving: { icon: TrendingUp,   label: "Tendencia positiva", color: "text-green-400" },
  stable:    { icon: Minus,        label: "Tendencia estable",  color: "text-muted-foreground" },
  declining: { icon: TrendingDown, label: "Tendencia negativa", color: "text-red-400" },
};

// ─── SKELETON ─────────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-4 bg-secondary/60 rounded-full w-3/4" />
      <div className="h-4 bg-secondary/60 rounded-full w-full" />
      <div className="h-4 bg-secondary/60 rounded-full w-5/6" />
      <div className="grid grid-cols-2 gap-3 pt-2">
        <div className="h-20 bg-secondary/40 rounded-xl" />
        <div className="h-20 bg-secondary/40 rounded-xl" />
      </div>
      <div className="h-16 bg-primary/10 rounded-xl" />
      <div className="h-12 bg-cyan-400/10 rounded-xl" />
    </div>
  );
}

// ─── ADVISOR CARD ─────────────────────────────────────────────────────────────
export function AdvisorCard({
  state,
  initialReport,
  compact = false,
}: {
  state: SimulationState;
  initialReport?: AdvisorReport | null;
  compact?: boolean;
}) {
  const [report, setReport] = useState<AdvisorReport | null>(initialReport ?? null);
  const [loading, setLoading] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(!!initialReport);

  const analyze = useCallback(() => {
    setLoading(true);
    setHasGenerated(true);
    // Simulate a brief "thinking" delay for UX — the actual analysis is instant
    setTimeout(() => {
      setReport(generateAdvisorReport(state));
      setLoading(false);
    }, 900);
  }, [state]);

  const TrendIcon = report ? TREND_STYLES[report.trend].icon : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center">
            <Brain className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Asesor Financiero IA</h3>
            <p className="text-xs text-muted-foreground">Análisis basado en tu simulación real</p>
          </div>
          {report && (
            <div className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-semibold ${PROFILE_STYLES[report.riskProfile].bg} ${PROFILE_STYLES[report.riskProfile].border} ${PROFILE_STYLES[report.riskProfile].text}`}>
                {report.riskProfile}
              </div>
              {TrendIcon && (
                <div className={`flex items-center gap-1 text-xs font-medium ${TREND_STYLES[report.trend].color}`}>
                  <TrendIcon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{TREND_STYLES[report.trend].label}</span>
                </div>
              )}
            </div>
          )}
        </div>
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={analyze}
          disabled={loading}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary/15 border border-primary/30 text-primary text-xs font-semibold hover:bg-primary/25 transition-all disabled:opacity-60"
        >
          {loading
            ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" />Analizando...</>
            : <><Sparkles className="w-3.5 h-3.5" />{hasGenerated ? 'Actualizar análisis' : 'Analizar mi situación'}</>
          }
        </motion.button>
      </div>

      {/* Empty state */}
      {!hasGenerated && !loading && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-10 border border-dashed border-border/60 rounded-2xl gap-3 text-muted-foreground"
        >
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Brain className="w-7 h-7 text-primary/60" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground mb-1">Diagnóstico financiero personalizado</p>
            <p className="text-xs text-muted-foreground max-w-xs">
              El asesor analizará tu patrimonio, deudas, decisiones, logros y trayectoria para generar recomendaciones accionables.
            </p>
          </div>
          <button
            onClick={analyze}
            className="mt-1 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary glow-primary text-white text-sm font-semibold hover:bg-primary/90 transition-all"
          >
            <Sparkles className="w-4 h-4" />Analizar mi situación
            <ChevronRight className="w-4 h-4" />
          </button>
        </motion.div>
      )}

      {/* Loading skeleton */}
      <AnimatePresence>
        {loading && (
          <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="text-xs text-primary/80 font-medium mb-3 flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              Procesando {state.financial.year} años de datos financieros…
            </div>
            <Skeleton />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Report */}
      <AnimatePresence>
        {report && !loading && (
          <motion.div
            key={`report-${report.generatedYear}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="space-y-4"
          >
            {/* Metadata */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="px-2 py-0.5 rounded-full bg-secondary/60">Año {report.generatedYear}</span>
              <span>·</span>
              <span>Edad {report.generatedAge} años</span>
              <span>·</span>
              <span>Score {report.score} pts ({report.scoreGrade})</span>
            </div>

            {/* 1. Situación actual */}
            <section>
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5" />Situación actual
              </h4>
              <p className="text-sm text-foreground/90 leading-relaxed bg-secondary/30 border border-border/40 rounded-xl p-3">
                {report.situation}
              </p>
            </section>

            {/* 2. Riesgos */}
            {report.risks.length > 0 && (
              <section>
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />Riesgos detectados ({report.risks.length})
                </h4>
                <div className="space-y-2">
                  {report.risks.map((risk, i) => {
                    const s = SEVERITY[risk.severity];
                    const Icon = s.icon;
                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.06 }}
                        className={`flex gap-3 p-3 rounded-xl border ${s.bg} ${s.border}`}
                      >
                        <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${s.text}`} />
                        <div>
                          <div className={`text-xs font-bold mb-0.5 ${s.text}`}>{risk.title}</div>
                          <div className="text-xs text-foreground/80 leading-relaxed">{risk.detail}</div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* 3. Oportunidades */}
            {report.opportunities.length > 0 && (
              <section>
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5" />Oportunidades ({report.opportunities.length})
                </h4>
                <div className="space-y-2">
                  {report.opportunities.map((opp, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.06 + 0.1 }}
                      className="flex gap-3 p-3 rounded-xl border bg-green-400/8 border-green-400/20"
                    >
                      <TrendingUp className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-bold text-green-400 mb-0.5">{opp.title}</div>
                        <div className="text-xs text-foreground/80 leading-relaxed">{opp.detail}</div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </section>
            )}

            {!compact && (
              <>
                {/* 4. Recomendación principal */}
                <section>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Brain className="w-3.5 h-3.5" />Recomendación principal
                  </h4>
                  <div className="p-4 rounded-xl bg-primary/10 border border-primary/25">
                    <p className="text-sm text-foreground leading-relaxed font-medium">{report.recommendation}</p>
                  </div>
                </section>

                {/* 5. Acción sugerida */}
                <section>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                    <ChevronRight className="w-3.5 h-3.5" />Acción sugerida · Próximo año
                  </h4>
                  <div className="p-4 rounded-xl bg-cyan-400/8 border border-cyan-400/25 flex gap-3">
                    <div className="w-8 h-8 rounded-lg bg-cyan-400/15 flex items-center justify-center shrink-0">
                      <Sparkles className="w-4 h-4 text-cyan-400" />
                    </div>
                    <p className="text-sm text-foreground/90 leading-relaxed">{report.nextAction}</p>
                  </div>
                </section>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── COMPACT WIDGET (for year summary / sidebar) ──────────────────────────────
export function AdvisorInsight({ state }: { state: SimulationState }) {
  const report = generateAdvisorReport(state);
  const PROFILE_STYLES_LOCAL = {
    Conservador: "text-green-400 bg-green-400/10 border-green-400/25",
    Equilibrado: "text-primary bg-primary/10 border-primary/25",
    Agresivo:    "text-red-400 bg-red-400/10 border-red-400/25",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-3"
    >
      <div className="flex items-center gap-2">
        <Brain className="w-4 h-4 text-primary" />
        <span className="text-xs font-bold text-foreground uppercase tracking-wider">Análisis IA</span>
        <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${PROFILE_STYLES_LOCAL[report.riskProfile]}`}>
          {report.riskProfile}
        </span>
      </div>

      {/* Top risk */}
      {report.risks.length > 0 && (
        <div className={`flex gap-2 p-2.5 rounded-xl border ${SEVERITY[report.risks[0].severity].bg} ${SEVERITY[report.risks[0].severity].border}`}>
          <AlertTriangle className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${SEVERITY[report.risks[0].severity].text}`} />
          <div>
            <div className={`text-xs font-bold ${SEVERITY[report.risks[0].severity].text}`}>{report.risks[0].title}</div>
            <div className="text-xs text-foreground/70">{report.risks[0].detail}</div>
          </div>
        </div>
      )}

      {/* Top opportunity */}
      {report.opportunities.length > 0 && (
        <div className="flex gap-2 p-2.5 rounded-xl border bg-green-400/8 border-green-400/20">
          <TrendingUp className="w-3.5 h-3.5 text-green-400 shrink-0 mt-0.5" />
          <div>
            <div className="text-xs font-bold text-green-400">{report.opportunities[0].title}</div>
            <div className="text-xs text-foreground/70">{report.opportunities[0].detail}</div>
          </div>
        </div>
      )}

      {/* Next action */}
      <div className="flex gap-2 p-2.5 rounded-xl bg-primary/8 border border-primary/20">
        <Sparkles className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
        <p className="text-xs text-foreground/80 leading-relaxed">{report.nextAction}</p>
      </div>
    </motion.div>
  );
}
