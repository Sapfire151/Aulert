/**
 * Ambient declarations for the legacy frontend global scripts.
 *
 * The frontend is a set of classic <script> tags sharing the global scope
 * (no modules). This file lets `tsc` type-check them without rewriting every
 * DOM access. It intentionally trades precision for pragmatism: DOM element
 * members are widened to `any` so the migration is incremental. Tighten these
 * types over time as the frontend is modernised.
 */

// External SDKs loaded via <script> tags.
declare var google: any;
declare var firebase: any;
declare var _tokenClient: any;
declare var comRender: any;
declare var comInit: any;

// Loosen DOM element access (getElementById() returns HTMLElement, which lacks
// input/anchor-specific members like .value, .checked, .href, .dataset, .style).
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

// Custom properties attached to window throughout the app.
interface MorphIconsAPI {
  mount(root?: ParentNode | Document): void;
  unmount(root?: ParentNode | Document): void;
  set(el: Element, name: string): void;
  mountAll(): void;
}

interface Window {
  [key: string]: any;
  MorphIcons?: MorphIconsAPI;
}
