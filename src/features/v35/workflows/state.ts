/**
 * Session UI state of the workflow screens (the prototype keeps it in `wfd`,
 * `wfVer`, `afTest`, `afLastCase`): the designer's working copy per workflow
 * (undo/redo, unsaved changes, selection, mode, zoom), the version open in the
 * designer, the latest test run and the last test case created.
 */
import { createStore } from '@/engine/store';
import type { WfCfg, WfSimResult } from './model';

export type DsgMode = 'design' | 'test' | 'replay';

export interface Wd {
  v: string;
  cfg: WfCfg;
  hist: string[];
  fut: string[];
  dirty: boolean;
  sel: string | null;
  mode: DsgMode;
  zoom: number;
  conn: string | null;
  showI: boolean;
  rp: { run: string; i: number } | null;
  tools?: boolean;
  palQ?: string;
  tq?: string;
  /** last edited field and when: typing into one field is one undo step */
  lastF?: string;
  lastT?: number;
}

export interface TestRun extends WfSimResult { running: boolean; stepI: number }

export interface WfUi {
  wd: Record<string, Wd | null>;
  ver: Record<string, string>;
  test: Record<string, TestRun>;
  lastCase: { cid: string; sid: string; key: string } | null;
}

export const uiStore = createStore<WfUi>(() => ({ wd: {}, ver: {}, test: {}, lastCase: null }));

/** Store key of a workflow in a tenant. */
export const uiKey = (t: string, wfId: string) => t + ':' + wfId;
