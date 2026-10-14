/// <reference types="vite/client" />

import { FocusGuardApi } from '../electron/preload';

declare global {
  interface Window {
    focusGuardApi?: FocusGuardApi;
  }
}
