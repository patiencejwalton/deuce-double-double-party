/* ============================================================
   Deuce's Double Double Party — one app, ONE store, no duplicates.
   Data layer: a single store with publish/subscribe and two
   adapters behind one interface:
     - LocalAdapter   (default): localStorage + BroadcastChannel +
       storage events, so every tab of this browser stays in sync.
     - SupabaseAdapter: CONFIG below points at the live party project;
       the same store operations map onto the Supabase tables (schema:
       goals/deuce-10th-birthday/files/supabase-backend-schema-2026-11-16.sql).
       localStorage remains the instant-render cache on every device.
   With the CONFIG keys empty the app runs fully in LOCAL mode and
   Admin says so plainly. Nothing fakes a connection.
   ============================================================ */
'use strict';

/* ---------------- CONFIG (Supabase — empty both slots to force local mode) --- */
const CONFIG = {
  SUPABASE_URL: 'https://jcquahyuouhkgjjfizas.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjcXVhaHl1b3Voa2dqamZpemFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUwNTUwNjksImV4cCI6MjExMDYzMTA2OX0.y7Y-4CSW_U8Mt5w-MG3CjCQUygVIqMsBYO4A09aKOCc' // anon public key (safe to ship in the app)
};

/* ---------------- Locked party facts (do not invent more) ------------------- */
const PARTY = {
  name: "Deuce's Double Double Party",
  kid: 'Deuce',
  statLine: 'DEUCE #10 — 10 PTS · 10 REB · 10x FUN',
  dateText: 'Saturday, December 19, 2026',
  timeText: '4:00 PM',
  tipoffISO: '2026-12-19T16:00:00-07:00', // America/Phoenix
  placeText: "At Deuce's House — El Mirage, AZ",
  adminCode: '1010'
};
const AWARD_TITLES = ['Shootout Champion', 'MVP', 'Best Player Card', 'Best Teammate'];

/* ---------------- Small utils ------------------------------------------------ */
const $  = (sel, el) => (el || document).querySelector(sel);
const $$ = (sel, el) => Array.from((el || document).querySelectorAll(sel));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let _uidN = 0;
const uid = p => (p || 'id') + '-' + Date.now().toString(36) + '-' + (++_uidN).toString(36) + Math.floor(Math.random() * 1e4).toString(36);
const nowISO = () => new Date().toISOString();
const tipoffMs = () => new Date(PARTY.tipoffISO).getTime();
const pad2 = n => String(n).padStart(2, '0');

/* ---------------- Seeded defaults (survive Clear All Data) ------------------- */
function seedState() {
  return {
    v: 1,
    seq: { ticket: 0 },                       // next ticket number issued
    families: [],                             // {id,name,contact,allergies,songRequest,prediction,createdAt}
    guests: [],                               // {id,familyId,name,type,ticketCode,seatNo,checkedIn,checkedInAt,cardStatus}
    scores: [],                               // {id,guestName,game,points,createdAt}
    triviaPlays: [],                          // {guestName,questionId,correct,createdAt}
    trivia: [
      { id: 'tq1', question: 'How old is Deuce turning?', choices: ['8', '9', '10', '11'], answer: '10', active: true },
      { id: 'tq2', question: "What number is on Deuce's jersey?", choices: ['1', '2', '10', '23'], answer: '10', active: true },
      { id: 'tq3', question: 'What is the name of this party?', choices: ["Deuce's Double Double Party", 'Hoop Dreams', 'Ballin Birthday', 'Team Deuce Day'], answer: "Deuce's Double Double Party", active: true }
    ],
    quarters: [
      { id: 'q1', label: '1st Quarter — Warm-Ups & Scan-In',            timeLabel: '4:00 PM', isCurrent: true },
      { id: 'q2', label: '2nd Quarter — Stations & Shootout Qualifying', timeLabel: '',       isCurrent: false },
      { id: 'q3', label: 'Halftime — Food, Trivia & Dance Cam',          timeLabel: '',       isCurrent: false },
      { id: 'q4', label: '3rd Quarter — Tournament',                     timeLabel: '',       isCurrent: false },
      { id: 'q5', label: '4th Quarter — Finals, Awards & Cake',          timeLabel: '',       isCurrent: false },
      { id: 'q6', label: 'Overtime — Favors & Goodbyes',                 timeLabel: '',       isCurrent: false }
    ],
    menu: ['Popcorn', 'Pizza', 'Hot Dogs', 'Chicken Tenders', 'Sports Drinks', 'Water', 'Juice'],
    menuNote: 'Allergy-safe tray: allergy-friendly snacks are kept on their own marked tray at the end of the table.',
    shoutouts: [
      { id: 'so-seed1', name: 'The Home Crowd', message: "Welcome to Deuce's Double Double Party!", approved: true, createdAt: nowISO() },
      { id: 'so-seed2', name: 'Team Deuce', message: 'Happy 10th birthday, Deuce — double digits!', approved: true, createdAt: nowISO() }
    ],
    photos: [],                               // {id,url,caption,submittedBy,sendTo,source,approved,createdAt}
    awards: AWARD_TITLES.map(t => ({ title: t, winner: '' })),
    cards: [],                                // {id,guestId,guestName,photo,position,stats:[{label,value}x3],createdAt}
    checkpoints: [
      { code: 'DEUCE10-HUNT-01', title: "Find Deuce's Gear #1 — The Jersey",   hint: 'Where do game-day clothes hang out?' },
      { code: 'DEUCE10-HUNT-02', title: "Find Deuce's Gear #2 — The Ball",     hint: 'It bounces best near the court.' },
      { code: 'DEUCE10-HUNT-03', title: "Find Deuce's Gear #3 — The Whistle",  hint: 'The ref keeps it close to the snacks.' },
      { code: 'DEUCE10-HUNT-04', title: "Find Deuce's Gear #4 — The Trophy",   hint: 'Champions shine near the big screen.' },
      { code: 'DEUCE10-HUNT-05', title: "Find Deuce's Gear #5 — The Sneakers", hint: 'Check where shoes line up at the door.' },
      { code: 'DEUCE10-HUNT-06', title: "Find Deuce's Gear #6 — The Playbook", hint: 'Every great plan starts at a table.' }
    ],
    signature: null,                          // dataURL of Deuce's drawn signature
    ui: {
      grandEntranceAt: 0,                     // ms epoch when Admin fired the grand entrance
      cakeStart: 0,                           // ms epoch when the 10s cake countdown started
      predScoredFamilyIds: []                 // families already awarded prediction points
    },
    log: []                                   // {id,kind,detail,ts} activity feed (NOW ENTERING etc.)
  };
}

/* ---------------- Adapters --------------------------------------------------- */
const LS_KEY = 'ddp_store_v1';

/* Local adapter: one browser, many tabs, live sync. */
class LocalAdapter {
  constructor() {
    this.bc = null;
    try { this.bc = new BroadcastChannel('ddp-party'); } catch (e) { /* older browser */ }
  }
  load() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      return (s && s.v === 1 && Array.isArray(s.guests)) ? s : null;
    } catch (e) { return null; }
  }
  persist(state) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) { /* storage full/blocked */ }
  }
  ping() { if (this.bc) { try { this.bc.postMessage({ t: 'state' }); } catch (e) {} } }
  onExternal(cb) {
    if (this.bc) this.bc.onmessage = () => cb();
    window.addEventListener('storage', e => { if (e.key === LS_KEY) cb(); });
  }
}

/* Supabase adapter — live wiring (Nov 18, 2026).
   Contract with the synchronous Store is unchanged:
     load()    -> the localStorage cache, synchronously (instant render).
     persist() -> cache write now + debounced full-collection push to
                  PostgREST (upsert on primary-key id; rows absent from
                  state are deleted for the party-data collections).
     ping()    -> BroadcastChannel ping for same-browser tabs.
     onExternal()-> local tab events + Supabase Realtime (postgres_changes
                  on guests/scores/shoutouts/photos/activity_log/
                  party_config) -> debounced re-hydrate -> Store.replace.
   hydrate() (called once at boot) aligns the seeded collections to the
   app's copy, fetches every table, merges DB rows with any local-only
   rows (created offline / before wiring), and replaces the store.
   Ids: DB rows are uuids. Local 'id-...' ids are swapped for real UUIDs
   on first push (state rows are mutated so upserts stay stable). The
   id sets this device has seen in the DB are persisted (KNOWN_KEY) so a
   row deleted on another device is not resurrected from this cache.
   Echo guard: a hash of the DB-bound projection is kept; a push whose
   hash matches the last pushed/hydrated hash is skipped.
   Collections with no DB table/column stay local-only by design:
   cards, signature, ui, menu/menuNote, families.prediction (no column),
   photos.sendTo/source (no columns). party_config is read on hydrate
   for connectivity only — PARTY constants stay the display truth. */
