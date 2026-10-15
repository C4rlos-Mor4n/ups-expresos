import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.test') });

// Tracking (Hunter): token sintético y operación automática con GPS para los e2e de tracking.
// Los temporizadores no arrancan con NODE_ENV=test; los tests invocan `tick()` directamente.
process.env.HUNTER_WEBHOOK_TOKEN ??= 'e2e-hunter-token-0123456789abcdef';
process.env.OPERATIONS_AUTO_RUN ??= 'schedule_with_gps';
