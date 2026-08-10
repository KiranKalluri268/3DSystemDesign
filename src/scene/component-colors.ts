import type { NodeKind } from '../sim/types';

/**
 * One colour per component kind.
 *
 * Grouped by role so the board reads at a glance: entry points are blue,
 * compute is green, storage is amber, async plumbing is violet. A player
 * should be able to spot "everything downstream of here is storage" without
 * reading a single label.
 *
 * This lives in `src/scene` and not in the roster because it is a rendering
 * concern — the engine must never grow an opinion about colour.
 */
export const COMPONENT_COLORS: Record<NodeKind, string> = {
  client: '#7dd3fc',
  dns: '#38bdf8',
  cdn: '#0ea5e9',
  load_balancer: '#2563eb',

  api_server: '#34d399',
  worker: '#10b981',

  cache: '#fbbf24',
  sql_primary: '#f59e0b',
  sql_replica: '#fcd34d',
  object_store: '#d97706',

  queue: '#a78bfa',
};

export const SELECTED_COLOR = '#ffffff';
export const INVALID_COLOR = '#ef4444';

/** Ring around a node picked as the source of a connection being drawn. */
export const LINK_PICK_COLOR = '#38bdf8';
/** A committed wire, and a wire selected for removal. */
export const LINK_COLOR = '#5b6b81';
export const LINK_SELECTED_COLOR = '#ffffff';
/** The in-progress wire following the cursor before its target is chosen. */
export const LINK_PREVIEW_VALID_COLOR = '#4ade80';