const SB_KNOWN_KEY = 'ddp_sb_known_v1';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function newUUID() {
  try { if (window.crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (e) {}
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
const playKeyOf = p => String(p.guestName || '').trim().toLowerCase() + '|' + p.questionId + '|' + Date.parse(p.createdAt || '');

class SupabaseAdapter {
  constructor(url, key) {
    this.url = String(url).replace(/\/+$/, '');
    this.key = key;
    this.configured = !!(url && key);
    this.local = new LocalAdapter();           // cache + same-browser tab sync
    this._hydrated = false;
    this._hydrating = false;
    this._pushTimer = 0;
    this._rtTimer = 0;
    this._pushing = false;
    this._retryTimer = 0;
    this._lastHash = '';
    this._client = null;
    this._known = { families: new Set(), guests: new Set(), scores: new Set(), photos: new Set(), shoutouts: new Set(), trivia: new Set(), plays: new Set(), log: new Set() };
    this._playIdByKey = {};                    // trivia_responses natural key -> DB uuid
    this._triviaIdByText = {};
    this._awardIdByTitle = {};
    this._quarterIdBySort = {};
    try {
      const raw = localStorage.getItem(SB_KNOWN_KEY);
      if (raw) {
        const k = JSON.parse(raw);
        Object.keys(this._known).forEach(c => { if (Array.isArray(k[c])) this._known[c] = new Set(k[c]); });
        this._playIdByKey = k.playIds || {};
      }
    } catch (e) { /* fresh device */ }
  }

  load() { return this.local.load(); }

  persist(state) {
    this._assignUuids(state);                  // ids are uuids before any push can read them
    this.local.persist(state);                 // cache always, synchronously
    if (!this._hydrated) return;               // never push before first hydrate
    this._schedulePush();
  }

  /* Swap local 'id-...' ids for real UUIDs and remap every foreign key
     that pointed at a swapped id. Runs synchronously on every persist so
     a row added while a push is in flight still reaches the payload with
     a valid uuid. */
  _assignUuids(state) {
    const famRemap = {}, guestRemap = {}, triviaRemap = {};
    state.families.forEach(f => { if (!UUID_RE.test(f.id || '')) { const nu = newUUID(); famRemap[f.id] = nu; f.id = nu; } });
    state.guests.forEach(g => {
      if (famRemap[g.familyId]) g.familyId = famRemap[g.familyId];
      if (!UUID_RE.test(g.id || '')) { const nu = newUUID(); guestRemap[g.id] = nu; g.id = nu; }
    });
    ['scores', 'photos', 'shoutouts'].forEach(coll => {
      state[coll].forEach(r => { if (!UUID_RE.test(r.id || '')) r.id = newUUID(); });
    });
    state.log.forEach(r => { if (!UUID_RE.test(r.id || '')) r.id = newUUID(); });
    state.trivia.forEach(q => {
      if (!UUID_RE.test(q.id || '')) {
        const nu = this._triviaIdByText[q.question] || newUUID();
        triviaRemap[q.id] = nu; q.id = nu;
      }
      this._triviaIdByText[q.question] = q.id;
    });
    state.triviaPlays.forEach(p => { if (triviaRemap[p.questionId]) p.questionId = triviaRemap[p.questionId]; });
    state.cards.forEach(c => { if (guestRemap[c.guestId]) c.guestId = guestRemap[c.guestId]; });
  }

  ping() { this.local.ping(); }

  onExternal(cb) {
    this.local.onExternal(cb);                 // same-browser tabs via cache
    this._subscribeRealtime();
  }

  /* ---------- REST helpers ---------- */
  _headers(extra) {
    return Object.assign({ apikey: this.key, Authorization: 'Bearer ' + this.key, 'Content-Type': 'application/json' }, extra || {});
  }
  async _get(table, query) {
    const r = await fetch(this.url + '/rest/v1/' + table + (query || ''), { headers: this._headers() });
    if (!r.ok) throw new Error(table + ' GET ' + r.status);
    return r.json();
  }
  async _upsert(table, rows, onConflict) {
    if (!rows.length) return [];
    const r = await fetch(this.url + '/rest/v1/' + table + '?on_conflict=' + (onConflict || 'id'), {
      method: 'POST',
      headers: this._headers({ Prefer: 'resolution=merge-duplicates,return=representation' }),
      body: JSON.stringify(rows)
    });
    if (!r.ok) throw new Error(table + ' upsert ' + r.status + ': ' + (await r.text()).slice(0, 200));
    return r.json();
  }
  async _insert(table, rows) {
    if (!rows.length) return [];
    const r = await fetch(this.url + '/rest/v1/' + table, {
      method: 'POST',
      headers: this._headers({ Prefer: 'return=representation' }),
      body: JSON.stringify(rows)
    });
    if (!r.ok) throw new Error(table + ' insert ' + r.status + ': ' + (await r.text()).slice(0, 200));
    return r.json();
  }
  async _deleteIds(table, ids) {
    if (!ids.length) return;
    const r = await fetch(this.url + '/rest/v1/' + table + '?id=in.(' + ids.map(encodeURIComponent).join(',') + ')', {
      method: 'DELETE', headers: this._headers({ Prefer: 'return=minimal' })
    });
    if (!r.ok) throw new Error(table + ' delete ' + r.status);
  }

  /* ---------- state <-> row mapping (camelCase <-> snake_case) ---------- */
  _famDb(f) { return { id: f.id, parent_name: f.name || '', contact: f.contact || '', song_request: f.songRequest || null, photo_permission: false, allergy_notes: f.allergies || null, created_at: f.createdAt || undefined }; }
  _guestDb(g) { return { id: g.id, family_id: g.familyId, name: g.name || '', guest_type: g.type === 'coach_fan' ? 'coach_fan' : 'player', ticket_code: g.ticketCode, seat_no: g.seatNo, checked_in: !!g.checkedIn, checked_in_at: g.checkedInAt || null, card_status: g.cardStatus || 'none' }; }
  _scoreDb(s) { return { id: s.id, guest_name: s.guestName, game: s.game || 'shootout', points: s.points | 0, created_at: s.createdAt || undefined }; }
  _photoDb(p) { return { id: p.id, url: p.url || '', caption: p.caption || null, submitted_by: p.submittedBy || null, approved: !!p.approved, created_at: p.createdAt || undefined }; }
  _shoutDb(s) { return { id: s.id, name: s.name || '', message: s.message || '', approved: !!s.approved, created_at: s.createdAt || undefined }; }
  _triviaDb(q, i) { return { id: q.id, question: q.question, choices: q.choices || [], answer: q.answer, sort: i + 1, active: !!q.active }; }
  _quarterDb(q, i) { return { id: this._quarterIdBySort[i + 1] || undefined, label: q.label, time_label: q.timeLabel || null, sort: i + 1, is_current: !!q.isCurrent }; }
  _awardDb(a) { return { id: this._awardIdByTitle[a.title] || undefined, title: a.title, winner: a.winner || null }; }
  _checkpointDb(cp, i) { return { code: cp.code, title: cp.title, hint: cp.hint || null, sort: i + 1 }; }
  _playDb(p) { return { guest_name: p.guestName, question_id: p.questionId, correct: !!p.correct, created_at: p.createdAt || undefined }; }
  _logDb(l) { return { id: l.id, kind: l.kind, detail: l.detail || null, created_at: new Date(l.ts || Date.now()).toISOString() }; }

  /* Hash of exactly what would be pushed — the echo-loop guard. */
  _hash(state) {
    return JSON.stringify({
      f: state.families.map(f => [f.id, f.name, f.contact, f.allergies, f.songRequest]),
      g: state.guests.map(g => [g.id, g.familyId, g.name, g.type, g.ticketCode, g.seatNo, g.checkedIn, g.cardStatus]),
      s: state.scores.map(s => [s.id, s.guestName, s.game, s.points]),
      t: state.trivia.map(q => [q.id, q.question, q.choices, q.answer, q.active]),
      q: state.quarters.map(q => [q.label, q.timeLabel, q.isCurrent]),
      a: state.awards.map(a => [a.title, a.winner]),
      p: state.photos.map(p => [p.id, p.url, p.caption, p.submittedBy, p.approved]),
      so: state.shoutouts.map(s => [s.id, s.name, s.message, s.approved]),
      cp: state.checkpoints.map(c => [c.code, c.title, c.hint]),
      tp: state.triviaPlays.map(playKeyOf).sort(),
      lg: state.log.map(l => l.id).sort()
    });
  }

  _saveKnown() {
    try {
      const out = { playIds: this._playIdByKey };
      Object.keys(this._known).forEach(c => { out[c] = Array.from(this._known[c]); });
      localStorage.setItem(SB_KNOWN_KEY, JSON.stringify(out));
    } catch (e) { /* cache full/blocked */ }
  }

  /* ---------- write-through push (debounced full-collection sync) ---------- */
  _schedulePush() {
    clearTimeout(this._pushTimer);
    this._pushTimer = setTimeout(() => { this._push(Store.state).catch(e => console.warn('[ddp] Supabase push failed:', e)); }, 700);
  }

  async _push(state) {
    if (this._pushing) { this._schedulePush(); return; }
    this._assignUuids(state);                  // backstop (persist already did it)
    const hash = this._hash(state);
    if (hash === this._lastHash) return;       // nothing new for the DB
    this._pushing = true;
    try {
      // Snapshot the DB-bound rows NOW. The whole push (payloads, deletion
      // diff, known-set bookkeeping) works from this snapshot only — a
      // commit landing mid-push is picked up by the catch-up push below,
      // never half-bookkept by this one.
      const snap = {
        families: state.families.map(f => this._famDb(f)),
        guests: state.guests.map(g => this._guestDb(g)),
        scores: state.scores.map(s => this._scoreDb(s)),
        trivia: state.trivia.map((q, i) => this._triviaDb(q, i)),
        quarters: state.quarters.map((q, i) => this._quarterDb(q, i)),
        awards: state.awards.map(a => this._awardDb(a)),
        checkpoints: state.checkpoints.map((cp, i) => this._checkpointDb(cp, i)),
        photos: state.photos.map(p => this._photoDb(p)),
        shoutouts: state.shoutouts.map(s => this._shoutDb(s)),
        plays: state.triviaPlays.slice(),
        log: state.log.slice()
      };
      const absent = (coll, rows) => {
        const cur = new Set(rows.map(r => r.id));
        return Array.from(this._known[coll]).filter(id => !cur.has(id));
      };
      // Deletions first (guests before families for the FK), then upserts.
      await this._deleteIds('guests', absent('guests', snap.guests));
      await this._deleteIds('scores', absent('scores', snap.scores));
      await this._deleteIds('photos', absent('photos', snap.photos));
      await this._deleteIds('shoutouts', absent('shoutouts', snap.shoutouts));
      await this._deleteIds('trivia_questions', absent('trivia', snap.trivia));
      const curPlayKeys = new Set(snap.plays.map(playKeyOf));
      const deadPlayIds = Object.keys(this._playIdByKey).filter(k => !curPlayKeys.has(k)).map(k => this._playIdByKey[k]);
      await this._deleteIds('trivia_responses', deadPlayIds);
      deadPlayIds.forEach(id => { Object.keys(this._playIdByKey).forEach(k => { if (this._playIdByKey[k] === id) delete this._playIdByKey[k]; }); });
      await this._deleteIds('families', absent('families', snap.families));

      await this._upsert('families', snap.families);
      await this._upsert('guests', snap.guests);
      await this._upsert('scores', snap.scores);
      await this._upsert('trivia_questions', snap.trivia);
      await this._syncSeeded('schedule_items', snap.quarters, this._quarterIdBySort, r => r.sort);
      await this._syncSeeded('awards', snap.awards, this._awardIdByTitle, r => r.title);
      await this._upsert('scavenger_checkpoints', snap.checkpoints, 'code');
      await this._upsert('photos', snap.photos);
      await this._upsert('shoutouts', snap.shoutouts);

      // trivia_responses + activity_log: insert new rows only.
      const newPlays = snap.plays.filter(p => !this._known.plays.has(playKeyOf(p)));
      if (newPlays.length) {
        const inserted = await this._insert('trivia_responses', newPlays.map(p => this._playDb(p)));
        inserted.forEach(row => {
          const k = playKeyOf({ guestName: row.guest_name, questionId: row.question_id, createdAt: row.created_at });
          this._playIdByKey[k] = row.id;
          this._known.plays.add(k);
        });
      }
      const newLog = snap.log.filter(l => !this._known.log.has(l.id));
      if (newLog.length) {
        await this._upsert('activity_log', newLog.map(l => this._logDb(l)));
        newLog.forEach(l => this._known.log.add(l.id));
      }

      this._known.families = new Set(snap.families.map(f => f.id));
      this._known.guests = new Set(snap.guests.map(g => g.id));
      this._known.scores = new Set(snap.scores.map(s => s.id));
      this._known.photos = new Set(snap.photos.map(p => p.id));
      this._known.shoutouts = new Set(snap.shoutouts.map(s => s.id));
      this._known.trivia = new Set(snap.trivia.map(q => q.id));
      this._known.plays = new Set(snap.plays.map(playKeyOf));
      this._saveKnown();
      this.local.persist(state);               // cache the uuid-updated state
      this._lastHash = hash;                   // the hash captured at push start —
      // a commit that landed mid-push makes the live hash differ, so push again
      if (this._hash(state) !== hash) this._schedulePush();
    } catch (e) {
      console.warn('[ddp] Supabase push failed, will retry:', e);
      clearTimeout(this._retryTimer);
      this._retryTimer = setTimeout(() => { this._lastHash = ''; this._schedulePush(); }, 5000);
      throw e;
    } finally {
      this._pushing = false;
    }
  }

  /* Seeded tables whose app rows carry no id (quarters, awards): upsert the
     rows whose DB id is mapped, insert the rest and record their ids. */
  async _syncSeeded(table, rows, idMap, keyOf) {
    const withId = rows.filter(r => r.id);
    const withoutId = rows.filter(r => !r.id);
    if (withId.length) await this._upsert(table, withId);
    if (withoutId.length) {
      const inserted = await this._insert(table, withoutId.map(r => { const c = Object.assign({}, r); delete c.id; return c; }));
      inserted.forEach(r => { idMap[keyOf(r)] = r.id; });
    }
  }

  /* ---------- hydrate: DB -> app state (merged with local-only rows) ---------- */
  async hydrate() {
    if (this._hydrating) return;
    this._hydrating = true;
    try {
      const boot = Store.state;
      // 1) Learn the seeded rows' DB ids, then align seeded content to the
      //    app's locked copy so the DB never rewrites party wording.
      const [sched0, awards0, trivia0] = await Promise.all([
        this._get('schedule_items', '?select=*&order=sort.asc'),
        this._get('awards', '?select=*'),
        this._get('trivia_questions', '?select=*&order=sort.asc')
      ]);
      sched0.forEach(r => { this._quarterIdBySort[r.sort] = r.id; });
      awards0.forEach(r => { this._awardIdByTitle[r.title] = r.id; });
      trivia0.forEach(r => { this._triviaIdByText[r.question] = r.id; });
      boot.trivia.forEach(q => { if (this._triviaIdByText[q.question]) q.id = this._triviaIdByText[q.question]; });
      await this._syncSeeded('schedule_items', boot.quarters.map((q, i) => this._quarterDb(q, i)), this._quarterIdBySort, r => r.sort);
      await this._syncSeeded('awards', boot.awards.map(a => this._awardDb(a)), this._awardIdByTitle, r => r.title);
      if (boot.trivia.length) {
        boot.trivia.forEach(q => { if (!UUID_RE.test(q.id || '')) q.id = newUUID(); this._triviaIdByText[q.question] = q.id; });
        await this._upsert('trivia_questions', boot.trivia.map((q, i) => this._triviaDb(q, i)));
      }
      if (boot.checkpoints.length) await this._upsert('scavenger_checkpoints', boot.checkpoints.map((cp, i) => this._checkpointDb(cp, i)), 'code');

      // 2) Fetch everything (party_config read for connectivity only —
      //    PARTY constants remain the display source of truth).
      const [configRows, famR, guestR, scoreR, triviaR, playR, schedR, awardR, photoR, shoutR, cpR, logR] = await Promise.all([
        this._get('party_config', '?select=key,value'),
        this._get('families', '?select=*&order=created_at.asc'),
        this._get('guests', '?select=*&order=seat_no.asc'),
        this._get('scores', '?select=*&order=created_at.asc'),
        this._get('trivia_questions', '?select=*&order=sort.asc'),
        this._get('trivia_responses', '?select=*&order=created_at.asc'),
        this._get('schedule_items', '?select=*&order=sort.asc'),
        this._get('awards', '?select=*'),
        this._get('photos', '?select=*&order=created_at.asc'),
        this._get('shoutouts', '?select=*&order=created_at.asc'),
        this._get('scavenger_checkpoints', '?select=*&order=sort.asc'),
        this._get('activity_log', '?select=*&order=created_at.desc&limit=200')
      ]);
      this._config = {};
      (configRows || []).forEach(r => { this._config[r.key] = r.value; });

      // 3) Merge: DB rows win on mapped fields; local-only rows (never seen
      //    in the DB by this device) survive; rows this device knew from
      //    the DB but which are gone there were deleted elsewhere — drop.
      const local = Store.state;
      const mergeById = (dbRows, localRows, knownSet, carry, dedupeKey) => {
        const dbIds = new Set(dbRows.map(r => r.id));
        const dbKeys = dedupeKey ? new Set(dbRows.map(dedupeKey)) : null;
        const out = dbRows.map(r => {
          const l = localRows.find(x => x.id === r.id);
          return (l && carry) ? carry(r, l) : r;
        });
        localRows.forEach(r => {
          if (dbIds.has(r.id) || knownSet.has(r.id)) return;
          if (dbKeys && dbKeys.has(dedupeKey(r))) return;  // same content already in DB (seeded rows)
          out.push(r);
        });
        return out;
      };

      const st = seedState();
      st.families = mergeById(
        famR.map(r => ({ id: r.id, name: r.parent_name, contact: r.contact, allergies: r.allergy_notes || '', songRequest: r.song_request || '', prediction: '', createdAt: r.created_at })),
        local.families, this._known.families,
        (db, l) => { db.prediction = l.prediction || ''; return db; });
      st.guests = mergeById(
        guestR.map(r => ({ id: r.id, familyId: r.family_id, name: r.name, type: r.guest_type, ticketCode: r.ticket_code, seatNo: r.seat_no, checkedIn: !!r.checked_in, checkedInAt: r.checked_in_at, cardStatus: r.card_status })),
        local.guests, this._known.guests, null);
      st.scores = mergeById(
        scoreR.map(r => ({ id: r.id, guestName: r.guest_name, game: r.game, points: r.points, createdAt: r.created_at })),
        local.scores, this._known.scores, null);
      st.photos = mergeById(
        photoR.map(r => ({ id: r.id, url: r.url, caption: r.caption || '', submittedBy: r.submitted_by || '', sendTo: '', source: 'booth', approved: !!r.approved, createdAt: r.created_at })),
        local.photos, this._known.photos,
        (db, l) => { db.sendTo = l.sendTo || ''; db.source = l.source || 'booth'; return db; });
      st.shoutouts = mergeById(
        shoutR.map(r => ({ id: r.id, name: r.name, message: r.message, approved: !!r.approved, createdAt: r.created_at })),
        local.shoutouts, this._known.shoutouts, null,
        r => String(r.name || '') + '|' + String(r.message || ''));

      if (triviaR.length) {
        const dbTexts = new Set(triviaR.map(r => r.question));
        st.trivia = triviaR.map(r => ({ id: r.id, question: r.question, choices: r.choices || [], answer: r.answer, active: !!r.active }));
        local.trivia.forEach(q => { if (!dbTexts.has(q.question) && !this._known.trivia.has(q.id)) st.trivia.push(q); });
        triviaR.forEach(r => { this._triviaIdByText[r.question] = r.id; });
      }
      const dbPlayKeys = new Set();
      this._playIdByKey = {};
      st.triviaPlays = playR.map(r => {
        const p = { guestName: r.guest_name, questionId: r.question_id, correct: !!r.correct, createdAt: r.created_at };
        const k = playKeyOf(p);
        dbPlayKeys.add(k);
        this._playIdByKey[k] = r.id;
        return p;
      });
      const seenPlayKeys = new Set(dbPlayKeys);
      local.triviaPlays.forEach(p => {
        const k = playKeyOf(p);
        if (!seenPlayKeys.has(k) && !this._known.plays.has(k)) { st.triviaPlays.push(p); seenPlayKeys.add(k); }
      });

      if (schedR.length) {
        st.quarters = schedR.map(r => {
          this._quarterIdBySort[r.sort] = r.id;
          return { id: 'q' + r.sort, label: r.label, timeLabel: r.time_label || '', isCurrent: !!r.is_current };
        });
      }
      if (awardR.length) {
        awardR.forEach(r => { this._awardIdByTitle[r.title] = r.id; });
        st.awards = AWARD_TITLES.map(t => {
          const r = awardR.find(x => x.title === t);
          return { title: t, winner: r ? (r.winner || '') : '' };
        });
      }
      if (cpR.length) st.checkpoints = cpR.map(r => ({ code: r.code, title: r.title, hint: r.hint || '' }));

      const dbLogIds = new Set(logR.map(r => r.id));
      st.log = logR.map(r => ({ id: r.id, kind: r.kind, detail: r.detail || '', ts: Date.parse(r.created_at) || Date.now() }));
      local.log.forEach(l => { if (!dbLogIds.has(l.id) && !this._known.log.has(l.id)) st.log.push(l); });
      st.log.sort((a, b) => a.ts - b.ts);
      st.log = st.log.slice(-200);

      // Local-only collections (no DB home): keep this device's values.
      st.cards = local.cards || [];
      st.signature = local.signature || null;
      st.ui = local.ui || st.ui;
      st.menu = local.menu || st.menu;
      st.menuNote = local.menuNote || st.menuNote;

      // Ticket sequence: never reissue a number the DB already used.
      let maxTicket = local.seq ? local.seq.ticket : 0;
      st.guests.forEach(g => {
        if (g.seatNo) maxTicket = Math.max(maxTicket, g.seatNo);
        const m = /^DEUCE10-(\d+)$/.exec(g.ticketCode || '');
        if (m) maxTicket = Math.max(maxTicket, parseInt(m[1], 10));
      });
      st.seq.ticket = maxTicket;

      this._known.families = new Set(famR.map(r => r.id));
      this._known.guests = new Set(guestR.map(r => r.id));
      this._known.scores = new Set(scoreR.map(r => r.id));
      this._known.photos = new Set(photoR.map(r => r.id));
      this._known.shoutouts = new Set(shoutR.map(r => r.id));
      this._known.trivia = new Set(triviaR.map(r => r.id));
      this._known.plays = dbPlayKeys;
      this._known.log = dbLogIds;
      this._saveKnown();

      Store.replace(st);
      this.local.persist(st);
      this._hydrated = true;
      // If the merge brought in local-only rows, push them up now (the hash
      // check inside _push keeps realtime echoes from looping).
      if (this._hash(st) !== this._lastHash) this._schedulePush();
      this._subscribeRealtime();
    } catch (e) {
      console.warn('[ddp] Supabase hydrate failed — running on local cache, will retry:', e);
      clearTimeout(this._retryTimer);
      this._retryTimer = setTimeout(() => this.hydrate(), 8000);
    } finally {
      this._hydrating = false;
    }
  }

  /* ---------- realtime: any remote change -> debounced re-hydrate ---------- */
  _subscribeRealtime() {
    if (this._client) return;
    try {
      if (typeof window === 'undefined' || !window.supabase || !window.supabase.createClient) return;
      this._client = window.supabase.createClient(this.url, this.key);
      const ch = this._client.channel('ddp-live');
      ['guests', 'scores', 'shoutouts', 'photos', 'activity_log', 'party_config'].forEach(t => {
        ch.on('postgres_changes', { event: '*', schema: 'public', table: t }, () => {
          clearTimeout(this._rtTimer);
          this._rtTimer = setTimeout(() => this.hydrate(), 500);
        });
      });
      ch.subscribe();
    } catch (e) { /* REST sync still works without the realtime client */ }
  }
}

const adapter = (CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY)
  ? new SupabaseAdapter(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY)
  : new LocalAdapter();
const BACKEND_MODE = adapter instanceof LocalAdapter ? 'local' : 'supabase';

/* ---------------- The store (single source of truth) ------------------------- */
const Store = {
  state: adapter.load() || seedState(),
  listeners: new Set(),
  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
  emit() { this.listeners.forEach(fn => { try { fn(this.state); } catch (e) { console.error(e); } }); },
  /* commit(mutatorFn): mutate state, persist, ping other tabs, notify views */
  commit(fn) {
    fn(this.state);
    adapter.persist(this.state);
    adapter.ping();
    this.emit();
  },
  replace(state) { this.state = state; this.emit(); }
};
adapter.onExternal(() => {
  const s = adapter.load();
  if (s) Store.replace(s);
});
adapter.persist(Store.state); // make sure a fresh seed is saved
if (typeof adapter.hydrate === 'function') adapter.hydrate(); // supabase: async DB sync after instant local render

/* ---------------- Derived helpers -------------------------------------------- */
function leaderboard(state, limit) {
  const by = new Map();
  state.scores.forEach(sc => {
    const k = sc.guestName.trim().toLowerCase();
    if (!by.has(k)) by.set(k, { name: sc.guestName, points: 0 });
    by.get(k).points += sc.points;
  });
  const rows = Array.from(by.values()).sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
  return limit ? rows.slice(0, limit) : rows;
}
function familyOf(state, guest) { return state.families.find(f => f.id === guest.familyId) || null; }
function totals(state) {
  return {
    families: state.families.length,
    guests: state.guests.length,
    players: state.guests.filter(g => g.type === 'player').length,
    fans: state.guests.filter(g => g.type === 'coach_fan').length,
    arrived: state.guests.filter(g => g.checkedIn).length,
    allergyFamilies: state.families.filter(f => (f.allergies || '').trim())
  };
}
function checkinURL(code) {
  return location.origin + location.pathname + '#/check-in?code=' + encodeURIComponent(code);
}
function rsvpURL() { return location.origin + location.pathname + '#/rsvp'; }
function recapURL() { return location.origin + location.pathname + '#/recap'; }

/* ---------------- Actions (all writes go through here) ----------------------- */
const Actions = {
  addRSVP({ familyName, contact, allergies, songRequest, prediction, guests }) {
    let created = null;
    Store.commit(s => {
      const fam = {
        id: uid('fam'), name: familyName.trim(), contact: (contact || '').trim(),
        allergies: (allergies || '').trim(), songRequest: (songRequest || '').trim(),
        prediction: (prediction || '').trim(), createdAt: nowISO()
      };
      s.families.push(fam);
      created = { family: fam, guests: [] };
      (guests || []).forEach((g, i) => {
        s.seq.ticket += 1;
        const guest = {
          id: uid('gst'), familyId: fam.id,
          name: (g.name || '').trim() || ('Guest ' + (i + 1)),
          type: g.type === 'coach_fan' ? 'coach_fan' : 'player',
          ticketCode: 'DEUCE10-' + String(s.seq.ticket).padStart(3, '0'),
          seatNo: s.seq.ticket,
          checkedIn: false, checkedInAt: null, cardStatus: 'none'
        };
        s.guests.push(guest);
        created.guests.push(guest);
      });
      s.log.push({ id: uid('log'), kind: 'rsvp', detail: fam.name + ' — ' + created.guests.length + ' guest(s)', ts: Date.now() });
    });
    return created;
  },

  findGuestByCode(state, code) {
    const c = String(code || '').trim().toUpperCase();
    return state.guests.find(g => g.ticketCode.toUpperCase() === c) || null;
  },

  checkIn(code) {
    const guest = Actions.findGuestByCode(Store.state, code);
    if (!guest) return { ok: false, error: 'Ticket not found. Check the code and try again.' };
    if (guest.checkedIn) return { ok: false, already: true, guest, error: guest.name + ' is already in the building.' };
    Store.commit(s => {
      const g = s.guests.find(x => x.id === guest.id);
      g.checkedIn = true; g.checkedInAt = nowISO();
      s.log.push({ id: uid('log'), kind: 'now_entering', detail: g.name, ts: Date.now() });
    });
    return { ok: true, guest: Store.state.guests.find(x => x.id === guest.id) };
  },

  setCheckedIn(guestId, val) {
    Store.commit(s => {
      const g = s.guests.find(x => x.id === guestId);
      if (g) { g.checkedIn = !!val; g.checkedInAt = val ? nowISO() : null; }
    });
  },

  setPrediction(familyId, pick) {
    Store.commit(s => {
      const f = s.families.find(x => x.id === familyId);
      if (f) f.prediction = (pick || '').trim();
    });
  },

  addScore(guestName, game, points) {
    const name = (guestName || '').trim();
    if (!name || !points) return false;
    Store.commit(s => {
      s.scores.push({ id: uid('sc'), guestName: name, game: game || 'shootout', points: parseInt(points, 10) || 0, createdAt: nowISO() });
    });
    return true;
  },

  answerTrivia(guestName, questionId, choice) {
    const name = (guestName || '').trim();
    if (!name) return { ok: false, error: 'Add your name first.' };
    const q = Store.state.trivia.find(x => x.id === questionId && x.active);
    if (!q) return { ok: false, error: 'That question is not live.' };
    const played = Store.state.triviaPlays.some(p => p.guestName.toLowerCase() === name.toLowerCase() && p.questionId === questionId);
    if (played) return { ok: false, already: true, error: 'You already took that shot. One try per question!' };
    const correct = choice === q.answer;
    Store.commit(s => {
      s.triviaPlays.push({ guestName: name, questionId, correct, createdAt: nowISO() });
      if (correct) s.scores.push({ id: uid('sc'), guestName: name, game: 'trivia', points: 10, createdAt: nowISO() });
    });
    return { ok: true, correct };
  },

  addShoutout(name, message, approved) {
    Store.commit(s => {
      s.shoutouts.push({ id: uid('so'), name: (name || 'A Fan').trim(), message: (message || '').trim(), approved: !!approved, createdAt: nowISO() });
    });
  },
  setShoutoutApproved(id, val) {
    Store.commit(s => { const so = s.shoutouts.find(x => x.id === id); if (so) so.approved = !!val; });
  },
  deleteShoutout(id) { Store.commit(s => { s.shoutouts = s.shoutouts.filter(x => x.id !== id); }); },

  addPhoto(photo) {
    Store.commit(s => {
      s.photos.push(Object.assign({
        id: uid('ph'), url: '', caption: '', submittedBy: '', sendTo: '',
        source: 'booth', approved: false, createdAt: nowISO()
      }, photo));
    });
  },
  setPhotoApproved(id, val) {
    Store.commit(s => { const p = s.photos.find(x => x.id === id); if (p) p.approved = !!val; });
  },
  deletePhoto(id) { Store.commit(s => { s.photos = s.photos.filter(x => x.id !== id); }); },

  setQuarterCurrent(id) {
    Store.commit(s => { s.quarters.forEach(q => { q.isCurrent = q.id === id; }); });
  },
  updateQuarter(id, label, timeLabel) {
    Store.commit(s => {
      const q = s.quarters.find(x => x.id === id);
      if (q) { q.label = label; q.timeLabel = timeLabel; }
    });
  },

  setAward(title, winner) {
    Store.commit(s => {
      const a = s.awards.find(x => x.title === title);
      if (a) a.winner = (winner || '').trim();
    });
  },

  addTriviaQ(question, choices, answer) {
    Store.commit(s => {
      s.trivia.push({ id: uid('tq'), question, choices, answer, active: true });
    });
  },
  updateTriviaQ(id, question, choices, answer, active) {
    Store.commit(s => {
      const q = s.trivia.find(x => x.id === id);
      if (q) { q.question = question; q.choices = choices; q.answer = answer; q.active = !!active; }
    });
  },
  deleteTriviaQ(id) { Store.commit(s => { s.trivia = s.trivia.filter(x => x.id !== id); }); },

  saveSignature(dataURL) { Store.commit(s => { s.signature = dataURL || null; }); },

  triggerGrandEntrance() { Store.commit(s => { s.ui.grandEntranceAt = Date.now(); }); },
  startCakeCountdown() { Store.commit(s => { s.ui.cakeStart = Date.now(); }); },

  saveCard(card) {
    let saved = null;
    Store.commit(s => {
      saved = Object.assign({ id: uid('card'), createdAt: nowISO() }, card);
      s.cards.push(saved);
      const g = s.guests.find(x => x.id === card.guestId);
      if (g && g.cardStatus === 'none') g.cardStatus = 'queued';
    });
    return saved;
  },
  setCardStatus(guestId, status) {
    Store.commit(s => {
      const g = s.guests.find(x => x.id === guestId);
      if (g) g.cardStatus = status;
    });
  },

  /* Q4: families whose shootout prediction matches the Shootout Champion
     get +10 on the leaderboard for each of their guests. Runs once per family. */
  scorePredictionWinners() {
    const champ = (Store.state.awards.find(a => a.title === 'Shootout Champion') || {}).winner || '';
    if (!champ) return { ok: false, error: 'Set the Shootout Champion award first.' };
    let awarded = 0;
    Store.commit(s => {
      s.families.forEach(f => {
        if (f.prediction && f.prediction.trim().toLowerCase() === champ.trim().toLowerCase()
            && !s.ui.predScoredFamilyIds.includes(f.id)) {
          s.ui.predScoredFamilyIds.push(f.id);
          s.guests.filter(g => g.familyId === f.id).forEach(g => {
            s.scores.push({ id: uid('sc'), guestName: g.name, game: 'prediction', points: 10, createdAt: nowISO() });
          });
          awarded++;
        }
      });
    });
    return { ok: true, awarded };
  },

  /* Reset everything to seeded defaults; Deuce's signature survives. */
  clearAllData() {
    const fresh = seedState();
    fresh.signature = Store.state.signature;
    Store.replace(fresh);
    adapter.persist(Store.state);
    adapter.ping();
    Store.emit();
  }
};

/* ---------------- QR + confetti helpers -------------------------------------- */
function makeQR(el, text, size) {
  if (!el) return;
  el.innerHTML = '';
  if (typeof QRCode !== 'undefined') {
    try {
      new QRCode(el, { text, width: size || 128, height: size || 128, correctLevel: QRCode.CorrectLevel.M });
      return;
    } catch (e) { /* fall through to text */ }
  }
  el.innerHTML = '<div style="font:700 11px monospace;color:#000;padding:6px;word-break:break-all">' + esc(text) + '</div>';
}
function fireConfetti(opts) {
  if (typeof confetti === 'undefined') return;
  try {
    confetti(Object.assign({
      particleCount: 130, spread: 75, startVelocity: 42,
      colors: ['#FF861F', '#244CE5', '#FFFFFF', '#FFB35C']
    }, opts || {}));
  } catch (e) {}
}

/* ---------------- Countdown helper ------------------------------------------- */
function countdownParts() {
  const diff = tipoffMs() - Date.now();
  const past = diff <= 0;
  const a = Math.abs(diff);
  return {
    past,
    d: Math.floor(a / 864e5),
    h: Math.floor(a / 36e5) % 24,
    m: Math.floor(a / 6e4) % 60,
    s: Math.floor(a / 1e3) % 60
  };
}

/* ============================================================
   3D ARENA SCENE (Three.js) — realistic bouncing ball + hoop,
   orange/blue spotlights, haze, reflective court.
   Returns a handle {destroy, shoot} or null when WebGL/THREE is
   unavailable so the caller can show the styled 2D fallback.
   ============================================================ */
function ballTexture() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#F07F13'); g.addColorStop(.5, '#E56F0A'); g.addColorStop(1, '#C85E05');
  x.fillStyle = g; x.fillRect(0, 0, 512, 256);
  // pebble grain
  x.fillStyle = 'rgba(0,0,0,.08)';
  for (let i = 0; i < 2600; i++) x.fillRect(Math.random() * 512, Math.random() * 256, 2, 2);
  // seams
  x.strokeStyle = '#1A0E04'; x.lineWidth = 5;
  x.beginPath(); x.moveTo(0, 128); x.lineTo(512, 128); x.stroke();
  [0, 128, 256, 384, 512].forEach(px => { x.beginPath(); x.moveTo(px, 0); x.lineTo(px, 256); x.stroke(); });
  x.beginPath(); x.ellipse(128, 128, 44, 128, 0, 0, Math.PI * 2); x.stroke();
  x.beginPath(); x.ellipse(384, 128, 44, 128, 0, 0, Math.PI * 2); x.stroke();
  const t = new THREE.CanvasTexture(c);
  return t;
}
function courtTexture() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 640;
  const x = c.getContext('2d');
  x.fillStyle = '#141210'; x.fillRect(0, 0, 1024, 640);
  // subtle wood planks
  for (let i = 0; i < 16; i++) {
    x.fillStyle = i % 2 ? 'rgba(255,150,60,.045)' : 'rgba(90,120,255,.04)';
    x.fillRect(0, i * 40, 1024, 40);
  }
  x.strokeStyle = 'rgba(255,255,255,.75)'; x.lineWidth = 5;
  x.strokeRect(26, 26, 972, 588);
  x.beginPath(); x.moveTo(512, 26); x.lineTo(512, 614); x.stroke();
  x.beginPath(); x.arc(512, 320, 92, 0, Math.PI * 2); x.stroke();
  x.strokeStyle = '#FF861F'; x.lineWidth = 6;
  x.strokeRect(26, 190, 190, 260);
  x.beginPath(); x.arc(216, 320, 92, -Math.PI / 2, Math.PI / 2); x.stroke();
  x.strokeRect(808, 190, 190, 260);
  x.beginPath(); x.arc(808, 320, 92, Math.PI / 2, Math.PI * 1.5); x.stroke();
  const t = new THREE.CanvasTexture(c);
  return t;
}

function mountArena(canvas, opts) {
  opts = opts || {};
  if (typeof THREE === 'undefined' || !canvas) return null;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  } catch (e) { return null; }
  if (!renderer || !renderer.getContext()) return null;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x04060c);
  scene.fog = new THREE.Fog(0x04060c, 12, 30);

  const camera = new THREE.PerspectiveCamera(46, 16 / 9, 0.1, 100);
  camera.position.set(0, 3.4, 10.5);
  camera.lookAt(0, 1.7, -1);

  scene.add(new THREE.AmbientLight(0x334, 0.7));
  const spotO = new THREE.SpotLight(0xff861f, 900, 40, 0.5, 0.55, 1.6);
  spotO.position.set(-7, 11, 3); scene.add(spotO);
  const spotB = new THREE.SpotLight(0x244ce5, 950, 40, 0.5, 0.55, 1.6);
  spotB.position.set(7, 11, 3); scene.add(spotB);
  const spotW = new THREE.SpotLight(0xffffff, 500, 40, 0.42, 0.7, 1.6);
  spotW.position.set(0, 12, -2); scene.add(spotW);
  [spotO, spotB, spotW].forEach(s => { s.target.position.set(0, 0, -1); scene.add(s.target); });

  // reflective court
  const court = new THREE.Mesh(
    new THREE.PlaneGeometry(17, 10.6),
    new THREE.MeshStandardMaterial({ map: courtTexture(), roughness: 0.32, metalness: 0.25 })
  );
  court.rotation.x = -Math.PI / 2; court.position.z = -1;
  scene.add(court);

  // spotlight cones (visible beams through the haze)
  function beam(color, x0) {
    const geo = new THREE.ConeGeometry(3.4, 11.5, 24, 1, true);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x0 / 2, 5.6, 1);
    m.rotation.z = x0 > 0 ? 0.5 : -0.5;
    return m;
  }
  scene.add(beam(0xff861f, -7)); scene.add(beam(0x244ce5, 7));

  // haze particles
  const pGeo = new THREE.BufferGeometry();
  const pCount = 260, pos = new Float32Array(pCount * 3);
  for (let i = 0; i < pCount; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 18;
    pos[i * 3 + 1] = Math.random() * 7 + 0.4;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 10;
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const haze = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: 0x9db4ff, size: 0.05, transparent: true, opacity: 0.5 }));
  scene.add(haze);

  // hoop: pole, backboard, rim, net
  const hoop = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 3.9), new THREE.MeshStandardMaterial({ color: 0x222a3d, roughness: .5, metalness: .6 }));
  pole.position.set(0, 1.95, 0); hoop.add(pole);
  const board = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.15, 0.06),
    new THREE.MeshStandardMaterial({ color: 0xf4f7ff, roughness: .25, metalness: .1, transparent: true, opacity: 0.92 }));
  board.position.set(0, 3.45, 0.42); hoop.add(board);
  const boardEdge = new THREE.Mesh(new THREE.BoxGeometry(1.98, 1.23, 0.03),
    new THREE.MeshBasicMaterial({ color: 0xff861f }));
  boardEdge.position.set(0, 3.45, 0.38); hoop.add(boardEdge);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.035, 10, 28),
    new THREE.MeshStandardMaterial({ color: 0xd84315, roughness: .4, metalness: .5 }));
  rim.rotation.x = Math.PI / 2; rim.position.set(0, 3.02, 0.95); hoop.add(rim);
  const net = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.24, 0.42, 10, 3, true),
    new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.55 }));
  net.position.set(0, 2.8, 0.95); hoop.add(net);
  hoop.position.set(1.9, 0, -4.2);
  scene.add(hoop);

  // the ball
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.42, 40, 28),
    new THREE.MeshStandardMaterial({ map: ballTexture(), roughness: 0.62, metalness: 0.05 }));
  ball.position.set(-1.6, 0.42, 0.6);
  scene.add(ball);
  // soft blob shadow
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.46, 24),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.42 }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.012;
  scene.add(shadow);

  let raf = 0, destroyed = false, t0 = performance.now();
  let shooting = null; // {start, from:Vector3, make:boolean}
  const rimPos = new THREE.Vector3(1.9, 3.05, -3.25);
  const state = { fun: 0 };

  function shoot() {
    if (shooting) return;
    shooting = { start: performance.now(), from: ball.position.clone(), make: Math.random() < 0.82 };
  }
  function onTap() { shoot(); }
  canvas.addEventListener('pointerdown', onTap);

  function resize() {
    const w = canvas.clientWidth || canvas.parentElement.clientWidth || 800;
    const h = canvas.clientHeight || canvas.parentElement.clientHeight || 380;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  function frame(now) {
    if (destroyed) return;
    raf = requestAnimationFrame(frame);
    const t = (now - t0) / 1000;
    haze.rotation.y = t * 0.012;
    if (shooting) {
      const k = Math.min(1, (now - shooting.start) / 720);
      const from = shooting.from;
      const target = shooting.make ? rimPos : rimPos.clone().add(new THREE.Vector3(0.85, 0.25, 0.3));
      ball.position.lerpVectors(from, target, k);
      ball.position.y = from.y + (target.y - from.y) * k + Math.sin(k * Math.PI) * 1.7;
      ball.rotation.x -= 0.22; ball.rotation.z -= 0.1;
      if (k >= 1) {
        if (shooting.make) {
          state.fun += 2;
          if (opts.onScore) opts.onScore(state.fun);
          fireConfetti({ particleCount: 70, spread: 60, startVelocity: 32, scalar: 0.85 });
        }
        shooting = null;
        ball.position.set(-1.6 - Math.random() * 1.4, 2.6, 0.6);
      }
    } else {
      // idle bounce
      const bounce = Math.abs(Math.sin(t * 3.1));
      ball.position.y = 0.42 + bounce * 1.25;
      ball.position.x = -1.6 + Math.sin(t * 0.55) * 0.9;
      ball.position.z = 0.6 + Math.cos(t * 0.4) * 0.35;
      const squash = 1 - Math.max(0, 0.16 - bounce) * 0.9;
      ball.scale.set(1 + (1 - squash) * 0.35, squash, 1 + (1 - squash) * 0.35);
      ball.rotation.z -= 0.012; ball.rotation.x += 0.006;
    }
    shadow.position.x = ball.position.x; shadow.position.z = ball.position.z;
    const shScale = Math.max(0.35, 1.15 - ball.position.y * 0.22);
    shadow.scale.set(shScale, shScale, 1);
    shadow.material.opacity = 0.16 + shScale * 0.22;
    renderer.render(scene, camera);
  }
  raf = requestAnimationFrame(frame);

  return {
    shoot,
    get fun() { return state.fun; },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      canvas.removeEventListener('pointerdown', onTap);
      window.removeEventListener('resize', resize);
      try { renderer.dispose(); } catch (e) {}
    }
  };
}

