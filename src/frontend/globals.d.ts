/**
 * Ambient declarations for external SDKs and browser extensions.
 * These cover the browser-script scope where all .ts files share a global namespace.
 */

// ── External SDKs loaded via <script> tags ──────────────────────────────
declare var google: any;
declare var firebase: any;
declare var lucide: any;

// ── Cross-script global state ────────────────────────────────────────────
declare var S: any;
declare var _hwTasks: any[];
declare var discordConfig: any;
declare var DISCORD_OFFLINE_SCOPES: string;

// ── Render / UI functions (defined in other script modules) ───────────────
declare function renderFeed(): void;
declare function renderCal(): void;
declare function renderClasses(): void;
declare function renderGreeting(): void;
declare function renderAccount(): void;
declare function renderSettings(): void;
declare function renderSidebar(): void;
declare function updatePip(): void;
declare function setCourseFilter(filter: string): void;
declare function hwRender(): void;
declare function hwSave(): void;
declare function updateTabBadge(tab: string, count: number): void;

// ── Utility functions shared across modules ───────────────────────────────
declare function showToast(title: any, msg: any, type?: string): void;
declare function showConfirmDialog(title: string, message: string, confirmLabel?: string): Promise<boolean>;
declare function goToday(): void;
declare function escHtml(s?: string | null): string;
declare function saveRead(): void;
declare function saveSeen(): void;
declare function saveSettings(): void;
declare function loadEverything(force?: boolean): Promise<void>;
declare function fetchAllContent(force: boolean, fullFetch?: boolean): Promise<void>;
declare function closeSheet(e?: any): void;
declare function closeNotifPanel(e?: any): void;
declare function gcalSyncAll(): void;
declare function gcalRenderStatus(): void;
declare function saved(name?: string, enabled?: boolean): void;

// ── Community module (optional, loaded async) ─────────────────────────────
declare function comRender(): void;
declare function comInit(): void;

// ── Loosen DOM element access for script-style JS patterns ───────────────
interface HTMLElement {
  [key: string]: any;
}
interface Element {
  [key: string]: any;
}
interface Node {
  [key: string]: any;
}
interface EventTarget {
  [key: string]: any;
}
interface GlobalEventHandlers {
  [key: string]: any;
}

// ── MorphIcons API ────────────────────────────────────────────────────────
interface MorphIconsAPI {
  mount(root?: ParentNode | Document): void;
  unmount(root?: ParentNode | Document): void;
  set(el: Element, name: string): void;
  mountAll(): void;
}

// ── Window extensions ─────────────────────────────────────────────────────
interface Window {
  [key: string]: any;
  MorphIcons?: MorphIconsAPI;
  AULERT_CLIENT_ID?: string;
  AULERT_ANALYTICS_ID?: string;
  __aulertAnalyticsLoaded?: boolean;
  dataLayer?: any[];
  gtag?: (...args: any[]) => void;
  google?: any;
  firebase?: any;
  S?: any;
}
