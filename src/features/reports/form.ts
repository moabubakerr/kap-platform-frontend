import type { RepDel, RepFmt, RepFreq, RepRange, RepSection, ReportSchedule } from '@/mocks/governance';

/** Local (interactive) state of the schedule edit form; drives the live preview. */
export interface ReportForm {
  name: string;
  sections: RepSection[];
  freq: RepFreq;
  range: RepRange;
  fmt: RepFmt;
  del: RepDel;
  day: string;
  time: string;
  recipients: string[];
  skipEmpty: boolean;
}

export const formFrom = (r: ReportSchedule): ReportForm => ({ name: r.name, ...r.form, sections: [...r.form.sections], recipients: [...r.form.recipients] });

export const DAY_OPTIONS: Record<RepFreq, string[]> = {
  daily: ['Every day'],
  weekly: ['Sunday', 'Monday', 'Thursday'],
  monthly: ['1st', '15th', 'Last day'],
};

export const UNIT: Record<RepFreq, string> = { daily: 'day', weekly: 'week', monthly: 'month' };