/* Arena block used by Invite / Jumbotron / Cake Finale.
   Builds the wrapper markup, mounts 3D, or reveals the 2D fallback. */
function arenaHTML(id) {
  return '<div class="arena-wrap" id="' + id + '">' +
    '<div class="arena-fallback"><div class="court"></div><div class="ball2d"></div></div>' +
    '<canvas class="gl"></canvas>' +
    '<div class="fun-score" style="display:none">FUN <span class="fv">00</span></div>' +
    '<div class="tap-hint">Tap the court — take a shot</div>' +
    '</div>';
}
function arenaInit(wrapId, cleanups) {
  const wrap = document.getElementById(wrapId);
  if (!wrap) return null;
  const canvas = wrap.querySelector('canvas.gl');
  const scoreEl = wrap.querySelector('.fun-score');
  const handle = mountArena(canvas, {
    onScore(fun) {
      if (scoreEl) { scoreEl.style.display = ''; scoreEl.querySelector('.fv').textContent = pad2(fun); }
    }
  });
  if (!handle) {
    canvas.style.display = 'none';
    const fb = wrap.querySelector('.arena-fallback');
    if (fb) fb.style.display = 'block';
    const hint = wrap.querySelector('.tap-hint');
    if (hint) hint.textContent = 'Game day energy, live from the arena';
    return null;
  }
  if (cleanups) cleanups.push(() => handle.destroy());
  return handle;
}

