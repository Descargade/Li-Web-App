import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Onboarding from "@/pages/Onboarding";
import Dashboard from "@/pages/Dashboard";
import { hasExistingSimulation } from "@/lib/storage";

const queryClient = new QueryClient();

function AppRouter() {
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (location === "/" && hasExistingSimulation()) {
      setLocation("/dashboard");
    }
  }, []);

  return (
    <Switch>
      <Route path="/" component={Onboarding} />
      <Route path="/dashboard" component={Dashboard} />
      <Route>
        <div className="min-h-screen flex items-center justify-center text-foreground">
          <div className="text-center">
            <h1 className="text-2xl font-bold">Página no encontrada</h1>
          </div>
        </div>
      </Route>
    </Switch>
  );
}

function App() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AppRouter />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
