export interface UserProfile {
  name: string;
  age: number;
  monthlyIncome: number;
  country: string;
  goal: 'house' | 'retirement' | 'travel' | 'freedom';
  startDate: string;
}

export interface FinancialState {
  year: number;
  age: number;
  cash: number;
  savings: number;
  investments: number;
  debt: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  netWorth: number;
  stressLevel: number;
  happinessLevel: number;
}

export interface TimelineEvent {
  id: string;
  year: number;
  age: number;
  type: 'decision' | 'random' | 'milestone';
  title: string;
  description: string;
  impact: {
    cash?: number;
    savings?: number;
    investments?: number;
    debt?: number;
    income?: number;
    stress?: number;
    happiness?: number;
  };
  icon: string;
  color: string;
}

export interface Decision {
  id: string;
  name: string;
  description: string;
  risk: 'LOW' | 'MED' | 'HIGH';
  impact: TimelineEvent['impact'];
  emoji: string;
}

export interface SimulationState {
  profile: UserProfile | null;
  financial: FinancialState;
  history: FinancialState[];
  timeline: TimelineEvent[];
  scenarioA: FinancialState[];
  scenarioB: FinancialState[];
  isComparing: boolean;
  createdAt: string;
}