/* ============================================================
   ROUTER + VIEW SHELL
   ============================================================ */
const appEl = document.getElementById('app');
let routeCleanups = [];
function onCleanup(fn) { routeCleanups.push(fn); }
function runCleanups() {
  routeCleanups.forEach(f => { try { f(); } catch (e) {} });
  routeCleanups = [];
}
function every(ms, fn) { const id = setInterval(fn, ms); onCleanup(() => clearInterval(id)); return id; }
function watchStore(fn) { const off = Store.subscribe(fn); onCleanup(off); }

function parseHash() {
  let h = location.hash.replace(/^#/, '');
  if (h.startsWith('/')) h = h.slice(1);
  const [path, qs] = h.split('?');
  return { path: path || '', params: new URLSearchParams(qs || '') };
}

const PAGE_TITLES = {
  rsvp: 'RSVP', tickets: 'My Tickets', 'check-in': 'Door Check-In', admin: 'Admin',
  trivia: 'Trivia', booth: 'Photo Booth', cards: 'Player Card Studio', recap: 'Recap',
  jumbotron: 'Jumbotron TV', 'snack-tv': 'Snack TV'
};
function router() {
  runCleanups();
  document.body.classList.remove('tv');
  const { path, params } = parseHash();
  $$('#mainnav a').forEach(a => {
    const href = a.getAttribute('href').replace(/^#\/?/, '');
    a.classList.toggle('on', href === path);
  });
  /* The home scoreboard is the hub: inner pages get a compact
     "back to the hub" link + the current page title instead of the full nav. */
  const mainnav = $('#mainnav'), hubnav = $('#hubnav');
  if (mainnav && hubnav) {
    const isHome = path === '';
    mainnav.hidden = !isHome;
    hubnav.hidden = isHome;
    if (!isHome) $('#hub-title').textContent = PAGE_TITLES[path] || '';
  }
  window.scrollTo(0, 0);
  switch (path) {
    case '':           return viewInvite();
    case 'rsvp':       return viewRSVP();
    case 'tickets':    return viewTickets();
    case 'check-in':   return viewCheckIn(params);
    case 'jumbotron':  return viewJumbotron();
    case 'snack-tv':   return viewSnackTV();
    case 'admin':      return viewAdmin();
    case 'trivia':     return viewTrivia();
    case 'booth':      return viewBooth();
    case 'cards':      return viewCards();
    case 'recap':      return viewRecap();
    default:           return viewInvite();
  }
}
window.addEventListener('hashchange', router);

/* ---------------- INVITE / HOME — the scoreboard hub ---------------- */
function hubLink(href, title, sub) {
  return '<a class="hub-link" href="' + href + '"><span class="hl-title">' + title + '</span>' +
    '<span class="hl-sub">' + sub + '</span></a>';
}
function viewInvite() {
  const s = Store.state;
  appEl.innerHTML =
    '<div class="hub">' +
      '<div class="hub-center">' +
        '<div class="scoreboard"><img src="assets/jumbotron.jpg" alt="Arena scoreboard cube lit up for game day"></div>' +
        '<div class="led-screen">' +
          '<div class="led-kicker">You\'re invited to the game of the year</div>' +
          '<div class="led-name">' + esc(PARTY.name.toUpperCase()) + '</div>' +
          '<div class="led-stat">' + esc(PARTY.statLine) + '</div>' +
          '<div class="count-chip" id="cd-chip"></div>' +
          '<div class="led-when">' + esc(PARTY.dateText) + ' · Tip-off ' + esc(PARTY.timeText) + ' · ' + esc(PARTY.placeText) + '</div>' +
        '</div>' +
      '</div>' +
      '<section class="hub-side hub-guests" aria-label="Guest options">' +
        '<div class="hub-label">For Guests</div>' +
        '<div class="hub-links">' +
          hubLink('#/rsvp', 'RSVP', 'Get your game tickets') +
          hubLink('#/tickets', 'My Tickets', 'Your QR — phone or paper') +
          hubLink('#/trivia', 'Trivia', 'Know Deuce — +10 a pop') +
          hubLink('#/booth', 'Photo Booth', 'Fan Cam for the big screens') +
          hubLink('#/cards', 'Player Card', 'Design your 4x6 card') +
          hubLink('#/recap', 'Recap', 'Post-game highlights') +
        '</div>' +
      '</section>' +
      '<section class="hub-side hub-host" aria-label="Host controls">' +
        '<div class="hub-label">For Patience — Host Controls</div>' +
        '<div class="hub-links">' +
          hubLink('#/admin', 'Admin', 'Totals, queues &amp; awards') +
          hubLink('#/check-in', 'Door Check-In', 'Scan tickets at the door') +
          hubLink('#/jumbotron', 'Jumbotron TV', 'The den big screen') +
          hubLink('#/snack-tv', 'Snack TV', 'Snack table screen') +
        '</div>' +
      '</section>' +
    '</div>' +
    arenaHTML('arena-invite') +

    '<div class="grid2">' +
      '<section class="panel"><h2>Game Plan — The Quarters</h2><div id="invite-quarters"></div></section>' +
      '<section class="panel center"><h2>Scan to RSVP</h2>' +
        '<div class="qr-box"><div id="invite-rsvp-qr"></div><div class="qr-cap">POINT YOUR CAMERA — RSVP</div></div>' +
        '<p class="muted">Every RSVP makes a real game ticket with its own scannable code. Bring it on your phone or printed — the door scans both.</p>' +
      '</section>' +
    '</div>' +

    '<section class="panel"><h2>Fan Shout-Outs</h2>' +
      '<div id="invite-shouts"></div>' +
      '<form id="shout-form" class="rowflex" style="margin-top:12px">' +
        '<input name="name" placeholder="Your name" maxlength="40" style="flex:1;min-width:140px">' +
        '<input name="message" placeholder="Shout-out for the big screens…" maxlength="120" style="flex:2;min-width:200px" required>' +
        '<button class="btn sm" type="submit">Send</button>' +
      '</form>' +
      '<div id="shout-msg" class="small muted"></div>' +
    '</section>';

  arenaInit('arena-invite', routeCleanups);
  makeQR($('#invite-rsvp-qr'), rsvpURL(), 148);

  const chip = $('#cd-chip');
  const drawChip = () => {
    const c = countdownParts();
    chip.innerHTML = c.past
      ? '<b>GAME TIME!</b>'
      : '<div><b>' + c.d + '</b><span>DAYS</span></div><div><b>' + pad2(c.h) + '</b><span>HRS</span></div>' +
        '<div><b>' + pad2(c.m) + '</b><span>MIN</span></div><div><b>' + pad2(c.s) + '</b><span>SEC</span></div>';
  };
  drawChip(); every(1000, drawChip);

  const drawQuarters = () => {
    $('#invite-quarters').innerHTML = Store.state.quarters.map(q =>
      '<div class="q-row' + (q.isCurrent ? ' cur' : '') + '"><span class="qt">' + esc(q.label) + '</span>' +
      (q.timeLabel ? '<span class="muted">' + esc(q.timeLabel) + '</span>' : '') +
      (q.isCurrent ? '<span class="now">ON COURT NOW</span>' : '') + '</div>').join('');
  };
  const drawShouts = () => {
    const list = Store.state.shoutouts.filter(x => x.approved).slice(-3).reverse();
    $('#invite-shouts').innerHTML = list.length
      ? list.map(x => '<p class="shout" style="font-size:20px">“' + esc(x.message) + '”<small>— ' + esc(x.name) + '</small></p>').join('')
      : '<p class="muted">No shout-outs yet — be the first voice in the arena.</p>';
  };
  drawQuarters(); drawShouts();
  watchStore(() => { drawQuarters(); drawShouts(); });

  $('#shout-form').addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    Actions.addShoutout(fd.get('name'), fd.get('message'), false);
    e.target.reset();
    $('#shout-msg').textContent = 'Got it! Your shout-out goes to the approval queue — watch the big screens on game day.';
  });
}

