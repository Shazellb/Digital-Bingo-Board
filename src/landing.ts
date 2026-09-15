import { setupPwaUpdates } from './pwa';
import { injectBuildLabels } from './version';

injectBuildLabels();
setupPwaUpdates();
