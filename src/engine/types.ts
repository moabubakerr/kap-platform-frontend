/**
 * The v35 screen model. Every hub screen (data ingestion, business data, agent
 * factory, identity & access, governance, platform administration) is a
 * function that turns data into this model; `<ScreenView>` renders it.
 *
 * Mirrors the prototype's `crud` / `paHead` view-model (design-ref-v35/app.js,
 * `crudSections()` and the `iamScr` template), so builders port nearly 1:1.
 */
import type * as React from 'react';

/** Status vocabulary of the design system's StatusPill. */
export type DsStatus = 'draft' | 'submitted' | 'review' | 'approved' | 'rejected' | 'hold';

export interface Cell {
  v: string;
  /** monospace + semibold (ids, technical names) */
  m?: boolean;
  sub?: string;
  tip?: string;
  /** render a status pill instead of text */
  p?: [DsStatus, string];
}

export interface Action {
  l: string;
  f: () => void;
  v?: 'primary' | 'outline' | 'ghost' | 'danger' | 'secondary';
}

export interface KV {
  k: string;
  v: string;
  mono?: boolean;
}

export interface DetailList {
  title: string;
  items: { a: string; b?: string; c?: string; x?: () => void; xl?: string }[];
  empty?: string;
}

export interface Row {
  key: string;
  cells: Cell[];
  /** details shown in the side panel; a row with details opens a panel on click */
  kv?: KV[];
  lists?: DetailList[];
  perms?: { p: string; on: boolean }[];
  /** actions in the panel (rows with details) or inline (rows without) */
  acts?: Action[];
  /** always-inline quick actions */
  quick?: Action[];
  /** tooltip on a lock icon when the user may not act */
  lockTip?: string;
  /** keep kv values even when the same text is already visible in the row */
  keepKv?: boolean;
  /** inline-row click (navigation) when the row has no details */
  onClick?: () => void;
}

export interface TimelineSpan {
  n: string;
  sub?: string;
  /** left offset and width as CSS percentages */
  l: string;
  w: string;
  d: string;
  c: string;
  onClick?: () => void;
  selected?: boolean;
}

export interface DiagramNode {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  l1: string;
  l2?: string;
  tone?: 'base' | 'brand' | 'out' | 'off' | 'ref' | 'ok' | 'bad' | 'warn' | 'run' | 'skip';
  sel?: boolean;
  click?: () => void;
}

export interface DiagramEdge {
  a: string;
  b: string;
  l?: string;
  tone?: 'ok' | 'bad' | 'off' | 'ref' | 'brand';
  dash?: string;
  bend?: number;
  ortho?: boolean;
  wrap?: boolean;
  noArrow?: boolean;
}

export interface DiagramSpec {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  legend?: [string, NonNullable<DiagramNode['tone']>][];
  inspect?: [string, string | number | null | undefined][];
  inspectT?: string;
  minW?: number;
  minH?: number;
  minScale?: number;
}

export interface Section {
  /** large group heading above the section */
  group?: string;
  title?: string;
  badge?: string;
  badgeP?: DsStatus;
  tip?: string;
  note?: string;
  callout?: string;
  /** section actions, right of the title */
  sacts?: Action[];
  empty?: string;
  // ---- kind (exactly one; a table when none of the others is set)
  stats?: { k: string; v: string; c: string }[];
  form?: boolean;
  tl?: TimelineSpan[];
  dgm?: DiagramSpec;
  /** custom content (designer canvas, bespoke widgets) */
  custom?: React.ReactNode;
  // ---- table / form
  cols?: string[];
  rows?: Row[];
  /** 'panel' when rows have details (default when any row has them), else 'inline' */
  mode?: 'panel' | 'inline';
  /** open this row's details panel initially (e.g. deep link to one record) */
  openKey?: string;
  pager?: { l: string; size: number; setSize: (n: number) => void; pg: string; prev: () => void; next: () => void; prevOff: boolean; nextOff: boolean };
}

export interface FilterField {
  label: string;
  value: string;
  options?: string[];
  date?: boolean;
  onChange: (v: string) => void;
}

export interface Filters {
  q: string;
  qLabel?: string;
  qPlaceholder?: string;
  setQ: (q: string) => void;
  main: FilterField[];
  adv?: FilterField[];
  advLabel?: string;
  chips?: { l: string; x: () => void }[];
  clear?: () => void;
  count?: string;
}

export interface PageHead {
  title: string;
  tabs?: { value: string; label: string; badge?: string | number }[];
  tab?: string;
  setTab?: (v: string) => void;
  add?: Action;
  acts?: Action[];
  /** a status pill next to the title */
  status?: [DsStatus, string];
  sub?: string;
}

export interface ScreenModel {
  head: PageHead;
  filters?: Filters;
  sections: Section[];
  /** message shown instead of the content when the viewer may not see it */
  denied?: string;
}
