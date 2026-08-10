import type { DesktopApi } from "./index.js";

declare global {
  interface Window {
    api: DesktopApi;
  }
}