
class Component extends DCLogic {
  state = { pubStep: 0, pubDone: false, catSel: 0, pZoom: 1, tenant: 'sceai', look: null, repSec: { overview: 1, jobs: 1, ask: 1, feedback: 1, attention: 1, oxford: 0, access: 0, cost: 0 }, repFreq: 'weekly', repRange: 'last', repFmt: 'pdf', repDel: 'email', screen: 'home', t: 0, aTab: 'overview', tTab: 'timeline', uTab: 'groups', mode: 'live', menu: null, palette: false, mcp: 0, mapView: 'kap', pSel: null, pHl: false, pDep: false, cSel: 0 };
  componentDidMount() {
    this._p = setInterval(() => { if (window.lucide) { clearInterval(this._p); this.setState({ t: 1 }); } }, 60);
    this._k = e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); this.setState({ palette: true, menu: null }); } if (e.key === 'Escape') this.setState({ palette: false, menu: null }); };
    window.addEventListener('keydown', this._k);
  }
  componentWillUnmount() { clearInterval(this._p); clearTimeout(this._mt); window.removeEventListener('keydown', this._k); }
  aiMark(size) {
    if ((this.state.look || this.props.look || 'refined') === 'default') return this.icon(['Sparkles'], size);
    return React.createElement('span', { style: { fontFamily: 'var(--font-mono)', fontSize: Math.round(size * 0.62), fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1 } }, 'AI');
  }
  icon(names, size = 16) {
    const L = window.lucide; if (!L) return null;
    let node; for (const n of names) { node = (L.icons && L.icons[n]) || L[n]; if (node) break; }
    if (!node) return null;
    const kids = Array.isArray(node[0]) ? node : (node[0] === 'svg' ? node[2] : node);
    return React.createElement('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round', strokeLinejoin: 'round', style: { flex: 'none', display: 'block' } },
      (kids || []).map(([t, a], i) => { const { key, ...rest } = a || {}; return React.createElement(t, { ...rest, key: i }); }));
  }
  lookV() {
    const cur = 'refined';
    return { look: cur, looks: [['default', 'Default'], ['refined', 'Refined']].map(([k, l]) => ({ l, set: () => this.setState({ look: k }), bg: cur === k ? '#fff' : 'transparent', fg: cur === k ? '#6B0F2B' : 'rgba(255,255,255,.85)', fw: cur === k ? 600 : 400 })) };
  }
  overview(I, go) {
    const st = this.state, out = {};
    const link = k => e => { e.preventDefault(); go(k)(); };
    out.goCatLink = link('catalogue'); out.goAgentsLink = link('agents');
    const r = st.ovRange || '7d';
    out.ovRanges = [['today', 'Today'], ['24h', '24 h'], ['7d', '7 d'], ['30d', '30 d']].map(([k, l]) => { const on = r === k; return { l, set: () => this.setState({ ovRange: k }), hbg: on ? '#fff' : 'transparent', hfg: on ? '#4F0A20' : 'rgba(255,255,255,.85)', fw: on ? 600 : 400 }; });
    out.goFeedbackLink = link('feedback');
    out.ovHero = [['Correct numbers', '97.9%', '+0.4 pp vs last week', 'conv'], ['Median answer time', '3.1 s', 'p95 3.9 s', 'map'], ['Helpful', '92%', '86 of 93 rated', 'feedback'], ['Arabic', '38%', '+4 pp', 'convs'], ['In flight', '6', '1 waiting in kap.agent', 'map']].map(([k, v, d, g]) => ({ k, v, d, dc: 'rgba(255,255,255,.7)', go: go(g) }));
    { const cur = [62, 66, 54, 70, 77, 82, 74, 92], prev = [48, 52, 46, 55, 61, 63, 58, 66]; const X = i => (i * 800 / 7).toFixed(1), Y = v => (104 - v / 100 * 90).toFixed(1);
      out.ovLine = cur.map((v, i) => X(i) + ',' + Y(v)).join(' '); out.ovLine2 = prev.map((v, i) => X(i) + ',' + Y(v)).join(' ');
      out.ovArea = 'M0,120 L' + cur.map((v, i) => X(i) + ',' + Y(v)).join(' L') + ' L800,120 Z'; }
    out.ovFlow = [['SCEAI indicators', 'sceai_indicators_agent → compute', 61, '#8A1538', '#fff', 'rgba(255,255,255,.8)', 'map'], ['Articles', 'Article Agent', 18, '#C8B49A', '#3A2A12', 'rgba(58,42,18,.75)', 'map'], ['Chat or out of scope', 'Composer Agent', 11, '#D2CBC9', 'var(--text-strong)', 'var(--text-muted)', 'map'], ['Oxford Economics', 'sceai_indicators_oxford → leak guard', 10, '#0F766E', '#fff', 'rgba(255,255,255,.8)', 'map']].map(([l, to, p, c, tc, sc, g]) => ({ l, to, p, c, tc, sc, w: p, go: go(g) }));
    out.ovOut = [['466', 'verified answers', 'var(--success-fg)', 'var(--success-bg)', 'var(--success-border)'], ['8', 'template fallbacks', 'var(--warning-fg)', 'var(--warning-bg)', 'var(--warning-border)'], ['34', 'refused or chat', 'var(--text-body)', 'var(--surface-sunken)', 'var(--border-subtle)']].map(([v, l, c, bg, bc]) => ({ v, l, c, bg, bc }));
    const SG = n => [0, 1, 2, 3, 4].map(i => ({ c: i < n ? 'var(--brand)' : i === n ? 'var(--info)' : 'var(--border-subtle)' }));
    out.ovNow = [['AR', 'كم بلغت مساهمة قطاع السياحة في الناتج المحلي؟', 'Composing answer', '2.4 s', 3], ['EN', "What was Qatar's real GDP growth in 2023?", 'Calling Oxford Economics', '1.8 s', 2], ['EN', 'Compare inflation in Qatar and Oman since 2020', 'Indicator Picker', '0.9 s', 1], ['EN', 'Latest strategic food reserve coverage', 'Queued in kap.agent', '0.3 s', 0]].map(([lang, q, step, t, n]) => ({ lang, q, step, t, segs: SG(n) }));
    out.ovQual = [['Correct numbers', '97.9%', 97.9, 'var(--success)', '425 of 433 numeric answers passed the verifier'], ['Helpful', '92%', 92, 'var(--success)', '7 negative ratings · 4 still open'], ['Found the indicator directly', '94%', 94, '#8A1538', '6% needed the Indicator Picker'], ['Oxford calls succeeded', '84%', 84, 'var(--warning)', '8 errors (502) · retried once']].map(([k, v, w, c, d]) => ({ k, v, w, c, d }));
    out.ovSvc = [['kap.agent', '6 in flight', 'var(--success)', 'map'], ['Models', '3 healthy', 'var(--success)', 'pModels'], ['Indicators DB', 'v2026.11.3', 'var(--success)', 'catalogue'], ['Oxford MCP', 'degraded', 'var(--warning)', 'mcp'], ['Pipelines', '1 partial run', 'var(--warning)', 'pipelines']].map(([n, d, c, k]) => ({ n, d, c, go: go(k) }));
    const sp = (arr) => { const mx = Math.max(...arr), mn = Math.min(...arr); return arr.map((v, i) => (i * 120 / (arr.length - 1)).toFixed(1) + ',' + (26 - (v - mn) / ((mx - mn) || 1) * 22).toFixed(1)).join(' '); };
    out.ovKpi = [
      ['Requests', '508', '+21%', 'var(--success-fg)', [52, 61, 48, 70, 77, 82, 74, 92], '#8A1538', 'Chat 458 · jobs 50', 'convs'],
      ['Correct numbers', '97.9%', '+0.4 pp', 'var(--success-fg)', [97.1, 97.4, 97.2, 97.8, 97.6, 98.1, 97.9, 97.9], '#1E7B4F', 'Verifier pass rate', 'conv'],
      ['End-to-end p95', '3.9 s', '−0.3 s', 'var(--success-fg)', [4.4, 4.2, 4.3, 4.0, 4.1, 3.8, 3.9, 3.9], '#8A1538', 'Target under 6 s', 'map'],
      ['Helpful answers', '92%', '86 of 93 rated', 'var(--text-muted)', [88, 90, 89, 91, 90, 93, 92, 92], '#1E7B4F', '7 negative · 4 open', 'feedback'],
      ['Arabic questions', '38%', '+4 pp', 'var(--text-muted)', [31, 33, 34, 35, 34, 36, 37, 38], '#C8B49A', '193 messages', 'convs'],
      ['Template fallbacks', '8', '1.6%', 'var(--warning-fg)', [1, 0, 2, 1, 0, 2, 1, 1], '#B7791F', 'Verifier rejected the answer', 'convs']
    ].map(([k, v, d, dc, s, sc, n, g]) => ({ k, v, d, dc, sp: sp(s), sc, n, go: go(g) }));
    const T = [['SCEAI indicators', '#8A1538'], ['Articles', '#C8B49A'], ['Oxford', '#0F766E'], ['Chat / refused', '#A8A0A3']];
    out.ovTypes = T.map(([l, c]) => ({ l, c }));
    const D = [[34, 10, 5, 7], [38, 11, 6, 6], [27, 9, 4, 8], [44, 13, 7, 6], [47, 14, 8, 8], [51, 15, 9, 7], [46, 12, 6, 10], [56, 16, 8, 12]];
    const lbl = ['Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Today'];
    const mx = 100;
    out.ovDays = D.map((d, i) => { const t = d.reduce((x, y) => x + y, 0); return { l: lbl[i], t: lbl[i] + ' · ' + t + ' requests', h: Math.round(t / mx * 100), lc: i === 7 ? 'var(--text-strong)' : 'var(--text-muted)', lw: i === 7 ? 600 : 400, segs: d.map((v, j) => ({ p: (v / t * 100).toFixed(1), c: T[j][1] })) }; });
    out.ovStages = [
      ['Q', 'kap.agent queue', 508, '0.4 s', '#8C8487', '2px', 'var(--surface-sunken)', 'var(--text-muted)'],
      ['AI', 'Intent Agent', 508, '410 ms', '#8A1538', '50%', '#F6E8EC', '#8A1538'],
      ['AI', 'Indicator agents', 440, '1.4 s', '#8A1538', '50%', '#F6E8EC', '#8A1538'],
      ['C', 'Resolve and compute', 389, '135 ms', '#8C8487', '2px', 'var(--surface-sunken)', 'var(--text-muted)'],
      ['AI', 'Composer and Article agents', 481, '2.7 s', '#8A1538', '50%', '#F6E8EC', '#8A1538'],
      ['C', 'Numeric verifier', 433, '2.1% rej.', '#B7791F', '2px', 'var(--warning-bg)', 'var(--warning-fg)'],
      ['X', 'Oxford Economics MCP', 51, '2.6 s', '#0F766E', '3px', 'var(--teal-tint)', '#0F766E']
    ].map(([i, n, v, p, c, rr, ibg, ifg]) => ({ i, n, v, p, c, r: rr, ibg, ifg, w: Math.round(v / 508 * 100), lc: p.includes('rej') ? 'var(--warning-fg)' : 'var(--text-muted)' }));
    out.ovLatest = [['EN', "How did tourism's share of GDP change between Q4 2023 and Q4 2024?", 'Numeric', '#8A1538', '4.1 s', '12 min ago'], ['AR', 'ما هو معدل التضخم في قطر في يناير 2019؟', 'Numeric', '#8A1538', '3.2 s', '18 min ago'], ['EN', 'What does the National Development Strategy say about export diversification?', 'Article', '#C8B49A', '3.8 s', '25 min ago'], ['EN', "What was Qatar's real GDP growth in 2023?", 'Oxford', '#0F766E', '5.6 s', '31 min ago'], ['EN', 'Rank GCC countries by non-hydrocarbon export share in 2019', 'Template fallback', '#B7791F', '4.4 s', '1 h ago']].map(([lang, q, t, c, lat, when]) => ({ lang, q, t, c, lat, when }));
    out.ovTopInd = [['Sector Contribution to GDP (Tourism)', 96], ['Consumer Price Inflation (YoY)', 74], ['Real GDP Growth', 58], ['Non-Hydrocarbon Exports (share)', 41], ['Strategic Food Reserve Coverage', 29]].map(([n, v]) => ({ n, v, w: Math.round(v / 96 * 100) }));
    out.ovAgents = [['Intent Agent', '508', '410 ms', '0.4%', 0], ['sceai_indicators_agent', '389', '1.1 s', '0.8%', 1], ['Composer Agent', '389', '2.6 s', '2.1%', 0], ['Follow-up Agent', '470', '380 ms', '0.6%', 0], ['Article Agent', '92', '2.9 s', '1.1%', 0], ['sceai_indicators_oxford', '51', '3.4 s', '4.0%', 1], ['Indicator Picker', '31', '1.2 s', '3.2%', 0], ['Reader Agent', '44', '2.4 s', '0%', 0]].map(([n, c, p, e, m]) => ({ n, c, p, e, f: m ? 'var(--font-mono)' : 'var(--font-sans)', fc: parseFloat(e) >= 2 ? 'var(--warning-fg)' : 'var(--text-muted)' }));
    out.ovTiles = [['Collections', '1', '8,104 observations · 12 docs', 'Database', 'Open sceai_indicators', 'collections'], ['Catalogue', '214', 'v2026.11.3 · 1 draft version', 'BookOpen', 'Publish new version', 'catPublish'], ['Users', '6', '2 groups · 3 API tokens', 'User', 'Manage access', 'users'], ['Scheduled reports', '4', 'Next: Sunday 07:00', ['CalendarClock', 'Calendar'], 'View reports', 'reports']].map(([l, v, d, icn, aa, k]) => ({ l, v, d, a: aa, icon: I(icn, 15), go: link(k) }));
    const lk = k => e => { e.preventDefault(); go(k)(); };
    out.ovBrief = [['questions answered', '508', '+21% on last week', 'var(--success-fg)', 'convs'], ['numbers verified', '97.9%', '8 template fallbacks', 'var(--text-muted)', 'convs'], ['median answer time', '3.1 s', 'p95 3.9 s', 'var(--text-muted)', 'map'], ['rated helpful', '92%', '7 negative · 4 open', 'var(--text-muted)', 'feedback'], ['asked in Arabic', '38%', '+4 pp', 'var(--success-fg)', 'convs']].map(([k, v, d, dc, g]) => ({ k, v, d, dc, go: go(g) }));
    { const C = 2 * Math.PI * 36; const ok = C * 425 / 433, tp = C * 8 / 433;
      out.ovRing = { ok: ok.toFixed(1) + ' ' + C.toFixed(1), tp: tp.toFixed(1) + ' ' + C.toFixed(1), tpo: (-ok).toFixed(1) };
      out.ovLang = (C * 0.38).toFixed(1) + ' ' + C.toFixed(1);
      const p50 = [3.4, 3.3, 3.5, 3.2, 3.1, 3.0, 3.1], p95 = [4.4, 4.2, 4.5, 4.0, 4.1, 3.8, 3.9];
      const X = i => (i * 200 / 6).toFixed(1), Y = v => (64 - v / 6.6 * 58).toFixed(1);
      out.ovTime = { p50: p50.map((v, i) => X(i) + ',' + Y(v)).join(' '), p95: p95.map((v, i) => X(i) + ',' + Y(v)).join(' '), band: 'M' + p95.map((v, i) => X(i) + ',' + Y(v)).join(' L') + ' L' + p50.map((v, i) => [X(i), Y(v)]).reverse().map(p => p.join(',')).join(' L') + ' Z' };
      out.ovFb = [['Helpful', 86, 'var(--success)'], ['Not helpful', 7, 'var(--danger)'], ['Not rated', 415, '#D2CBC9']].map(([l, v, c]) => ({ l, v, c, w: Math.max(2, Math.round(v / 415 * 100)) }));
      out.goFeedback = go('feedback');
      out.ovGauge = (157.1 * 86 / 93).toFixed(1) + ' 157.1';
      out.ovFbWhy = [['Not answered (template)', 2], ['Wrong indicator', 2], ['Wrong period', 1], ['Wrong source', 1], ['Too long', 1]].map(([l, n]) => ({ l, n, dots: Array.from({ length: n }, (_, i) => ({ i })) }));
      const up = [10, 12, 8, 13, 14, 15, 14], dn = [1, 0, 2, 1, 0, 2, 1], L = ['Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Today'];
      out.ovFbD = up.map((u, i) => ({ l: L[i].slice(0, 2) === 'To' ? 'Tod' : L[i].slice(0, 2), up: Math.round(u / 15 * 100), dn: Math.round(dn[i] / 2 * 100), t: L[i] + ' · ' + u + ' helpful · ' + dn[i] + ' not helpful' })); }
    { const cur = [64, 67, 50, 75, 82, 88, 82], prev = [52, 58, 47, 61, 66, 70, 66]; const mx = 100;
      const X = i => 24 + i * 512 / 6, Y = v => 128 - v / mx * 110; const L = ['Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Today'];
      out.ovQ = { cur: cur.map((v, i) => X(i).toFixed(1) + ',' + Y(v).toFixed(1)).join(' '), prev: prev.map((v, i) => X(i).toFixed(1) + ',' + Y(v).toFixed(1)).join(' '),
        area: 'M24,140 L' + cur.map((v, i) => X(i).toFixed(1) + ',' + Y(v).toFixed(1)).join(' L') + ' L536,140 Z',
        grid: [25, 50, 75].map(v => ({ y: Y(v).toFixed(1) })),
        pts: cur.map((v, i) => ({ v, l: L[i], lc: i === 6 ? 'var(--text-strong)' : 'var(--text-muted)', lw: i === 6 ? 600 : 400, x: (X(i) / 560 * 100).toFixed(2), y: (Y(v) - 6).toFixed(1) })) }; }
    out.ovActions = [['Ask a test question', ['MessageSquarePlus', 'MessageSquare'], 'convs'], ['Publish catalogue version', 'Upload', 'catPublish'], ['Run ingestion', 'Play', 'pipelines'], ['Create agent', 'Bot', 'wizard'], ['Invite user', ['UserPlus', 'User'], 'users'], ['Schedule report', ['CalendarClock', 'Calendar'], 'reports']].map(([l, icn, g]) => ({ l, icon: I(icn, 15), go: go(g) }));
    const LT = ['#F6E8EC', '#8A1538'], SD = ['var(--sand-tint)', 'var(--sand-ink)'], TL = ['var(--teal-tint)', '#0F766E'], NT = ['var(--surface-sunken)', 'var(--text-muted)'];
    out.ovRes = [['Agents', '8', '6 Ask AI · 2 indicator agents', 'Bot', LT, 'var(--success)', 'agents'], ['Conversations', '508', 'This week · 38% Arabic', ['MessagesSquare', 'MessageSquare'], LT, 'var(--success)', 'convs'], ['Catalogue', '214', 'v2026.11.3 · 1 draft version', 'BookOpen', SD, 'var(--success)', 'catalogue'], ['Collections', '1', '8,104 observations · 12 docs', 'Database', SD, 'var(--success)', 'collections'], ['Pipelines', '2', '1 partial run this week', 'Workflow', NT, 'var(--warning)', 'pipelines'], ['MCP servers', '1', 'Oxford Economics · degraded', 'Plug', TL, 'var(--warning)', 'mcp'], ['Users', '6', '2 groups · 3 API tokens', 'Users', NT, 'var(--success)', 'users'], ['Scheduled reports', '4', 'Next: Sunday 07:00', ['CalendarClock', 'Calendar'], NT, 'var(--success)', 'reports']].map(([n, v, d, icn, c, hc, g]) => ({ n, v, d, hc, icon: I(icn, 16), ibg: c[0], ifg: c[1], go: go(g) }));
    out.ovAtt = [['critical', 'var(--danger)', 'var(--danger-bg)', ['CircleX', 'XCircle'], 'Two jobs hit the 180 s timeout', 'Both were waiting on Oxford Economics. The answers fell back to local data only.', ['2 jobs', 'sceai_indicators_oxford'], '2 h ago', 'Open trace', 'trace'], ['warning', 'var(--warning)', 'var(--warning-bg)', ['TriangleAlert', 'AlertTriangle'], 'Oxford Economics is slow and failing more often', '8 of 51 calls returned 502 this week. Oxford questions take 2.6 s longer than others.', ['51 questions affected', 'MCP'], '18 min ago', 'Check connection', 'mcp'], ['warning', 'var(--warning)', 'var(--warning-bg)', ['Languages', 'Globe'], 'Six indicators have weak Arabic coverage', 'Arabic questions about them need the Indicator Picker three times more often.', ['6 indicators', 'Catalogue'], '1 d ago', 'Open catalogue', 'catalogue']].map(([sev, c, bg, icn, t, d, tags, when, l, g]) => ({ sev, c, bg, icon: I(icn, 17), t, d, tags, when, l, go: go(g) }));
    const spk = arr => { const mx = Math.max(...arr), mn = Math.min(...arr); return arr.map((v, i) => (i * 100 / (arr.length - 1)).toFixed(1) + ',' + (22 - (v - mn) / ((mx - mn) || 1) * 20).toFixed(1)).join(' '); };
    out.ovHealth = [['Ask AI pipeline', '97.9%', 'verified', 'Healthy', 'var(--success)', 'var(--success-fg)', 'p95 3.9 s', 'Workflow', 'map', [97.2, 97.6, 97.4, 98.0, 97.8, 98.1, 97.9]], ['kap.agent queue', '6/8', 'in flight', 'Busy', 'var(--warning)', 'var(--warning-fg)', '1 waiting', 'Layers', 'map', [3, 4, 6, 5, 7, 8, 6]], ['Oxford MCP', '16%', 'errors', 'Degraded', 'var(--warning)', 'var(--warning-fg)', 'p95 2.6 s', 'Plug', 'mcp', [4, 6, 5, 12, 9, 18, 16]], ['Model serving', '62%', 'capacity', 'Healthy', 'var(--success)', 'var(--success-fg)', '3 models', 'Cpu', 'providers', [48, 55, 60, 72, 81, 66, 62]], ['Pipelines', '6 h', 'since last run', 'Healthy', 'var(--success)', 'var(--success-fg)', '8,104 rows', 'Database', 'pipelines', [1, 1, 1, 1, 0.8, 1, 1]]].map(([n, m, ml, s, c, tc, d, icn, g, sp]) => ({ n, m, ml, s, c, tc, d, icon: I(icn, 14), go: go(g), sp: spk(sp) }));
    out.ovRecent = [['Trace 93c7a1f2', '2 min ago', ['Waypoints', 'GitBranch'], 'trace', 'Trace', 1], ['sceai_indicators_oxford', '20 min ago', 'Bot', 'agent', 'Agent', 1], ['Publish v2026.11.4', '1 h ago', 'BookOpen', 'catPublish', 'Catalogue', 0], ['Message 7f21a9', '3 h ago', 'MessageSquare', 'conv', 'Conversation', 0], ['indicators_csv_ingest', 'Yesterday', 'Workflow', 'pipelines', 'Pipeline', 1]].map(([n, w, icn, g, k, m]) => ({ n, w, k, icon: I(icn, 14), go: go(g), f: m ? 'var(--font-mono)' : 'var(--font-sans)', ibg: '#F6E8EC', ifg: '#8A1538' }));
    return out;
  }
  reports(I) {
    const st = this.state, out = {};
    const seg = (key, opts) => opts.map(([k, l]) => { const on = st[key] === k; return { l, set: () => this.setState({ [key]: k }), bg: on ? 'var(--brand-tint)' : 'var(--surface-card)', fg: on ? 'var(--brand-strong)' : 'var(--text-body)', fw: on ? 600 : 400 }; });
    out.repFreq = seg('repFreq', [['daily', 'Daily'], ['weekly', 'Weekly'], ['monthly', 'Monthly']]);
    out.repRange = seg('repRange', [['last', 'Previous week'], ['mtd', 'Month to date'], ['30', 'Last 30 days']]);
    out.repFmt = seg('repFmt', [['pdf', 'PDF'], ['xlsx', 'Excel'], ['both', 'Both']]);
    out.repDel = seg('repDel', [['email', 'Email'], ['teams', 'Teams'], ['both', 'Email + Teams']]);
    out.selS = { flex: '1 1 130px', minWidth: 130 };
    const ck = I('Check', 11);
    out.repSecs = [['overview', 'Overview KPIs', 'Jobs, success rate, p95, active agents'], ['jobs', 'Agent jobs', 'Daily volume by status and agent'], ['ask', 'Ask AI usage', 'Messages, answer types, languages'], ['feedback', 'User feedback', 'Helpful vs not helpful, open items'], ['attention', 'Needs attention', 'Failures, timeouts, MCP issues'], ['oxford', 'Oxford Economics usage', 'External calls and leak-guard results'], ['access', 'Access changes', 'New users, grants and tokens'], ['cost', 'Model usage', 'Requests and tokens per model']].map(([k, n, d]) => { const on = !!st.repSec[k]; return { n, d, toggle: () => this.setState(s => ({ repSec: { ...s.repSec, [k]: s.repSec[k] ? 0 : 1 } })), bc: on ? 'var(--brand-tint)' : 'var(--border-default)', bg: on ? '#FCF7F8' : 'var(--surface-card)', cb: on ? 'var(--brand)' : 'transparent', cbb: on ? 'var(--brand)' : 'var(--border-strong)', check: on ? ck : null }; });
    out.repRcp = ['sceai_admin', 'tenant_admins (group)', 'm.alkuwari', 'director.office@sceai.gov.qa'].map(n => ({ n }));
    out.reps = [
      ['Weekly SCEAI summary', 'sceai_admin', 'Overview, Agent jobs, Ask AI usage, Feedback, Needs attention', 'Weekly · Sunday 07:00', '4 recipients', 'PDF', 'Sun 23 Nov, 07:00', 'approved', 'Delivered', 1],
      ['Monthly leadership brief', 'sceai_admin', 'Overview, Ask AI usage, Feedback', 'Monthly · 1st, 08:00', '9 recipients', 'PDF', 'Mon 1 Dec, 08:00', 'approved', 'Delivered', 0],
      ['Daily operations digest', 'm.alkuwari', 'Needs attention, Agent jobs, Oxford usage', 'Daily · 07:00', 'ai_team', 'PDF', 'Tomorrow, 07:00', 'rejected', 'Failed', 0],
      ['Access changes · audit', 'sceai_admin', 'Access changes', 'Monthly · last day, 17:00', '2 recipients', 'XLSX', 'Sun 30 Nov, 17:00', 'draft', 'Paused', 0]
    ].map(([n, owner, sec, freq, rcp, fmt, next, p, pl, on]) => ({ n, owner, sec, freq, rcp, fmt, next, p, pl, bg: on ? 'var(--brand-tint)' : 'transparent' }));
    out.repKpi = [['Agent jobs', '50', '+12% vs prior week', '#17633F'], ['Success rate', '84.8%', '−3.1 pp', '#A12B23'], ['Ask AI messages', '508', '+21%', '#17633F'], ['Arabic share', '38%', '+4 pp', '#5C5457']].map(([k, v, d, c]) => ({ k, v, d, c }));
    out.repTopQ = [['Tourism share of GDP', 41], ['Consumer price inflation', 33], ['Food reserve coverage', 22], ['Non-hydrocarbon exports', 19], ['Real GDP growth (Oxford)', 15]].map(([q, n]) => ({ q, n }));
    out.repAtt = [['2 jobs exceeded the 180 s timeout', '#C0352B'], ['Oxford MCP degraded · 2 × 502', '#B7791F'], ['8 template fallbacks from the verifier', '#B7791F'], ['1 document failed ingestion', '#B7791F']].map(([t, c]) => ({ t, c }));
    out.repHist = [
      ['Sun 16 Nov, 07:00', 'Weekly SCEAI summary', '9 – 15 Nov', '4', 'Email', 'approved', 'Delivered', '', 'View PDF'],
      ['Wed 19 Nov, 07:00', 'Daily operations digest', '18 Nov', '3', 'Email', 'rejected', 'Failed', 'SMTP relay timed out · retried twice', 'Retry'],
      ['Tue 18 Nov, 07:00', 'Daily operations digest', '17 Nov', '3', 'Email', 'approved', 'Delivered', '', 'View PDF'],
      ['Sat 1 Nov, 08:00', 'Monthly leadership brief', 'October 2026', '9', 'Email + Teams', 'approved', 'Delivered', '', 'View PDF'],
      ['Sun 9 Nov, 07:00', 'Weekly SCEAI summary', '2 – 8 Nov', '4', 'Email', 'hold', 'Partly delivered', '1 recipient bounced', 'Details']
    ].map(([t, n, per, r, d, p, pl, err, act]) => ({ t, n, per, r, d, p, pl, err, act }));
    return out;
  }
  pipe(I, go) {
    const st = this.state, out = {};
    const link = k => e => { e.preventDefault(); go(k)(); };
    out.goConv = go('conv'); out.goConvLink = link('conv'); out.goConvsLink = link('convs');
    out.goPipe = () => { this.setState({ mapView: 'pipe' }); go('map')(); };
    out.tHl = () => this.setState(s => ({ pHl: !s.pHl })); out.tDep = () => this.setState(s => ({ pDep: !s.pDep }));
    out.pDep = st.pDep; out.pOpen = !!st.pSel; out.closeDrawer = () => this.setState({ pSel: null });
    out.mv = { kap: false, pipe: true };
    const show = st.pShow || 'all';
    out.showOpts = [['all', 'All agents · 8'], ['chat', 'Ask AI · 6'], ['jobs', 'Indicator agents · 2']].map(([k, l]) => { const on = show === k; return { l, set: () => this.setState({ pShow: k }), bg: on ? 'var(--brand-tint)' : 'transparent', fg: on ? 'var(--brand-strong)' : 'var(--text-body)', fw: on ? 600 : 400 }; });
    out.bandA = { op: show === 'jobs' ? 0.3 : 1 }; out.bandB = { op: show === 'chat' ? 0.3 : 1 };
    out.bLanes = [[460, 'Agents'], [690, 'Tools'], [920, 'Data'], [1150, 'External']].map(([x, t]) => ({ x, t }));
    out.mapViews = [['kap', 'KAP agents', 'Bot'], ['pipe', 'SCEAI Assistant pipeline', ['MessagesSquare', 'MessageSquare']]].map(([k, l, icn]) => { const on = st.mapView === k; return { l, icon: I(icn, 15), set: () => this.setState({ mapView: k }), fg: on ? 'var(--brand-strong)' : 'var(--text-muted)', fw: on ? 600 : 500, bc: on ? 'var(--brand)' : 'transparent' }; });
    out.pt = { hlL: st.pHl ? 'Highlighting message 7f21a9' : 'Highlight path: none', hlB: st.pHl ? 'var(--brand)' : 'var(--border-default)', hlBg: st.pHl ? 'var(--brand-tint)' : 'var(--surface-card)', hlFg: st.pHl ? 'var(--brand-strong)' : 'var(--text-body)', depBg: st.pDep ? 'var(--brand)' : 'var(--border-strong)', depX: st.pDep ? 14 : 2 };
    out.pc = { h: st.pDep ? 1030 : 850, vh: 680, kapY: st.pDep ? 1012 : 828 };
    const zs = [0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.25];
    const zi = Math.max(0, zs.indexOf(st.pZoom));
    out.pz = st.pZoom; out.zPct = Math.round(st.pZoom * 100) + '%';
    out.zIn = () => this.setState({ pZoom: zs[Math.min(zs.length - 1, zi + 1)] });
    out.zOut = () => this.setState({ pZoom: zs[Math.max(0, zi - 1)] });
    out.zFit = () => this.setState({ pZoom: 0.6 });
    out.goConvs = go('convs');
    out.mpRange = st.mode === 'live' ? 'Live' : ({ '1h': 'Last 1 h', '24h': 'Last 24 h', '7d': 'Last 7 d' })[st.mode];
    out.mapKpi = [['Requests · 7 d', '508', '74 today', 'var(--text-strong)'], ['In flight', '6', 'kap.agent · 1 waiting', 'var(--text-strong)'], ['End-to-end p95', '3.9 s', 'Target 6 s', 'var(--text-strong)'], ['Verifier pass', '97.9%', '8 template answers', 'var(--text-strong)'], ['Oxford MCP', 'Degraded', 'p95 2.6 s · 16% errors', 'var(--warning-fg)']].map(([k, v, d, c]) => ({ k, v, d, c }));
    out.routes = [['SCEAI indicators', 61, '#8A1538', 'sceai_indicators_agent', '310', 'pa_local'], ['Articles', 18, '#C8B49A', 'Article Agent', '92', 'article'], ['Oxford Economics', 10, '#0F766E', 'sceai_indicators_oxford', '51', 'pa_ox'], ['Chat / out of scope', 11, '#A8A0A3', 'Composer Agent', '55', 'composer']].map(([l, p, c, to, n, id]) => ({ l, p, c, to, n, pick: () => this.setState({ pSel: id }) }));
    out.aiSm = this.aiMark(12);
    out.laneBg = [[0, 226, 'transparent'], [226, 222, 'rgba(240,236,234,.35)'], [448, 222, 'transparent'], [670, 230, 'rgba(240,236,234,.35)'], [900, 230, 'transparent'], [1130, 470, 'rgba(240,236,234,.35)'], [1600, 240, 'transparent']].map(([x, w, bg]) => ({ x, w, bg }));
    out.laneHead = [[20, '01', 'Channels', ''], [240, '02', 'Queue', ''], [460, '03', 'Understand & route', ''], [680, '04', 'Resolve', ''], [910, '05', 'Compute', ''], [1140, '06', 'Compose & verify', ''], [1620, '07', 'Models', 'shared']].map(([x, n, t, m]) => ({ x, n, t, m }));
    out.ticker = [['msg 7f21c0 · AR · composing', 'var(--info)'], ['msg 7f21ad · EN · Oxford EconomicData', '#0F766E'], ['msg 7f21b8 · EN · Indicator Picker', 'var(--warning)']].map(([t, c]) => ({ t, c }));
    const live = st.mode === 'live';
    out.pLanes = [[20, 'Channels'], [240, 'Queue'], [460, 'Understand'], [680, 'Resolve'], [910, 'Compute'], [1140, 'Compose & verify'], [1620, 'Models']].map(([x, t]) => ({ x, t }));
    const AIc = this.aiMark(14), GEAR = I(['Cog', 'Settings'], 14), DB = I('Database', 14), CHIP = I('Cpu', 14), MSG = I(['MessageSquare'], 14), API = I(['Terminal', 'Code'], 14), TPL = I('FileText', 14);
    const PN = [
      ['web', 'ch', 20, 110, 'Ask AI web chat', 'Channel · English and Arabic', '', '412 msgs · 7 d', '2 in flight'],
      ['api', 'ch', 20, 220, '/ask API', 'Channel · token auth', '', '96 msgs · 7 d', '1 in flight'],
      ['intent', 'ai', 240, 140, 'Intent Agent', 'Question → indicator, countries, periods, computation type', 'Qwen2.5-7B', '508 calls · p95 410 ms · 0.4% failed', 'Active · 1 message'],
      ['resolver', 'code', 460, 96, 'Indicator, country and period resolvers', 'Embedding match · bge-m3', '', '508 runs · p95 90 ms', 'Active'],
      ['picker', 'ai', 460, 250, 'Indicator Picker', 'Fallback · picks a catalogue name or NONE', 'Qwen2.5-72B', '31 calls · p95 1.2 s · 3.2% NONE', 'Active · 1 message'],
      ['engine', 'code', 690, 96, 'Compute engine', 'Deterministic · 11 computation types', '', '389 runs · p95 45 ms · 0 errors', 'Active'],
      ['pgdb', 'store', 690, 200, 'Indicators DB', 'Postgres · catalogue v2026.11.3', '', '1,204 reads · 7 d', 'Reading'],
      ['retrieval', 'code', 690, 320, 'Article retrieval', 'Top-k passages · bge-m3', '', '92 runs · p95 140 ms', 'Active'],
      ['vecdb', 'store', 690, 424, 'SCEAI articles', 'Vector store · 2,184 passages', '', '92 queries · 7 d', 'Idle'],
      ['composer', 'ai', 920, 96, 'Composer Agent', 'Only agent that writes the numeric answer · streaming', 'Qwen2.5-72B', '389 calls · p95 2.6 s · 2.1% rejected', 'Streaming · AR'],
      ['article', 'ai', 920, 320, 'Article Agent', 'Answers only from retrieved passages, names sources', 'Qwen2.5-72B', '92 calls · p95 2.9 s · 1.1% failed', 'Active · 1 message'],
      ['verifier', 'code', 1150, 104, 'Numeric verifier', 'Checks every number against computed facts', '', '433 checks · 2.1% rejected', 'Checking'],
      ['template', 'code', 1150, 240, 'Template answer', 'Used when verification fails', '', '8 answers · 7 d', 'Idle'],
      ['followup', 'ai', 920, 530, 'Follow-up Agent', 'Up to 3 next questions · never blocks', 'Qwen2.5-7B', '470 calls · p95 380 ms', 'Idle'],
      ['reader', 'ai', 1150, 530, 'Reader Agent', '"Read this for me" · plain language', 'Qwen2.5-72B', '44 calls · p95 2.4 s · 0% rejected', 'Idle'],
      ['m72', 'model', 1400, 96, 'Qwen2.5-72B-Instruct', 'Main · indicator agents, Picker, Composer, Article, Reader', '', '38 req/min · p95 2.9 s', '38 req/min · p95 2.9 s'],
      ['m7', 'model', 1400, 262, 'Qwen2.5-7B-Instruct', 'Fast / router · Intent, Follow-up', '', '52 req/min · p95 410 ms', '52 req/min · p95 410 ms'],
      ['bge', 'model', 1400, 424, 'BAAI/bge-m3', 'Embeddings · resolvers, retrieval', '', '71 req/min · p95 60 ms', '71 req/min · p95 60 ms'],
      ['queue', 'queue', 240, 280, 'kap.agent queue', 'All Ask AI requests', '', '508 requests · p95 wait 0.4 s', '6 in flight · 1 waiting'],
      ['pa_local', 'ai', 240, 308, 'sceai_indicators_agent', 'SCEAI indicators · local data and documents', 'Qwen2.5-72B', '389 requests · p95 1.1 s · 0.8% failed', 'Routing to resolvers'],
      ['pa_ox', 'ai', 240, 476, 'sceai_indicators_oxford', 'Local data + Oxford Economics context', 'Qwen2.5-72B', '51 requests · p95 3.4 s · 4% failed', 'Calling Oxford · 1 open'],
      ['guard', 'code', 460, 612, 'Leak guard', 'Strips local data · public question', '', '51 runs · 0 blocked', 'Checking outbound question'],
      ['oxmcp', 'ext', 910, 612, 'Oxford Economics MCP', 'External · 2 tools', '', '51 calls · p95 2.6 s · 16% errors', 'EconomicData · 1.8 s']
    ].map(r => { const id = r[0]; if (r[3] < 700 && id !== 'queue') r[3] = r[3] + 48; if (!['web', 'api', 'analyst', 'jobsapi', 'queue', 'oxmcp'].includes(id)) r[2] = r[2] + 220; return r; });
    const JOBS = new Set([]);
    const SHARED = new Set(['queue']);
    const inShow = id => show === 'all' || SHARED.has(id) || (show === 'jobs') === JOBS.has(id);
    const ACT = new Set(['web', 'intent', 'picker', 'composer', 'verifier', 'article', 'retrieval', 'pgdb', 'engine', 'm72', 'm7', 'queue', 'guard', 'oxmcp', 'pa_local', 'pa_ox']);
    const HL = new Set(['web', 'queue', 'intent', 'pa_local', 'resolver', 'picker', 'engine', 'pgdb', 'composer', 'verifier', 'followup', 'm72', 'm7', 'bge']);
    const N = {};
    out.pNodes = PN.map(([id, t, x, y, name, sub, chip, hm, lm]) => {
      const h = t === 'ai' ? 96 : t === 'model' ? 84 : 76;
      const TC = { tl_local: '#8A1538', tl_docs: '#C8B49A', tl_ox: '#0F766E' }[id];
      N[id] = { x, y, h };
      const sel = st.pSel === id, dim = (st.pHl && !HL.has(id)) || !inShow(id), act = live && ACT.has(id);
      const ai = t === 'ai';
      return {
        x, y, h, name, sub, chip, pick: () => this.setState({ pSel: id }),
        tag: id === 'picker' || id === 'template' ? 'Fallback' : id === 'followup' || id === 'reader' ? 'Side agent' : id === 'pa_local' || id === 'pa_ox' ? 'planner_and_executor' : t === 'model' ? 'Model' : t === 'ext' ? 'External' : '',
        tagBg: id === 'picker' || id === 'template' ? 'var(--warning-bg)' : 'var(--surface-sunken)', tagFg: id === 'picker' || id === 'template' ? 'var(--warning-fg)' : 'var(--text-muted)',
        bg: t === 'code' || t === 'queue' ? 'var(--surface-sunken)' : t === 'model' ? 'var(--sand-tint)' : t === 'ext' ? 'var(--teal-tint)' : 'var(--surface-card)',
        bc: sel ? 'var(--brand)' : t === 'model' ? '#C8B49A' : t === 'ext' ? '#0F766E' : TC || 'var(--border-default)', bs: t === 'ext' ? 'dashed' : 'solid',
        bl: ai ? '4px solid #8A1538' : '1px ' + (t === 'ext' ? 'dashed ' : 'solid ') + (sel ? 'var(--brand)' : t === 'model' ? '#C8B49A' : t === 'ext' ? '#0F766E' : TC || 'var(--border-default)'),
        r: ai ? '8px' : t === 'code' ? '2px' : '8px', ir: ai ? '50%' : t === 'code' ? '2px' : '6px',
        ibg: ai ? '#F6E8EC' : t === 'model' || t === 'store' || t === 'ext' ? '#fff' : t === 'tool' ? (id === 'tl_local' ? '#F6E8EC' : id === 'tl_docs' ? 'var(--sand-tint)' : 'var(--teal-tint)') : '#E4DFDD', ifg: ai ? '#8A1538' : t === 'model' ? 'var(--sand-ink)' : t === 'ext' ? '#0F766E' : TC === '#C8B49A' ? 'var(--sand-ink)' : TC || 'var(--text-muted)',
        icon: ai ? AIc : t === 'code' ? (id === 'template' ? TPL : GEAR) : t === 'queue' ? I('Layers', 14) : t === 'tool' ? I('Wrench', 14) : t === 'ext' ? I('Globe', 14) : t === 'store' ? DB : t === 'model' ? CHIP : id === 'api' || id === 'jobsapi' ? API : id === 'analyst' ? I('Users', 14) : MSG,
        sh: sel ? '0 0 0 2px var(--brand), 0 4px 12px rgba(31,26,28,.08)' : act ? '0 0 0 3px rgba(138,21,56,.10)' : '0 1px 2px rgba(31,26,28,.05)',
        op: dim ? 0.3 : 1, flt: 'none',
        hc: id === 'oxmcp' ? 'var(--warning)' : id === 'template' ? '#A8A0A3' : 'var(--success)', ht: id === 'oxmcp' ? 'Degraded' : 'Healthy',
        metric: live ? lm : hm, mc: live && act ? 'var(--brand)' : (id === 'composer' || id === 'verifier') && !live ? 'var(--warning-fg)' : 'var(--text-muted)', mw: live && act ? 600 : 400
      };
    });
    const hor = (a, b, ya, yb) => { const A = N[a], B = N[b], x1 = A.x + 190, x2 = B.x, dx = Math.max(20, (x2 - x1) / 2); ya = ya == null ? A.y + A.h / 2 : ya; yb = yb == null ? B.y + B.h / 2 : yb; return 'M' + x1 + ',' + ya + ' C' + (x1 + dx) + ',' + ya + ' ' + (x2 - dx) + ',' + yb + ' ' + x2 + ',' + yb; };
    const ver = (a, b) => { const A = N[a], B = N[b]; return 'M' + (A.x + 95) + ',' + (A.y + A.h) + ' L' + (B.x + 95) + ',' + B.y; };
    const E = [
      ['web', 'queue', hor('web', 'queue'), 6, 0, 1],
      ['queue', 'intent', hor('queue', 'intent', 590, 236), 6, 0, 1],
      ['api', 'queue', hor('api', 'queue'), 2.5, 0, 0],
      ['intent', 'pa_local', 'M555,318 L555,356', 6, 0, 1],
      ['pa_local', 'resolver', hor('pa_local', 'resolver', 410, 200), 6, 0, 1],
      ['intent', 'retrieval', hor('intent', 'retrieval', 258, 406), 2.5, 0, 1],
      ['intent', 'composer', 'M555,188 C555,112 1235,104 1235,144', 1.5, 0, 0],
      ['resolver', 'picker', ver('resolver', 'picker'), 1.5, 1, 1],
      ['resolver', 'engine', hor('resolver', 'engine'), 5.5, 0, 0],
      ['picker', 'engine', hor('picker', 'engine', 346, 198), 1.5, 1, 1],
      ['engine', 'pgdb', ver('engine', 'pgdb'), 4, 0, 1],
      ['retrieval', 'vecdb', ver('retrieval', 'vecdb'), 2.5, 0, 1],
      ['engine', 'composer', hor('engine', 'composer'), 5.5, 0, 1],
      ['retrieval', 'article', hor('retrieval', 'article'), 2.5, 0, 1],
      ['composer', 'verifier', hor('composer', 'verifier', 188, 190), 5.5, 0, 1],
      ['verifier', 'template', ver('verifier', 'template'), 1.5, 1, 0],
      ['composer', 'followup', 'M1140,218 C1116,218 1116,626 1140,626', 4, 1, 0],
      ['reader', 'verifier', 'M1560,626 C1598,626 1598,190 1560,190', 1.5, 1, 0],
      ['intent', 'pa_ox', 'M470,318 C436,350 436,566 460,574', 2.5, 0, 1],
      ['pa_ox', 'guard', hor('pa_ox', 'guard', 586, 698), 2.5, 0, 1],
      ['guard', 'oxmcp', hor('guard', 'oxmcp'), 2.5, 0, 1],
      ['oxmcp', 'composer', 'M1100,698 C1122,698 1118,228 1140,228', 2.5, 0, 1],
    ];
    out.pEdges = E.map(([a, b, d, w, dash, act]) => {
      const dim = (st.pHl && !(HL.has(a) && HL.has(b))) || !inShow(a) || !inShow(b);
      const on = live && act && !dim;
      const fb = (a === 'resolver' && b === 'picker') || (a === 'verifier' && b === 'template');
      const ext = b === 'oxmcp' || a === 'oxmcp';
      return { d, w: live ? (on ? 2.5 : 1.5) : w, c: live ? (on ? (ext ? '#0F766E' : '#8A1538') : '#CFC8C6') : (fb ? '#B7791F' : ext ? '#C0352B' : '#A8A0A3'), dash: dash ? '6 4' : 'none', op: dim ? 0.15 : 1, live: on, pc: ext ? '#0F766E' : '#8A1538', sp: (1.2 + (d.length % 5) * 0.15).toFixed(2) + 's' };
    });
    const lop = id => (st.pHl && !HL.has(id) ? 0.3 : 1);
    out.pLabels = [
      [440, 72, 'SCEAI indicators 61%', 'var(--text-muted)', 'var(--border-subtle)', 'resolver'],
      [470, 374, 'Articles 18%', 'var(--text-muted)', 'var(--border-subtle)', 'retrieval'],
      [560, 34, 'General chat / out of scope 11% → Composer', 'var(--text-muted)', 'var(--border-subtle)', 'composer'],
      [462, 220, 'Indicator Picker used on 6% of questions', 'var(--warning-fg)', '#F1DDB4', 'picker'],
      [1152, 212, 'Verifier rejected 2.1% → template', 'var(--warning-fg)', '#F1DDB4', 'verifier'],
      [1250, 470, 'Same numeric check', 'var(--text-muted)', 'var(--border-subtle)', 'reader']
    ].map(r => { r[1] = r[1] + 48; r[0] = r[0] + 220; return r; }).concat([
      [240, 500, 'Oxford Economics 10%', 'var(--text-muted)', 'var(--border-subtle)', 'guard'],
      [682, 790, '0 blocked · 7 d', 'var(--success-fg)', 'var(--success-border)', 'guard'],
      [912, 790, 'Errors 16% · retried once', 'var(--warning-fg)', '#F1DDB4', 'oxmcp']
    ]).map(([x, y, t, c, bc, id]) => ({ x, y, t, c, bc, op: lop(id) * (inShow(id) ? 1 : 0.3) }));
    out.depNodes = [['Router', 'v1 · LLM chose the next agent', 'Non-deterministic routing'], ['SQL Agent', 'v1 · wrote free-form SQL', 'Wrong joins and filters'], ['Analyst Agent', 'v1 · model arithmetic', 'Wrong numbers'], ['Chart Agent', 'v1 · generated chart specs', 'Unverified series'], ['Verifier (LLM)', 'v1 · model checked model', 'Missed numeric errors']].map(([n, d, why], i) => ({ n, d, why, x: 40 + i * 310 }));
    const D = {
      intent: ['AI agent · Qwen2.5-7B-Instruct', 'Turns the question into structured fields: indicator, countries, periods, frequency and one computation type. It does not answer or calculate.', [['Calls · 7 d', '508'], ['p95', '410 ms'], ['Failed', '0.4%']], [['Model', 'Qwen2.5-7B-Instruct'], ['Output', 'JSON · schema v3'], ['Retries', '1 on invalid JSON']], 'Extract the request as JSON with fields:\nindicator, countries, periods, frequency, computation.\ncomputation is one of: latest_value, trend,\nperiod_comparison, country_comparison, country_ranking,\nperiod_ranking, min_max, difference, growth_rate,\ngeneral_chat, out_of_scope.\nDo not answer the question. Do not compute.'],
      picker: ['AI agent · Qwen2.5-72B-Instruct · fallback', 'Runs only when the resolver is unsure. Chooses one real indicator name from the catalogue, or NONE.', [['Calls · 7 d', '31'], ['p95', '1.2 s'], ['NONE', '3.2%']], [['Model', 'Qwen2.5-72B-Instruct'], ['Trigger', 'Resolver confidence below 0.70'], ['Catalogue', 'v2026.11.3 · 214 names']], 'You are given a question and a list of catalogue\nindicator names. Return exactly one name from the list,\nor NONE. Never invent or edit a name.'],
      composer: ['AI agent · Qwen2.5-72B-Instruct · streaming', 'The only agent that writes the final numeric answer. It restates the computed facts in English or Arabic and never calculates.', [['Calls · 7 d', '389'], ['p95', '2.6 s'], ['Rejected', '2.1%']], [['Model', 'Qwen2.5-72B-Instruct'], ['Input', 'Computed facts + question'], ['Checked by', 'Numeric verifier']], 'Write the answer using only the facts provided.\nRestate every number exactly as given, with its period\nand unit. Answer in the user\u2019s language (English or\nArabic). Do not calculate, round or infer new numbers.'],
      article: ['AI agent · Qwen2.5-72B-Instruct', 'Answers article questions only from the retrieved passages and names the sources it used.', [['Calls · 7 d', '92'], ['p95', '2.9 s'], ['Failed', '1.1%']], [['Model', 'Qwen2.5-72B-Instruct'], ['Passages', 'Top 6 from SCEAI articles'], ['Citations', 'Required']], 'Answer only from the passages below. Cite each passage\nyou use by title. If the passages do not contain the\nanswer, say so.'],
      followup: ['AI agent · Qwen2.5-7B-Instruct · side agent', 'Suggests up to three next questions after the answer is shown. It never blocks or delays the answer.', [['Calls · 7 d', '470'], ['p95', '380 ms'], ['Failed', '0.6%']], [['Model', 'Qwen2.5-7B-Instruct'], ['Runs', 'After answer, async'], ['Max', '3 suggestions']], 'Suggest up to 3 short follow-up questions about the same\nindicator or country. Return a JSON list of strings.'],
      pa_local: ['AI agent · planner_and_executor · Qwen2.5-72B-Instruct', 'Answers indicator questions submitted as jobs. Plans its own tool calls over local indicator data and documents, then writes the answer.', [['Jobs · 7 d', '29'], ['p95', '9.1 s'], ['Failed', '10%']], [['Model', 'Qwen2.5-72B-Instruct'], ['Tools', '11 local + hybrid_search'], ['Limits', '180 s · 15 tool calls · 20 requests']], 'You answer questions about SCEAI economic indicators.\nAlways resolve indicators with find_indicator before\nreading values. Quote actual and target values with\nperiod and unit.'],
      pa_ox: ['AI agent · planner_and_executor · Qwen2.5-72B-Instruct', 'Same as sceai_indicators_agent, plus public macro context from Oxford Economics. Only public questions leave the project boundary.', [['Jobs · 7 d', '21'], ['p95', '12.8 s'], ['Failed', '24%']], [['Model', 'Qwen2.5-72B-Instruct'], ['Tools', '11 local + hybrid_search + 2 Oxford'], ['Leak guard', 'On · 0 blocked in 7 d']], 'Only send public-domain questions to Oxford Economics.\nNever include local indicator codes, values or tenant\ninformation. Keep local and external figures in\nseparate sentences.'],
      reader: ['AI agent · Qwen2.5-72B-Instruct · on demand', 'Runs when a user presses "Read this for me". Rewrites the same facts in plain language and is checked by the numeric verifier.', [['Calls · 7 d', '44'], ['p95', '2.4 s'], ['Rejected', '0%']], [['Model', 'Qwen2.5-72B-Instruct'], ['Trigger', 'User action'], ['Checked by', 'Numeric verifier']], 'Rewrite the answer in plain language for a general\nreader. Keep every number exactly as given.\nDo not add numbers.']
    };
    const P = PN.find(p => p[0] === st.pSel) || PN[9];
    const t = P[1], ai = t === 'ai', d = D[P[0]];
    const KV = (k, v, m) => ({ k, v, f: m ? 'var(--font-mono)' : 'var(--font-sans)' });
    out.pd = {
      name: P[4], icon: ai ? this.aiMark(18) : t === 'tool' ? I('Wrench', 18) : t === 'ext' ? I('Globe', 18) : t === 'queue' ? I('Layers', 18) : t === 'code' ? I(['Cog', 'Settings'], 18) : t === 'store' ? I('Database', 18) : t === 'model' ? I('Cpu', 18) : I('MessageSquare', 18),
      ir: ai ? '50%' : t === 'code' ? '2px' : '6px', ibg: ai ? '#F6E8EC' : t === 'model' ? 'var(--sand-tint)' : 'var(--surface-sunken)', ifg: ai ? '#8A1538' : t === 'model' ? 'var(--sand-ink)' : 'var(--text-muted)',
      kind: d ? d[0] : ({ code: 'Deterministic code step', store: 'Data store', model: 'Model', ch: 'Channel', queue: 'Job queue', tool: 'Tool', ext: 'External MCP server' })[t],
      purpose: d ? d[1] : P[5] + '.',
      stats: (d ? d[2] : [['Volume', P[7].split(' · ')[0]], ['p95', (P[7].split('p95 ')[1] || '—').split(' ·')[0]], ['Errors', (P[7].match(/([\d.]+% errors)/) || [0, '0%'])[1].replace(' errors', '')]]).map(([k, v]) => ({ k, v, c: /Rejected|Failed|NONE/.test(k) && v !== '0%' ? 'var(--warning-fg)' : 'var(--text-strong)' })),
      kv: d ? d[3].map(([k, v]) => KV(k, v, k === 'Model')) : [KV('Type', ({ code: 'Code (no model)', store: 'Data store', model: 'Model endpoint', ch: 'Channel', queue: 'Job queue', tool: 'Tool (code)', ext: 'External · Oxford Economics' })[t]), KV('Detail', P[5])],
      prompt: d ? d[4] : '',
      hc: P[0] === 'oxmcp' ? 'var(--warning)' : 'var(--success)',
      spark: [0, 1, 2, 3, 4, 5, 6].map(i => (i * 50) + ',' + (40 - (((P[0].length * 7 + i * 13) % 23) + (i === 6 ? 10 : 0)))).join(' '),
      conn: E.filter(e => e[0] === P[0] || e[1] === P[0]).map(e => { const other = e[0] === P[0] ? e[1] : e[0]; const o = PN.find(p => p[0] === other); return { dir: e[0] === P[0] ? 'To' : 'From', n: o ? o[4] : other, pick: () => this.setState({ pSel: other }) }; })
    };
    const TB = (l, tone) => ({ l, tone });
    const THU = I('ThumbsUp', 14), THD = I('ThumbsDown', 14);
    const CV = [
      ['7f21a9', 'sceai_analyst', 'EN', "How did tourism's share of GDP change between Q4 2023 and Q4 2024?", 'Numeric', 'success', 'Intent → Resolve + Picker → Compute → Compose → Verify', '4.1 s', 1, '12 min ago'],
      ['7f21a4', 'sceai_analyst', 'AR', 'ما هو معدل التضخم في قطر في يناير 2019؟', 'Numeric', 'success', 'Intent → Resolve → Compute → Compose → Verify', '3.2 s', 0, '18 min ago'],
      ['7f2198', 'guest_8812', 'EN', 'What does the National Development Strategy say about export diversification?', 'Article', 'info', 'Intent → Retrieve → Article', '3.8 s', 1, '25 min ago'],
      ['7f2190', 'guest_8812', 'AR', 'قارن نمو الناتج المحلي بين قطر والإمارات في 2023', 'Numeric', 'success', 'Intent → Resolve → Compute → Compose → Verify', '3.6 s', 0, '41 min ago'],
      ['7f2187', 'api:dashboards-svc', 'EN', 'Rank GCC countries by non-hydrocarbon export share in 2019', 'Template fallback', 'warning', 'Compose → Verify rejected → Template', '4.4 s', -1, '1 h ago'],
      ['7f217c', 'guest_7720', 'EN', 'Who will win the next World Cup?', 'Refusal', 'neutral', 'Intent → out of scope', '0.6 s', 0, '1 h ago'],
      ['7f2171', 'sceai_admin', 'AR', 'كم بلغت مساهمة قطاع السياحة في الناتج المحلي في الربع الرابع 2024؟', 'Numeric', 'success', 'Intent → Resolve → Compute → Compose → Verify', '3.1 s', 1, '2 h ago'],
      ['7f2166', 'guest_7720', 'EN', 'Hotel occupancy in Al Wakrah last month', 'Refusal', 'neutral', 'Intent → Resolve + Picker (NONE)', '1.9 s', -1, '3 h ago'],
      ['7f215b', 'sceai_analyst', 'EN', 'What is the latest strategic food reserve coverage?', 'Numeric', 'success', 'Intent → Resolve → Compute → Compose → Verify', '2.9 s', 0, '4 h ago'],
      ['7f2150', 'guest_9034', 'AR', 'ما هي آخر قيمة لتغطية المخزون الاستراتيجي للأغذية؟', 'Numeric', 'success', 'Intent → Resolve → Compute → Compose → Verify', '3.0 s', 1, '5 h ago'],
      ['7f2149', 'guest_9034', 'EN', 'Hello, what can you help me with?', 'General chat', 'neutral', 'Intent → Composer', '1.2 s', 0, '5 h ago'],
      ['7f213e', 'sceai_analyst', 'EN', 'Growth rate of re-exports between 2022 and 2024', 'Template fallback', 'warning', 'Compose → Verify rejected → Template', '4.7 s', -1, '7 h ago'],
      ['7f2132', 'guest_6610', 'AR', 'ما الذي تقوله التقارير عن تنويع الاقتصاد؟', 'Article', 'info', 'Intent → Retrieve → Article', '4.0 s', 0, '9 h ago'],
      ['7f2127', 'sceai_admin', 'EN', 'Which quarter had the highest tourism contribution since 2022?', 'Numeric', 'success', 'Intent → Resolve → Compute → Compose → Verify', '3.3 s', 1, '11 h ago']
    ];
    out.convs = CV.map(([id, user, lang, q, type, tone, path, lat, fb, when]) => ({ id, user, lang, q, type, tone, path, lat, when, fb: fb === 1 ? THU : fb === -1 ? THD : null, fc: fb === 1 ? 'var(--success)' : 'var(--danger)' }));
    out.convSum = [['Messages · 7 d', '508', '#8C8487'], ['Numeric', '61%', 'var(--success)'], ['Article', '18%', 'var(--info)'], ['Refusal / chat', '17%', '#A8A0A3'], ['Template fallback', '8', 'var(--warning)'], ['Arabic', '38%', '#C8B49A'], ['Negative feedback', '7', 'var(--danger)']].map(([k, v, c]) => ({ k, v, c }));
    const ST = [
      ['understanding', 'Intent Agent', 'ai', 0, .42, 'AI · Qwen2.5-7B-Instruct', 'Extracted structured fields from the question.', '"How did tourism\'s share of GDP change between\n Q4 2023 and Q4 2024?"', '{\n  "indicator": "tourism share of GDP",\n  "countries": ["QAT"],\n  "periods": ["2023-Q4", "2024-Q4"],\n  "frequency": "Q",\n  "computation": "period_comparison"\n}'],
      ['routed', 'Pipeline router', 'code', .42, .01, 'Code', 'Numeric path selected from computation type.', '{ "computation": "period_comparison" }', '{ "path": "numeric" }'],
      ['resolved', 'Resolvers', 'code', .43, .09, 'Code · bge-m3 match', 'Country and periods resolved. Indicator match below 0.70 confidence.', '{ "indicator": "tourism share of GDP" }', '{\n  "country": "QAT",\n  "periods": ["2023-Q4", "2024-Q4"],\n  "indicator_candidates": 5,\n  "best_score": 0.58\n}'],
      ['resolved', 'Indicator Picker', 'ai', .52, 1.14, 'AI · Qwen2.5-72B-Instruct · fallback', 'Picked one catalogue name from 5 candidates.', '{ "candidates": [5 names from v2026.11.3] }', '{ "picked": "Sector Contribution to GDP (Tourism)",\n  "code": "IND-TOU-014" }'],
      ['retrieving', 'Compute engine', 'code', 1.67, .04, 'Code · reads Indicators DB', 'Read 2 observations and computed the difference.', '{ "code": "IND-TOU-014",\n  "op": "difference",\n  "periods": ["2023-Q4", "2024-Q4"] }', '{\n  "facts": [\n    { "period": "2024-Q4", "value": 8.8, "unit": "%" },\n    { "period": "2023-Q4", "value": 6.9, "unit": "%" },\n    { "difference_pp": 1.9 }\n  ]\n}'],
      ['composing', 'Composer Agent', 'ai', 1.71, 2.38, 'AI · Qwen2.5-72B-Instruct · streaming', 'Wrote the answer from the computed facts only.', '{ "facts": [3], "language": "en" }', '"Tourism contributed 8.8% of GDP in Q4 2024, up from\n 6.9% in Q4 2023, an increase of 1.9 percentage points."'],
      ['verifying', 'Numeric verifier', 'code', 4.09, .01, 'Code', 'Every number in the answer matched a computed fact.', '{ "numbers_in_answer": ["8.8", "6.9", "1.9"] }', '{ "matched": 3, "unmatched": 0, "result": "pass" }'],
      ['replace', 'Template answer', 'code', 4.1, 0, 'Code · skipped', 'Not used. Verification passed.', '—', '—']
    ];
    const T = 4.1, sel = Math.min(st.cSel, ST.length - 1);
    out.cStages = ST.map(([stage, n, k, s, d], i) => ({ stage, n, pick: () => this.setState({ cSel: i }), bg: i === sel ? 'var(--brand-tint)' : 'transparent', op: i === 7 ? 0.5 : 1, icon: k === 'ai' ? this.aiMark(12) : I(['Cog', 'Settings'], 12), ir: k === 'ai' ? '50%' : '2px', ibg: k === 'ai' ? '#F6E8EC' : '#E4DFDD', ifg: k === 'ai' ? '#8A1538' : 'var(--text-muted)', c: k === 'ai' ? '#8A1538' : '#8C8487', l: (s / T * 100).toFixed(2), w: (d / T * 100).toFixed(2), d: d === 0 ? 'skipped' : d < 1 ? Math.round(d * 1000) + ' ms' : d.toFixed(2) + ' s' }));
    const cs = ST[sel];
    out.cs = { n: cs[1], kind: cs[5], note: cs[6], input: cs[7], output: cs[8], d: cs[4] === 0 ? 'skipped' : cs[4] < 1 ? Math.round(cs[4] * 1000) + ' ms' : cs[4].toFixed(2) + ' s' };
    out.cProv = [['1', '8.8%', 'Sector Contribution to GDP (Tourism)', '2024-Q4', 'Qatar Tourism · quarterly.csv row 2214', 'compute_engine'], ['2', '6.9%', 'Sector Contribution to GDP (Tourism)', '2023-Q4', 'Qatar Tourism · quarterly.csv row 2210', 'compute_engine'], ['3', '1.9 pp', 'Difference of 1 and 2', '2023-Q4 → 2024-Q4', 'Computed', 'compute_engine · difference']].map(([i, v, ind, per, src, by]) => ({ i, v, ind, per, src, by }));
    out.fbSum = [['Negative · 7 d', '7', 'var(--danger-fg)'], ['Positive · 7 d', '86', 'var(--success-fg)'], ['Negative rate', '7.5%', 'var(--text-strong)'], ['Open', '4', 'var(--text-strong)'], ['Median time to triage', '5 h', 'var(--text-strong)']].map(([k, v, c]) => ({ k, v, c }));
    out.fbRows = [
      ['7f2187', 'Rank GCC countries by non-hydrocarbon export share in 2019', 'EN', 'Template fallback', 'warning', 'Not answered', 'Gave a generic answer instead of the ranking', 'submitted', 'New', '1 h ago'],
      ['7f2166', 'Hotel occupancy in Al Wakrah last month', 'EN', 'Refusal', 'neutral', 'Missing indicator', 'This data exists on the PSA site', 'submitted', 'New', '3 h ago'],
      ['7f213e', 'Growth rate of re-exports between 2022 and 2024', 'EN', 'Template fallback', 'warning', 'Not answered', '—', 'hold', 'Triaged', '7 h ago'],
      ['7f20f2', 'ما هو ترتيب قطر في مؤشر التنافسية؟', 'AR', 'Numeric', 'success', 'Wrong indicator', 'أريد مؤشر التنافسية العالمي وليس المحلي', 'hold', 'Triaged', '1 d ago'],
      ['7f20c8', 'Compare inflation in Qatar and Oman since 2020', 'EN', 'Numeric', 'success', 'Too long', 'Just wanted the table', 'submitted', 'New', '2 d ago'],
      ['7f2081', 'ما الذي تقوله التقارير عن السياحة الرياضية؟', 'AR', 'Article', 'info', 'Wrong source', 'المصدر قديم', 'submitted', 'New', '3 d ago'],
      ['7f1f9a', 'Latest unemployment rate', 'EN', 'Numeric', 'success', 'Wrong period', 'Showed 2023, 2024 is published', 'approved', 'Resolved', '5 d ago']
    ].map(([id, q, lang, type, tone, reason, cmt, p, pl, when]) => ({ id, q, lang: lang === 'AR' ? 'Arabic' : 'English', type, tone, reason, cmt, p, pl, when }));
    out.cat = [
      ['Sector Contribution to GDP (Tourism)', 'مساهمة قطاع السياحة في الناتج المحلي', 'IND-TOU-014', 'Quarterly', 'Qatar', '2015-Q1 → 2024-Q4', '6 / 4', 'approved', 'Published'],
      ['Consumer Price Inflation (YoY)', 'معدل التضخم السنوي', 'IND-PRC-002', 'Monthly', 'Qatar, GCC', '2010-01 → 2024-12', '9 / 7', 'approved', 'Published'],
      ['Non-Hydrocarbon Exports (share of total exports)', 'الصادرات غير الهيدروكربونية', 'IND-TRD-031', 'Annual', 'Qatar, GCC', '2010 → 2023', '5 / 3', 'approved', 'Published'],
      ['Strategic Food Reserve Coverage', 'تغطية المخزون الاستراتيجي للأغذية', 'IND-FDS-007', 'Annual', 'Qatar', '2018 → 2024', '4 / 3', 'approved', 'Published'],
      ['Real GDP Growth', 'نمو الناتج المحلي الحقيقي', 'IND-GDP-001', 'Annual', 'Qatar, GCC', '2000 → 2024', '7 / 5', 'approved', 'Published'],
      ['Re-export Value Growth', 'نمو قيمة إعادة التصدير', 'IND-TRD-019', 'Quarterly', 'Qatar', '2019-Q1 → 2024-Q4', '3 / 2', 'hold', 'Draft · next version']
    ].map(([n, ar, code, f, cov, per, al, p, pl], i) => ({ n, ar, code, f, cov, per, al, p, pl, open: () => { this.setState({ catSel: i, screen: 'catItem' }); const m = document.querySelector('main'); if (m) m.scrollTop = 0; } }));
    out.backCat = e => { e.preventDefault(); this.setState({ screen: 'catalogue' }); };
    out.backCatBtn = () => this.setState({ screen: 'catalogue', pubDone: false, pubStep: 0 });
    out.goPublish = () => { this.setState({ screen: 'catPublish', pubStep: 0, pubDone: false }); const m = document.querySelector('main'); if (m) m.scrollTop = 0; };
    {
      const k = st.pubStep || 0, OKc = I('Check', 12), WR = I('Minus', 12);
      const names = [['Changes', '9 indicators affected'], ['Checks', '5 passed · 1 warning'], ['Review and publish', 'Notes and rollout']];
      out.pubSteps = names.map(([n, d], i) => { const done = i < k || st.pubDone, cur = i === k && !st.pubDone; return { n, d, go: () => this.setState({ pubStep: i }), mark: done ? '✓' : String(i + 1), bg: cur ? 'var(--brand-tint)' : 'transparent', cbg: done ? 'var(--brand)' : cur ? '#fff' : 'transparent', cfg: done ? '#fff' : cur ? 'var(--brand)' : 'var(--text-muted)', cb: done || cur ? 'var(--brand)' : 'var(--border-default)', fg: cur ? 'var(--brand-strong)' : 'var(--text-strong)', fw: cur ? 600 : 500 }; });
      out.ps = { changes: k === 0, checks: k === 1, review: k === 2 };
      out.pubNotFirst = k > 0; out.pubNotLast = k < 2; out.pubNextL = k === 0 ? 'Next: Checks' : 'Next: Review';
      out.pubNext = () => this.setState({ pubStep: Math.min(2, k + 1) }); out.pubPrev = () => this.setState({ pubStep: Math.max(0, k - 1) });
      out.pubDo = () => this.setState({ pubDone: true }); out.pubDone = !!st.pubDone;
      out.pubSum = [['+ 1 added', 'var(--success-bg)', 'var(--success-fg)'], ['~ 7 changed', 'var(--info-bg)', 'var(--info)'], ['− 1 retired', 'var(--danger-bg)', 'var(--danger-fg)'], ['+ 12 Arabic aliases', 'var(--surface-sunken)', 'var(--text-body)']].map(([t, bg, fg]) => ({ t, bg, fg }));
      const CH = { Added: ['var(--success-bg)', 'var(--success-fg)'], Changed: ['var(--info-bg)', 'var(--info)'], Retired: ['var(--danger-bg)', 'var(--danger-fg)'] };
      out.pubChanges = [
        ['Added', 'Re-export Value Growth', 'IND-TRD-019', 'Status', 'Draft', 'Published', 'm.alkuwari'],
        ['Changed', 'Sector Contribution to GDP (Tourism)', 'IND-TOU-014', 'Target · 2025-Q1', '—', '7.9%', 'pkg_2024Q4'],
        ['Changed', 'Non-Hydrocarbon Exports (share of total exports)', 'IND-TRD-031', 'Target · 2024', '50%', '45%', 'pkg_2024Q4'],
        ['Changed', 'Consumer Price Inflation (YoY)', 'IND-PRC-002', 'Arabic aliases', '7', '9', 'r.haddad'],
        ['Changed', 'Strategic Food Reserve Coverage', 'IND-FDS-007', 'Unit label', 'days', 'days of consumption', 'm.alkuwari'],
        ['Changed', 'Real GDP Growth', 'IND-GDP-001', 'Source organisation', 'PSA', 'National Planning Council', 'pkg_2024Q4'],
        ['Changed', 'Labour Force Participation Rate', 'IND-LAB-022', 'Latest period', '2024-Q3', '2024-Q4', 'pkg_2024Q4'],
        ['Changed', 'Sector Contribution to GDP (Tourism)', 'IND-TOU-014', 'English aliases', '6', '8', 'r.haddad'],
        ['Retired', 'GDP (nominal, old series)', 'IND-GDP-004', 'Status', 'Published', 'Retired', 'm.alkuwari']
      ].map(([kk, n, code, f, b, a, by]) => ({ k: kk, n, code, f, b, a, by, bg: CH[kk][0], fg: CH[kk][1], bb: kk === 'Added' ? 'transparent' : 'var(--danger-bg)', bd: kk === 'Retired' ? 'none' : 'line-through', ab: kk === 'Retired' ? 'var(--danger-bg)' : 'var(--success-bg)' }));
      out.pubChecks = [
        ['ok', 'Names are unique', 'No two indicators share a name or alias, so the Indicator Picker cannot confuse them.', '215 / 215'],
        ['ok', 'Every indicator has data', 'Each published indicator has at least one observation in the Indicators DB.', '215 / 215'],
        ['ok', 'Units and periods are valid', 'Frequency matches the periods present; units are set.', '0 issues'],
        ['ok', 'Retired entry is not referenced', 'No saved questions or reports point at IND-GDP-004.', '0 references'],
        ['ok', 'Ask AI regression questions', 'Answers to the 200 test questions match expected numbers.', '198 / 200'],
        ['warn', 'Arabic alias coverage', '6 indicators still have fewer than 2 Arabic aliases. Arabic questions about them may need the Indicator Picker.', '97% covered']
      ].map(([s, t, d, m]) => ({ t, d, m, icon: s === 'ok' ? OKc : WR, c: s === 'ok' ? 'var(--success)' : 'var(--warning)', mc: s === 'ok' ? 'var(--success-fg)' : 'var(--warning-fg)' }));
      out.pubEval = [['Correct numbers', '99.0%', '+0.5 pp vs current', 'var(--success-fg)'], ['Resolved directly', '94%', '+3 pp · fewer Picker calls', 'var(--success-fg)'], ['Arabic questions', '97.5%', '78 / 80', 'var(--text-muted)'], ['Median latency', '3.1 s', 'unchanged', 'var(--text-muted)']].map(([k, v, d, c]) => ({ k, v, d, c }));
    }
    {
      const c = out.cat[Math.min(st.catSel || 0, out.cat.length - 1)];
      const X = { 'IND-TOU-014': ['% of GDP', 'Qatar Tourism', '8.8% · Q4 2024', '7.6%', ['tourism share of GDP', 'tourism contribution', 'tourism GDP', 'travel and tourism share', 'tourism sector GDP', 'hospitality contribution'], ['مساهمة السياحة', 'السياحة من الناتج', 'نسبة السياحة', 'قطاع السياحة'], 42, 88, 12], 'IND-PRC-002': ['% YoY', 'Planning and Statistics Authority', '−0.5% · Jan 2019', '−0.3%', ['inflation', 'CPI', 'consumer prices', 'price index', 'cost of living', 'headline inflation', 'CPI YoY', 'inflation rate', 'consumer inflation'], ['التضخم', 'معدل التضخم', 'مؤشر الأسعار', 'أسعار المستهلك', 'غلاء المعيشة', 'الرقم القياسي', 'تضخم سنوي'], 33, 94, 6] };
      const x = X[c.code] || ['%', 'Planning and Statistics Authority', '—', '—', ['primary name', 'short name', 'abbreviation'], ['الاسم', 'الاسم المختصر'], 9, 80, 20];
      out.ci = { n: c.n, ar: c.ar, code: c.code, p: c.p, pl: c.pl, org: x[1], upd: '3 d ago',
        kpi: [['Latest value', x[2], 'Actual'], ['Target', x[3], 'Current period'], ['Questions · 7 d', String(x[6]), 'Ask AI'], ['Answer accuracy', '98%', 'Verifier pass rate']].map(([k, v, d]) => ({ k, v, d })),
        meta: [['Code', c.code, 1], ['Frequency', c.f], ['Unit', x[0]], ['Coverage', c.cov], ['Periods', c.per, 1], ['Source organisation', x[1]], ['Collection', 'sceai_indicators', 1], ['Catalogue version', 'v2026.11.3', 1]].map(([k, v, m]) => ({ k, v, f: m ? 'var(--font-mono)' : 'var(--font-sans)' })),
        en: x[4], arA: x[5], direct: x[7], picker: x[8],
        qs: [['How did ' + c.n.split(' (')[0].toLowerCase() + ' change last period?', 11], ['What is the latest value and is it on target?', 9], [c.ar + '؟', 7], ['Compare with the previous year', 5]].map(([q, n]) => ({ q, n })),
        hist: [['v2026.11.3', 'Added 2 Arabic aliases', 'm.alkuwari', '3 d ago'], ['v2026.10.1', 'Unit clarified to ' + x[0], 'r.haddad', '34 d ago'], ['v2026.09.4', 'Entry created', 'r.haddad', '61 d ago']].map(([v, note, by, when]) => ({ v, note, by, when })) };
      const SER = {
        'IND-TOU-014': [[6.4, 6.7, 7.0, 6.9, 7.2, 7.4, 7.7, 8.8], [7.0, 7.0, 7.0, 7.0, 7.6, 7.6, 7.6, 7.6], ['Q1 23', 'Q2 23', 'Q3 23', 'Q4 23', 'Q1 24', 'Q2 24', 'Q3 24', 'Q4 24'], '%', 1, 'quarterly.csv', 2207],
        'IND-PRC-002': [[0.2, 0.1, 0.4, 0.3, -0.1, -0.3, -0.4, -0.5], [0.0, 0.0, 0.0, 0.0, -0.2, -0.2, -0.3, -0.3], ['Jun 18', 'Jul 18', 'Aug 18', 'Sep 18', 'Oct 18', 'Nov 18', 'Dec 18', 'Jan 19'], '%', 1, 'monthly.csv', 411],
        'IND-TRD-031': [[24.1, 25.6, 26.9, 28.2, 28.8, 29.4, 30.8, 32.04], [50, 50, 50, 50, 50, 50, 50, 50], ['2012', '2013', '2014', '2015', '2016', '2017', '2018', '2019'], '%', 2, 'annual.csv', 70],
        'IND-FDS-007': [[52, 58, 61, 66, 70, 74, 79, 84], null, ['2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024'], ' days', 0, 'annual.csv', 134],
        'IND-GDP-001': [[1.5, -3.6, 1.6, 4.9, 1.2, 1.56, 2.0, 2.4], [2.0, 2.0, 2.0, 3.0, 3.0, 3.0, 3.0, 3.0], ['2017', '2018*', '2019', '2020*', '2021', '2022*', '2023', '2024'], '%', 2, 'annual.csv', 12],
        'IND-TRD-019': [[3.1, 4.4, 2.8, 5.0, 6.2, 5.5, 7.1, 6.4], [5, 5, 5, 5, 5, 5, 5, 5], ['Q1 23', 'Q2 23', 'Q3 23', 'Q4 23', 'Q1 24', 'Q2 24', 'Q3 24', 'Q4 24'], '%', 1, 'quarterly.csv', 1880]
      }[c.code];
      if (SER) {
        const [A, T, lb, u, dp, file, row] = SER;
        const all = A.concat(T || []), mn = Math.min(...all), mx = Math.max(...all), pad = (mx - mn) * 0.12 || 1, lo = mn - pad, hi = mx + pad;
        const Xp = i => 60 + i * 76, Yp = v => (180 - (v - lo) / (hi - lo) * 165).toFixed(1);
        const fmt = v => (v < 0 ? '−' : '') + Math.abs(v).toFixed(dp) + u;
        out.ci.actPts = A.map((v, i) => Xp(i) + ',' + Yp(v)).join(' ');
        out.ci.tgtPts = T ? T.map((v, i) => Xp(i) + ',' + Yp(v)).join(' ') : '';
        out.ci.hasT = !!T; out.ci.noT = !T;
        out.ci.chartTitle = T ? 'Actual vs target' : 'Actual values';
        out.ci.dots = A.map((v, i) => ({ x: Xp(i), y: Yp(v), q: lb[i] }));
        out.ci.gridY = [0, 1, 2, 3].map(k => { const v = lo + pad + (hi - lo - 2 * pad) * k / 3; return { y: Yp(v), ly: (+Yp(v) + 4).toFixed(1), l: (Math.abs(v) >= 10 ? Math.round(v) : v.toFixed(1)) + (u === ' days' ? 'd' : u) }; });
        out.ci.obs = A.map((v, i) => { const t = T ? T[i] : null, g = t == null ? null : v - t, up = g == null || g >= 0; return { period: lb[i], a: fmt(v), t: t == null ? '—' : fmt(t), gap: g == null ? '—' : (g >= 0 ? '+' : '−') + Math.abs(g).toFixed(dp) + (u === '%' ? ' pp' : u), gc: g == null ? 'var(--text-muted)' : up ? 'var(--success-fg)' : 'var(--danger-fg)', src: file + ' · ' + (row + i) }; }).reverse();
        out.ci.kpi[0].v = fmt(A[A.length - 1]) + ' · ' + lb[lb.length - 1];
        out.ci.kpi[1].v = T ? fmt(T[T.length - 1]) : 'No target';
      }
    }
    out.catVers = [['v2026.11.3', 'Current', 'Added 4 indicators · 12 Arabic aliases', 'm.alkuwari', '3 d ago', 1], ['v2026.11.2', '', 'Renamed IND-PRC-002 aliases', 'r.haddad', '11 d ago', 0], ['v2026.10.1', '', 'Removed 2 duplicate GDP indicators', 'm.alkuwari', '34 d ago', 0], ['v2026.09.4', '', 'Initial assistant catalogue · 206 indicators', 'r.haddad', '61 d ago', 0]].map(([v, tag, note, by, when, on]) => ({ v, tag, note, by, when, bg: on ? 'var(--brand-tint)' : 'transparent', tc: 'var(--brand)' }));
    return out;
  }
  more(I, ic, go, nodes) {
    const st = this.state, sc = st.screen;
    const tg = v => () => this.setState(s => ({ menu: s.menu === v ? null : v, palette: false }));
    const link = k => e => { e.preventDefault(); e.stopPropagation(); go(k)(); };
    const PS = { running: 'submitted', succeeded: 'approved', failed: 'rejected', waiting: 'draft' };
    const isLive = st.mode === 'live';
    const out = {
      goWizard: go('wizard'), goAgent: go('agent'), goTrace: go('trace'), goMap: go('map'),
      goMapLink: link('map'), goTraceLink: link('trace'), goAgentLink: link('agent'), goJobsLink: link('jobs'), goCollectionsLink: link('collections'),
      setATab: v => this.setState({ aTab: v }), setTTab: v => this.setState({ tTab: v }), setUTab: v => this.setState({ uTab: v }), setTestTab: () => {},
      openPalette: () => this.setState({ palette: true, menu: null }), closeAll: () => this.setState({ palette: false, menu: null }),
      tTenant: tg('tenant'), tCreate: tg('create'), tBell: tg('bell'),
      checkMcp: () => { this.setState({ mcp: 1 }); clearTimeout(this._mt); this._mt = setTimeout(() => this.setState({ mcp: 2 }), 1100); },
      mcpBusy: st.mcp === 1, mcpOk: st.mcp === 2,
      palette: st.palette, mn: { tenant: st.menu === 'tenant', create: st.menu === 'create', bell: st.menu === 'bell' },
      anyOverlay: st.palette || !!st.menu, backdrop: st.palette ? 'rgba(31,26,28,.35)' : 'transparent',
      aTab: st.aTab, tTab: st.tTab, uTab: st.uTab,
      at: { [st.aTab]: true }, ut: { [st.uTab]: true },
      tt: { [st.tTab]: true, prov: st.tTab === 'timeline' || st.tTab === 'answer' },
      mp: { live: isLive, hist: !isLive }, selW: { minWidth: 220, flex: '1 1 220px' }
    };
    out.modes = [['live', 'Live'], ['1h', 'Last 1 h'], ['24h', '24 h'], ['7d', '7 d']].map(([k, l]) => { const on = st.mode === k; return { l, live: k === 'live', bg: on ? 'var(--brand)' : 'transparent', fg: on ? '#fff' : 'var(--text-body)', fw: on ? 600 : 400, set: () => this.setState({ mode: k }) }; });
    if (!isLive) {
      const HM = ['28 jobs · 7 d', '11 jobs · 7 d', '9 jobs · 7 d', 'p95 wait 1.2 s', '29 jobs · p95 9.1 s · 10% err', '21 jobs · p95 12.8 s · 24% err', '142 calls · p95 330 ms · 0.7% err', '12 calls · p95 690 ms · 0% err', '15 calls · p95 2.6 s · 20% err', '4 calls · p95 3.3 s · 0% err', '154 reads · 7 d', '12 calls · p95 120 ms', '118 calls · p95 3.4 s', 'Not used by agents', '19 calls · p95 2.6 s · 16% err'];
      const bad = [5, 8, 14];
      out.nodes = nodes.map((n, i) => ({ ...n, metric: HM[i], bc: bad.includes(i) ? 'var(--danger)' : 'var(--border-subtle)', sh: 'var(--shadow-xs)', mc: bad.includes(i) ? 'var(--danger-fg)' : 'var(--text-body)', mw: 500, loop: false, expand: n.loop ? 'Show execution loop' : n.expand }));
    }
    const W = I(['TriangleAlert', 'AlertTriangle'], 15), X = I(['CircleX', 'XCircle'], 15), CK = I('Check', 15);
    const curT = st.tenant;
    const PLAT = new Set(['pHome', 'tenants', 'pModels', 'pMcp', 'pQueues', 'pUsers', 'pAudit']);
    const isPlat = PLAT.has(sc);
    const pick = (k) => () => { this.setState(k === 'kap' ? { screen: 'pHome', menu: null } : { tenant: k, screen: PLAT.has(this.state.screen) ? 'home' : this.state.screen, menu: null }); const m = document.querySelector('main'); if (m) m.scrollTop = 0; };
    out.tenantMenu = [['kap', 'KAP platform', 'Shared runtime, model serving, queues · AI team', 1, 'Platform', 'KAP', '#1F1A1C', '#fff'], ['sceai', 'SCEAI', 'Supreme Council for Economic Affairs and Investment', 1, 'Projects on KAP', 'SC', '#F6E8EC', '#8A1538'], ['econ', 'Economic Affairs', 'Not in this prototype', 0, '', 'EA', 'var(--surface-sunken)', 'var(--text-muted)'], ['sandbox', 'sandbox', 'Not in this prototype', 0, '', 'SB', 'var(--surface-sunken)', 'var(--text-muted)'], ['default', 'Default', 'System project · defaults and service identities', 1, '', 'DF', 'var(--surface-sunken)', 'var(--text-body)']].map(([k, n, d, ok, head, ini, ibg, ifg]) => { const on = k === 'kap' ? isPlat : (!isPlat && curT === k); return { head, n, d, ini, ibg, ifg, icon: on ? CK : null, bg: on ? 'var(--brand-tint)' : 'transparent', set: ok ? pick(k) : () => {}, op: ok ? 1 : 0.5, cur: ok ? 'pointer' : 'default' }; });
    const isDef = !isPlat && curT === 'default';
    out.tenantName = isPlat ? 'KAP' : curT === 'default' ? 'Default' : 'SCEAI';
    out.scopeKind = isPlat ? 'Platform' : 'Project';
    out.scopeIcon = I(isPlat ? 'Layers' : 'FolderOpen', 15);
    out.sid = isPlat ? { kind: 'Platform', n: 'KAP platform', d: 'Shared runtime · 4 projects', ini: 'KAP', bg: '#1F1A1C', fg: '#fff' } : curT === 'default' ? { kind: 'Project on KAP', n: 'Default', d: 'System project', ini: 'DF', bg: 'var(--surface-sunken)', fg: 'var(--text-body)' } : { kind: 'Project on KAP', n: 'SCEAI', d: 'Economic Affairs and Investment', ini: 'SC', bg: '#F6E8EC', fg: '#8A1538' };
    out.isSceai = !isDef; out.isDefault = isDef; out.defEmpty = isDef && sc !== 'home';
    out.toSceai = () => this.setState({ tenant: 'sceai' }); out.goHome = go('home');
    out.toSceaiHome = pick('sceai'); out.goTenants = go('tenants'); out.goTenantsLink = e => { e.preventDefault(); go('tenants')(); };
    const PI = (n) => I(n, 14);
    out.layerProjects = [['SC', 'SCEAI', 'Economic indicators · Ask AI assistant', '8 agents · 14 jobs · 74 chats today', 'var(--success)', 'sceai', '#F6E8EC', '#8A1538'], ['EA', 'Economic Affairs', 'Directorate analytics', '2 agents · 31 jobs today', 'var(--success)', '', 'var(--surface-sunken)', 'var(--text-muted)'], ['SB', 'sandbox', 'AI team experiments · public + confidential', '4 agents · 12 jobs today', 'var(--warning)', '', 'var(--surface-sunken)', 'var(--text-muted)'], ['DF', 'Default', 'System project · defaults', 'No agents', 'var(--success)', 'default', 'var(--surface-sunken)', 'var(--text-body)']].map(([ini, n, d, m, hc, k, ibg, ifg]) => ({ ini, n, d, m, hc, ibg, ifg, go: k ? pick(k) : () => {}, cur: k ? 'pointer' : 'default', bc: k === 'sceai' ? 'var(--brand)' : 'var(--border-subtle)', bg: k === 'sceai' ? '#FCF7F8' : 'var(--surface-card)' }));
    out.layerArrows = [1, 2, 3, 4].map(n => ({ n }));
    out.layerSvcs = [['Model serving', 'vLLM · 6 models · 62% capacity', 'Cpu', 'var(--success)', 'pModels'], ['Queues & workers', 'kap.agent · kap.pipeline · 10 workers', 'Layers', 'var(--warning)', 'pQueues'], ['MCP registry', '1 external server · Oxford degraded', 'Plug', 'var(--warning)', 'pMcp'], ['Identity', 'QDI sign-in · AI team admins', 'Shield', 'var(--success)', 'pUsers'], ['Audit', 'Platform and project events', 'History', 'var(--success)', 'pAudit']].map(([n, d, icn, hc, k]) => ({ n, d, hc, icon: PI(icn), go: go(k) }));
    out.pKpi = [['Projects', '4', '3 active · 1 system', 'var(--text-strong)'], ['Agents', '14', 'Across all projects', 'var(--text-strong)'], ['Jobs today', '57', 'All projects', 'var(--text-strong)'], ['Success rate · 7 d', '86.2%', 'All projects', 'var(--text-strong)'], ['Model capacity', '62%', 'Peak 81% at 10:00', 'var(--text-strong)'], ['Shared services', '2 degraded', 'Oxford MCP, kap.agent', 'var(--warning-fg)']].map(([k, v, d, c]) => ({ k, v, d, c }));
    out.pProjects = [['SCEAI', 'Supreme Council for Economic Affairs and Investment', '8', '14', '84.8%', '3 / 3', 100, 'var(--warning)', 'hold', 'At limit', 'sceai'], ['Economic Affairs', 'Economic Affairs directorate', '2', '31', '91.0%', '1 / 3', 33, 'var(--brand)', 'approved', 'Healthy', ''], ['sandbox', 'AI team sandbox', '4', '12', '78.4%', '2 / 4', 50, 'var(--brand)', 'hold', 'Degraded', ''], ['Default', 'System project', '0', '0', '—', '0 / 0', 0, 'var(--brand)', 'approved', 'Healthy', 'default']].map(([n, d, a, j, s, q, qp, qc, hp, hl, k]) => ({ n, d, a, j, s, q, qp, qc, hp, hl, go: k ? pick(k) : () => {}, cur: k ? 'pointer' : 'default' }));
    out.pAlerts = [[W, 'var(--warning)', 'SCEAI is at its kap.agent limit', '3 / 3 in flight · 1 job waiting', '4 min ago'], [W, 'var(--warning)', 'Oxford MCP degraded', 'Used by SCEAI · 2 × 502 in 24 h', '18 min ago'], [W, 'var(--warning)', 'sandbox: confidential collection re-index slow', 'kap.pipeline · 41 min elapsed', '1 h ago'], [CK, 'var(--success)', 'vLLM node gpu-03 back in service', 'Capacity restored to 4 nodes', '3 h ago']].map(([icon, c, t, m, w]) => ({ icon, c, t, m, w }));
    {
      const PR = [['SC', 'SCEAI', 'Economic Affairs and Investment', 'Busy', 'var(--warning)', 'var(--warning-bg)', [['8', 'agents'], ['558', 'requests'], ['84.8%', 'success']], '3 / 3', 100, 'var(--warning)', '#F6E8EC', '#8A1538', '#8A1538', 'sceai'], ['EA', 'Economic Affairs', 'Directorate analytics', 'Healthy', 'var(--success-fg)', 'var(--success-bg)', [['2', 'agents'], ['412', 'requests'], ['91.0%', 'success']], '1 / 3', 33, 'var(--success)', 'var(--sand-tint)', 'var(--sand-ink)', '#C8B49A', ''], ['SB', 'sandbox', 'AI team experiments', 'Degraded', 'var(--warning-fg)', 'var(--warning-bg)', [['4', 'agents'], ['270', 'requests'], ['78.4%', 'success']], '2 / 4', 50, 'var(--success)', 'var(--teal-tint)', '#0F766E', '#0F766E', ''], ['DF', 'Default', 'System project · defaults', 'Healthy', 'var(--success-fg)', 'var(--success-bg)', [['0', 'agents'], ['0', 'requests'], ['—', 'success']], '0 / 0', 0, 'var(--success)', 'var(--surface-sunken)', 'var(--text-body)', '#A8A0A3', 'default']];
      out.plProj = PR.map(([ini, n, d, hh, hc, hbg, m, q, qp, qc, ibg, ifg, ac, k]) => ({ ini, n, d, h: hh, hc, hbg, m: m.map(([v, kk]) => ({ v, k: kk })), q, qp, qc, ibg, ifg, ac, go: k ? pick(k) : () => {}, cur: k ? 'pointer' : 'default', op: 1 }));
      const SER = [['SCEAI', '#8A1538', [64, 67, 50, 75, 82, 88, 82]], ['Economic Affairs', '#C8B49A', [55, 61, 48, 60, 63, 66, 59]], ['sandbox', '#0F766E', [30, 42, 26, 38, 44, 51, 39]]];
      const X = i => (i * 560 / 6), mx = 210, Y = v => 156 - v / mx * 146;
      let base = [0, 0, 0, 0, 0, 0, 0];
      out.plSeries = SER.map(([n, c, v]) => { const top = v.map((x, i) => base[i] + x); const d = 'M' + top.map((t, i) => X(i).toFixed(1) + ',' + Y(t).toFixed(1)).join(' L') + ' L' + base.map((t, i) => [X(i).toFixed(1), Y(t).toFixed(1)]).reverse().map(p => p.join(',')).join(' L') + ' Z'; base = top; return { n, c, area: d, op: n === 'SCEAI' ? 0.85 : 0.7 }; });
      out.plGrid = [50, 100, 150, 200].map(v => Y(v).toFixed(1));
      out.plDays = ['Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Today'];
      out.plCap = (182.2 * 0.62).toFixed(1) + ' 182.2';
      out.plModels = [['Qwen2.5-72B', 71], ['Qwen2.5-7B', 58], ['Qwen2.5-14B', 22], ['embeddings', 44]].map(([n, p]) => ({ n, p }));
      out.plSucc = [['Economic Affairs', '91.0%', 91, 'var(--success)'], ['SCEAI', '84.8%', 84.8, 'var(--warning)'], ['sandbox', '78.4%', 78.4, 'var(--warning)']].map(([n, v, w, c]) => ({ n, v, w, c }));
      const spk = arr => { const mx2 = Math.max(...arr), mn = Math.min(...arr); return arr.map((v, i) => (i * 100 / (arr.length - 1)).toFixed(1) + ',' + (22 - (v - mn) / ((mx2 - mn) || 1) * 20).toFixed(1)).join(' '); };
      out.plSvc = [['Model serving', '62%', 'capacity', 'Healthy', 'var(--success)', 'var(--success-fg)', '6 models · 4 GPUs', 'Cpu', 'pModels', [48, 55, 60, 72, 81, 66, 62]], ['Queues & workers', '8/10', 'workers busy', 'Busy', 'var(--warning)', 'var(--warning-fg)', 'SCEAI at limit', 'Layers', 'pQueues', [4, 5, 7, 6, 8, 9, 8]], ['MCP registry', '16%', 'Oxford errors', 'Degraded', 'var(--warning)', 'var(--warning-fg)', 'p95 2.6 s', 'Plug', 'pMcp', [4, 6, 5, 12, 9, 18, 16]], ['Identity', '23', 'active users', 'Healthy', 'var(--success)', 'var(--success-fg)', 'QDI sign-in', 'Shield', 'pUsers', [18, 21, 9, 7, 22, 24, 23]], ['Audit', '1,982', 'events · 7 d', 'Healthy', 'var(--success)', 'var(--success-fg)', 'retention 1 y', 'History', 'pAudit', [240, 310, 120, 90, 330, 420, 472]]].map(([n, m, ml, s, c, tc, d, icn, g, sp]) => ({ n, m, ml, s, c, tc, d, icon: I(icn, 14), go: go(g), sp: spk(sp) }));
      out.plAlerts = [['warning', 'var(--warning)', 'var(--warning-bg)', ['TriangleAlert', 'AlertTriangle'], 'SCEAI', 'SCEAI is at its kap.agent limit', '3 of 3 in flight with 1 waiting. Consider raising the limit to 4.', '4 min ago', 1], ['warning', 'var(--warning)', 'var(--warning-bg)', ['TriangleAlert', 'AlertTriangle'], 'MCP registry', 'Oxford Economics MCP degraded', 'Used by SCEAI. 2 × 502 in the last 24 hours.', '18 min ago', 1], ['warning', 'var(--warning)', 'var(--warning-bg)', ['TriangleAlert', 'AlertTriangle'], 'sandbox', 'Confidential collection re-index is slow', 'kap.pipeline run has taken 41 minutes so far.', '1 h ago', 1], ['resolved', 'var(--success)', 'var(--success-bg)', ['CircleCheck', 'CheckCircle'], 'Model serving', 'gpu-03 back in service', 'Capacity restored to 4 GPUs.', '3 h ago', 0.7]].map(([sev, c, bg, icn, scope, t, d, when, op]) => ({ sev, c, bg, icon: I(icn, 17), scope, t, d, when, op }));
      out.plProj.forEach(p => { p.qbar = p.qp >= 100 ? 'var(--warning)' : '#8A1538'; });
      out.plSvc.forEach(x => { x.hc2 = x.s === 'Healthy' ? 'var(--success)' : 'var(--warning)'; x.tc = x.s === 'Healthy' ? 'var(--success-fg)' : 'var(--warning-fg)'; });
      out.plLegend = [['SCEAI', '#8A1538', '508', '45%', '+21%', 'var(--success-fg)'], ['Economic Affairs', '#C8B49A', '412', '36%', '+6%', 'var(--success-fg)'], ['sandbox', '#0F766E', '270', '19%', '−4%', 'var(--text-muted)']].map(([n, c, v, s, d, dc]) => ({ n, c, v, s, d, dc }));
      { const D = [['SCEAI', '#8A1538', [64, 67, 50, 75, 82, 88, 82], '+21%', 'var(--success-fg)', 'var(--success-bg)', 'sceai', '45%'], ['Economic Affairs', '#C8B49A', [55, 61, 48, 60, 63, 66, 59], '+6%', 'var(--success-fg)', 'var(--success-bg)', '', '36%'], ['sandbox', '#0F766E', [30, 42, 26, 38, 44, 51, 39], '−4%', 'var(--text-muted)', 'var(--surface-sunken)', '', '19%']];
        const L = ['Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Today'];
        out.plMulti = D.map(([n, c, v, d, dc, dbg, k, s]) => { const mx = 100, bw = 240 / 7, tot = v.reduce((x, y) => x + y, 0), avg = Math.round(tot / 7), pi = v.indexOf(Math.max(...v));
          return { n, c, d, dc, dbg, s, v: String(tot), avg, pk: v[pi], pd: L[pi], go: k ? pick(k) : () => {}, cur: k ? 'pointer' : 'default', avgY: (78 - avg / mx * 74).toFixed(1),
            bars: v.map((x, i) => ({ x: (i * bw + bw * 0.18).toFixed(1), w: (bw * 0.64).toFixed(1), y: (78 - x / mx * 74).toFixed(1), h: (x / mx * 74).toFixed(1), c: i === 6 ? c : c, op: 1 })).map((b, i) => ({ ...b, c: i === 6 ? c : c + '99' })) }; }); }
      out.plProj.forEach((p, i) => { p.dot = ['#D69A3A', '#3FA574', '#D69A3A', '#3FA574'][i]; p.qc = p.qp >= 100 ? '#D69A3A' : '#C8B49A'; });
      out.plSvc.forEach(x => { x.lc = x.s === 'Healthy' ? '#7CCFA2' : '#E8B866'; x.c = x.s === 'Healthy' ? '#3FA574' : '#D69A3A'; });
      out.plQCols = ['kap.agent in flight', 'Model tokens · month', 'Storage', 'Users'];
      const QC = p => p >= 95 ? 'var(--danger)' : p >= 75 ? 'var(--warning)' : '#8A1538';
      out.plQuota = [['SCEAI', [['3 / 3', 100], ['41.2M / 60M', 69], ['3.1 / 10 GB', 31], ['14 / 50', 28]], 'sceai'], ['Economic Affairs', [['1 / 3', 33], ['22.8M / 40M', 57], ['1.4 / 10 GB', 14], ['9 / 50', 18]], ''], ['sandbox', [['2 / 4', 50], ['18.9M / 20M', 95], ['6.2 / 8 GB', 78], ['6 / 10', 60]], ''], ['Default', [['0 / 0', 0], ['0 / —', 0], ['0.1 / 1 GB', 10], ['3 / 5', 60]], 'default']].map(([n, cells, k]) => ({ n, go: k ? pick(k) : () => {}, cur: k ? 'pointer' : 'default', cells: cells.map(([v, p]) => ({ v, p, c: QC(p) })) }));
      out.plTimeline = [['4 min', 'var(--warning)', 'SCEAI reached its kap.agent limit', '3 of 3 in flight, 1 waiting'], ['18 min', 'var(--warning)', 'Oxford Economics MCP degraded', '2 × 502 in 24 h · used by SCEAI'], ['1 h', 'var(--warning)', 'sandbox re-index running long', 'kap.pipeline · 41 min elapsed'], ['3 h', 'var(--success)', 'gpu-03 returned to the model pool', 'Capacity back to 4 GPUs · m.alkuwari'], ['2 d', '#8C8487', 'kap.agent workers raised 6 → 8', 'r.haddad'], ['31 d', '#8C8487', 'Project sandbox created', 'm.alkuwari']].map(([w, c, t, d]) => ({ w, c, t, d }));
    }
    const LBL = { map: 'agents', live: 'running jobs', trace: 'traces', convs: 'conversations', conv: 'conversations', feedback: 'feedback', catalogue: 'catalogue indicators', agents: 'agents', agent: 'agents', wizard: 'agents', providers: 'tenant-specific model providers', mcp: 'MCP servers', collections: 'collections', connectors: 'connectors', pipelines: 'pipelines', indicators: 'indicators', packages: 'ingest packages', jobs: 'agent jobs', ingest: 'ingestion jobs', users: 'human users', groups: 'groups', roles: 'custom roles', grants: 'access grants', tokens: 'API tokens', audit: 'audit events this week', configs: 'configuration versions', reports: 'scheduled reports', settings: 'tenant settings' };
    out.defLabel = LBL[sc] || 'resources';
    out.defKpi = [['Users', '3', 'Service identities only'], ['Agents', '0', 'System project'], ['Collections', '0', 'System project'], ['Jobs today', '0', 'No jobs run here'], ['Tenants using defaults', '3', 'SCEAI, Economic Affairs, sandbox']].map(([k, v, d]) => ({ k, v, d }));
    out.defUsers = [['kap_system', 'Platform service · migrations and health checks', '2 min ago'], ['kap_scheduler', 'Runs scheduled reports and pipeline triggers', '6 h ago'], ['kap_ingest_svc', 'Executes ingestion on kap.pipeline', '6 h ago']].map(([n, d, last]) => ({ n, d, last }));
    out.defModels = [['agent_default', 'Qwen2.5-32B-Instruct · chat with tool calling'], ['embed_default', 'qwen3-embedding · 1024-d'], ['chat_default', 'Qwen2.5-14B-Instruct · chat']].map(([n, d]) => ({ n, d }));
    out.defQueues = [['kap.agent · max in-flight', '3'], ['kap.agent · task priority', '3'], ['kap.pipeline · max in-flight', '2'], ['Job timeout', '180 s'], ['Tool-call limit', '15'], ['Request limit', '20']].map(([k, v]) => ({ k, v }));
    out.defTenants = [['SCEAI', 'Supreme Council for Economic Affairs and Investment', 'Created 142 d ago', 1], ['Economic Affairs', 'Economic Affairs directorate', 'Created 118 d ago', 0], ['sandbox', 'AI team sandbox', 'Created 31 d ago', 0]].map(([n, d, when, ok]) => ({ n, d, when, go: ok ? () => this.setState({ tenant: 'sceai', screen: 'home' }) : () => {}, cur: ok ? 'pointer' : 'default' }));
    out.createMenu = [['Agent', 'wizard', 'Bot', 'Guided wizard'], ['Collection', 'collections', 'Database', ''], ['Connector', 'connectors', ['Cable', 'Link'], ''], ['Pipeline', 'pipelines', 'Workflow', ''], ['User', 'users', 'User', ''], ['API token', 'tokens', 'Key', ''], ['Project', 'tenants', 'Building2', 'AI team']].map(([n, k, icn, kk]) => ({ n, k: kk, icon: I(icn, 15), go: go(k) }));
    out.bellItems = [[X, 'var(--danger)', 'Job 5d2e0a71 exceeded the 180 s timeout', 'sceai_indicators_oxford · 2 h ago'], [W, 'var(--warning)', 'Oxford MCP degraded', '2 errors (502) in the last 24 h · 18 min ago'], [X, 'var(--danger)', 'Job b1c94f08 reached the tool-call limit', 'sceai_indicators_agent · 5 h ago'], [W, 'var(--warning)', 'docs_docx_ingest skipped 1 file', 'run 87 · 1 d ago']].map(([icon, c, t, m]) => ({ icon, c, t, m }));
    const pal = [['Actions', 'Create agent', '', 'Plus', 'wizard', 'Action'], [0, 'Go to Agent jobs', '', 'ListChecks', 'jobs', 'Action'], [0, 'Open agents map', '', 'Network', 'map', 'Action'], ['Resources', 'sceai_indicators_oxford', 'Agent · planner_and_executor', 'Bot', 'agent', 'Agent'], [0, 'sceai_indicators_agent', 'Agent · planner_and_executor', 'Bot', 'agent', 'Agent'], [0, 'sceai_indicators', 'Collection · 8,104 observations', 'Database', 'collections', 'Collection'], [0, 'sceai_analyst', 'User · analyst', 'User', 'users', 'User'], [0, 'sceai_admin', 'User · administrator', 'User', 'users', 'User'], ['Recent jobs', '93c7a1f2…', 'sceai_indicators_oxford · tourism contribution to GDP, Q4 2024', ['Waypoints', 'GitBranch'], 'trace', 'Job']];
    out.palItems = pal.map(([head, n, d, icn, k, kk], i) => ({ head: head || '', n, d, k: kk, icon: I(icn, 15), go: go(k), bg: i === 0 ? 'var(--brand-tint)' : 'transparent', f: kk === 'Action' ? 'var(--font-sans)' : 'var(--font-mono)' }));

    const seg = (n, err) => [0, 1, 2, 3].map(i => ({ c: n >= 4 ? 'var(--success)' : i < n ? 'var(--brand)' : i === n ? (err ? 'var(--danger)' : 'var(--info)') : 'var(--border-subtle)' }));
    out.liveRows = [
      ['running', 'Running', 'sceai_analyst', 'sceai_indicators_oxford', 'What was the tourism sector contribution to GDP in Q4 2024, and how does it compare with the target?', 'Calling tools', 'EconomicData', '4 / 15 tool calls', '6.1 s', 3.4, 2, 0, 'now'],
      ['running', 'Running', 'dashboards-svc', 'sceai_indicators_agent', 'What is the strategic food reserve coverage for 2024?', 'Calling tools', 'find_indicator', '1 / 15 tool calls', '2.4 s', 1.3, 2, 0, 'now'],
      ['running', 'Running', 'sceai_admin', 'sceai_indicators_agent', 'Which indicators moved the most in Q4 2024?', 'Planning', 'plan · agent_default', '0 / 15 tool calls', '1.2 s', .7, 1, 0, 'now'],
      ['waiting', 'Waiting', 'sceai_analyst', 'sceai_indicators_oxford', 'Compare the recent tourism trend with the Oxford Economics outlook for Qatar.', 'Queued', 'Waiting for a slot · 3 / 3', '—', '4.0 s', 2.2, 0, 0, 'now'],
      ['succeeded', 'Succeeded', 'sceai_analyst', 'sceai_indicators_oxford', 'Compare the recent tourism trend with the Oxford Economics outlook for Qatar.', 'Done', 'Answer returned', '3 / 15 tool calls', '10.2 s', 5.7, 4, 0, '40 s ago'],
      ['failed', 'Failed', 'dashboards-svc', 'sceai_indicators_oxford', 'Add wider GDP context to the tourism contribution figure.', 'Failed while calling tools', 'EconomicData · 502', '3 / 15 tool calls', '14.6 s', 8.1, 2, 1, '2 min ago']
    ].map(([s, pl, user, agent, q, phase, step, calls, el, pct, n, err, when]) => ({ p: PS[s], pl, user, agent, q, phase, step, calls, el, pct, when, segs: seg(n, err), bar: err ? 'var(--danger)' : 'var(--brand)' }));
    out.queues = [
      { name: 'kap.agent', note: 'Agent jobs · priority 3 · tenant limit 3 in flight', depth: '1', inflight: '3', max: '3', pct: 100, bar: 'var(--warning)', pill: 'hold', pl: 'At limit' },
      { name: 'kap.pipeline', note: 'Ingestion runs · last run 6 h ago', depth: '0', inflight: '0', max: '2', pct: 0, bar: 'var(--brand)', pill: 'approved', pl: 'Idle' }
    ];
    out.agentRows = [
      ['sceai_indicators_agent', 'Local indicator data and planning documents only', 'planner_and_executor', 'Indicator agents · jobs', 'Qwen2.5-72B', 'sceai_indicators', '12', 'No', 'neutral', '5', '89.7%'],
      ['sceai_indicators_oxford', 'Local data with Oxford Economics context', 'planner_and_executor', 'Indicator agents · jobs', 'Qwen2.5-72B', 'sceai_indicators', '14', 'Yes', 'info', '9', '76.2%'],
      ['Intent Agent', 'Question → indicator, countries, periods, computation type', 'pipeline · understand', 'Ask AI · chat', 'Qwen2.5-7B', '—', '—', 'No', 'neutral', '74', '99.6%'],
      ['Indicator Picker', 'Fallback · picks a catalogue name or NONE', 'pipeline · resolve', 'Ask AI · chat', 'Qwen2.5-72B', 'Catalogue', '—', 'No', 'neutral', '5', '96.8%'],
      ['Composer Agent', 'Writes the numeric answer from computed facts', 'pipeline · compose', 'Ask AI · chat', 'Qwen2.5-72B', '—', '—', 'No', 'neutral', '57', '97.9%'],
      ['Article Agent', 'Answers from retrieved article passages', 'pipeline · compose', 'Ask AI · chat', 'Qwen2.5-72B', 'SCEAI articles', '—', 'No', 'neutral', '13', '98.9%'],
      ['Follow-up Agent', 'Suggests up to 3 next questions', 'pipeline · side agent', 'Ask AI · chat', 'Qwen2.5-7B', '—', '—', 'No', 'neutral', '69', '99.4%'],
      ['Reader Agent', '"Read this for me" in plain language', 'pipeline · side agent', 'Ask AI · chat', 'Qwen2.5-72B', '—', '—', 'No', 'neutral', '6', '100%']
    ].map(([name, desc, type, group, model, coll, tools, ox, oxT, jobs, rate]) => ({ name, desc, type, group, model, coll, tools, ox, oxT, jobs, rate }));
    out.mcpTools = [['EconomicData', 'Public macro data series by country and indicator', 'sceai_indicators_oxford', '15', '20%', '2.6 s'], ['EconomicAnalysis', 'Forecasts and narrative analysis', 'sceai_indicators_oxford', '4', '0%', '3.3 s']].map(([n, d, used, calls, err, p95]) => ({ n, d, used, calls, err, p95, ec: err === '0%' ? 'var(--text-body)' : 'var(--danger-fg)' }));
    const BI = [['find_indicator', 'local', 41, '0%', 'Resolve an indicator by name, alias or code'], ['get_indicator_value', 'local', 33, '0%', 'Actual value for an indicator and period'], ['actual_vs_target', 'local', 27, '0%', 'Compare actual against target'], ['get_time_series', 'local', 14, '0%', 'Observations over a period range'], ['get_change', 'local', 6, '0%', 'Change between two periods'], ['compare_indicators', 'local', 3, '0%', 'Side-by-side comparison'], ['top_movers', 'local', 6, '0%', 'Largest positive and negative changes'], ['get_status', 'local', 4, '0%', 'On-track / off-track by target'], ['get_narratives', 'local', 11, '0%', 'Narrative commentary'], ['get_achievements', 'local', 2, '0%', 'Recorded achievements for a theme'], ['query_indicators', 'local', 21, '4.8%', 'Structured filter over the catalogue'], ['hybrid_search', 'docs', 12, '0%', 'Semantic + keyword search over Word documents']];
    out.builtin = BI.map(([n, s, calls, err, d]) => ({ n, d, calls, err, src: s === 'local' ? 'Local data' : 'Documents', c: s === 'local' ? '#8A1538' : '#C8B49A', ec: err === '0%' ? 'var(--text-muted)' : 'var(--warning-fg)' }));
    out.builtinAll = out.builtin.concat([{ n: 'EconomicData', d: 'Oxford MCP · public macro data', calls: 15, err: '20%', src: 'Oxford (external)', c: '#0F766E', ec: 'var(--danger-fg)' }, { n: 'EconomicAnalysis', d: 'Oxford MCP · forecasts and analysis', calls: 4, err: '0%', src: 'Oxford (external)', c: '#0F766E', ec: 'var(--text-muted)' }]);
    out.collTabs = [{ value: 'overview', label: 'Overview' }, { value: 'items', label: 'Items', badge: '8,104' }, { value: 'files', label: 'Source files & versions', badge: 6 }, { value: 'lineage', label: 'Lineage' }, { value: 'access', label: 'Access' }];
    out.files = [['sceai_indicators_quarterly.csv', 'CSV', 'v14', '14', '2,316 rows', '6 h ago', 'approved', 'Ingested'], ['sceai_indicators_monthly.csv', 'CSV', 'v31', '31', '4,920 rows', '6 h ago', 'approved', 'Ingested'], ['sceai_indicators_annual.csv', 'CSV', 'v6', '6', '868 rows', '6 h ago', 'approved', 'Ingested'], ['NDS2_Economic_Diversification.docx', 'DOCX', 'v2', '2', '96 chunks', '1 d ago', 'approved', 'Ingested'], ['SCEAI_Annual_Review_2024.docx', 'DOCX', 'v3', '3', '142 chunks', '1 d ago', 'approved', 'Ingested'], ['SCEAI_Annual_Review_draft.docx', 'DOCX', 'v1', '1', '—', '1 d ago', 'rejected', 'Parse failed']].map(([n, t, v, vs, rows, when, p, pl]) => ({ n, t, v, vs, rows, when, p, pl, c: t === 'CSV' ? '#8A1538' : '#C8B49A' }));
    out.indList = [['Sector Contribution to GDP (Tourism)', 'IND-TOU-014', 'Quarterly', 1], ['Consumer Price Inflation (YoY)', 'IND-PRC-002', 'Monthly', 0], ['Non-Hydrocarbon Exports (share of total exports)', 'IND-TRD-031', 'Annual', 0], ['Strategic Food Reserve Coverage', 'IND-FDS-007', 'Annual', 0], ['Labour Force Participation Rate', 'IND-LAB-022', 'Quarterly', 0], ['Re-export Value Growth', 'IND-TRD-019', 'Quarterly', 0]].map(([n, code, f, on]) => ({ n, code, f, bg: on ? 'var(--brand-tint)' : 'transparent', fg: on ? 'var(--brand-strong)' : 'var(--text-strong)' }));
    const act = [6.4, 6.7, 7.0, 6.9, 7.2, 7.4, 7.7, 8.8], tgt = [7.0, 7.0, 7.0, 7.0, 7.6, 7.6, 7.6, 7.6];
    const qs = ['Q1 23', 'Q2 23', 'Q3 23', 'Q4 23', 'Q1 24', 'Q2 24', 'Q3 24', 'Q4 24'];
    const Xp = i => 60 + i * 76, Yp = v => (180 - (v - 6) / 3.5 * 165).toFixed(1);
    out.indAct = act.map((v, i) => Xp(i) + ',' + Yp(v)).join(' ');
    out.indTgt = tgt.map((v, i) => Xp(i) + ',' + Yp(v)).join(' ');
    out.indDots = act.map((v, i) => ({ x: Xp(i), y: Yp(v), q: qs[i] }));
    out.gridY = [6, 7, 8, 9].map(v => ({ y: Yp(v), ly: (+Yp(v) + 4).toFixed(1), l: v + '%' }));
    out.obs = act.map((a, i) => { const t = tgt[i], g = a - t, up = g >= 0; return { period: qs[i].replace(' ', ' 20'), a: a.toFixed(1) + '%', t: t.toFixed(1) + '%', gap: (up ? '+' : '−') + Math.abs(g).toFixed(1) + ' pp', gc: up ? 'var(--success-fg)' : 'var(--danger-fg)', tone: up ? 'success' : 'danger', st: up ? 'Above target' : 'Below target', src: 'quarterly.csv · ' + (2207 + i) }; }).reverse();
    const OK = I('Check', 10), BAD = I('X', 10), WRN = I('Minus', 10);
    const stp = (arr) => arr.map(([n, d, m, s], i) => ({ n, d, m, arrow: i < arr.length - 1, icon: s === 'ok' ? OK : s === 'bad' ? BAD : WRN, dc: s === 'ok' ? 'var(--success)' : s === 'bad' ? 'var(--danger)' : 'var(--warning)', bc: s === 'warn' ? 'var(--warning-border)' : 'var(--border-subtle)', bg: s === 'warn' ? 'var(--warning-bg)' : 'var(--surface-card)', mc: s === 'warn' ? 'var(--warning-fg)' : 'var(--text-muted)' }));
    const hist = s => s.split('').map(ch => ({ c: ch === 'o' ? 'var(--success)' : ch === 'f' ? 'var(--danger)' : 'var(--warning)', t: ch === 'o' ? 'Succeeded' : ch === 'f' ? 'Failed' : 'Partial' }));
    out.pipeKpi = [['Pipelines', '2', '1 scheduled · 1 on upload', 'var(--text-strong)'], ['Runs · 7 d', '9', '7 succeeded', 'var(--text-strong)'], ['Rows ingested · 7 d', '32,310', '+ 814 doc chunks', 'var(--text-strong)'], ['Success rate', '88.9%', '1 failed · 1 partial', 'var(--text-strong)'], ['kap.pipeline', '0 / 2', 'In flight · idle', 'var(--text-strong)']].map(([k, v, d, c]) => ({ k, v, d, c }));
    out.pipes = [
      { n: 'indicators_csv_ingest', desc: 'sceai_bucket → sceai_indicators · 3 CSV exports', p: 'approved', pl: 'Succeeded', ibg: '#F6E8EC', ifg: '#8A1538', sched: 'Daily · 02:00 AST', last: '6 h ago · 2 m 41 s', next: 'Tomorrow, 02:00', rows: '8,104 rows · 0 errors', warn: '', hist: hist('ooooofoooooo'),
        steps: stp([['Read', 'sceai_bucket · 3 files', '2.1 MB', 'ok'], ['Parse', 'CSV → rows', '8,104 rows', 'ok'], ['Validate', 'Schema, units, periods', '0 rejected', 'ok'], ['Upsert', 'Indicators DB', '8,104 written', 'ok'], ['Publish', 'sceai_indicators', 'v14 live', 'ok']]) },
      { n: 'docs_docx_ingest', desc: 'sceai_docs → sceai_indicators · Word documents', p: 'hold', pl: 'Partial', ibg: 'var(--sand-tint)', ifg: 'var(--sand-ink)', sched: 'On upload', last: '1 d ago · 4 m 02 s', next: 'When a file is uploaded', rows: '418 chunks · 1 file skipped', warn: 'SCEAI_Annual_Review_draft.docx could not be parsed. Re-upload a clean copy to include it.', hist: hist('oooopoooopoo'),
        steps: stp([['Read', 'sceai_docs · 4 files', '6.8 MB', 'ok'], ['Extract', 'DOCX → text', '3 of 4 files', 'warn'], ['Chunk', '~800 tokens', '418 chunks', 'ok'], ['Embed', 'embed_default · 1024-d', '418 vectors', 'ok'], ['Publish', 'sceai_indicators', 'v3 live', 'ok']]) }
    ];
    const segR = s => s.split('').map(ch => ({ c: ch === 'o' ? 'var(--success)' : ch === 'f' ? 'var(--danger)' : ch === 'w' ? 'var(--warning)' : 'var(--border-subtle)' }));
    out.runs = [['run 412', 'indicators_csv_ingest', 'approved', 'Succeeded', '8,104', '0', '2 m 41 s', 67, 'Schedule', '6 h ago', 'ooooo', ''], ['run 87', 'docs_docx_ingest', 'hold', 'Partial', '418 chunks', '1', '4 m 02 s', 100, 'sceai_admin · upload', '1 d ago', 'owooo', ''], ['run 411', 'indicators_csv_ingest', 'approved', 'Succeeded', '8,051', '0', '2 m 38 s', 65, 'Schedule', '1 d ago', 'ooooo', ''], ['run 410', 'indicators_csv_ingest', 'rejected', 'Failed', '0', '1', '12 s', 5, 'Schedule', '2 d ago', 'oof--', 'Validate: unit "%" missing in 14 rows'], ['run 409', 'indicators_csv_ingest', 'approved', 'Succeeded', '8,051', '0', '2 m 35 s', 64, 'm.alkuwari · manual', '3 d ago', 'ooooo', ''], ['run 86', 'docs_docx_ingest', 'approved', 'Succeeded', '396 chunks', '0', '3 m 47 s', 94, 'sceai_admin · upload', '8 d ago', 'ooooo', '']].map(([id, pipe, p, pl, rows, errs, dur, dp, by, when, sg, why]) => ({ id, pipe, p, pl, rows, errs, dur, dp, by, when, why, segs: segR(sg), ec: errs === '0' ? 'var(--text-muted)' : 'var(--danger-fg)' }));
    out.users = [['sceai_admin', 'SCEAI tenant admin', 'administrator', 'tenant_admins, catalog_readers', '25 min ago', 0], ['sceai_analyst', 'SCEAI analyst', 'analyst', 'catalog_readers', '3 min ago', 1], ['m.alkuwari', 'Mariam Al-Kuwari', 'administrator', 'ai_team', '8 min ago', 0], ['r.haddad', 'Rami Haddad', 'administrator', 'ai_team', '2 h ago', 0], ['j.thomas', 'Julia Thomas', 'viewer', 'ai_team', '3 d ago', 0], ['api:dashboards-svc', 'Dashboards service (token)', 'analyst', 'catalog_readers', '1 min ago', 0]].map(([n, d, role, groups, last, on]) => ({ n, d, role, groups, last, ini: n.replace('api:', '').slice(0, 2).toUpperCase(), tone: role === 'administrator' ? 'brand' : role === 'analyst' ? 'info' : 'neutral', bg: on ? 'var(--brand-tint)' : 'transparent' }));
    out.userTabs = [{ value: 'profile', label: 'Profile' }, { value: 'groups', label: 'Groups', badge: 1 }, { value: 'tokens', label: 'API tokens' }, { value: 'signin', label: 'Sign-in activity' }];
    out.perms = [['agents.run', 'sceai_indicators_agent', 'catalog_readers → analyst'], ['agents.run', 'sceai_indicators_oxford', 'catalog_readers → analyst'], ['jobs.read', 'Own jobs and traces', 'catalog_readers → analyst'], ['collections.read', 'sceai_indicators', 'catalog_readers → viewer']].map(([p, r, via]) => ({ p, r, via }));
    out.signins = [['19 Nov 2026 · 10:38', 'QDI', '10.12.4.21 · Doha', 'approved', 'Success'], ['18 Nov 2026 · 08:02', 'QDI', '10.12.4.21 · Doha', 'approved', 'Success'], ['17 Nov 2026 · 17:45', 'QDI', '10.12.7.3 · Doha', 'rejected', 'Denied']].map(([t, m, ip, p, pl]) => ({ t, m, ip, p, pl }));
    out.gcols = [['Agent', 'sceai_indicators_agent'], ['Agent', 'sceai_indicators_oxford'], ['Collection', 'sceai_indicators'], ['MCP server', 'oxford_economics']].map(([k, n]) => ({ k, n }));
    out.grows = [['tenant_admins', '1 member', ['administrator', 'administrator', 'administrator', 'administrator']], ['catalog_readers', '2 members', ['analyst', 'analyst', 'viewer', '']], ['ai_team', '3 members · platform', ['administrator', 'administrator', 'administrator', 'administrator']]].map(([g, m, cells]) => ({ g, m, cells: cells.map(r => ({ r, has: !!r, none: !r, tone: r === 'administrator' ? 'brand' : r === 'analyst' ? 'info' : 'neutral' })) }));
    const ALL = ['agents.read', 'agents.run', 'agents.write', 'collections.read', 'collections.write', 'jobs.read', 'jobs.cancel', 'users.manage', 'grants.manage', 'tokens.manage'];
    const ck = I('Check', 14), dash = I('Minus', 14);
    const role = (n, g, d, has) => ({ n, g, d, perms: ALL.map(p => { const on = has.includes(p); return { p, icon: on ? ck : dash, c: on ? 'var(--success)' : 'var(--border-strong)', fg: on ? 'var(--text-strong)' : 'var(--text-subtle)' }; }) });
    out.roles = [role('administrator', '3 grants', 'Full control of tenant resources, users, grants and tokens.', ALL), role('analyst', '2 grants', 'Run agents, read jobs, traces and collections.', ['agents.read', 'agents.run', 'collections.read', 'jobs.read']), role('viewer', '1 grant', 'Read-only access to agents and job history.', ['agents.read', 'collections.read', 'jobs.read'])];
    out.tokens = [['dashboards-svc', 'api:dashboards-svc', 'kap_live_7Hq2…', 'in 82 days', '1 min ago', 'approved', 'Active'], ['powerbi-prod', 'sceai_admin', 'kap_live_Rk8v…', 'in 92 days', 'Never', 'approved', 'Active'], ['etl-nightly', 'sceai_admin', 'kap_live_c91X…', 'in 9 days', '6 h ago', 'hold', 'Expires soon'], ['powerbi-test', 'sceai_admin', 'kap_live_Qe04…', 'Expired 3 d ago', '12 d ago', 'rejected', 'Expired']].map(([n, o, pre, exp, used, p, pl]) => ({ n, o, pre, exp, used, p, pl }));
    out.tenantsGo = 1; out.tenants = [['SCEAI', 'Supreme Council for Economic Affairs and Investment', '14', '8', '1', '14', 'approved', 'Healthy', 1], ['Economic Affairs', 'Economic Affairs directorate', '9', '2', '2', '31', 'approved', 'Healthy', 0], ['sandbox', 'AI team sandbox · public + confidential', '6', '4', '3', '12', 'hold', 'Degraded', 0], ['Default', 'System project', '3', '0', '0', '0', 'approved', 'Healthy', 0]].map(([n, d, u, a, c, j, p, pl, on]) => ({ n, d, u, a, c, j, p, pl, go: n === 'SCEAI' ? () => this.setState({ tenant: 'sceai', screen: 'home' }) : n === 'Default' ? () => this.setState({ tenant: 'default', screen: 'home' }) : () => {}, bc: on ? 'var(--brand)' : 'var(--border-subtle)' }));
    out.provision = ['Tenant record sandbox created', 'Queue policy kap.agent · max in-flight 4', 'Queue policy kap.pipeline · max in-flight 2', 'Default model providers linked', 'Groups tenant_admins and catalog_readers created', 'Admin user sbx_admin invited via QDI'];
    out.audit = [
      { when: '2 d ago', abs: '17 Nov 2026 · 14:22', who: 'r.haddad', action: 'updated the configuration of', res: 'sceai_indicators_oxford', meta: 'Agent · v5 → v6', c: 'var(--brand)', open: true, before: '"tools": [ …12 tools, "EconomicData" ]', after: '"tools": [ …12 tools, "EconomicData", "EconomicAnalysis" ]' },
      { when: '6 d ago', abs: '13 Nov 2026 · 09:10', who: 'm.alkuwari', action: 'changed limits on', res: 'sceai_indicators_agent', meta: 'Agent · v3 → v4', c: 'var(--brand)', open: true, before: '"request_limit": 15', after: '"request_limit": 20' },
      { when: '9 d ago', abs: '10 Nov 2026 · 11:47', who: 'sceai_admin', action: 'added sceai_analyst to', res: 'catalog_readers', meta: 'Group membership', c: 'var(--info)', open: false },
      { when: '9 d ago', abs: '10 Nov 2026 · 11:40', who: 'sceai_admin', action: 'created API token for', res: 'dashboards-svc', meta: 'Expires in 90 days', c: 'var(--info)', open: false },
      { when: '12 d ago', abs: '07 Nov 2026 · 02:00', who: 'system', action: 'ran pipeline', res: 'indicators_csv_ingest', meta: '8,051 rows ingested', c: 'var(--text-subtle)', open: false },
      { when: '14 d ago', abs: '05 Nov 2026 · 08:31', who: 'sceai_admin', action: 'signed in with QDI to', res: 'SCEAI', meta: 'Authentication', c: 'var(--text-subtle)', open: false }
    ];
    out.versions = [['v6', 'r.haddad', '2 d ago', 'Added EconomicAnalysis tool', 1], ['v5', 'r.haddad', '9 d ago', 'Raised request limit to 20', 1], ['v4', 'm.alkuwari', '21 d ago', 'Tightened Oxford question template', 0], ['v3', 'm.alkuwari', '33 d ago', 'Added hybrid_search', 0], ['v2', 'r.haddad', '47 d ago', 'Attached sceai_indicators', 0], ['v1', 'r.haddad', '61 d ago', 'Created', 0]].map(([v, by, when, note, on]) => ({ v, by, when, note, bg: on ? 'var(--brand-tint)' : 'transparent' }));
    const L = ['{', '  "name": "sceai_indicators_oxford",', '  "type": "planner_and_executor",', '  "model_provider": "agent_default",', '  "collections": ["sceai_indicators"],', '  "tools": [', '    "find_indicator", "get_indicator_value",', '    "actual_vs_target", "…8 more local tools",', '    "hybrid_search",', '    "EconomicData"', '  ],', '  "limits": {', '    "timeout_seconds": 180,', '    "max_retries": 1,', '    "request_limit": 20,', '    "tool_call_limit": 15,', '    "task_priority": 3,', '    "max_in_flight": 3', '  }', '}'];
    const rows = []; let rn = 0;
    L.forEach((l, i) => {
      if (l === '    "EconomicData"') { rows.push({ ln: i + 1, l, lb: 'var(--danger-bg)', rn: ++rn, r: '    "EconomicData",', rb: 'var(--success-bg)' }); rows.push({ ln: '', l: '', lb: 'var(--surface-sunken)', rn: ++rn, r: '    "EconomicAnalysis"', rb: 'var(--success-bg)' }); }
      else rows.push({ ln: i + 1, l, lb: 'transparent', rn: ++rn, r: l, rb: 'transparent' });
    });
    out.diffRows = rows;
    const col = t => /^\s*"[^"]+":/.test(t) ? 'var(--text-body)' : 'var(--text-body)';
    const toLines = arr => arr.map((t, i) => ({ n: i + 1, t, c: /^\s*[{}\[\]],?$/.test(t) ? 'var(--text-muted)' : /":\s*"/.test(t) ? '#0F766E' : /":\s*[\d-]/.test(t) ? '#2B6CB0' : 'var(--text-body)' }));
    out.cfgLines = toLines(rows.map(r => r.r));
    out.rawLines = toLines(['{', '  "id": "93c7a1f2-6e0b-4c1d-9a7e-2f5b8d0c3e41",', '  "tenant": "sceai",', '  "agent": "sceai_indicators_oxford",', '  "user": "sceai_analyst",', '  "queue": "kap.agent",', '  "status": "succeeded",', '  "retries": 0,', '  "duration_ms": 9814,', '  "model_requests": 3,', '  "tool_calls": 4,', '  "user_prompt": "What was the tourism sector contribution to GDP in Q4 2024…",', '  "spans": [', '    { "name": "queued", "start_ms": 0, "duration_ms": 806 },', '    { "name": "plan", "kind": "model", "start_ms": 820, "duration_ms": 2204 },', '    { "name": "find_indicator", "kind": "tool", "start_ms": 3050, "duration_ms": 310 },', '    { "name": "get_indicator_value", "kind": "tool", "start_ms": 3400, "duration_ms": 180 },', '    { "name": "plan (step 2)", "kind": "model", "start_ms": 3620, "duration_ms": 1300 },', '    { "name": "actual_vs_target", "kind": "tool", "start_ms": 4950, "duration_ms": 150 },', '    { "name": "EconomicData", "kind": "mcp", "start_ms": 5130, "duration_ms": 2410 },', '    { "name": "compose answer", "kind": "model", "start_ms": 7580, "duration_ms": 2200 }', '  ],', '  "leak_guard": { "passed": true, "checks": 4 }', '}']);
    out.logs = [['10:42:07.112', 'INFO', 'Job enqueued on kap.agent · priority 3'], ['10:42:07.918', 'INFO', 'Dequeued by worker kap-agent-2 · in flight 3 / 3'], ['10:42:07.940', 'INFO', 'Model call plan · agent_default · 2,846 in / 212 out tokens'], ['10:42:10.161', 'INFO', 'Tool find_indicator called · {"query":"tourism sector contribution to GDP"}'], ['10:42:10.471', 'INFO', 'find_indicator returned in 310 ms · 1 match · IND-TOU-014'], ['10:42:10.520', 'INFO', 'Tool get_indicator_value called · {"period":"2024-Q4"}'], ['10:42:10.700', 'INFO', 'get_indicator_value returned in 180 ms · 8.8 %'], ['10:42:10.740', 'INFO', 'Model call plan (step 2) · 3,746 in / 118 out tokens'], ['10:42:12.070', 'INFO', 'Tool actual_vs_target returned in 150 ms · above_target'], ['10:42:12.240', 'INFO', 'Leak guard checked outbound question · 0 local identifiers'], ['10:42:12.250', 'INFO', 'MCP oxford_economics · EconomicData called'], ['10:42:13.900', 'WARN', 'EconomicData slow response · 1.6 s elapsed (p95 2.6 s)'], ['10:42:14.660', 'INFO', 'EconomicData returned in 2.41 s · 1.56 % y/y'], ['10:42:14.700', 'INFO', 'Model call compose answer · 4,644 in / 286 out tokens'], ['10:42:16.900', 'INFO', 'Answer provenance attached · 2 local refs, 1 external ref'], ['10:42:16.926', 'INFO', 'Job succeeded · 9.8 s · 3 / 20 model requests · 4 / 15 tool calls']].map(([t, lv, m]) => ({ t, lv, m, c: lv === 'WARN' ? 'var(--warning-fg)' : lv === 'ERROR' ? 'var(--danger-fg)' : 'var(--success-fg)' }));
    out.failReasons = [['Oxford MCP 502', 2, 100], ['Timeout (180 s)', 2, 100], ['Tool-call limit', 1, 50], ['Indicator not found', 1, 50]].map(([n, v, w]) => ({ n, v, w }));

    const C = (v, k) => ({ v, f: k === 'm' ? 'var(--font-mono)' : 'var(--font-sans)', col: k === 'mut' ? 'var(--text-muted)' : 'var(--text-body)', fw: k === 'm' ? 500 : 400 });
    const G = {
      providers: ['Model providers', 'LLM and embedding endpoints available to agents and pipelines.', 'Add provider', ['Name', 'Kind', 'Model', 'Endpoint', 'Used by'], [[['agent_default', 'm'], 'Chat · tool calling', 'Qwen2.5-32B-Instruct', ['vllm.kap.internal/v1', 'm'], '2 agents', 'approved', 'Healthy'], [['embed_default', 'm'], 'Embedding', 'qwen3-embedding · 1024-d', ['vllm.kap.internal/embed', 'm'], '1 collection', 'approved', 'Healthy'], [['chat_default', 'm'], 'Chat', 'Qwen2.5-14B-Instruct', ['vllm.kap.internal/v1', 'm'], 'Chat UI', 'approved', 'Healthy']]],
      connectors: ['Connectors', 'Where source data is read from. Credentials are stored masked.', 'Create connector', ['Name', 'Type', 'Location', 'Credentials', 'Last sync'], [[['sceai_bucket', 'm'], 'Bucket · CSV', ['s3://sceai-indicators/exports/', 'm'], ['AKIA••••••••7Q2F', 'm'], '6 h ago', 'approved', 'Healthy'], [['sceai_docs', 'm'], 'Bucket · DOCX', ['s3://sceai-indicators/docs/', 'm'], ['AKIA••••••••7Q2F', 'm'], '1 d ago', 'approved', 'Healthy']]],
      packages: ['Ingest packages', 'Versioned bundles of source files submitted for ingestion.', 'Upload package', ['Package', 'Files', 'Collection', 'Submitted by', 'Submitted'], [[['pkg_2024Q4_indicators', 'm'], '3 CSV', ['sceai_indicators', 'm'], 'sceai_admin', '6 h ago', 'approved', 'Ingested'], [['pkg_docs_annual_review', 'm'], '4 DOCX', ['sceai_indicators', 'm'], 'sceai_admin', '1 d ago', 'hold', 'Partial'], [['pkg_2024Q3_indicators', 'm'], '3 CSV', ['sceai_indicators', 'm'], 'sceai_admin', '92 d ago', 'approved', 'Ingested']]],
      ingest: ['Ingestion jobs', 'Pipeline runs on the kap.pipeline queue.', 'Run pipeline', ['Run', 'Pipeline', 'Rows', 'Duration', 'Started'], [[['run 412', 'm'], ['indicators_csv_ingest', 'm'], '8,104', '2 m 41 s', '6 h ago', 'approved', 'Succeeded'], [['run 87', 'm'], ['docs_docx_ingest', 'm'], '418 chunks · 1 skipped', '4 m 02 s', '1 d ago', 'hold', 'Partial'], [['run 411', 'm'], ['indicators_csv_ingest', 'm'], '8,051', '2 m 38 s', '1 d ago', 'approved', 'Succeeded'], [['run 410', 'm'], ['indicators_csv_ingest', 'm'], '0', '12 s', '2 d ago', 'rejected', 'Failed']]],
      groups: ['Groups', 'Groups receive grants. Users inherit access through membership.', 'Create group', ['Group', 'Members', 'Grants', 'Created'], [[['tenant_admins', 'm'], 'sceai_admin', 'administrator on all SCEAI resources', '142 d ago', 'approved', 'Active'], [['catalog_readers', 'm'], 'sceai_analyst, api:dashboards-svc', 'analyst on 2 agents · viewer on sceai_indicators', '140 d ago', 'approved', 'Active'], [['ai_team', 'm'], 'm.alkuwari, r.haddad, j.thomas', 'administrator (platform)', 'System', 'approved', 'Active']]],
      settings: ['Project settings', 'Queue limits and defaults for the SCEAI project. Platform-wide limits are set under KAP platform.', 'Edit settings', ['Setting', 'Value', 'Changed by', 'Changed'], [['kap.agent · max in-flight', ['3', 'm'], 'm.alkuwari', '61 d ago', 'approved', 'Applied'], ['kap.agent · task priority', ['3', 'm'], 'm.alkuwari', '61 d ago', 'approved', 'Applied'], ['kap.pipeline · max in-flight', ['2', 'm'], 'm.alkuwari', '61 d ago', 'approved', 'Applied'], ['Default chat model', ['chat_default', 'm'], 'm.alkuwari', '142 d ago', 'approved', 'Applied'], ['Default embedding model', ['embed_default', 'm'], 'm.alkuwari', '142 d ago', 'approved', 'Applied']]]
,
      pModels: ['Model serving', 'Models served by the KAP platform. Projects reference them through their own provider aliases.', 'Add model', ['Model', 'Kind', 'Served on', 'Used by projects', 'Load'], [[['Qwen2.5-72B-Instruct', 'm'], 'Chat · tool calling', 'gpu-01, gpu-02', 'SCEAI (Ask AI)', '38 req/min', 'approved', 'Healthy'], [['Qwen2.5-32B-Instruct', 'm'], 'Chat · tool calling', 'gpu-03', 'SCEAI, Economic Affairs, sandbox', '24 req/min', 'approved', 'Healthy'], [['Qwen2.5-14B-Instruct', 'm'], 'Chat', 'gpu-04', 'All projects', '6 req/min', 'approved', 'Healthy'], [['Qwen2.5-7B-Instruct', 'm'], 'Chat · router', 'gpu-04', 'SCEAI (Ask AI)', '52 req/min', 'approved', 'Healthy'], [['qwen3-embedding', 'm'], 'Embedding · 1024-d', 'gpu-04', 'All projects', '12 req/min', 'approved', 'Healthy'], [['BAAI/bge-m3', 'm'], 'Embedding', 'gpu-04', 'SCEAI (Ask AI)', '71 req/min', 'approved', 'Healthy']]],
      pMcp: ['MCP registry', 'External tool servers registered on the platform. Projects opt in per agent.', 'Register server', ['Server', 'URL', 'Tools', 'Enabled in projects', 'p95'], [[['oxford_economics', 'm'], ['services.oxfordeconomics.com/mcp', 'm'], '2', 'SCEAI', '2.6 s', 'hold', 'Degraded']]],
      pQueues: ['Queues & workers', 'Shared job queues. Each project gets its own in-flight limit on top of platform capacity.', 'Scale workers', ['Queue', 'Workers', 'In flight', 'Waiting', 'Busiest project'], [[['kap.agent', 'm'], '8', '6', '1', 'SCEAI · 3 / 3', 'hold', 'Busy'], [['kap.pipeline', 'm'], '2', '1', '0', 'sandbox · 1 / 2', 'approved', 'Healthy']]],
      pUsers: ['AI team & admins', 'Platform-level users. They can see every project; project admins only see their own.', 'Invite admin', ['User', 'Name', 'Platform role', 'Projects', 'Last sign-in'], [[['m.alkuwari', 'm'], 'Mariam Al-Kuwari', 'platform administrator', 'All', '8 min ago', 'approved', 'Active'], [['r.haddad', 'm'], 'Rami Haddad', 'platform administrator', 'All', '2 h ago', 'approved', 'Active'], [['j.thomas', 'm'], 'Julia Thomas', 'platform viewer', 'All', '3 d ago', 'approved', 'Active']]],
      pAudit: ['Platform audit', 'Platform-level changes. Project changes are in each project’s own audit log.', 'Export', ['When', 'Who', 'Action', 'Scope'], [['3 h ago', ['m.alkuwari', 'm'], 'Returned gpu-03 to the model pool', 'Model serving', 'approved', 'Applied'], ['2 d ago', ['r.haddad', 'm'], 'Raised kap.agent workers 6 → 8', 'Queues', 'approved', 'Applied'], ['31 d ago', ['m.alkuwari', 'm'], 'Created project sandbox', 'Projects', 'approved', 'Applied'], ['61 d ago', ['r.haddad', 'm'], 'Registered oxford_economics MCP server', 'MCP registry', 'approved', 'Applied']]]
    }[sc];
    out.sg = !!G;
    if (G) out.gen = { title: G[0], desc: G[1], btn: G[2], cols: G[3], n: String(G[4].length), rows: G[4].map(r => ({ cells: r.slice(0, -2).map((c, i) => Array.isArray(c) ? C(c[0], c[1]) : C(c, i > 0 && i === r.length - 3 ? 'mut' : '')), p: r[r.length - 2], pl: r[r.length - 1] })) };
    Object.assign(out, this.pipe(I, go), this.reports(I), this.overview(I, go));
    return out;
  }
  renderVals() {
    const I = (n, s) => this.icon([].concat(n), s);
    const ic = {
      panel: I('PanelLeft', 18), building: I('Building2', 15), chev: I('ChevronDown', 14), chevR: I('ChevronRight', 14), chevL: I('ChevronLeft', 14), search: I('Search', 15), plus: I('Plus', 15), bell: I('Bell', 18), help: I(['CircleHelp', 'HelpCircle'], 18),
      warn: I(['TriangleAlert', 'AlertTriangle'], 15), route: I('Route', 15), pause: I('Pause', 14), lock: I('Lock', 13), bot: I('Bot', 18), bot24: I('Bot', 24), x: I('X', 18), arrow: I('ArrowRight', 14), loop: I('Repeat', 12),
      zin: I('ZoomIn', 15), book: I('BookOpen', 24), msg: I('MessageSquare', 14), mail: I('Mail', 14), send: I('Send', 14), xs: I('X', 12), chip: I('Cpu', 14), up: I('ThumbsUp', 14), down: I('ThumbsDown', 15), upload: I('Upload', 14), layers: I('Layers', 15), server: I('Server', 20), zap: I('Zap', 14), db: I('Database', 16), db24: I('Database', 24), info: I('Info', 15), workflow: I('Workflow', 16), download: I('Download', 14), zout: I('ZoomOut', 15), fit: I(['Maximize2', 'Maximize'], 15), layout: I('LayoutGrid', 15), copy: I('Copy', 15), copySm: I('Copy', 12), map: I('Network', 15), rerun: I(['RotateCcw', 'RefreshCw'], 15),
      shield: I('ShieldCheck', 16), check: I('Check', 14), checkSm: I('Check', 12), cols: I(['Columns3', 'Columns'], 15), edit: I('Pencil', 14), flask: I('FlaskConical', 15), more: I(['Ellipsis', 'MoreHorizontal'], 16), play: I('Play', 14)
    };
    const sc = this.state.screen;
    const go = k => (e) => { if (e && e.preventDefault) e.preventDefault(); this.setState({ screen: k, menu: null, palette: false }); const m = document.querySelector('main'); if (m) m.scrollTop = 0; };
    const N = (label, key, icon, screen) => {
      const on = screen === sc || (screen === 'agents' && (sc === 'agent' || sc === 'wizard')) || (screen === 'trace' && sc === 'trace') || (screen === 'convs' && sc === 'conv') || (screen === 'catalogue' && (sc === 'catItem' || sc === 'catPublish'));
      return { label, icon: I(icon, 16), go: go(screen), fg: on ? 'var(--brand)' : 'var(--text-body)', bg: on ? 'var(--brand-tint)' : 'transparent', fw: on ? 600 : 500 };
    };
    const PLAT = new Set(['pHome', 'tenants', 'pModels', 'pMcp', 'pQueues', 'pUsers', 'pAudit']);
    const isPlat = PLAT.has(sc);
    const NG = (label, icon, fn, on) => ({ label, icon: I(icon, 16), go: fn, fg: on ? 'var(--brand)' : 'var(--text-body)', bg: on ? 'var(--brand-tint)' : 'transparent', fw: on ? 600 : 500 });
    const toProj = (t) => () => { this.setState({ tenant: t, screen: 'home', menu: null }); const m = document.querySelector('main'); if (m) m.scrollTop = 0; };
    const nav = isPlat ? [
      { label: 'KAP platform', items: [N('Overview', 0, ['LayoutDashboard', 'House'], 'pHome'), N('Projects', 0, 'Building2', 'tenants')] },
      { label: 'Shared services', items: [N('Model serving', 0, 'Cpu', 'pModels'), N('MCP registry', 0, 'Plug', 'pMcp'), N('Queues & workers', 0, 'Layers', 'pQueues')] },
      { label: 'Platform access', items: [N('AI team & admins', 0, 'Shield', 'pUsers')] },
      { label: 'Governance', items: [N('Platform audit', 0, 'History', 'pAudit')] },
      { label: 'Open a project', items: [NG('SCEAI', 'FolderOpen', toProj('sceai'), false), NG('Default · system', 'FolderOpen', toProj('default'), false)] }
    ] : [
      { label: 'Home', items: [N('Overview', 0, ['House', 'Home'], 'home')] },
      { label: 'Orchestration', items: [N('Agents map', 0, 'Network', 'map'), N('Traces', 0, ['Waypoints', 'GitBranch'], 'trace'), N('Conversations', 0, ['MessagesSquare', 'MessageSquare'], 'convs'), N('Feedback', 0, ['ThumbsDown'], 'feedback'), N('Catalogue', 0, ['BookOpen'], 'catalogue')] },
      { label: 'AI', items: [N('Agents', 0, 'Bot', 'agents'), N('Model providers', 0, 'Cpu', 'providers'), N('Tools & MCP servers', 0, 'Plug', 'mcp')] },
      { label: 'Data', items: [N('Collections', 0, 'Database', 'collections'), N('Connectors', 0, ['Cable', 'Link'], 'connectors'), N('Pipelines', 0, 'Workflow', 'pipelines'), N('Indicators', 0, ['ChartLine', 'LineChart'], 'indicators'), N('Ingest packages', 0, 'Package', 'packages')] },
      { label: 'Operations', items: [N('Agent jobs', 0, 'ListChecks', 'jobs'), N('Ingestion jobs', 0, ['HardDriveDownload', 'Download'], 'ingest')] },
      { label: 'Identity & access', items: [N('Users', 0, 'User', 'users'), N('Groups', 0, 'Users', 'groups'), N('Roles', 0, 'Shield', 'roles'), N('Access grants', 0, 'KeyRound', 'grants'), N('API tokens', 0, 'Key', 'tokens')] },
      { label: 'Governance', items: [N('Audit log', 0, 'History', 'audit'), N('Configuration versions', 0, ['GitCompare', 'GitCompareArrows'], 'configs'), N('Scheduled reports', 0, ['CalendarClock', 'Calendar'], 'reports')] },
      { label: 'Project', items: [N('Project settings', 0, 'Settings', 'settings')] },
      { label: 'KAP platform', items: [N('Platform overview', 0, 'ArrowUpLeft', 'pHome')] }
    ];
    const tabL = { overview: 'Overview', config: 'Configuration', tools: 'Tools & collections', access: 'Access', jobs: 'Jobs', metrics: 'Metrics', versions: 'Versions', timeline: 'Timeline', answer: 'Answer & provenance', raw: 'Raw JSON', logs: 'Logs' };
    const CR = { home: ['Home', 'Overview'], map: ['Orchestration', 'Agents map'], live: ['Orchestration', 'Live activity'], trace: ['Orchestration', 'Traces', '93c7a1f2', tabL[this.state.tTab]], jobs: ['Operations', 'Agent jobs'], ingest: ['Operations', 'Ingestion jobs'], agents: ['AI', 'Agents'], agent: ['AI', 'Agents', 'sceai_indicators_oxford', tabL[this.state.aTab]], wizard: ['AI', 'Agents', 'Create agent'], providers: ['AI', 'Model providers'], mcp: ['AI', 'Tools & MCP servers'], collections: ['Data', 'Collections', 'sceai_indicators', 'Overview'], connectors: ['Data', 'Connectors'], pipelines: ['Data', 'Pipelines'], indicators: ['Data', 'Indicators', 'IND-TOU-014'], packages: ['Data', 'Ingest packages'], users: ['Identity & access', 'Users', 'sceai_analyst'], groups: ['Identity & access', 'Groups'], roles: ['Identity & access', 'Roles'], grants: ['Identity & access', 'Access grants'], tokens: ['Identity & access', 'API tokens'], audit: ['Governance', 'Audit log'], configs: ['Governance', 'Configuration versions', 'sceai_indicators_oxford'], tenants: ['Settings', 'Tenants'], convs: ['Orchestration', 'Conversations'], reports: ['Governance', 'Scheduled reports', 'Weekly SCEAI summary'], conv: ['Orchestration', 'Conversations', '7f21a9'], feedback: ['Orchestration', 'Feedback'], catalogue: ['Orchestration', 'Catalogue', 'v2026.11.3'], catItem: ['Orchestration', 'Catalogue', 'v2026.11.3', 'Indicator'], catPublish: ['Orchestration', 'Catalogue', 'Publish v2026.11.4'], settings: ['Project', 'Project settings'] }[sc] || ['Home'];
    const CRP = { pHome: ['Overview'], tenants: ['Projects'], pModels: ['Shared services', 'Model serving'], pMcp: ['Shared services', 'MCP registry'], pQueues: ['Shared services', 'Queues & workers'], pUsers: ['Platform access', 'AI team & admins'], pAudit: ['Governance', 'Platform audit'] };
    const cl = isPlat ? ['KAP', ...CRP[sc]] : ['KAP', this.state.tenant === 'default' ? 'Default' : 'SCEAI', ...CR];
    const crumbs = cl.map((label, i) => ({ label, sep: i > 0, color: i === cl.length - 1 ? 'var(--text-strong)' : 'var(--text-muted)', fw: i === cl.length - 1 ? 600 : 400 }));

    const days = [[5, 1, 0], [7, 1, 0], [4, 0, 0], [6, 2, 0], [8, 1, 0], [7, 1, 0], [9, 2, 3]].map(([o, f, r], i) => {
      const t = o + f + r; return { ph: Math.round(t / 14 * 60), h: Math.round(t / 14 * 160), ok: (o / t * 100).toFixed(1), fail: (f / t * 100).toFixed(1), run: (r / t * 100).toFixed(1), label: ['Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Today'][i] };
    });
    const topTools = [['find_indicator', 41, '0%', '#8A1538'], ['get_indicator_value', 33, '0%', '#8A1538'], ['actual_vs_target', 27, '0%', '#8A1538'], ['EconomicData', 15, '20%', '#0F766E'], ['hybrid_search', 12, '0%', '#C8B49A'], ['query_indicators', 21, '4.8%', '#8A1538']]
      .sort((a, b) => b[1] - a[1]).map(([n, calls, err, c]) => ({ n, calls, err, c, w: Math.round(calls / 41 * 100), ec: err === '0%' ? 'var(--text-muted)' : err === '20%' ? 'var(--danger-fg)' : 'var(--warning-fg)' }));
    const W = I(['TriangleAlert', 'AlertTriangle'], 16), X = I(['CircleX', 'XCircle'], 16);
    const attention = [
      { icon: W, c: 'var(--warning)', title: 'Oxford MCP degraded', meta: 'oxford_economics · 2 errors (502) and p95 2.6 s in the last 24 h', when: '18 min ago' },
      { icon: X, c: 'var(--danger)', title: 'Job exceeded 180 s timeout', meta: '5d2e0a71… · sceai_indicators_oxford · sceai_analyst · EconomicData did not respond', when: '2 h ago' },
      { icon: X, c: 'var(--danger)', title: 'Tool-call limit reached (15 / 15)', meta: 'b1c94f08… · sceai_indicators_agent · sceai_admin · "Which indicators are currently off track…"', when: '5 h ago' },
      { icon: X, c: 'var(--danger)', title: 'Oxford MCP returned 502 Bad Gateway', meta: 'e7a3d2c6… · sceai_indicators_oxford · dashboards-svc · failed after 1 retry', when: '9 h ago' },
      { icon: X, c: 'var(--danger)', title: 'Indicator not found', meta: '2f8b6e19… · sceai_indicators_agent · "What was hotel occupancy in Al Wakrah…"', when: '1 d ago' },
      { icon: W, c: 'var(--warning)', title: 'Ingestion skipped 1 file', meta: 'docs_docx_ingest · run 87 · SCEAI_Annual_Review_draft.docx could not be parsed', when: '1 d ago' }
    ];
    const tiles = [['Agents', 8, 'Bot'], ['Collections', 1, 'Database'], ['Connectors', 2, ['Cable', 'Link']], ['Users', 6, 'User']].map(([label, n, icn]) => ({ label, n, icon: I(icn, 15) }));

    const lanes = [[20, 'Callers'], [250, 'Job queue'], [480, 'Agents'], [760, 'Tools'], [1030, 'Data & models'], [1270, 'External']].map(([x, t]) => ({ x, t }));
    const nd = (o) => ({ h: 64, bc: 'var(--border-subtle)', sh: 'var(--shadow-xs)', ibg: 'var(--surface-sunken)', ifg: 'var(--text-muted)', hc: 'var(--success)', mc: 'var(--text-muted)', mw: 400, queue: false, loop: false, expand: '', ...o });
    const LT = { ibg: '#F6E8EC', ifg: '#8A1538' }, DT = { ibg: 'var(--sand-tint)', ifg: 'var(--sand-ink)' }, OT = { ibg: 'var(--teal-tint)', ifg: '#0F766E' };
    const act = c => ({ bc: c, sh: `0 0 0 3px ${c === '#0F766E' ? 'rgba(15,118,110,.14)' : 'rgba(138,21,56,.12)'}`, mc: c, mw: 600 });
    const nodes = [
      nd({ x: 20, y: 90, name: 'sceai_analyst', sub: 'User · via catalog_readers', metric: '2 jobs running', icon: I('User', 16), ...act('#8A1538') }),
      nd({ x: 20, y: 180, name: 'sceai_admin', sub: 'User · tenant_admins', metric: '6 jobs in 24 h', icon: I('User', 16) }),
      nd({ x: 20, y: 270, name: 'dashboards-svc', sub: 'API client · token', metric: '1 job queued', icon: I('KeyRound', 16), ...act('#8A1538') }),
      nd({ x: 250, y: 140, h: 130, name: 'kap.agent', sub: 'Job queue · priority 3', metric: '', queue: true, icon: I('Layers', 16), hc: 'var(--warning)' }),
      nd({ x: 480, y: 80, h: 180, name: 'sceai_indicators_agent', sub: 'planner_and_executor', metric: '1 in flight · calling find_indicator', loop: true, icon: I('Bot', 16), ...LT, ...act('#8A1538') }),
      nd({ x: 480, y: 310, name: 'sceai_indicators_oxford', sub: 'planner_and_executor', metric: '1 in flight · calling EconomicData', expand: 'Show execution loop', icon: I('Bot', 16), ...LT, bc: '#8A1538', sh: '0 0 0 2px #8A1538', mc: '#0F766E', mw: 600 }),
      nd({ x: 760, y: 60, name: 'local indicator tools', sub: '11 tools · local data', metric: 'find_indicator active', expand: 'Expand cluster', icon: I('Wrench', 16), ...LT, ...act('#8A1538') }),
      nd({ x: 760, y: 170, name: 'hybrid_search', sub: 'Document search', metric: '12 calls · p95 690 ms', icon: I('FileText', 16), ...DT }),
      nd({ x: 760, y: 280, name: 'EconomicData', sub: 'Oxford MCP tool', metric: 'Active · 1.8 s elapsed', icon: I('Globe', 16), ...OT, ...act('#0F766E') }),
      nd({ x: 760, y: 370, name: 'EconomicAnalysis', sub: 'Oxford MCP tool', metric: '4 calls · p95 3.3 s', icon: I('Globe', 16), ...OT }),
      nd({ x: 1030, y: 60, name: 'sceai_indicators', sub: 'Collection · 8,104 obs.', metric: 'Reading · 3 CSV, 12 DOCX', icon: I('Database', 16), ...LT, ...act('#8A1538') }),
      nd({ x: 1030, y: 170, name: 'embed_default', sub: 'qwen3-embedding · 1024-d', metric: '12 calls · 24 h', icon: I('Cpu', 16) }),
      nd({ x: 1030, y: 440, name: 'agent_default', sub: 'Qwen2.5-32B-Instruct', metric: '96 calls · p95 3.4 s', icon: I('Cpu', 16) }),
      nd({ x: 1030, y: 520, name: 'chat_default', sub: 'Qwen2.5-14B-Instruct', metric: 'Not used by agents', icon: I('Cpu', 16), hc: '#A8A0A3' }),
      nd({ x: 1270, y: 300, name: 'oxford_economics', sub: 'External MCP server', metric: 'Degraded · p95 2.6 s', icon: I('Server', 16), ...OT, bc: '#0F766E', hc: 'var(--warning)', mc: 'var(--warning-fg)', mw: 600 })
    ];
    const drawerTabs = [{ value: 'overview', label: 'Overview' }, { value: 'metrics', label: 'Metrics' }, { value: 'runs', label: 'Recent runs', badge: 9 }, { value: 'conn', label: 'Connections' }];
    const limits = [['Timeout', '180 s'], ['Max retries', '1'], ['Request limit', '20'], ['Tool-call limit', '15'], ['Task priority', '3'], ['Max in-flight', '3']].map(([k, v]) => ({ k, v }));

    const meters = [['Model requests', '3 / 20', 15], ['Tool calls', '4 / 15', 27], ['Elapsed vs timeout', '9.8 s / 180 s', 5.4]].map(([k, v, p]) => ({ k, v, p }));
    const traceTabs = [{ value: 'timeline', label: 'Timeline' }, { value: 'answer', label: 'Answer & provenance' }, { value: 'raw', label: 'Raw JSON' }, { value: 'logs', label: 'Logs', badge: 18 }];
    const T = 9.8;
    const spans = [['queued', 'Queue wait', 0, .8, '#CFCAC8', 0, 0], ['plan', 'Model call', .82, 2.2, '#8C8487', 0, 12], ['find_indicator', 'Tool', 3.05, .31, '#8A1538', 1, 12], ['get_indicator_value', 'Tool', 3.4, .18, '#8A1538', 1, 12], ['plan (step 2)', 'Model call', 3.62, 1.3, '#8C8487', 0, 12], ['actual_vs_target', 'Tool', 4.95, .15, '#8A1538', 1, 12], ['Oxford · EconomicData', 'Tool', 5.13, 2.41, '#0F766E', 1, 12], ['compose answer', 'Model call', 7.58, 2.2, '#8C8487', 0, 12]]
      .map(([n, k, s, d, c, mono, ind]) => ({ n, k, c, ind, l: (s / T * 100).toFixed(2), w: (d / T * 100).toFixed(2), d: d < 1 ? Math.round(d * 1000) + ' ms' : d.toFixed(2) + ' s', f: mono ? 'var(--font-mono)' : 'var(--font-sans)', bg: n.indexOf('EconomicData') >= 0 ? 'var(--brand-tint)' : 'transparent' }));

    const summary = [['Total', '50', '#8C8487'], ['Succeeded', '39', 'var(--success)'], ['Failed', '7', 'var(--danger)'], ['Running', '3', 'var(--info)'], ['Avg duration', '8.6 s', 'transparent']].map(([k, v, c]) => ({ k, v, c }));
    const ck = I('Check', 11);
    const J = [
      ['running', 'Running', '93c7a1f2', 'sceai_indicators_oxford', 'sceai_analyst', 'What was the tourism sector contribution to GDP in Q4 2024, and how does it compare with the target?', '', '6.1 s', '0', 'just now'],
      ['running', 'Running', '4be0d913', 'sceai_indicators_agent', 'dashboards-svc', 'What is the strategic food reserve coverage for 2024?', '', '2.4 s', '0', 'just now'],
      ['succeeded', 'Succeeded', '7a1c5e30', 'sceai_indicators_oxford', 'sceai_analyst', 'Compare the recent tourism trend with the Oxford Economics outlook for Qatar.', '', '10.2 s', '0', '12 min ago'],
      ['succeeded', 'Succeeded', 'c3f80b6d', 'sceai_indicators_agent', 'sceai_analyst', 'What was consumer price inflation in January 2019 and was it on target?', '', '6.7 s', '0', '38 min ago'],
      ['failed', 'Failed', '5d2e0a71', 'sceai_indicators_oxford', 'sceai_analyst', 'Add wider GDP context to the tourism contribution figure for Q4 2024.', 'Job exceeded 180 s timeout', '3 m 00 s', '0', '2 h ago'],
      ['succeeded', 'Succeeded', '0e9b2a47', 'sceai_indicators_agent', 'sceai_admin', 'How did non-hydrocarbon exports perform as a share of total exports in 2019 against target?', '', '8.9 s', '0', '3 h ago'],
      ['failed', 'Failed', 'b1c94f08', 'sceai_indicators_agent', 'sceai_admin', 'Which indicators are currently off track and what do the plans say about them?', 'Tool-call limit reached (15 / 15)', '41.3 s', '0', '5 h ago'],
      ['succeeded', 'Succeeded', '6f4d1c82', 'sceai_indicators_agent', 'dashboards-svc', 'Which indicators moved the most in Q4 2024?', '', '7.4 s', '0', '6 h ago'],
      ['failed', 'Failed', 'e7a3d2c6', 'sceai_indicators_oxford', 'dashboards-svc', 'Compare the recent tourism trend with the Oxford Economics outlook for Qatar.', 'Oxford MCP returned 502 Bad Gateway', '14.6 s', '1', '9 h ago'],
      ['succeeded', 'Succeeded', 'a8e27f15', 'sceai_indicators_agent', 'sceai_analyst', 'What is the strategic food reserve coverage for 2024?', '', '5.9 s', '0', '11 h ago'],
      ['cancelled', 'Cancelled', '1d6b9e04', 'sceai_indicators_oxford', 'sceai_admin', 'Summarise tourism performance against the national strategy target.', 'Cancelled by sceai_admin', '3.2 s', '0', '1 d ago'],
      ['failed', 'Failed', '2f8b6e19', 'sceai_indicators_agent', 'sceai_analyst', 'What was hotel occupancy in Al Wakrah last month?', 'Indicator not found', '4.1 s', '0', '1 d ago']
    ];
    const PM = { running: 'submitted', succeeded: 'approved', failed: 'rejected', cancelled: 'draft' };
    const jobs = J.map(([s, pl, id, agent, user, q, reason, dur, r, when], i) => {
      const sel = i === 4 || i === 6;
      return { p: PM[s], pl, id, agent, user, q, reason, dur, r, when, abs: '19 Nov 2026', bg: sel ? 'var(--brand-tint)' : 'transparent', cb: sel ? 'var(--brand)' : 'var(--border-strong)', cbg: sel ? 'var(--brand)' : 'transparent', check: sel ? ck : null };
    });
    const agentJobs = [0, 2, 4, 8, 10].map(i => jobs[i]).map(j => ({ ...j, agent: 'sceai_indicators_oxford' }));
    const agentTabs = [{ value: 'overview', label: 'Overview' }, { value: 'config', label: 'Configuration' }, { value: 'tools', label: 'Tools & collections', badge: 14 }, { value: 'access', label: 'Access' }, { value: 'jobs', label: 'Jobs', badge: 21 }, { value: 'metrics', label: 'Metrics' }, { value: 'versions', label: 'Versions', badge: 6 }];
    const ok = I('Check', 10);
    const testSteps = [
      ['Plan', 'agent_default · 2,846 in / 212 out tokens', '2.1 s', 'var(--success)', 0, ok],
      ['find_indicator', 'IND-TRD-031 · Non-Hydrocarbon Exports (share of total exports)', '330 ms', 'var(--success)', 1, ok],
      ['get_time_series', '2017–2019 · 3 observations', '220 ms', 'var(--success)', 1, ok],
      ['actual_vs_target', '2019 · 32.04% vs 50% target', '160 ms', 'var(--success)', 1, ok],
      ['hybrid_search', 'National Development Strategy · Diversification · 1 hit', '640 ms', 'var(--success)', 1, ok],
      ['Compose answer', 'Streaming…', '—', 'var(--info)', 0, null]
    ].map(([n, sub, d, c, mono, icon]) => ({ n, sub, d, c, icon, f: mono ? 'var(--font-mono)' : 'var(--font-sans)' }));

    const steps = ['Basics', 'Model', 'Knowledge', 'Tools', 'System instructions', 'Access', 'Review + create'];
    const wSteps = steps.map((n, i) => {
      const done = i < 3, cur = i === 3;
      return { n, mark: done ? '✓' : String(i + 1), bg: cur ? 'var(--brand-tint)' : 'transparent', cbg: done ? 'var(--brand)' : cur ? '#fff' : 'transparent', cfg: done ? '#fff' : cur ? 'var(--brand)' : 'var(--text-muted)', cb: done || cur ? 'var(--brand)' : 'var(--border-default)', fg: cur ? 'var(--brand-strong)' : done ? 'var(--text-strong)' : 'var(--text-muted)', fw: cur ? 600 : 400 };
    });
    const wTools = [['find_indicator', 'Resolve an indicator by name, alias or code'], ['get_indicator_value', 'Actual value for an indicator and period'], ['actual_vs_target', 'Compare actual against target'], ['get_time_series', 'Observations over a period range'], ['get_change', 'Change between two periods'], ['compare_indicators', 'Side-by-side comparison'], ['top_movers', 'Largest positive and negative changes'], ['get_status', 'On-track / off-track by target'], ['get_narratives', 'Narrative commentary'], ['get_achievements', 'Recorded achievements for a theme'], ['query_indicators', 'Structured filter over the catalogue']].map(([n, d]) => ({ n, d }));

    return {
      ic, nav, crumbs, s: { [sc]: true },
      days, topTools, attention, tiles,
      lanes, nodes, drawerTabs, limits,
      meters, traceTabs, spans,
      summary, jobs, agentJobs, agentTabs, testSteps, wSteps, wTools,
      ...this.more(I, ic, go, nodes),
      ...this.lookV()
    };
  }
}
</script>


</body></html>