import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app/App';
import { createBootstrapLocaleController } from './app/boot/locale-bootstrap';
import { LocaleProvider } from './locales/locale-context';
import { A11yShell } from './ui/a11y/A11yShell.js';
import { MusicDirectorProvider } from './features/audio/music-director-context.js';
import './styles/index.css';

const rootElement = document.getElementById('root');
if (rootElement === null) {
  throw new Error('RW_BOOT_ROOT_MISSING');
}

// Bootstrap locale controller: stable for the app lifetime. The real
// compiler-backed registry replaces this once the localization pipeline lands.
const localeController = createBootstrapLocaleController('dev');

createRoot(rootElement).render(
  <StrictMode>
    <A11yShell>
      <MusicDirectorProvider>
        <LocaleProvider controller={localeController}>
          <App />
        </LocaleProvider>
      </MusicDirectorProvider>
    </A11yShell>
  </StrictMode>,
);