/* ---------------- RSVP ---------------- */
function viewRSVP() {
  appEl.innerHTML =
    '<section class="panel"><h2>RSVP — Join the Roster</h2>' +
    '<p class="muted">One form per family. Every guest gets their own scannable game ticket — Section FAMILY, Row 10.</p>' +
    '<form id="rsvp-form">' +
      '<label>Family / Group Name</label><input name="familyName" required maxlength="60" placeholder="e.g. The Johnson Family">' +
      '<label>Your Email or Phone (for your tickets + recap)</label><input name="contact" maxlength="80" placeholder="you@email.com or (555) 555-0100">' +
      '<label>How many guests (including kids)?</label>' +
      '<select name="count" id="rsvp-count">' + [1,2,3,4,5,6,7,8].map(n => '<option' + (n === 3 ? ' selected' : '') + '>' + n + '</option>').join('') + '</select>' +
      '<div id="rsvp-guests"></div>' +
      '<label>Allergies or food notes (optional)</label><textarea name="allergies" rows="2" maxlength="240" placeholder="Anything the concession stand should know"></textarea>' +
      '<label>Song request for the party playlist (optional)</label><input name="songRequest" maxlength="80" placeholder="Song title — artist">' +
      '<label>Prediction — who wins the Shootout?</label><input name="prediction" id="rsvp-pred" maxlength="60" list="pred-list" placeholder="Pick a player…"><datalist id="pred-list"></datalist>' +
      '<div style="margin-top:20px"><button class="btn big" type="submit">Lock In My Tickets</button></div>' +
    '</form><div id="rsvp-done"></div></section>';

  const guestsBox = $('#rsvp-guests');
  function drawGuestRows() {
    const count = parseInt($('#rsvp-count').value, 10);
    const prev = $$('.g-name', guestsBox).map(i => i.value);
    const prevT = $$('.g-type', guestsBox).map(i => i.value);
    guestsBox.innerHTML = Array.from({ length: count }, (_, i) =>
      '<div class="rowflex" style="margin-top:10px">' +
        '<input class="g-name" placeholder="Guest ' + (i + 1) + ' name" maxlength="40" style="flex:2;min-width:170px" value="' + esc(prev[i] || '') + '">' +
        '<select class="g-type" style="flex:1;min-width:140px">' +
          '<option value="player"' + (prevT[i] === 'player' ? ' selected' : '') + '>Player (kid)</option>' +
          '<option value="coach_fan"' + (prevT[i] === 'coach_fan' ? ' selected' : '') + '>Coach / Fan (grown-up)</option>' +
        '</select></div>').join('');
  }
  drawGuestRows();
  $('#rsvp-count').addEventListener('change', drawGuestRows);

  const drawPredList = () => {
    const names = Store.state.guests.filter(g => g.type === 'player').map(g => g.name);
    $('#pred-list').innerHTML = ['Deuce'].concat(names).map(n => '<option value="' + esc(n) + '">').join('');
  };
  drawPredList(); watchStore(drawPredList);

  $('#rsvp-form').addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const guests = $$('.g-name', guestsBox).map((inp, i) => ({
      name: inp.value, type: $$('.g-type', guestsBox)[i].value
    }));
    const created = Actions.addRSVP({
      familyName: fd.get('familyName'), contact: fd.get('contact'),
      allergies: fd.get('allergies'), songRequest: fd.get('songRequest'),
      prediction: fd.get('prediction'), guests
    });
    /* Confirmation email (Supabase mode only): fire-and-forget to the
       send-rsvp-confirmation edge function when the contact is an email.
       Never blocks or breaks the RSVP if the send fails. */
    try {
      const contact = String(fd.get('contact') || '').trim();
      if (typeof BACKEND_MODE !== 'undefined' && BACKEND_MODE === 'supabase' &&
          /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contact) && created.guests.length) {
        fetch(CONFIG.SUPABASE_URL + '/functions/v1/send-rsvp-confirmation', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': CONFIG.SUPABASE_ANON_KEY,
            'Authorization': 'Bearer ' + CONFIG.SUPABASE_ANON_KEY
          },
          body: JSON.stringify({
            email: contact,
            name: created.family.name,
            ticketCode: created.guests[0].ticketCode,
            guestCount: created.guests.length
          })
        }).catch(() => {});
      }
    } catch (e) { /* email is a bonus; the RSVP itself already landed */ }
    fireConfetti({ particleCount: 90, spread: 65 });
    $('#rsvp-done').innerHTML =
      '<div class="flash ok">You\'re on the roster, ' + esc(created.family.name) + '! ' +
      created.guests.length + ' ticket(s) issued:</div>' +
      created.guests.map(g => '<p style="margin:6px 0"><b>' + esc(g.name) + '</b> — ticket <b>' + esc(g.ticketCode) + '</b> · Section FAMILY · Row 10 · Seat ' + g.seatNo + '</p>').join('') +
      '<div class="rowflex" style="margin-top:12px"><a class="btn" href="#/tickets">See &amp; Print Tickets</a>' +
      '<a class="btn ghost" href="#/trivia">Play Know Deuce Trivia</a></div>';
    e.target.style.display = 'none';
    window.scrollTo(0, document.body.scrollHeight);
  });
}

/* ---------------- TICKETS ---------------- */
function ticketCardHTML(g, fam) {
  return '<article class="ticket">' +
    '<div class="ticket-main">' +
      '<div class="ticket-meta"><span><b>' + esc(PARTY.name.toUpperCase()) + '</b></span><span>' + esc(PARTY.dateText) + ' · ' + esc(PARTY.timeText) + '</span></div>' +
      '<div class="t-name">' + esc(g.name) + '</div>' +
      '<div class="ticket-meta">' +
        '<span>SECTION <b>FAMILY</b></span><span>ROW <b>10</b></span><span>SEAT <b>' + g.seatNo + '</b></span>' +
        '<span>' + (g.type === 'player' ? 'PLAYER' : 'COACH / FAN') + '</span>' +
        (fam ? '<span>' + esc(fam.name) + '</span>' : '') +
      '</div>' +
      '<div style="margin-top:8px">' + (g.checkedIn ? '<span class="tag in">IN THE BUILDING</span>' : '<span class="tag out">NOT SCANNED YET</span>') + '</div>' +
    '</div>' +
    '<div class="ticket-stub"><div class="qr-box"><div class="qr-slot" data-code="' + esc(g.ticketCode) + '"></div></div>' +
      '<div class="ticket-code">' + esc(g.ticketCode) + '</div><div class="small muted">SCAN AT THE DOOR</div></div>' +
  '</article>';
}
function paintTicketQRs(root) {
  $$('.qr-slot', root).forEach(el => makeQR(el, checkinURL(el.dataset.code), 118));
}

function viewTickets() {
  appEl.innerHTML =
    '<section class="panel"><h2>Game Tickets</h2>' +
    '<p class="muted">Show the QR on your phone at the door, or print the paper tickets — 3 to a page, big code under every QR.</p>' +
    '<div class="rowflex"><input id="tk-filter" placeholder="Filter by family, guest, or code…" style="flex:1;min-width:200px">' +
    '<button class="btn blue" id="tk-print-all">Print All Paper Tickets</button></div>' +
    '<div id="tk-list"></div></section>';

  const draw = () => {
    const q = ($('#tk-filter').value || '').toLowerCase();
    const s = Store.state;
    const rows = s.guests.filter(g => {
      const fam = familyOf(s, g);
      return !q || g.name.toLowerCase().includes(q) || g.ticketCode.toLowerCase().includes(q) ||
        (fam && fam.name.toLowerCase().includes(q));
    });
    $('#tk-list').innerHTML = rows.length
      ? rows.map(g => ticketCardHTML(g, familyOf(s, g))).join('')
      : '<div class="flash info" style="margin-top:14px">No tickets yet. <a href="#/rsvp">RSVP to get yours</a> — your name goes on the roster and your ticket prints right here.</div>';
    paintTicketQRs($('#tk-list'));
  };
  draw(); watchStore(draw);
  $('#tk-filter').addEventListener('input', draw);
  $('#tk-print-all').addEventListener('click', () => printPaperTickets(Store.state.guests));
}

function printPaperTickets(guests) {
  if (!guests.length) return;
  const s = Store.state;
  const area = $('#print-area');
  area.innerHTML = guests.map(g => {
    const fam = familyOf(s, g);
    return '<div class="paper-ticket"><div>' +
      '<div style="font-size:10pt;letter-spacing:2px;font-weight:700">' + esc(PARTY.name.toUpperCase()) + '</div>' +
      '<div class="pt-name">' + esc(g.name) + '</div>' +
      '<div class="pt-meta">' + esc(PARTY.dateText) + ' · Tip-off ' + esc(PARTY.timeText) + ' · ' + esc(PARTY.placeText) + '<br>' +
      'SECTION <b>FAMILY</b> · ROW <b>10</b> · SEAT <b>' + g.seatNo + '</b>' + (fam ? ' · ' + esc(fam.name) : '') + '<br>' +
      esc(PARTY.statLine) + '</div></div>' +
      '<div class="pt-side"><div class="pt-qr" data-code="' + esc(g.ticketCode) + '"></div>' +
      '<div class="pt-code">' + esc(g.ticketCode) + '</div></div></div>';
  }).join('');
  $$('.pt-qr', area).forEach(el => makeQR(el, checkinURL(el.dataset.code), 220));
  setTimeout(() => window.print(), 400);
}

/* ---------------- CHECK-IN (the door) ---------------- */
function extractCode(text) {
  const t = String(text || '').trim();
  const m = t.match(/code=([A-Za-z0-9-]+)/) || t.match(/(DEUCE10-[A-Za-z0-9-]+)/i);
  return m ? m[1].toUpperCase() : t.toUpperCase();
}
function viewCheckIn(params) {
  appEl.innerHTML =
    '<section class="panel center"><h2>Door Check-In</h2>' +
    '<p class="muted">Scan a ticket QR — phone or paper — or type the code under it. One scan per ticket: that\'s the starting lineup.</p>' +
    '<div id="qr-reader"></div>' +
    '<div class="rowflex" style="justify-content:center;margin-top:12px">' +
      '<button class="btn blue" id="scan-start">Start Camera Scan</button>' +
      '<button class="btn ghost" id="scan-stop" disabled>Stop Camera</button>' +
    '</div>' +
    '<div class="rowflex" style="justify-content:center;margin-top:16px">' +
      '<input id="ci-code" placeholder="DEUCE10-001" style="max-width:260px;text-transform:uppercase" autocomplete="off">' +
      '<button class="btn" id="ci-go">Check In</button>' +
    '</div>' +
    '<div id="ci-result" style="margin-top:18px"></div>' +
    '<div id="ci-recent" style="margin-top:14px"></div>' +
    '</section>';

  const result = $('#ci-result');
  let scanner = null;

  function showResult(html) { result.innerHTML = html; }
  function predictionBlock(guest) {
    const fam = familyOf(Store.state, guest);
    if (!fam || fam.prediction) return '';
    const players = Store.state.guests.filter(g => g.type === 'player');
    return '<div class="panel" style="max-width:520px;margin:14px auto;text-align:left"><h3>Quick prediction</h3>' +
      '<p class="muted small">Who wins the Shootout today? Right picks score in the 4th Quarter.</p>' +
      '<div class="rowflex"><select id="ci-pred" style="flex:1;min-width:160px">' +
      '<option value="">— pick a player —</option>' +
      players.map(p => '<option>' + esc(p.name) + '</option>').join('') + '</select>' +
      '<button class="btn sm" id="ci-pred-save">Save Pick</button></div></div>';
  }
  function wirePrediction(guest) {
    const btn = $('#ci-pred-save');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const pick = $('#ci-pred').value;
      if (!pick) return;
      Actions.setPrediction(guest.familyId, pick);
      showResult('<div class="flash ok">Prediction locked: <b>' + esc(pick) + '</b> takes the Shootout. Good luck, ' + esc(guest.name) + '!</div>');
    });
  }
  function attempt(code) {
    const r = Actions.checkIn(code);
    if (r.ok) {
      fireConfetti({ particleCount: 110, spread: 70 });
      showResult('<div class="flash ok"><div class="big-result">NOW ENTERING<br>' + esc(r.guest.name.toUpperCase()) + '</div>' +
        '<p class="center" style="margin:4px">Ticket ' + esc(r.guest.ticketCode) + ' · Section FAMILY · Row 10 · Seat ' + r.guest.seatNo + ' — watch the Jumbotron!</p></div>' +
        predictionBlock(r.guest));
      wirePrediction(r.guest);
    } else if (r.already) {
      showResult('<div class="flash info"><div class="big-result">' + esc(r.guest.name.toUpperCase()) + '</div>' +
        '<p class="center" style="margin:4px">Already in the building — this ticket was scanned earlier. One ticket, one entry.</p></div>');
    } else {
      showResult('<div class="flash err">' + esc(r.error) + '</div>');
    }
    drawRecent();
  }
  function drawRecent() {
    const arrived = Store.state.guests.filter(g => g.checkedIn).slice(-5).reverse();
    $('#ci-recent').innerHTML = arrived.length
      ? '<p class="muted small">IN THE BUILDING (' + Store.state.guests.filter(g => g.checkedIn).length + '): ' +
        arrived.map(g => esc(g.name)).join(' · ') + '</p>'
      : '<p class="muted small">Nobody scanned in yet — doors open at tip-off.</p>';
  }
  drawRecent(); watchStore(drawRecent);

  $('#ci-go').addEventListener('click', () => { const v = $('#ci-code').value; if (v) attempt(extractCode(v)); });
  $('#ci-code').addEventListener('keydown', e => { if (e.key === 'Enter') $('#ci-go').click(); });

  const startBtn = $('#scan-start'), stopBtn = $('#scan-stop');
  startBtn.addEventListener('click', async () => {
    if (typeof Html5Qrcode === 'undefined') {
      showResult('<div class="flash err">Camera scanning library did not load — type the ticket code instead.</div>');
      return;
    }
    try {
      scanner = new Html5Qrcode('qr-reader');
      await scanner.start({ facingMode: 'environment' }, { fps: 10, qrbox: 240 },
        txt => { attempt(extractCode(txt)); }, () => {});
      startBtn.disabled = true; stopBtn.disabled = false;
    } catch (e) {
      showResult('<div class="flash err">Camera unavailable (' + esc(e && e.message ? e.message : 'blocked') + ') — type the ticket code instead.</div>');
    }
  });
  const stopScanner = async () => { if (scanner) { try { await scanner.stop(); } catch (e) {} scanner = null; } };
  stopBtn.addEventListener('click', async () => { await stopScanner(); startBtn.disabled = false; stopBtn.disabled = true; });
  onCleanup(stopScanner);

  const pre = params.get('code');
  if (pre) { $('#ci-code').value = pre; attempt(pre); }
}

/* ---------------- TV shared bits ---------------- */
function leaderboardHTML(state, limit, cls) {
  const rows = leaderboard(state, limit || 10);
  if (!rows.length) return '<p class="tv-sub">No points on the board yet — the shootout, stations and trivia all score here.</p>';
  return rows.map((r, i) =>
    '<div class="lb-row"><span class="nm">' + (i + 1) + '. ' + esc(r.name) + '</span><span class="pts">' + r.points + ' PTS</span></div>').join('');
}
function quartersHTML(state) {
  return state.quarters.map(q =>
    '<div class="q-row' + (q.isCurrent ? ' cur' : '') + '"><span class="qt">' + esc(q.label) + '</span>' +
    (q.timeLabel ? '<span class="muted">' + esc(q.timeLabel) + '</span>' : '') +
    (q.isCurrent ? '<span class="now">ON COURT NOW</span>' : '') + '</div>').join('');
}
function photoWallHTML(state) {
  const photos = state.photos.filter(p => p.approved);
  if (!photos.length) return '<p class="tv-sub">The Fan Cam wall is warming up — booth photos land here once approved.</p>';
  return '<div class="photo-wall">' + photos.map(p =>
    '<figure><img src="' + p.url + '" alt=""><figcaption>' + esc(p.caption || p.submittedBy || 'Fan Cam') + '</figcaption></figure>').join('') + '</div>';
}
/* Giant "10" mosaic: 11 x 7 cell mask, approved photos fill the lit cells. */
const MOSAIC_MASK = [
  '00100.01110',
  '01100.10001',
  '00100.10011',
  '00100.10101',
  '00100.11001',
  '00100.10001',
  '01110.01110'
];
function mosaicHTML(state) {
  const photos = state.photos.filter(p => p.approved);
  let n = 0;
  const cells = [];
  MOSAIC_MASK.forEach(row => {
    row.split('').forEach(ch => {
      if (ch === '.') { cells.push('<div class="cell void"></div>'); return; }
      const p = photos.length ? photos[n % photos.length] : null;
      n++;
      cells.push(p
        ? '<div class="cell on"><img src="' + p.url + '" alt=""></div>'
        : '<div class="cell on"></div>');
    });
  });
  return '<div class="mosaic" style="grid-template-columns:repeat(11,1fr)">' + cells.join('') + '</div>' +
    (photos.length ? '' : '<p class="tv-sub" style="margin-top:2vh">Every approved photo fills in the big 1-0 — hit the photo booth!</p>');
}
function cakeOverlayHTML(state) {
  const start = state.ui.cakeStart;
  if (!start) return '';
  const el = (Date.now() - start) / 1000;
  if (el < 10) {
    return '<div class="tv-flash"><div class="tv-kicker">Everybody count with us</div>' +
      '<div class="tv-giant" style="font-size:clamp(90px,22vw,300px)">' + (10 - Math.floor(el)) + '</div></div>';
  }
  if (el < 45) {
    return '<div class="tv-flash"><div class="tv-kicker">The Trophy Cake</div>' +
      '<div class="tv-giant">HAPPY BIRTHDAY<br><span class="o">DEUCE!</span></div>' +
      '<div class="tv-sub">' + esc(PARTY.statLine) + '</div></div>';
  }
  return '';
}
function grandEntranceHTML(state) {
  const at = state.ui.grandEntranceAt;
  if (!at || Date.now() - at > 25000) return '';
  return '<div class="tv-flash"><div class="tv-kicker">Now Entering</div>' +
    '<div class="tv-giant">DEUCE <span class="o">#10</span></div>' +
    '<div class="tv-sub">' + esc(PARTY.statLine) + '</div>' +
    '<div class="tv-sub">The birthday MVP — make some noise!</div></div>';
}

