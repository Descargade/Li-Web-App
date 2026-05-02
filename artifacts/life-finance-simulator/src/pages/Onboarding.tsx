import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ChevronLeft, TrendingUp, Home, Plane, Sparkles, User, DollarSign, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { COUNTRIES } from "@/lib/simulation";
import { createNewState, saveState } from "@/lib/storage";
import type { UserProfile } from "@/lib/types";

const GOALS = [
  { id: "house", label: "Comprar casa", icon: Home, desc: "Tu propio espacio" },
  { id: "retirement", label: "Retiro temprano", icon: Sparkles, desc: "Libertad financiera" },
  { id: "travel", label: "Viajar el mundo", icon: Plane, desc: "Experiencias sin límite" },
  { id: "freedom", label: "Independencia total", icon: TrendingUp, desc: "Construir riqueza" },
] as const;

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 80 : -80, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -80 : 80, opacity: 0 }),
};

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [form, setForm] = useState({
    name: "",
    age: 28,
    country: "USA",
    monthlyIncome: 3500,
    goal: "freedom" as UserProfile["goal"],
  });

  const totalSteps = 3;

  const go = (next: number) => {
    setDir(next > step ? 1 : -1);
    setStep(next);
  };

  const start = () => {
    const profile: UserProfile = {
      name: form.name || "Jugador",
      age: form.age,
      country: form.country,
      monthlyIncome: form.monthlyIncome,
      goal: form.goal,
      startDate: new Date().toISOString(),
    };
    const state = createNewState(profile);
    saveState(state);
    setLocation("/dashboard");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-accent/10 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-lg">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center glow-primary">
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-semibold text-muted-foreground tracking-widest uppercase">Life Finance</span>
          </div>
          <h1 className="text-4xl font-bold text-foreground leading-tight">
            Tu vida financiera,<br />
            <span className="text-primary">simulada</span>
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">Toma decisiones, avanza en el tiempo, construye riqueza.</p>
        </motion.div>

        {/* Progress */}
        <div className="flex gap-2 mb-8 justify-center">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <motion.div
              key={i}
              animate={{ width: i === step ? 32 : 8 }}
              className={`h-1.5 rounded-full transition-colors duration-300 ${i === step ? "bg-primary" : i < step ? "bg-primary/50" : "bg-border"}`}
            />
          ))}
        </div>

        {/* Step card */}
        <div className="glass rounded-2xl p-8 relative overflow-hidden" style={{ minHeight: 340 }}>
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div
              key={step}
              custom={dir}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="absolute inset-8"
            >
              {step === 0 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold text-foreground mb-1">Cuéntanos sobre ti</h2>
                    <p className="text-muted-foreground text-sm">Tu punto de partida en esta simulación.</p>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                        <User className="inline w-3 h-3 mr-1" />
                        Tu nombre
                      </label>
                      <Input
                        data-testid="input-name"
                        placeholder="¿Cómo te llamas?"
                        value={form.name}
                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                        className="bg-secondary/50 border-border"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                        Edad: <span className="text-primary font-bold text-base">{form.age}</span> años
                      </label>
                      <Slider
                        data-testid="slider-age"
                        min={18}
                        max={65}
                        step={1}
                        value={[form.age]}
                        onValueChange={([v]) => setForm(f => ({ ...f, age: v }))}
                        className="mt-2"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>18</span><span>65</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                        <Globe className="inline w-3 h-3 mr-1" />
                        País
                      </label>
                      <div className="grid grid-cols-4 gap-2">
                        {COUNTRIES.map(c => (
                          <button
                            key={c}
                            data-testid={`btn-country-${c}`}
                            onClick={() => setForm(f => ({ ...f, country: c }))}
                            className={`px-2 py-2 rounded-lg text-xs font-medium transition-all ${
                              form.country === c
                                ? "bg-primary text-white glow-primary"
                                : "bg-secondary/60 text-muted-foreground hover:bg-secondary"
                            }`}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {step === 1 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold text-foreground mb-1">Tu situación financiera</h2>
                    <p className="text-muted-foreground text-sm">Ingreso mensual y tu gran meta.</p>
                  </div>
                  <div className="space-y-5">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                        <DollarSign className="inline w-3 h-3 mr-1" />
                        Ingreso mensual: <span className="text-primary font-bold text-lg">${form.monthlyIncome.toLocaleString()}</span>
                      </label>
                      <Slider
                        data-testid="slider-income"
                        min={500}
                        max={20000}
                        step={100}
                        value={[form.monthlyIncome]}
                        onValueChange={([v]) => setForm(f => ({ ...f, monthlyIncome: v }))}
                        className="mt-2"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>$500</span><span>$20,000</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 block">
                        Objetivo principal
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {GOALS.map(g => {
                          const Icon = g.icon;
                          return (
                            <button
                              key={g.id}
                              data-testid={`btn-goal-${g.id}`}
                              onClick={() => setForm(f => ({ ...f, goal: g.id }))}
                              className={`p-3 rounded-xl text-left transition-all glass-hover ${
                                form.goal === g.id
                                  ? "bg-primary/20 border border-primary/60 glow-primary"
                                  : "bg-secondary/30 border border-border hover:border-primary/30"
                              }`}
                            >
                              <Icon className={`w-4 h-4 mb-1 ${form.goal === g.id ? "text-primary" : "text-muted-foreground"}`} />
                              <div className="text-xs font-semibold text-foreground">{g.label}</div>
                              <div className="text-xs text-muted-foreground">{g.desc}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-2xl font-bold text-foreground mb-1">Todo listo, {form.name || "campeón"}</h2>
                    <p className="text-muted-foreground text-sm">Aquí empieza tu simulación financiera.</p>
                  </div>
                  <div className="space-y-3">
                    {[
                      { label: "Avanza años", desc: "Simula decisiones año a año" },
                      { label: "Toma decisiones", desc: "Invertir, ahorrar, cambiar trabajo" },
                      { label: "Eventos aleatorios", desc: "Crisis, herencias, oportunidades" },
                      { label: "Compara escenarios", desc: "Contrasta dos caminos diferentes" },
                    ].map((f, i) => (
                      <motion.div
                        key={f.label}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="flex items-center gap-3 p-3 rounded-xl bg-secondary/30 border border-border"
                      >
                        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                          <span className="text-primary text-xs font-bold">{i + 1}</span>
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-foreground">{f.label}</div>
                          <div className="text-xs text-muted-foreground">{f.desc}</div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                  <div className="pt-1 p-3 rounded-xl bg-primary/10 border border-primary/20">
                    <p className="text-xs text-primary">
                      Edad inicial: <strong>{form.age}</strong> · País: <strong>{form.country}</strong> · Ingreso: <strong>${form.monthlyIncome.toLocaleString()}/mes</strong>
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <div className="flex gap-3 mt-6">
          {step > 0 && (
            <Button
              variant="outline"
              onClick={() => go(step - 1)}
              className="flex-1 border-border"
              data-testid="btn-back"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Atrás
            </Button>
          )}
          {step < totalSteps - 1 ? (
            <Button
              onClick={() => go(step + 1)}
              className="flex-1 bg-primary hover:bg-primary/90 glow-primary"
              data-testid="btn-next"
            >
              Continuar
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={start}
              className="flex-1 bg-primary hover:bg-primary/90 glow-primary font-semibold"
              data-testid="btn-start"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Comenzar simulación
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
