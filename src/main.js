// The demo: made-up funnels from src/data.js, with time running fast.
import { FUNNELS } from './data.js';
import { mountDashboard } from './dashboard.js';

mountDashboard(FUNNELS, {
  clock: scene => `Demo · day ${Math.floor(scene.days) + 1}`,
  // Answers work as on your own dashboard; in the demo they go nowhere, the agent just carries on.
  onAnswer: async () => null,
});