/* ---------------- JUMBOTRON ---------------- */
function viewJumbotron() {
  document.body.classList.add('tv');
  appEl.innerHTML = '<div class="tv-screen" id="jumbo"></div>';
  const el = $('#jumbo');
  let panelIdx = 0, panelCleanups = [];
  let lastGrand = 0, lastCakePop = 0;
  const clearPanel = () => { panelCleanups.forEach(f => { try { f(); } catch (e) {} }); panelCleanups = []; };

  function panels() {
    const s = Store.state;
    const list = [];
    const recent = s.log.filter(l => l.kind === 'now_entering' && Date.now() - l.ts < 90000).slice(-1)[0];
    const lastArrived = s.guests.filter(g => g.checkedIn).slice(-1)[0];
    list.push(() => '<div class="tv-kicker">Now Entering</div>' +
      '<div class="tv-giant">' + esc(recent ? recent.detail : (lastArrived ? lastArrived.name : 'GAME DAY')) + '</div>' +
      '<div class="tv-sub">' + (recent || lastArrived ? 'Welcome to the arena — find your seat in Section FAMILY, Row 10!' : 'Doors open at tip-off — tickets ready!') + '</div>');
    list.push(() => '<div class="tv-kicker">Leaderboard</div><div class="tv-panel">' + leaderboardHTML(s, 10) + '</div>');
    list.push(() => '<div class="tv-kicker">The Quarters</div><div class="tv-panel">' + quartersHTML(s) + '</div>');
    list.push(() => {
      const so = s.shoutouts.filter(x => x.approved);
      return '<div class="tv-kicker">Fan Shout-Outs</div>' + (so.length
        ? so.slice(-3).map(x => '<p class="shout">“' + esc(x.message) + '”<small>— ' + esc(x.name) + '</small></p>').join('')
        : '<p class="tv-sub">Send a shout-out from the Invite page!</p>');
    });
    list.push(() => '<div class="tv-kicker">Fan Cam</div><div class="tv-panel">' + photoWallHTML(s) + '</div>');
    list.push(() => '<div class="tv-kicker">The Big 1-0 Mosaic</div>' + mosaicHTML(s));
    if (s.awards.some(a => a.winner)) {
      list.push(() => '<div class="tv-kicker">Awards</div>' + s.awards.filter(a => a.winner).map(a =>
        '<p class="shout">' + esc(a.title) + '<small>' + esc(a.winner) + '</small></p>').join(''));
    }
    list.push(() => '<div class="hero-block">' +
      '<div class="tv-kicker">Cake Finale</div><div class="tv-giant" style="font-size:clamp(40px,8vw,96px)">DEUCE <span class="o">#10</span></div>' +
      '<div class="tv-sub">' + esc(PARTY.statLine) + '</div></div>' +
      arenaHTML('arena-finale'));
    return list;
  }

  let showingOverlay = false;
  function render(force) {
    const s = Store.state;
    // one-shot confetti for grand entrance / cake zero
    if (s.ui.grandEntranceAt && s.ui.grandEntranceAt !== lastGrand) {
      lastGrand = s.ui.grandEntranceAt;
      fireConfetti({ particleCount: 180, spread: 100, startVelocity: 48 });
    }
    const cake = cakeOverlayHTML(s);
    if (cake && s.ui.cakeStart !== lastCakePop && (Date.now() - s.ui.cakeStart) / 1000 >= 10) {
      lastCakePop = s.ui.cakeStart;
      fireConfetti({ particleCount: 220, spread: 120, startVelocity: 52 });
    }
    const grand = grandEntranceHTML(s);
    if (grand || cake) {
      clearPanel();
      el.innerHTML = grand || cake;
      showingOverlay = true;
      return;
    }
    if (Date.now() < tipoffMs()) {
      // countdown mode: build once, then tick the numbers in place
      if (!force && el.querySelector('#arena-jumbo')) {
        const c = countdownParts();
        const set = (cls, v) => { const n = el.querySelector(cls); if (n) n.textContent = v; };
        set('.cd-d', c.d); set('.cd-h', pad2(c.h)); set('.cd-m', pad2(c.m)); set('.cd-s', pad2(c.s));
        return;
      }
      clearPanel();
      const c = countdownParts();
      el.innerHTML = '<div class="hero-block">' +
        '<div class="tv-kicker">Tip-Off Countdown</div>' +
        '<div class="tv-giant" style="font-size:clamp(38px,7.5vw,84px)">DEUCE\'S <span class="o">DOUBLE DOUBLE</span> PARTY</div>' +
        '<div class="tv-count">' +
          '<div class="cell"><b class="cd-d">' + c.d + '</b><span>DAYS</span></div>' +
          '<div class="cell"><b class="cd-h">' + pad2(c.h) + '</b><span>HOURS</span></div>' +
          '<div class="cell"><b class="cd-m">' + pad2(c.m) + '</b><span>MINUTES</span></div>' +
          '<div class="cell"><b class="cd-s">' + pad2(c.s) + '</b><span>SECONDS</span></div>' +
        '</div>' +
        '<div class="tv-sub">' + esc(PARTY.dateText) + ' · ' + esc(PARTY.timeText) + ' · ' + esc(PARTY.placeText) + '</div></div>' +
        arenaHTML('arena-jumbo');
      arenaInit('arena-jumbo', panelCleanups);
      showingOverlay = false;
      return;
    }
    if (!force && !showingOverlay && el.children.length) return; // 1s tick: leave the panel alone
    clearPanel();
    showingOverlay = false;
    const list = panels();
    el.innerHTML = list[panelIdx % list.length]();
    if (el.querySelector('#arena-finale')) arenaInit('arena-finale', panelCleanups);
  }
  render(true);
  every(8000, () => { panelIdx++; render(true); });
  every(1000, () => render(false)); // overlays + countdown stay live
  watchStore(() => render(true));
  onCleanup(clearPanel);
}

/* ---------------- SNACK TV ---------------- */
function viewSnackTV() {
  document.body.classList.add('tv');
  appEl.innerHTML = '<div class="tv-screen" id="snack"></div>';
  const el = $('#snack');
  let idx = 0, lastCakePop = 0;
  function render() {
    const s = Store.state;
    const cake = cakeOverlayHTML(s);
    if (cake) {
      el.innerHTML = cake;
      if (s.ui.cakeStart !== lastCakePop && (Date.now() - s.ui.cakeStart) / 1000 >= 10) {
        lastCakePop = s.ui.cakeStart;
        fireConfetti({ particleCount: 160, spread: 110 });
      }
      return;
    }
    const views = [
      () => '<div class="tv-kicker">Concession Stand</div><div class="tv-giant" style="font-size:clamp(34px,6vw,72px)">SNACK <span class="b">ATTACK</span></div>' +
        '<div class="tv-panel">' + s.menu.map(m => '<div class="lb-row"><span class="nm">' + esc(m) + '</span></div>').join('') + '</div>' +
        '<p class="tv-sub" style="margin-top:2vh">' + esc(s.menuNote) + '</p>',
      () => '<div class="tv-kicker">Leaderboard</div><div class="tv-panel">' + leaderboardHTML(s, 8) + '</div>',
      () => '<div class="tv-kicker">Fan Cam</div><div class="tv-panel">' + photoWallHTML(s) + '</div>',
      () => '<div class="tv-kicker">The Quarters</div><div class="tv-panel">' + quartersHTML(s) + '</div>'
    ];
    el.innerHTML = views[idx % views.length]();
  }
  render();
  every(10000, () => { idx++; render(); });
  every(1000, () => { if (Store.state.ui.cakeStart) render(); });
  watchStore(render);
}

/* ---------------- ADMIN ---------------- */
function viewAdmin() {
  if (sessionStorage.getItem('ddp_admin') !== '1') {
    appEl.innerHTML =
      '<section class="panel center" style="max-width:440px;margin:30px auto"><h2>Coach\'s Office</h2>' +
      '<p class="muted">Enter the admin code to run the party.</p>' +
      '<form id="admin-gate"><input name="code" inputmode="numeric" placeholder="Admin code" style="text-align:center;font-size:22px;letter-spacing:.3em" autocomplete="off">' +
      '<div id="gate-err"></div><div style="margin-top:14px"><button class="btn" type="submit">Unlock</button></div></form></section>';
    $('#admin-gate').addEventListener('submit', e => {
      e.preventDefault();
      if (new FormData(e.target).get('code').trim() === PARTY.adminCode) {
        sessionStorage.setItem('ddp_admin', '1');
        viewAdmin();
      } else {
        $('#gate-err').innerHTML = '<div class="flash err">That code doesn\'t open the office. Try again.</div>';
      }
    });
    return;
  }
  renderAdmin();
}

function renderAdmin() {
  const s = Store.state;
  appEl.innerHTML =
    '<section class="panel"><h2>Admin — Game Control</h2>' +
    '<div class="mode-line">' + (BACKEND_MODE === 'local'
      ? 'Local mode — back end not connected (CONFIG slots at the top of app.js are empty). Everything runs in this browser and syncs live between tabs on this device only.'
      : 'Supabase connected — project jcquahyuouhkgjjfizas. RSVPs, tickets, scores, shout-outs and photos sync across devices in real time; this browser also keeps a local cache so the app opens instantly.') + '</div>' +
    '<div class="rowflex">' +
      '<button class="btn big" id="ad-grand">⭐ Trigger Grand Entrance</button>' +
      '<button class="btn blue big" id="ad-cake">🎂 Start Cake Countdown</button>' +
      '<button class="btn ghost" id="ad-lock">Lock Admin</button>' +
    '</div>' +
    '<p class="small muted">Grand Entrance takes over the Jumbotron for 25 seconds. Cake Countdown runs 10 seconds on the Jumbotron AND the Snack TV, with confetti at zero.</p>' +
    '<div id="admin-dyn"></div></section>' +

    '<details class="admin-sec" open><summary>Enter Scores (Shootout &amp; Stations)</summary><div class="sec-body">' +
      '<form id="ad-score" class="rowflex"><input name="guestName" list="ad-player-list" placeholder="Player name" required style="flex:2;min-width:160px">' +
      '<datalist id="ad-player-list"></datalist>' +
      '<select name="game" style="flex:1;min-width:130px"><option value="shootout">Shootout</option><option value="station">Station</option><option value="tournament">Tournament</option></select>' +
      '<input name="points" type="number" min="1" max="999" value="10" required style="flex:0 0 100px">' +
      '<button class="btn sm" type="submit">Add Points</button></form>' +
      '<div id="ad-lb" style="margin-top:10px"></div>' +
    '</div></details>' +

    '<details class="admin-sec"><summary>Quarters Board</summary><div class="sec-body" id="ad-quarters"></div></details>' +
    '<details class="admin-sec"><summary>Know Deuce Trivia — Questions</summary><div class="sec-body" id="ad-trivia"></div></details>' +
    '<details class="admin-sec"><summary>Awards (exactly four)</summary><div class="sec-body" id="ad-awards"></div></details>' +

    '<details class="admin-sec"><summary>Prediction Game — 4th Quarter Payoff</summary><div class="sec-body">' +
      '<p class="muted small">Families picked the Shootout winner on their RSVP / at the door. Once the Shootout Champion award is set, score the winners: +10 for every guest in a family that called it.</p>' +
      '<div id="ad-preds"></div>' +
      '<button class="btn" id="ad-pred-score">Score Prediction Winners (+10 each)</button> <span id="ad-pred-msg" class="small muted"></span>' +
    '</div></details>' +

    '<details class="admin-sec"><summary>Scavenger Hunt — Find Deuce\'s Gear (printable QRs)</summary><div class="sec-body">' +
      '<div id="ad-hunt"></div>' +
      '<button class="btn blue" id="ad-hunt-print">Print Checkpoint QRs</button>' +
    '</div></details>' +

    '<details class="admin-sec"><summary>Deuce\'s Signature (stamps every player card)</summary><div class="sec-body">' +
      '<p class="muted small">Deuce draws his signature once, right here. It is saved and stamped onto every printed player card.</p>' +
      '<canvas id="sigpad" width="720" height="220"></canvas>' +
      '<div class="rowflex" style="margin-top:10px"><button class="btn sm" id="sig-save">Save Signature</button>' +
      '<button class="btn ghost sm" id="sig-clear">Clear Pad</button>' +
      '<span id="sig-status" class="small muted"></span></div>' +
      '<div id="sig-current" style="margin-top:10px"></div>' +
    '</div></details>' +

    '<details class="admin-sec"><summary>Danger Zone</summary><div class="sec-body">' +
      '<p class="muted small">Clear All Data wipes RSVPs, guests, scores, photos and awards, and restarts ticket numbering at DEUCE10-001. Seeded defaults (quarters, trivia, menu, welcome shout-outs) and Deuce\'s signature survive.</p>' +
      '<button class="btn danger" id="ad-clear">Clear All Data</button>' +
    '</div></details>';

  /* --- big buttons --- */
  $('#ad-grand').addEventListener('click', () => { Actions.triggerGrandEntrance(); fireConfetti({ particleCount: 60 }); });
  $('#ad-cake').addEventListener('click', () => { Actions.startCakeCountdown(); });
  $('#ad-lock').addEventListener('click', () => { sessionStorage.removeItem('ddp_admin'); viewAdmin(); });
  $('#ad-clear').addEventListener('click', () => {
    if (confirm('Clear ALL party data? RSVPs, tickets, scores, photos and awards will be wiped.')) {
      if (confirm('For real? Ticket numbering restarts at DEUCE10-001.')) {
        Actions.clearAllData();
        renderAdmin();
      }
    }
  });

  /* --- score entry --- */
  $('#ad-score').addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    if (Actions.addScore(fd.get('guestName'), fd.get('game'), fd.get('points'))) {
      e.target.reset(); e.target.querySelector('[name=points]').value = 10;
    }
  });

  /* --- prediction scoring --- */
  $('#ad-pred-score').addEventListener('click', () => {
    const r = Actions.scorePredictionWinners();
    $('#ad-pred-msg').textContent = r.ok
      ? (r.awarded ? r.awarded + ' winning family(ies) scored!' : 'No new winners to score (already scored, or no matching picks).')
      : r.error;
  });

  /* --- hunt print --- */
  $('#ad-hunt-print').addEventListener('click', () => {
    const area = $('#print-area');
    area.innerHTML = Store.state.checkpoints.map(cp =>
      '<div class="hunt-card"><div class="hc-qr" data-code="' + esc(cp.code) + '"></div>' +
      '<div><div class="hc-title">' + esc(cp.title) + '</div><div class="hc-hint">' + esc(cp.hint) + '</div>' +
      '<div class="hc-code">' + esc(cp.code) + '</div></div></div>').join('');
    $$('.hc-qr', area).forEach(el => makeQR(el, el.dataset.code, 200));
    setTimeout(() => window.print(), 400);
  });

  drawAdminEditors();
  refreshAdminDyn();
  watchStore(() => { refreshAdminDyn(); drawPreds(); });
  initSigPad();
  drawPreds();
}

function drawPreds() {
  const elx = $('#ad-preds');
  if (!elx) return;
  const s = Store.state;
  const withPred = s.families.filter(f => f.prediction);
  elx.innerHTML = withPred.length
    ? '<table><tr><th>Family</th><th>Their pick</th><th>Scored?</th></tr>' + withPred.map(f =>
      '<tr><td>' + esc(f.name) + '</td><td>' + esc(f.prediction) + '</td><td>' +
      (s.ui.predScoredFamilyIds.includes(f.id) ? '<span class="tag in">+10 PAID</span>' : '<span class="tag out">WAITING</span>') + '</td></tr>').join('') + '</table>'
    : '<p class="muted small">No predictions yet — they come in on RSVPs and at the door.</p>';
}

