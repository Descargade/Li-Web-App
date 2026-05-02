import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import ScenariosHome from "@/pages/ScenariosHome";
import Onboarding from "@/pages/Onboarding";
import Dashboard from "@/pages/Dashboard";

const queryClient = new QueryClient();

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={ScenariosHome} />
      <Route path="/new" component={Onboarding} />
      <Route path="/play" component={Dashboard} />
      <Route>
        <div className="min-h-screen flex items-center justify-center text-foreground">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Página no encontrada</h1>
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
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
