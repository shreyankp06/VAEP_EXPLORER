import type { ActionTypeBreakdown } from '@workspace/api-client-react';

export const mockActionTypeBreakdown: ActionTypeBreakdown[] = [
  {
    actionType: "pass",
    totalVaep: 15.4,
    count: 25000,
    avgVaep: 0.0006,
  },
  {
    actionType: "shot",
    totalVaep: 45.2,
    count: 800,
    avgVaep: 0.0565,
  },
  {
    actionType: "dribble",
    totalVaep: 8.5,
    count: 1200,
    avgVaep: 0.007,
  },
  {
    actionType: "cross",
    totalVaep: 5.2,
    count: 600,
    avgVaep: 0.0086,
  },
  {
    actionType: "interception",
    totalVaep: 12.1,
    count: 1500,
    avgVaep: 0.008,
  }
];