/* Dynamic admin region: totals, guests, queues, thank-yous. Re-renders on store change. */
function refreshAdminDyn() {
  const host = $('#admin-dyn');
  if (!host) return;
  const s = Store.state;
  const t = totals(s);
  const pendingPhotos = s.photos.filter(p => !p.approved);
  const approvedPhotos = s.photos.filter(p => p.approved);
  const pendingShouts = s.shoutouts.filter(x => !x.approved);
  const cardGuests = s.guests.filter(g => g.cardStatus !== 'none');

  host.innerHTML =
    '<div class="stat-cards">' +
      '<div class="stat-card"><b>' + t.families + '</b><span>Families</span></div>' +
      '<div class="stat-card"><b>' + t.guests + '</b><span>Guests</span></div>' +
      '<div class="stat-card"><b>' + t.players + '</b><span>Players</span></div>' +
      '<div class="stat-card"><b>' + t.fans + '</b><span>Coaches / Fans</span></div>' +
      '<div class="stat-card"><b>' + t.arrived + '</b><span>In the Building</span></div>' +
      '<div class="stat-card"><b>' + pendingPhotos.length + '</b><span>Photos to Approve</span></div>' +
    '</div>' +
    (t.allergyFamilies.length
      ? '<div class="flash info">🥜 <b>Allergy notes:</b> ' + t.allergyFamilies.map(f => esc(f.name) + ' — ' + esc(f.allergies)).join(' · ') + '</div>'
      : '') +

    '<h3>Guest List &amp; Tickets</h3>' +
    (s.guests.length
      ? '<table><tr><th>Guest</th><th>Ticket</th><th>Seat</th><th>Family</th><th>Arrived</th><th>Player Card</th></tr>' +
        s.guests.map(g => {
          const fam = familyOf(s, g);
          return '<tr><td><b>' + esc(g.name) + '</b> <span class="muted small">' + (g.type === 'player' ? 'Player' : 'Coach/Fan') + '</span></td>' +
            '<td>' + esc(g.ticketCode) + '</td><td>' + g.seatNo + '</td><td>' + esc(fam ? fam.name : '') + '</td>' +
            '<td><input type="checkbox" class="g-arr" data-id="' + g.id + '"' + (g.checkedIn ? ' checked' : '') + ' style="width:22px;height:22px"></td>' +
            '<td><select class="g-card" data-id="' + g.id + '" style="padding:7px;font-size:14px">' +
              ['none', 'queued', 'printed', 'ready', 'picked_up'].map(st =>
                '<option value="' + st + '"' + (g.cardStatus === st ? ' selected' : '') + '>' + st.replace('_', ' ') + '</option>').join('') +
            '</select></td></tr>';
        }).join('') + '</table>'
      : '<p class="muted">No RSVPs yet — tickets appear here the second a family signs up.</p>') +

    '<h3 style="margin-top:22px">Photo Approval Queue</h3>' +
    (pendingPhotos.length
      ? '<div class="queue-grid">' + pendingPhotos.map(p =>
          '<figure><img src="' + p.url + '" alt=""><figcaption class="small muted">' + esc(p.submittedBy || 'Fan Cam') +
          (p.sendTo ? '<br>Send copy to: ' + esc(p.sendTo) : '') + '</figcaption>' +
          '<div class="rowflex" style="margin-top:6px"><button class="btn sm ph-ok" data-id="' + p.id + '">Approve</button>' +
          '<button class="btn ghost sm ph-del" data-id="' + p.id + '">Delete</button></div></figure>').join('') + '</div>'
      : '<p class="muted small">Queue is clear. Booth photos land here for a quick yes before they hit the big screens.</p>') +
    (approvedPhotos.length
      ? '<p class="small muted" style="margin-top:8px">On the walls now: ' + approvedPhotos.length + ' photo(s). ' +
        approvedPhotos.map(p => '<a href="#" class="ph-un" data-id="' + p.id + '">remove #' + p.id.slice(-4) + '</a>').join(' · ') + '</p>'
      : '') +

    '<h3 style="margin-top:22px">Shout-Out Approval Queue</h3>' +
    (pendingShouts.length
      ? pendingShouts.map(x => '<div class="rowflex" style="margin:6px 0"><span style="flex:1">“' + esc(x.message) + '” <span class="muted small">— ' + esc(x.name) + '</span></span>' +
          '<button class="btn sm so-ok" data-id="' + x.id + '">Approve</button><button class="btn ghost sm so-del" data-id="' + x.id + '">Delete</button></div>').join('')
      : '<p class="muted small">No shout-outs waiting.</p>') +

    '<h3 style="margin-top:22px">Player Card Queue</h3>' +
    (cardGuests.length
      ? '<p class="small">' + cardGuests.map(g => esc(g.name) + ' — <b>' + esc(g.cardStatus.replace('_', ' ')) + '</b>').join(' · ') + '</p>'
      : '<p class="muted small">No cards designed yet. Kids build them at the Cards station; status is tracked in the guest list above.</p>') +

    '<h3 style="margin-top:22px">One-Tap Thank-Yous</h3>' +
    '<p class="muted small">Prepared messages — copy one and send it your way (text or email). Nothing sends itself.</p>' +
    (s.families.length
      ? s.families.map(f => {
          const msg = 'Hi ' + f.name + '! Thank you for celebrating ' + PARTY.name + ' with us — what a game! ' +
            'Relive the highlights in the Post-Game Recap: ' + recapURL() + ' — Team Deuce 🏀';
          return '<div class="rowflex" style="margin:6px 0"><span style="flex:1;min-width:180px"><b>' + esc(f.name) + '</b> <span class="muted small">' + esc(f.contact || '') + '</span></span>' +
            '<button class="btn sm ty-copy" data-msg="' + esc(msg) + '">Copy Thank-You</button>' +
            (f.contact && f.contact.includes('@') ? '<a class="btn ghost sm" href="mailto:' + esc(f.contact) + '?subject=' + encodeURIComponent('Thank you — ' + PARTY.name) + '&body=' + encodeURIComponent(msg) + '">Email</a>' : '') +
            '</div>';
        }).join('')
      : '<p class="muted small">Families appear here as RSVPs come in.</p>');

  /* wire dynamic controls */
  $$('.g-arr', host).forEach(cb => cb.addEventListener('change', () => Actions.setCheckedIn(cb.dataset.id, cb.checked)));
  $$('.g-card', host).forEach(sel => sel.addEventListener('change', () => Actions.setCardStatus(sel.dataset.id, sel.value)));
  $$('.ph-ok', host).forEach(b => b.addEventListener('click', () => Actions.setPhotoApproved(b.dataset.id, true)));
  $$('.ph-del', host).forEach(b => b.addEventListener('click', () => Actions.deletePhoto(b.dataset.id)));
  $$('.ph-un', host).forEach(a => a.addEventListener('click', e => { e.preventDefault(); Actions.setPhotoApproved(a.dataset.id, false); }));
  $$('.so-ok', host).forEach(b => b.addEventListener('click', () => Actions.setShoutoutApproved(b.dataset.id, true)));
  $$('.so-del', host).forEach(b => b.addEventListener('click', () => Actions.deleteShoutout(b.dataset.id)));
  $$('.ty-copy', host).forEach(b => b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(b.dataset.msg); b.textContent = 'Copied!'; }
    catch (e) { prompt('Copy this thank-you:', b.dataset.msg); }
    setTimeout(() => { b.textContent = 'Copy Thank-You'; }, 1600);
  }));

  /* leaderboard + player datalist in the score section */
  const lb = $('#ad-lb');
  if (lb) {
    const rows = leaderboard(s, 8);
    lb.innerHTML = rows.length
      ? '<table>' + rows.map((r, i) => '<tr><td>' + (i + 1) + '. ' + esc(r.name) + '</td><td><b>' + r.points + ' PTS</b></td></tr>').join('') + '</table>'
      : '<p class="muted small">Leaderboard is empty.</p>';
  }
  const dl = $('#ad-player-list');
  if (dl) dl.innerHTML = s.guests.map(g => '<option value="' + esc(g.name) + '">').join('');
}

/* Static admin editors: quarters, trivia, awards, hunt list. */
function drawAdminEditors() {
  const s = Store.state;
  const qHost = $('#ad-quarters');
  if (qHost) {
    qHost.innerHTML = s.quarters.map(q =>
      '<div class="rowflex" style="margin:8px 0">' +
      '<input class="q-label" data-id="' + q.id + '" value="' + esc(q.label) + '" style="flex:2;min-width:220px">' +
      '<input class="q-time" data-id="' + q.id + '" value="' + esc(q.timeLabel) + '" placeholder="Time (optional)" style="flex:0 0 130px">' +
      '<button class="btn sm q-save" data-id="' + q.id + '">Save</button>' +
      '<button class="btn ' + (q.isCurrent ? '' : 'ghost') + ' sm q-cur" data-id="' + q.id + '">' + (q.isCurrent ? '● On Court Now' : 'Set Current') + '</button></div>').join('');
    $$('.q-save', qHost).forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.id;
      Actions.updateQuarter(id, $('.q-label[data-id="' + id + '"]', qHost).value, $('.q-time[data-id="' + id + '"]', qHost).value);
      drawAdminEditors();
    }));
    $$('.q-cur', qHost).forEach(b => b.addEventListener('click', () => { Actions.setQuarterCurrent(b.dataset.id); drawAdminEditors(); }));
  }

  const tHost = $('#ad-trivia');
  if (tHost) {
    tHost.innerHTML = s.trivia.map(q =>
      '<div style="border:1px solid var(--line);border-radius:12px;padding:12px;margin:10px 0">' +
      '<input class="tq-q" data-id="' + q.id + '" value="' + esc(q.question) + '" style="margin-bottom:8px">' +
      '<input class="tq-c" data-id="' + q.id + '" value="' + esc(q.choices.join(' | ')) + '" placeholder="Choices, split with | ">' +
      '<div class="rowflex" style="margin-top:8px"><input class="tq-a" data-id="' + q.id + '" value="' + esc(q.answer) + '" placeholder="Correct answer (must match a choice)" style="flex:1;min-width:160px">' +
      '<label style="margin:0;text-transform:none;color:var(--white)"><input type="checkbox" class="tq-act" data-id="' + q.id + '"' + (q.active ? ' checked' : '') + ' style="width:18px;height:18px"> Live</label>' +
      '<button class="btn sm tq-save" data-id="' + q.id + '">Save</button>' +
      '<button class="btn ghost sm tq-del" data-id="' + q.id + '">Delete</button></div></div>').join('') +
      '<form id="tq-add" class="rowflex"><input name="question" placeholder="New question" required style="flex:2;min-width:180px">' +
      '<input name="choices" placeholder="Choices split with |" required style="flex:2;min-width:180px">' +
      '<input name="answer" placeholder="Correct answer" required style="flex:1;min-width:130px">' +
      '<button class="btn sm" type="submit">Add Question</button></form>' +
      '<p class="small muted">House rule: trivia stays about the party — Deuce\'s age, his #10 jersey, and the party name. No invented facts.</p>';
    $$('.tq-save', tHost).forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.id;
      Actions.updateTriviaQ(id,
        $('.tq-q[data-id="' + id + '"]', tHost).value,
        $('.tq-c[data-id="' + id + '"]', tHost).value.split('|').map(x => x.trim()).filter(Boolean),
        $('.tq-a[data-id="' + id + '"]', tHost).value,
        $('.tq-act[data-id="' + id + '"]', tHost).checked);
    }));
    $$('.tq-del', tHost).forEach(b => b.addEventListener('click', () => { Actions.deleteTriviaQ(b.dataset.id); drawAdminEditors(); }));
    $('#tq-add').addEventListener('submit', e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      Actions.addTriviaQ(fd.get('question'), fd.get('choices').split('|').map(x => x.trim()).filter(Boolean), fd.get('answer'));
      drawAdminEditors();
    });
  }

  const aHost = $('#ad-awards');
  if (aHost) {
    aHost.innerHTML = s.awards.map(a =>
      '<div class="rowflex" style="margin:8px 0"><span style="flex:1;min-width:150px;font-family:var(--disp);text-transform:uppercase;letter-spacing:.05em">' + esc(a.title) + '</span>' +
      '<input class="aw-in" data-title="' + esc(a.title) + '" value="' + esc(a.winner) + '" placeholder="Winner\'s name" style="flex:2;min-width:170px">' +
      '<button class="btn sm aw-save" data-title="' + esc(a.title) + '">Save</button></div>').join('') +
      '<p class="small muted">Winners appear on the Jumbotron awards screen, the Cake Finale rotation and the Post-Game Recap.</p>';
    $$('.aw-save', aHost).forEach(b => b.addEventListener('click', () => {
      Actions.setAward(b.dataset.title, $('.aw-in[data-title="' + b.dataset.title + '"]', aHost).value);
    }));
  }

  const hHost = $('#ad-hunt');
  if (hHost) {
    hHost.innerHTML = s.checkpoints.map(cp =>
      '<div class="checkpoint"><div class="qr-box"><div class="hunt-qr" data-code="' + esc(cp.code) + '"></div></div>' +
      '<div><b>' + esc(cp.title) + '</b><div class="muted small">' + esc(cp.hint) + '</div>' +
      '<div class="small" style="font-family:monospace">' + esc(cp.code) + '</div></div></div>').join('');
    $$('.hunt-qr', hHost).forEach(el => makeQR(el, el.dataset.code, 84));
  }
}

/* Signature pad: draw once, save, stamp on cards. */
function initSigPad() {
  const pad = $('#sigpad');
  if (!pad) return;
  const ctx = pad.getContext && pad.getContext('2d');
  if (!ctx) return;
  ctx.lineWidth = 3.4; ctx.lineCap = 'round'; ctx.strokeStyle = '#FFFFFF';
  let drawing = false, last = null;
  const pos = e => {
    const r = pad.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (pad.width / r.width), y: (e.clientY - r.top) * (pad.height / r.height) };
  };
  pad.addEventListener('pointerdown', e => { drawing = true; last = pos(e); pad.setPointerCapture(e.pointerId); });
  pad.addEventListener('pointermove', e => {
    if (!drawing) return;
    const p = pos(e);
    ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    last = p;
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => pad.addEventListener(ev, () => { drawing = false; }));
  $('#sig-clear').addEventListener('click', () => ctx.clearRect(0, 0, pad.width, pad.height));
  $('#sig-save').addEventListener('click', () => {
    Actions.saveSignature(pad.toDataURL('image/png'));
    $('#sig-status').textContent = 'Saved — it will stamp onto every player card.';
    drawSigCurrent();
  });
  drawSigCurrent();
}
function drawSigCurrent() {
  const host = $('#sig-current');
  if (!host) return;
  const sig = Store.state.signature;
  host.innerHTML = sig
    ? '<p class="small muted">Current signature on file:</p><img src="' + sig + '" alt="Deuce\'s signature" style="max-width:280px;background:#0B1122;border:1px solid var(--line);border-radius:10px;padding:8px">'
    : '<p class="small muted">No signature saved yet.</p>';
}

/* ---------------- TRIVIA — Know Deuce ---------------- */
function viewTrivia() {
  appEl.innerHTML =
    '<section class="panel"><h2>Know Deuce — Trivia</h2>' +
    '<p class="muted">Three questions, all about today\'s game. Every correct answer is <b>+10 points</b> on the big leaderboard. One shot per question!</p>' +
    '<label>Your name (as it should appear on the leaderboard)</label>' +
    '<div class="rowflex"><input id="tv-name" placeholder="Your name" maxlength="40" style="flex:1;min-width:180px" value="' + esc(sessionStorage.getItem('ddp_name') || '') + '">' +
    '<button class="btn" id="tv-start">Play</button></div>' +
    '<div id="tv-body" style="margin-top:16px"></div>' +
    '<h3 style="margin-top:24px">Leaderboard</h3><div id="tv-lb"></div></section>';

  const drawLB = () => {
    const rows = leaderboard(Store.state, 5);
    $('#tv-lb').innerHTML = rows.length
      ? '<table>' + rows.map((r, i) => '<tr><td>' + (i + 1) + '. ' + esc(r.name) + '</td><td><b>' + r.points + ' PTS</b></td></tr>').join('') + '</table>'
      : '<p class="muted small">No points yet — be the first on the board.</p>';
  };
  drawLB(); watchStore(drawLB);

  function drawQuestions() {
    const name = $('#tv-name').value.trim();
    const body = $('#tv-body');
    if (!name) { body.innerHTML = '<div class="flash info">Add your name, tap Play, and take your shots.</div>'; return; }
    const s = Store.state;
    const qs = s.trivia.filter(q => q.active);
    body.innerHTML = qs.map(q => {
      const play = s.triviaPlays.find(p => p.guestName.toLowerCase() === name.toLowerCase() && p.questionId === q.id);
      if (play) {
        return '<div class="panel" style="margin:10px 0"><b>' + esc(q.question) + '</b><p style="margin:6px 0">' +
          (play.correct ? '<span class="tag in">✓ +10 — NOTHING BUT NET</span>' : '<span class="tag warn">✗ OFF THE RIM — the answer was ' + esc(q.answer) + '</span>') + '</p></div>';
      }
      return '<div class="panel" style="margin:10px 0"><b>' + esc(q.question) + '</b><div class="rowflex" style="margin-top:10px">' +
        q.choices.map(c => '<button class="btn ghost tv-choice" data-q="' + q.id + '" data-c="' + esc(c) + '">' + esc(c) + '</button>').join('') + '</div></div>';
    }).join('') || '<p class="muted">Trivia is between rounds — check back at Halftime!</p>';
    $$('.tv-choice', body).forEach(b => b.addEventListener('click', () => {
      const r = Actions.answerTrivia(name, b.dataset.q, b.dataset.c);
      if (r.ok && r.correct) fireConfetti({ particleCount: 60, spread: 55, scalar: 0.8 });
      drawQuestions();
    }));
  }
  $('#tv-start').addEventListener('click', () => {
    sessionStorage.setItem('ddp_name', $('#tv-name').value.trim());
    drawQuestions();
  });
  if (sessionStorage.getItem('ddp_name')) drawQuestions();
  watchStore(() => { if (sessionStorage.getItem('ddp_name')) drawQuestions(); });
}

