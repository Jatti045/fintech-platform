export interface IGoal {
  id: string;
  userId: string;
  name: string;
  target: number;
  progress: number;
  remaining: number;
  achieved: boolean;
  icon?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface GoalState {
  goals: IGoal[];
  loading: boolean;
  error: string | null;
  latestRequestId?: string | null;
}

export interface IGoalData {
  name: string;
  target: number;
  icon?: string | null;
}
