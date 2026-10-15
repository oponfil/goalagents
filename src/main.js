// The demo: made-up funnels from src/data.js, with time running fast.
import { FUNNELS } from './data.js';
import { mountDashboard } from './dashboard.js';

mountDashboard(FUNNELS, { clock: scene => `demo · day ${Math.floor(scene.days) + 1}` });