/* ---------------- PHOTO BOOTH ---------------- */
function viewBooth() {
  appEl.innerHTML =
    '<section class="panel"><h2>Photo Booth — Fan Cam</h2>' +
    '<p class="muted">Big smiles, game faces. Tap the button, count down 3-2-1, and your photo heads to the big screens (after a quick coach\'s approval).</p>' +
    '<div class="grid2" style="align-items:end"><div><label>Your name</label><input id="booth-name" placeholder="Name for the caption" maxlength="40"></div>' +
    '<div><label>Text or email it to yourself (optional)</label><input id="booth-send" placeholder="Phone number or email" maxlength="80"></div></div>' +
    '<div class="booth-stage" style="margin-top:16px">' +
      '<video id="booth-video" autoplay playsinline muted></video>' +
      '<div class="booth-frame"><div class="bf-top">' + esc(PARTY.name.toUpperCase()) + '</div>' +
      '<div class="bf-bot">' + esc(PARTY.statLine) + '<br>' + esc(PARTY.dateText) + '</div></div>' +
      '<div class="booth-count" id="booth-count" style="display:none">3</div>' +
    '</div>' +
    '<div class="rowflex" style="justify-content:center;margin-top:16px">' +
      '<button class="btn blue" id="booth-start">Start Camera</button>' +
      '<button class="btn big" id="booth-snap" disabled>📸 Take Photo</button>' +
      '<label class="btn ghost" style="margin:0">Upload Instead<input type="file" id="booth-file" accept="image/*" hidden></label>' +
    '</div>' +
    '<div id="booth-result" style="margin-top:16px"></div></section>';

  const video = $('#booth-video');
  const snapBtn = $('#booth-snap');
  let stream = null;

  function frameAndCapture(source, w, h) {
    const c = document.createElement('canvas');
    c.width = 900; c.height = 675;
    const x = c.getContext('2d');
    x.fillStyle = '#000'; x.fillRect(0, 0, 900, 675);
    // cover-fit the source image/video into the frame
    const sr = w / h, tr = 900 / 675;
    let sw = w, sh = h, sx = 0, sy = 0;
    if (sr > tr) { sw = h * tr; sx = (w - sw) / 2; } else { sh = w / tr; sy = (h - sh) / 2; }
    x.save();
    x.translate(900, 0); x.scale(-1, 1); // mirror like a booth
    x.drawImage(source, sx, sy, sw, sh, 0, 0, 900, 675);
    x.restore();
    // branded frame
    x.strokeStyle = '#FF861F'; x.lineWidth = 18; x.strokeRect(9, 9, 882, 657);
    x.strokeStyle = '#244CE5'; x.lineWidth = 5; x.strokeRect(24, 24, 852, 627);
    x.fillStyle = 'rgba(5,7,13,.72)'; x.fillRect(0, 24, 900, 58); x.fillRect(0, 593, 900, 58);
    x.fillStyle = '#FFFFFF'; x.textAlign = 'center';
    x.font = '700 34px Oswald, sans-serif';
    x.fillText(PARTY.name.toUpperCase(), 450, 66);
    x.font = '600 25px Oswald, sans-serif'; x.fillStyle = '#FFB35C';
    x.fillText(PARTY.statLine, 450, 622);
    x.font = '500 19px Archivo, sans-serif'; x.fillStyle = '#FFFFFF';
    x.fillText(PARTY.dateText, 450, 644);
    return c.toDataURL('image/jpeg', 0.86);
  }

  function showPreview(dataURL) {
    $('#booth-result').innerHTML =
      '<img class="booth-shot" src="' + dataURL + '" alt="Your booth photo">' +
      '<div class="rowflex" style="justify-content:center;margin-top:12px">' +
      '<button class="btn" id="booth-keep">Keep It — Send to the Big Screens</button>' +
      '<button class="btn ghost" id="booth-retake">Retake</button></div>';
    $('#booth-retake').addEventListener('click', () => { $('#booth-result').innerHTML = ''; });
    $('#booth-keep').addEventListener('click', () => {
      Actions.addPhoto({
        url: dataURL, source: 'booth',
        submittedBy: $('#booth-name').value.trim() || 'Fan Cam',
        caption: ($('#booth-name').value.trim() || 'Fan Cam') + ' at the Booth',
        sendTo: $('#booth-send').value.trim()
      });
      fireConfetti({ particleCount: 80, spread: 60 });
      $('#booth-result').innerHTML = '<div class="flash ok">Photo sent! Once a coach approves it, watch for it on the Jumbotron and the Snack TV wall.' +
        ($('#booth-send').value.trim() ? ' We noted ' + esc($('#booth-send').value.trim()) + ' to send your copy after the game.' : '') + '</div>';
    });
  }

  $('#booth-start').addEventListener('click', async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      video.srcObject = stream;
      snapBtn.disabled = false;
      $('#booth-start').textContent = 'Camera On';
    } catch (e) {
      $('#booth-result').innerHTML = '<div class="flash err">Camera unavailable — use Upload Instead to add a photo.</div>';
    }
  });
  snapBtn.addEventListener('click', () => {
    if (!stream) return;
    const cd = $('#booth-count');
    let n = 3;
    cd.style.display = 'flex'; cd.textContent = n;
    snapBtn.disabled = true;
    const iv = setInterval(() => {
      n--;
      if (n > 0) { cd.textContent = n; return; }
      clearInterval(iv);
      cd.style.display = 'none';
      snapBtn.disabled = false;
      showPreview(frameAndCapture(video, video.videoWidth || 900, video.videoHeight || 675));
    }, 750);
    onCleanup(() => clearInterval(iv));
  });
  $('#booth-file').addEventListener('change', e => {
    const f = e.target.files[0];
    if (!f) return;
    const img = new Image();
    img.onload = () => { showPreview(frameAndCapture(img, img.naturalWidth, img.naturalHeight)); URL.revokeObjectURL(img.src); };
    img.src = URL.createObjectURL(f);
  });
  onCleanup(() => { if (stream) stream.getTracks().forEach(t => t.stop()); });
}

/* ---------------- PLAYER CARDS ---------------- */
function cardHTML(card, forPrint) {
  const sig = Store.state.signature;
  return '<div class="' + (forPrint ? 'print-card' : 'card-preview') + '"' + (forPrint ? ' style="page:cardpage"' : '') + '>' +
    '<div class="cp-photo" style="background-image:url(' + (card.photo || '') + ')"></div>' +
    '<div class="cp-brand">' + esc(PARTY.name.toUpperCase()) + '</div>' +
    '<div class="cp-body"><div class="cp-name">' + esc(card.guestName || 'PLAYER NAME') + '</div>' +
    '<div class="cp-pos">' + esc(card.position || 'POSITION') + ' · #10 TEAM DEUCE</div>' +
    '<div class="cp-stats">' + card.stats.map(st =>
      '<div class="st"><b>' + esc(st.value) + '</b><span>' + esc(st.label) + '</span></div>').join('') + '</div>' +
    '<div class="small" style="margin-top:8px;color:var(--muted)">' + esc(PARTY.statLine) + '</div></div>' +
    (sig ? '<img class="cp-sig" src="' + sig + '" alt="Deuce\'s signature">' : '') +
  '</div>';
}
function viewCards() {
  appEl.innerHTML =
    '<section class="panel"><h2>Player Card Studio</h2>' +
    '<p class="muted">Design your official game card — 4x6, ready for the card printer. Deuce\'s signature stamps onto every card. Cards go to the print queue at the Trophy Table.</p>' +
    '<div class="card-stage"><div id="card-preview-host"></div>' +
    '<div style="flex:1;min-width:260px">' +
      '<label>Player</label><select id="card-guest"></select>' +
      '<label>Or walk-in name</label><input id="card-name" placeholder="Type a name if not on the roster" maxlength="40">' +
      '<label>Position</label><input id="card-pos" placeholder="e.g. Point Guard" maxlength="30" value="All-Star">' +
      '<label>Photo — pick a booth shot or upload</label><div class="thumbrow" id="card-photos"></div>' +
      '<input type="file" id="card-upload" accept="image/*" style="margin-top:10px">' +
      '<label>Power Stats (pick your three, 1–99)</label><div id="card-stats"></div>' +
      '<div class="rowflex" style="margin-top:16px"><button class="btn" id="card-save">Save to Print Queue</button>' +
      '<button class="btn blue" id="card-print">Print This Card (4x6)</button></div>' +
      '<div id="card-msg"></div>' +
    '</div></div></section>';

  const draft = {
    guestId: '', guestName: '', photo: '', position: 'All-Star',
    stats: [{ label: 'SPEED', value: 88 }, { label: 'SHOOTING', value: 92 }, { label: 'HYPE', value: 99 }]
  };
  const drawPreview = () => { $('#card-preview-host').innerHTML = cardHTML(draft, false); };
  const drawGuests = () => {
    const sel = $('#card-guest');
    const s = Store.state;
    sel.innerHTML = '<option value="">— pick a player —</option>' + s.guests.map(g =>
      '<option value="' + g.id + '"' + (draft.guestId === g.id ? ' selected' : '') + '>' + esc(g.name) + ' (' + esc(g.ticketCode) + ')</option>').join('');
  };
  const drawPhotos = () => {
    const host = $('#card-photos');
    const photos = Store.state.photos;
    host.innerHTML = photos.length ? photos.map(p =>
      '<figure><button type="button" class="cpick' + (draft.photo === p.url ? ' sel' : '') + '" data-url="' + p.id + '"><img src="' + p.url + '" alt=""></button>' +
      '<figcaption>' + esc(p.submittedBy || 'Booth') + '</figcaption></figure>').join('')
      : '<p class="muted small">No booth photos yet — upload one, or hit the Photo Booth first.</p>';
    $$('.cpick', host).forEach(b => b.addEventListener('click', () => {
      const p = Store.state.photos.find(x => x.id === b.dataset.url);
      if (p) { draft.photo = p.url; drawPhotos(); drawPreview(); }
    }));
  };
  const drawStats = () => {
    $('#card-stats').innerHTML = draft.stats.map((st, i) =>
      '<div class="rowflex" style="margin:6px 0"><input class="st-label" data-i="' + i + '" value="' + esc(st.label) + '" maxlength="12" style="flex:1;min-width:110px">' +
      '<input class="st-val" data-i="' + i + '" type="number" min="1" max="99" value="' + st.value + '" style="flex:0 0 90px"></div>').join('');
    $$('.st-label').forEach(inp => inp.addEventListener('input', () => { draft.stats[+inp.dataset.i].label = inp.value.toUpperCase() || 'STAT'; drawPreview(); }));
    $$('.st-val').forEach(inp => inp.addEventListener('input', () => { draft.stats[+inp.dataset.i].value = Math.max(1, Math.min(99, +inp.value || 1)); drawPreview(); }));
  };
  drawGuests(); drawPhotos(); drawStats(); drawPreview();
  watchStore(() => { drawGuests(); drawPhotos(); drawPreview(); });

  $('#card-guest').addEventListener('change', e => {
    const g = Store.state.guests.find(x => x.id === e.target.value);
    draft.guestId = g ? g.id : '';
    draft.guestName = g ? g.name : draft.guestName;
    if (g) $('#card-name').value = '';
    drawPreview();
  });
  $('#card-name').addEventListener('input', e => { draft.guestName = e.target.value; if (e.target.value) draft.guestId = ''; drawPreview(); });
  $('#card-pos').addEventListener('input', e => { draft.position = e.target.value; drawPreview(); });
  $('#card-upload').addEventListener('change', e => {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => { draft.photo = r.result; drawPhotos(); drawPreview(); };
    r.readAsDataURL(f);
  });
  $('#card-save').addEventListener('click', () => {
    const name = (draft.guestName || $('#card-name').value || '').trim();
    if (!name) { $('#card-msg').innerHTML = '<div class="flash err">Pick a player or type a name first.</div>'; return; }
    draft.guestName = name;
    Actions.saveCard({ guestId: draft.guestId, guestName: name, photo: draft.photo, position: draft.position || 'All-Star', stats: draft.stats });
    $('#card-msg').innerHTML = '<div class="flash ok">Card saved to the print queue for <b>' + esc(name) + '</b> — listen for “PLAYER CARD READY” on the Jumbotron and pick it up at the Trophy Table.</div>';
  });
  $('#card-print').addEventListener('click', () => {
    const name = (draft.guestName || $('#card-name').value || '').trim();
    if (!name) { $('#card-msg').innerHTML = '<div class="flash err">Pick a player or type a name first.</div>'; return; }
    draft.guestName = name;
    $('#print-area').innerHTML = cardHTML(draft, true);
    setTimeout(() => window.print(), 250);
  });
}

/* ---------------- POST-GAME RECAP ---------------- */
function viewRecap() {
  const s = Store.state;
  const t = totals(s);
  const top = leaderboard(s, 5);
  const winners = s.awards.filter(a => a.winner);
  const photos = s.photos.filter(p => p.approved);
  const empty = !s.guests.length && !top.length && !winners.length;
  appEl.innerHTML =
    '<section class="panel center"><div class="kicker">Post-Game Recap</div>' +
    '<h2 style="font-size:38px">' + esc(PARTY.name) + '</h2>' +
    '<p class="muted">' + esc(PARTY.dateText) + ' · ' + esc(PARTY.placeText) + '<br>' + esc(PARTY.statLine) + '</p>' +
    (empty
      ? '<div class="flash info">The game hasn\'t tipped off yet — this page fills up with the final scoreboard, the award winners and the best Fan Cam shots once the party is rolling. Check back after the 4th Quarter!</div>'
      : '<div class="stat-cards">' +
        '<div class="stat-card"><b>' + t.guests + '</b><span>Players &amp; Fans</span></div>' +
        '<div class="stat-card"><b>' + t.arrived + '</b><span>Made It In</span></div>' +
        '<div class="stat-card"><b>' + photos.length + '</b><span>Fan Cam Shots</span></div>' +
        '<div class="stat-card"><b>' + s.scores.length + '</b><span>Scoring Plays</span></div></div>') +
    '</section>' +
    (top.length ? '<section class="panel"><h2>Final Leaderboard — Top 5</h2><table>' +
      top.map((r, i) => '<tr><td>' + (i + 1) + '. ' + esc(r.name) + '</td><td><b>' + r.points + ' PTS</b></td></tr>').join('') + '</table></section>' : '') +
    (winners.length ? '<section class="panel"><h2>Awards</h2>' +
      winners.map(a => '<p class="shout" style="font-size:24px">' + esc(a.title) + '<small>' + esc(a.winner) + '</small></p>').join('') + '</section>' : '') +
    (photos.length ? '<section class="panel"><h2>Fan Cam — Best Shots</h2>' + photoWallHTML(s) + '</section>' : '') +
    '<section class="panel center"><h2>Thank You</h2>' +
    '<p style="font-size:18px;max-width:560px;margin:8px auto">Thank you for making Deuce\'s Double Double one for the record books. ' +
    'Ten years, ten points, ten rebounds — and a whole arena of people who showed up for our MVP. See you at the next game.</p>' +
    '<p class="muted">— Team Deuce</p></section>';
  /* Recap is a look-back page: it renders fresh on every visit.
     (No live subscription here on purpose — re-entering the route re-renders.) */
}

/* ---------------- Expose for testing + boot ---------------- */
window.DDP = { Store, Actions, PARTY, leaderboard, totals, BACKEND_MODE, seedState };
router();
