import { supabase } from './supabase.js'

/* =========================================================================
   Dawn Run 5K — app entry
   State is one JSON object per user, mirrored to localStorage (instant/offline)
   and synced to Supabase (one JSONB row per user, RLS-protected).
   ========================================================================= */

const LS = 'dawnRun5k.v1'
const ROW_ID = 'singleton'   // single-user app, no login — everything lives in one shared row
let state = {}
let saveTimer = null

/* ---------------- sync indicator ---------------- */
function setSync(status) {
  const el = document.getElementById('syncBadge')
  if (!el) return
  const map = {
    saving: ['Saving…', 'sync-saving'],
    saved:  ['Synced', 'sync-ok'],
    local:  ['Local only', 'sync-warn'],
    error:  ['Sync error', 'sync-err']
  }
  const m = map[status] || map.saved
  el.textContent = m[0]
  el.className = 'sync ' + m[1]
}

/* ---------------- persistence ---------------- */
function saveLocal() { try { localStorage.setItem(LS, JSON.stringify(state)) } catch (e) {} }

function save() {
  saveLocal()
  setSync('saving')
  clearTimeout(saveTimer)
  saveTimer = setTimeout(pushRemote, 700)
}

async function pushRemote() {
  try {
    const { error } = await supabase
      .from('tracker_state')
      .upsert({ id: ROW_ID, data: state, updated_at: new Date().toISOString() }, { onConflict: 'id' })
    setSync(error ? 'error' : 'saved')
    if (error) console.error('Supabase upsert failed:', error.message)
  } catch (e) {
    setSync('local')             // offline / not configured — kept in localStorage
    console.error('Supabase upsert threw:', e)
  }
}

// Pull the cloud copy in the background and reconcile with what we booted from.
async function syncFromRemote() {
  try {
    const { data, error } = await supabase
      .from('tracker_state').select('data').eq('id', ROW_ID).maybeSingle()
    if (error) { setSync('local'); console.error('Supabase load failed:', error.message); return }
    if (data && data.data) {
      const remote = JSON.stringify(data.data)
      if (remote !== JSON.stringify(state)) {
        localStorage.setItem(LS, remote)   // cloud is newer → adopt it and repaint once
        location.reload()
      } else {
        setSync('saved')
      }
    } else {
      await pushRemote()                   // cloud empty → seed it from local
    }
  } catch (e) {
    setSync('local')                       // offline / not configured — run from localStorage
    console.error('Supabase unreachable:', e)
  }
}

/* ---------------- boot (no login — single user) ---------------- */
try { state = JSON.parse(localStorage.getItem(LS)) || {} } catch (e) { state = {} }
bootApp()          // instant paint from local cache — never blocks on the network
syncFromRemote()   // then reconcile with the cloud in the background

/* =========================================================================
   bootApp — the tracker. Runs once, after the user is authenticated and
   `state` has been loaded. Uses module-scope `state` + `save`.
   ========================================================================= */
function bootApp() {
  const RACE = new Date(2026, 9, 24) // Oct 24 2026

  const TAGS = { run: 'Run', strength: 'Strength', rest: 'Rest', cross: 'Cross-train', race: 'Race' }

  // week start dates (Sunday Sep 6 -> ) ; each week has 7 days Sun..Sat
  const plan = [
    { phase: 'Base', start: [2026, 8, 6], title: 'Find your rhythm', days: [
      { t: 'rest', l: 'rest', n: 'Rest / mobility', d: 'Gentle stretch, easy walk if you like.' },
      { t: 'run', l: 'moderate', n: 'Run 1′ / walk 90″ ×8', d: '~20 min. Keep runs conversational-slow.' },
      { t: 'strength', l: 'moderate', n: 'Strength & core (20 min)', d: 'Squats, lunges, glute bridges, plank.' },
      { t: 'run', l: 'moderate', n: 'Run 1′ / walk 90″ ×8', d: 'Repeat Tuesday. Warm up 5 min first.' },
      { t: 'rest', l: 'rest', n: 'Rest', d: 'Full recovery day.' },
      { t: 'run', l: 'moderate', n: 'Run 90″ / walk 2′ ×6', d: '~21 min. Slightly longer run bursts.' },
      { t: 'cross', l: 'moderate', n: 'Easy walk 30–40 min', d: 'Fresh air, keep the legs moving.' }
    ] },
    { phase: 'Base', start: [2026, 8, 13], title: 'Stretch the runs', days: [
      { t: 'rest', l: 'rest', n: 'Rest', d: 'Recover from the weekend.' },
      { t: 'run', l: 'moderate', n: 'Run 2′ / walk 90″ ×6', d: '~21 min. Breathing stays easy.' },
      { t: 'strength', l: 'moderate', n: 'Strength & core (20 min)', d: 'Add calf raises + side plank.' },
      { t: 'run', l: 'moderate', n: 'Run 2′ / walk 90″ ×6', d: 'Same as Tuesday.' },
      { t: 'rest', l: 'rest', n: 'Rest', d: 'Sleep 7–9 hrs tonight.' },
      { t: 'run', l: 'hard', n: 'Run 3′ / walk 2′ ×5', d: '~25 min. Longest run interval yet.' },
      { t: 'cross', l: 'moderate', n: 'Easy walk/jog 35 min', d: 'Mostly walk, jog when it feels good.' }
    ] },
    { phase: 'Build', start: [2026, 8, 20], title: 'Longer efforts', days: [
      { t: 'rest', l: 'rest', n: 'Rest', d: 'Mobility only.' },
      { t: 'run', l: 'moderate', n: 'Run 3′ / walk 90″ ×6', d: '~27 min steady.' },
      { t: 'strength', l: 'moderate', n: 'Strength & core (20 min)', d: 'Keep it light, focus on form.' },
      { t: 'run', l: 'moderate', n: 'Run 5′ / walk 2′ ×4', d: '~28 min. Bigger blocks now.' },
      { t: 'rest', l: 'rest', n: 'Rest', d: 'Protect tomorrow’s long run.' },
      { t: 'run', l: 'hard', n: 'Run 8′ / walk 2′ ×3', d: '~30 min. You’re building endurance.' },
      { t: 'cross', l: 'moderate', n: 'Easy walk 40 min', d: 'Recovery pace, relaxed.' }
    ] },
    { phase: 'Build', start: [2026, 8, 27], title: 'First continuous run', days: [
      { t: 'rest', l: 'rest', n: 'Rest', d: 'Recover well.' },
      { t: 'run', l: 'moderate', n: 'Run 5′ / walk 1′ ×5', d: '~30 min, short walk breaks.' },
      { t: 'strength', l: 'moderate', n: 'Strength & core (20 min)', d: 'Squats, lunges, core.' },
      { t: 'run', l: 'moderate', n: 'Run 10′ / walk 2′ ×2', d: '~24 min in two long blocks.' },
      { t: 'rest', l: 'rest', n: 'Rest', d: 'Sleep + hydrate.' },
      { t: 'run', l: 'hard', n: 'Continuous run 20 min', d: 'No walk breaks — slow & steady. Big milestone!' },
      { t: 'cross', l: 'moderate', n: 'Cross-train 30 min', d: 'Cycle or swim — easy on the legs.' }
    ] },
    { phase: 'Sharpen', start: [2026, 9, 4], title: 'Add some spice', days: [
      { t: 'rest', l: 'rest', n: 'Rest', d: 'Mobility.' },
      { t: 'run', l: 'moderate', n: 'Run 12′ / walk 1′ ×2', d: '~26 min continuous-ish.' },
      { t: 'strength', l: 'moderate', n: 'Strength & core (20 min)', d: 'Maintain, don’t max out.' },
      { t: 'run', l: 'hard', n: 'Intervals: 5×(2′ quicker / 2′ easy)', d: 'Learn a faster gear. Warm up first.' },
      { t: 'rest', l: 'rest', n: 'Rest', d: 'Recover for the long run.' },
      { t: 'run', l: 'hard', n: 'Continuous run 25 min', d: 'Relaxed, steady — roughly 3.5–4 km.' },
      { t: 'cross', l: 'moderate', n: 'Easy walk/jog 40 min', d: 'Recovery.' }
    ] },
    { phase: 'Peak', start: [2026, 9, 11], title: 'Nearly there', days: [
      { t: 'rest', l: 'rest', n: 'Rest', d: 'Bank an extra 30 min sleep this week.' },
      { t: 'run', l: 'moderate', n: 'Steady run 20 min', d: 'Smooth and controlled.' },
      { t: 'strength', l: 'moderate', n: 'Strength (light, 15 min)', d: 'Keep the legs fresh.' },
      { t: 'run', l: 'hard', n: 'Tempo: 5×3′ strong / 90″ easy', d: 'Comfortably hard efforts.' },
      { t: 'rest', l: 'rest', n: 'Rest', d: 'Sleep well before the long run.' },
      { t: 'run', l: 'hard', n: 'Long run 30 min (~4.5–5 km)', d: 'Your dress rehearsal. Finish feeling you had more.' },
      { t: 'cross', l: 'moderate', n: 'Recovery walk 30 min', d: 'Loosen up, celebrate the block.' }
    ] },
    { phase: 'Taper · Race', start: [2026, 9, 18], title: 'Taper & race week', days: [
      { t: 'rest', l: 'rest', n: 'Rest', d: 'Legs up, extra sleep.' },
      { t: 'run', l: 'moderate', n: 'Easy run 20 min', d: 'Relaxed, no pushing.' },
      { t: 'run', l: 'moderate', n: 'Sharpener: 4×1′ brisk / 2′ easy', d: 'Wake the legs up, stay short.' },
      { t: 'run', l: 'moderate', n: 'Shakeout 15 min easy', d: 'Very light, just moving.' },
      { t: 'rest', l: 'rest', n: 'Rest — prep day', d: 'Carb-lean up, hydrate, lay out kit, early night.' },
      { t: 'race', l: 'hard', n: 'RACE DAY — 5K! 🏁', d: 'Start slow, settle, finish strong. Enjoy it.' },
      { t: 'cross', l: 'moderate', n: 'Celebrate / recovery walk', d: 'Gentle walk, good food, you earned it.' }
    ] }
  ]

  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  function dateFor(weekStart, dayIdx) {
    const d = new Date(weekStart[0], weekStart[1], weekStart[2])
    d.setDate(d.getDate() + dayIdx)
    return d
  }
  function fmt(d) { return DOW[d.getDay()] + ' ' + d.getDate() + ' ' + MON[d.getMonth()] }
  function sameDay(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate() }
  function keyOf(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2) }

  const TODAY = new Date(); TODAY.setHours(0, 0, 0, 0)
  let totalSessions = 0, totalRuns = 0
  plan.forEach(w => w.days.forEach(d => { if (d.t !== 'rest') { totalSessions++; if (d.t === 'run' || d.t === 'race') totalRuns++ } }))

  // ---- Countdown ----
  function updateCountdown() {
    const now = new Date(); now.setHours(0, 0, 0, 0)
    const diff = Math.round((RACE - now) / 86400000)
    document.getElementById('bigDays').textContent = diff >= 0 ? diff : '—'
    document.getElementById('bigDaysLabel').textContent = diff === 1 ? 'day' : 'days'
    document.getElementById('miniDays').textContent = diff >= 0 ? diff : 'done'
    document.getElementById('bigDate').textContent = diff === 0 ? 'That’s today — go get it!' : (diff < 0 ? 'Race complete 🏅' : 'Saturday · 24 October 2026')
    document.getElementById('chipSessions').textContent = totalSessions + ' sessions'
  }

  // ---- current week ----
  function currentWeekIdx() {
    for (let i = 0; i < plan.length; i++) {
      const s = dateFor(plan[i].start, 0), e = dateFor(plan[i].start, 6)
      s.setHours(0, 0, 0, 0); e.setHours(23, 59, 59, 999)
      if (TODAY >= s && TODAY <= e) return i
    }
    if (TODAY < dateFor(plan[0].start, 0)) return 0
    return plan.length - 1
  }
  const curWeek = currentWeekIdx()

  // per-day load lookup by date key
  const planMap = {}
  plan.forEach((w, wi) => w.days.forEach((d, di) => { planMap[keyOf(dateFor(w.start, di))] = { load: d.l, name: d.n, tag: d.t, week: wi } }))
  function planFor(d) { return planMap[keyOf(d)] || { load: 'moderate', name: 'Training day', tag: 'run', week: curWeek } }

  // ---- render weeks ----
  const CHECK = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 7.5l3 3 6-7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  const weeksEl = document.getElementById('weeks')
  plan.forEach((w, wi) => {
    const wrap = document.createElement('div')
    wrap.className = 'week' + (wi === curWeek ? ' now open' : '')
    const s = dateFor(w.start, 0), e = dateFor(w.start, 6)
    const head = document.createElement('div')
    head.className = 'week-head'
    head.innerHTML = '<span class="week-num">' + (wi + 1) + '</span>' +
      '<div class="week-title"><b>' + w.title + '</b><small>' + fmt(s).replace(/^\w+ /, '') + ' – ' + fmt(e).replace(/^\w+ /, '') + '</small></div>' +
      (wi === curWeek ? '<span class="week-now-flag">This week</span>' : '') +
      '<span class="week-phase">' + w.phase + '</span>' +
      '<span class="wprog" data-wp="' + wi + '"></span>' +
      '<span class="caret">▶</span>'
    head.addEventListener('click', () => wrap.classList.toggle('open'))
    wrap.appendChild(head)

    const daysEl = document.createElement('div')
    daysEl.className = 'days'
    w.days.forEach((day, di) => {
      const id = 'w' + wi + 'd' + di
      const dt = dateFor(w.start, di)
      const isToday = sameDay(dt, TODAY)
      const checked = !!state[id]
      const row = document.createElement('div')
      row.className = 'day' + (checked ? ' done' : '') + (isToday ? ' today' : '')
      row.innerHTML = '<div class="dcheck"><input type="checkbox" id="' + id + '" ' + (checked ? 'checked' : '') + '><label for="' + id + '">' + CHECK + '</label></div>' +
        '<div class="dbody">' +
          '<div class="dday">' + fmt(dt) + ' <span class="dtag t-' + day.t + '">' + TAGS[day.t] + '</span></div>' +
          '<div class="dtitle">' + day.n + '</div>' +
          '<div class="ddesc">' + day.d + '</div>' +
        '</div>'
      daysEl.appendChild(row)
      const cb = row.querySelector('input')
      cb.addEventListener('change', () => {
        if (cb.checked) state[id] = 1; else delete state[id]
        row.classList.toggle('done', cb.checked)
        save(); refresh()
      })
    })
    wrap.appendChild(daysEl)
    weeksEl.appendChild(wrap)
  })

  // ---- race checklist ----
  const raceItems = [
    'Lay out kit the night before (shoes, socks, bib, watch)',
    'Charge watch / phone; set alarms',
    'Rehearsed breakfast eaten 2–3 hrs before',
    'Toilet stop before the start',
    'Dynamic warm-up: brisk walk + leg swings',
    'Start slower than feels natural',
    'Sip water at stations if provided',
    'Finish strong — then refuel within the hour'
  ]
  const raceEl = document.getElementById('raceList')
  raceItems.forEach((txt, i) => {
    const id = 'race' + i, checked = !!state[id]
    const row = document.createElement('div')
    row.className = 'rc' + (checked ? ' done' : '')
    row.innerHTML = '<input type="checkbox" id="' + id + '" ' + (checked ? 'checked' : '') + '><label class="box" for="' + id + '">' + CHECK + '</label><span class="txt">' + txt + '</span>'
    raceEl.appendChild(row)
    const cb = row.querySelector('input')
    cb.addEventListener('change', () => { if (cb.checked) state[id] = 1; else delete state[id]; row.classList.toggle('done', cb.checked); save() })
  })

  // ---- stats refresh ----
  const CIRC = 2 * Math.PI * 58
  function refresh() {
    let done = 0, runsDone = 0, weeksCleared = 0
    plan.forEach((w, wi) => {
      let wTotal = 0, wDone = 0
      w.days.forEach((d, di) => {
        if (d.t !== 'rest') {
          wTotal++
          if (state['w' + wi + 'd' + di]) { done++; wDone++; if (d.t === 'run' || d.t === 'race') runsDone++ }
        }
      })
      const wp = document.querySelector('[data-wp="' + wi + '"]')
      if (wp) wp.textContent = wDone + '/' + wTotal
      if (wTotal > 0 && wDone === wTotal) weeksCleared++
    })
    const pct = totalSessions ? Math.round(done / totalSessions * 100) : 0
    document.getElementById('ringPct').textContent = pct + '%'
    document.getElementById('ringFg').style.strokeDashoffset = CIRC * (1 - done / totalSessions)
    document.getElementById('stDone').textContent = done
    document.getElementById('stRuns').textContent = runsDone
    document.getElementById('stWeek').textContent = (curWeek + 1)
    document.getElementById('stStreak').textContent = weeksCleared
    document.getElementById('barDone').style.width = (done / totalSessions * 100) + '%'
    document.getElementById('barRuns').style.width = (totalRuns ? runsDone / totalRuns * 100 : 0) + '%'
    document.getElementById('barWeek').style.width = ((curWeek + 1) / plan.length * 100) + '%'
    document.getElementById('barStreak').style.width = (weeksCleared / plan.length * 100) + '%'
  }

  // ---- tabs ----
  const tabs = document.querySelectorAll('.tab')
  tabs.forEach(t => {
    t.addEventListener('click', () => {
      tabs.forEach(x => x.setAttribute('aria-selected', 'false'))
      t.setAttribute('aria-selected', 'true')
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'))
      document.getElementById('panel-' + t.dataset.tab).classList.add('active')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    })
  })

  // ---- theme ----
  const themeBtn = document.getElementById('themeBtn')
  let savedTheme = null; try { savedTheme = localStorage.getItem('dawnRun5k.theme') } catch (e) {}
  if (savedTheme) document.documentElement.setAttribute('data-theme', savedTheme)
  themeBtn.addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme')
    const isDark = cur ? cur === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches
    const next = isDark ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', next)
    try { localStorage.setItem('dawnRun5k.theme', next) } catch (e) {}
  })

  // ---- reset ----
  document.getElementById('resetBtn').addEventListener('click', () => {
    if (confirm('Reset all ticked workouts and race-day items? Your food & sleep logs and weight are kept.')) {
      Object.keys(state).forEach(k => { if (/^w\d+d\d+$/.test(k) || /^race\d+$/.test(k)) delete state[k] })
      save()
      document.querySelectorAll('.day input[type="checkbox"], .rc input[type="checkbox"]').forEach(c => { c.checked = false })
      document.querySelectorAll('.day.done,.rc.done').forEach(r => r.classList.remove('done'))
      refresh()
    }
  })

  // ================= FUEL & SLEEP ENGINE =================
  const FOODS = {
    // --- Carbs ---
    roti: ['Roti / chapati', 'c', 120, 18, 3, 3], rice: ['Rice (cup)', 'c', 205, 45, 4, 0], paratha: ['Paratha', 'c', 180, 22, 4, 8],
    idli: ['Idli (2)', 'c', 140, 30, 4, 1], dosa: ['Plain dosa', 'c', 165, 25, 4, 5], poha: ['Poha (bowl)', 'c', 250, 40, 5, 7],
    upma: ['Upma (bowl)', 'c', 230, 35, 6, 8], oats: ['Oats bowl', 'c', 150, 27, 5, 3], banana: ['Banana', 'c', 105, 27, 1, 0],
    bread: ['Toast (slice)', 'c', 80, 14, 3, 1], potato: ['Aloo / potato', 'c', 160, 37, 4, 0], sweetpotato: ['Sweet potato', 'c', 115, 27, 2, 0],
    pasta: ['Pasta (cup)', 'c', 200, 43, 7, 1], fruit: ['Apple / fruit', 'c', 95, 25, 0, 0], energybar: ['Energy bar', 'c', 200, 30, 8, 6],
    // --- Protein ---
    dal: ['Dal / lentils', 'p', 230, 40, 18, 1], rajma: ['Rajma (cup)', 'p', 215, 38, 15, 1], chana: ['Chana / chickpea', 'p', 210, 35, 12, 4],
    curd: ['Curd / dahi (bowl)', 'p', 100, 8, 8, 4], paneer: ['Paneer 100g', 'p', 265, 4, 18, 20], soya: ['Soya chunks', 'p', 170, 10, 26, 1],
    sprouts: ['Sprouts (cup)', 'p', 125, 22, 10, 1], eggs: ['Eggs (2)', 'p', 140, 1, 12, 10], chicken: ['Chicken 100g', 'p', 165, 0, 31, 4],
    chickencurry: ['Chicken curry', 'p', 250, 6, 26, 13], fish: ['Fish 100g', 'p', 180, 0, 25, 8], tofu: ['Tofu 100g', 'p', 145, 3, 16, 9],
    yogurt: ['Greek yogurt', 'p', 150, 8, 20, 4], milk: ['Milk (glass)', 'p', 120, 12, 8, 5], shake: ['Protein shake', 'p', 160, 8, 25, 3],
    // --- Fats & veg ---
    sabzi: ['Mixed sabzi', 'f', 120, 12, 4, 7], ghee: ['Ghee (1 tsp)', 'f', 45, 0, 0, 5], nuts: ['Nuts (handful)', 'f', 180, 6, 6, 16],
    peanuts: ['Peanuts / chana', 'f', 165, 6, 7, 14], chutney: ['Coconut chutney', 'f', 90, 3, 1, 8], avocado: ['Avocado ½', 'f', 120, 6, 1, 11],
    pnut: ['Peanut butter', 'f', 95, 3, 4, 8], veg: ['Veg / salad', 'f', 60, 10, 3, 1], cheese: ['Cheese slice', 'f', 110, 1, 7, 9],
    // --- Drinks ---
    chai: ['Chai', 'd', 90, 12, 3, 3], lassi: ['Sweet lassi', 'd', 180, 28, 6, 5], chaas: ['Chaas / buttermilk', 'd', 40, 4, 3, 1],
    coconutwater: ['Coconut water', 'd', 45, 9, 1, 0], nimbupani: ['Nimbu pani', 'd', 60, 15, 0, 0], coffee: ['Coffee', 'd', 5, 0, 0, 0],
    sports: ['Sports drink', 'd', 80, 20, 0, 0], juice: ['Fruit juice', 'd', 110, 26, 1, 0]
  }
  // definition lookup covers both defaults and the user's saved custom foods
  function foodDef(id) { return FOODS[id] || (state.customFoods && state.customFoods[id]) || null }
  const GROUPS = [['c', 'Carbs — your fuel'], ['p', 'Protein — repair'], ['f', 'Fats & veg'], ['d', 'Drinks']]

  function getWeight() { return state.weight || 65 }
  function ensureLog(k) { if (!state.log) state.log = {}; if (!state.log[k]) state.log[k] = { foods: {}, water: 0 }; return state.log[k] }

  function fuelTargets(w, load) {
    const T = { rest: { kc: 28, c: 3.0, p: 1.4, ml: 35 }, moderate: { kc: 33, c: 5.0, p: 1.5, ml: 42 }, hard: { kc: 37, c: 6.5, p: 1.6, ml: 48 } }[load]
    return { kc: Math.round(w * T.kc), c: Math.round(w * T.c), p: Math.round(w * T.p), f: Math.round(w * 1.0), ml: Math.round(w * T.ml) }
  }
  function barClass(r) { return r < 0.8 ? 'warn' : (r > 1.15 ? 'over' : '') }
  function carbTip(g) { if (g < 15) return 'a piece of fruit'; if (g < 35) return 'a banana + a slice of toast'; if (g < 60) return 'a bowl of oats or a cup of rice'; return 'a full carb meal — rice/pasta plus fruit' }
  function protTip(g) { if (g < 10) return 'a glass of milk or a boiled egg'; if (g < 25) return 'Greek yogurt or 2 eggs'; return 'a chicken, tofu or dal portion (~30 g)' }

  function renderFuel() {
    const host = document.getElementById('fuelToday'); if (!host) return
    const w = getWeight(), today = new Date(); today.setHours(0, 0, 0, 0)
    const k = keyOf(today), pd = planFor(today), tg = fuelTargets(w, pd.load), log = ensureLog(k)
    const tot = { kc: 0, c: 0, p: 0, f: 0 }, foods = log.foods || {}
    Object.keys(foods).forEach(id => { const q = foods[id], F = foodDef(id); if (!F) return; tot.kc += F[2] * q; tot.c += F[3] * q; tot.p += F[4] * q; tot.f += F[5] * q })
    const water = log.water || 0
    const loadLabel = { rest: 'Rest day', moderate: 'Training day', hard: 'Hard / long day' }[pd.load]

    function bar(label, val, target, unit) {
      const r = target ? val / target : 0, pct = Math.min(100, Math.round(r * 100))
      return '<div class="tgt"><div class="tl"><span>' + label + '</span><span>' + Math.round(r * 100) + '%</span></div>' +
        '<div class="tv">' + Math.round(val) + '<small> / ' + target + ' ' + unit + '</small></div>' +
        '<div class="tbar"><i class="' + barClass(r) + '" style="width:' + pct + '%"></i></div></div>'
    }
    const merged = Object.assign({}, FOODS, state.customFoods || {})
    let qa = ''
    GROUPS.forEach(g => {
      let chips = ''
      Object.keys(merged).forEach(id => {
        if (merged[id][1] !== g[0]) return
        const F = merged[id], custom = !!(state.customFoods && state.customFoods[id])
        chips += '<span class="qa-wrap">' +
          '<button class="qa' + (custom ? ' qa-custom' : '') + '" data-add="' + id + '"><span class="plus">+</span>' + F[0] + ' <span class="kc">' + F[2] + '</span></button>' +
          (custom ? '<button class="qa-x" data-delfood="' + id + '" title="Remove custom food" aria-label="Remove ' + F[0] + '">×</button>' : '') +
          '</span>'
      })
      qa += '<div class="qa-grp"><b>' + g[1] + '</b><div class="qa-row">' + chips + '</div></div>'
    })
    let logged = ''
    const ids = Object.keys(foods).filter(id => foods[id] > 0 && foodDef(id))
    if (!ids.length) { logged = '<div class="empty">Nothing logged yet — tap foods above as you eat them.</div>' }
    else ids.forEach(id => { const F = foodDef(id), q = foods[id]
      logged += '<div class="li"><span class="nm">' + F[0] + '</span><span class="mc">' + (F[2] * q) + ' kcal · ' + (F[3] * q) + 'C ' + (F[4] * q) + 'P</span>' +
        '<div class="stp"><button data-dec="' + id + '" aria-label="one less">–</button><span class="q">' + q + '</span><button data-inc="' + id + '" aria-label="one more">+</button></div></div>'
    })
    const glasses = Math.round(water / 250), tgGlass = Math.ceil(tg.ml / 250)
    let gh = ''
    for (let i = 0; i < Math.max(tgGlass, glasses); i++) gh += '<span class="g' + (i < glasses ? ' full' : '') + '"></span>'

    const rc = recalcFuel(tot, tg, pd, water)

    host.innerHTML =
      '<div class="logblock">' +
        '<div class="load-head"><span class="d">Today · ' + fmt(today).replace(/^\w+ /, '') + '</span>' +
          '<span class="load-pill load-' + pd.load + '">' + loadLabel + '</span>' +
          '<span style="color:var(--ink-soft);font-size:.82rem">' + pd.name + '</span></div>' +
        '<div class="load-sub">Targets scale to your weight (' + w + ' kg) and today’s effort.</div>' +
        '<div class="tgrid">' + bar('Calories', tot.kc, tg.kc, 'kcal') + bar('Carbs', tot.c, tg.c, 'g') + bar('Protein', tot.p, tg.p, 'g') + bar('Water', water, tg.ml, 'ml') + '</div>' +
        '<div class="recal ' + rc.cls + '"><div class="vh"><span class="badge">' + rc.badge + '</span>' + rc.head + '</div>' +
          (rc.items.length ? '<ul>' + rc.items.map(x => '<li>' + x + '</li>').join('') + '</ul>' : '') + '</div>' +
      '</div>' +
      '<div class="logblock"><div class="load-head" style="margin-bottom:12px"><span class="d">Add food</span></div>' +
        '<div class="qa-groups">' + qa + '</div></div>' +
      '<div class="logblock"><div class="load-head" style="margin-bottom:12px"><span class="d">Add custom food</span></div>' +
        '<div class="custom-form">' +
          '<input id="cfName" placeholder="Food name" maxlength="40" aria-label="Food name">' +
          '<select id="cfCat" aria-label="Category"><option value="c">Carbs</option><option value="p">Protein</option><option value="f">Fats & veg</option><option value="d">Drinks</option></select>' +
          '<input id="cfKcal" type="number" min="0" max="2000" placeholder="kcal" aria-label="Calories">' +
          '<input id="cfC" type="number" min="0" max="300" placeholder="Carbs g" aria-label="Carbs grams">' +
          '<input id="cfP" type="number" min="0" max="300" placeholder="Protein g" aria-label="Protein grams">' +
          '<input id="cfF" type="number" min="0" max="300" placeholder="Fat g" aria-label="Fat grams">' +
          '<button class="savebtn" id="cfAdd">Add &amp; log</button>' +
        '</div>' +
        '<div class="custom-hint">Name and calories required. Saved to your food list for next time, and logged once for today.</div></div>' +
      '<div class="logblock"><div class="load-head" style="margin-bottom:12px"><span class="d">Water</span>' +
          '<span style="color:var(--ink-soft);font-size:.82rem">' + water + ' / ' + tg.ml + ' ml</span></div>' +
        '<div class="water-ctl"><div class="stp"><button data-water="-250" aria-label="less water">–</button>' +
          '<span class="q">' + glasses + '</span><button data-water="250" aria-label="more water">+</button></div>' +
          '<div class="glasses">' + gh + '</div><span style="color:var(--ink-soft);font-size:.8rem">1 glass ≈ 250 ml</span></div></div>' +
      '<div class="logblock"><div class="load-head" style="margin-bottom:12px"><span class="d">Logged today</span></div>' +
        '<div class="logged">' + logged + '</div></div>'
  }

  function recalcFuel(tot, tg, pd, water) {
    const cGap = tg.c - tot.c, pGap = tg.p - tot.p, wGap = tg.ml - water, items = []
    let cls, badge, head
    const cR = tot.c / tg.c, pR = tot.p / tg.p, kR = tot.kc / tg.kc
    const hard = pd.load === 'hard'
    if (cGap > 10) items.push('<b>' + Math.round(cGap) + ' g carbs</b> to go' + (hard ? ' before today’s hard session' : '') + ' — add ' + carbTip(cGap) + '.')
    if (pGap > 8) items.push('<b>' + Math.round(pGap) + ' g protein</b> short — add ' + protTip(pGap) + '.')
    if (wGap > 250) { const gl = Math.round(wGap / 250); items.push('<b>' + gl + ' more glass' + (gl > 1 ? 'es' : '') + '</b> of water to hit today’s hydration.') }
    if (kR > 1.2 && pd.load !== 'hard') items.push('You’re over on calories for an easy day — no need to add more; keep the rest lighter.')
    if (hard && cR < 0.8) { cls = 'bad'; badge = 'Refuel'; head = 'Under-fuelled for today’s hard session' }
    else if (cR >= 0.8 && pR >= 0.8 && kR <= 1.2 && wGap <= 250) { cls = 'good'; badge = 'On track'; head = 'Well fuelled and balanced — nice work'; if (!items.length) items.push('Everything’s topped up. Keep meals steady through the day.') }
    else if (!items.length) { cls = 'good'; badge = 'On track'; head = 'Looking good so far'; items.push('Keep logging as you eat to stay on target.') }
    else { cls = 'warn'; badge = 'Top up'; head = 'A few gaps to close today' }
    return { cls, badge, head, items }
  }

  // ---------- SLEEP ----------
  function sleepTargetForWeek(wi) { return (wi >= 5) ? 8.5 : 8.0 } // peak weeks W6–7 need more
  function fmtClock(mins) { mins = ((mins % 1440) + 1440) % 1440; const h = Math.floor(mins / 60), m = mins % 60; const ap = h < 12 ? 'am' : 'pm'; let h12 = h % 12; if (h12 === 0) h12 = 12; return h12 + ':' + ('0' + m).slice(-2) + ' ' + ap }

  function renderSleep() {
    const host = document.getElementById('sleepPanel'); if (!host) return
    const today = new Date(); today.setHours(0, 0, 0, 0); const k = keyOf(today)
    const log = state.log && state.log[k] ? state.log[k] : {}
    const wi = curWeek, target = sleepTargetForWeek(wi)
    const nights = []
    if (state.log) Object.keys(state.log).forEach(dk => { const e = state.log[dk]; if (e && typeof e.sleep === 'number') nights.push({ k: dk, h: e.sleep, q: e.quality }) })
    nights.sort((a, b) => a.k < b.k ? -1 : 1)
    const last7 = nights.slice(-7)
    const avg = last7.length ? last7.reduce((s, n) => s + n.h, 0) / last7.length : 0
    let debt = 0; last7.forEach(n => { debt += (target - n.h) }); debt = Math.max(0, debt)

    let scls, sbadge, shead
    if (!last7.length) { scls = 'warn'; sbadge = 'Log it'; shead = 'Log last night to start tracking your sleep' }
    else if (debt < 1 && avg >= target - 0.3) { scls = 'good'; sbadge = 'Rested'; shead = 'You’re well rested — keep this rhythm' }
    else if (debt <= 3) { scls = 'warn'; sbadge = 'Mild debt'; shead = 'Carrying about ' + debt.toFixed(1) + ' h of sleep debt' }
    else { scls = 'bad'; sbadge = 'Sleep debt'; shead = 'Significant debt (' + debt.toFixed(1) + ' h) — recovery is slipping' }

    const items = []; let tonight = target
    if (debt > 0.5) { tonight = Math.min(target + 1.5, target + debt * 0.4); tonight = Math.round(tonight * 4) / 4
      items.push('Aim for <b>' + tonight.toFixed(2).replace(/\.00$/, '').replace(/0$/, '') + ' h tonight</b> to chip away at the debt (base target ' + target + ' h).')
    } else if (last7.length) { items.push('Hold your <b>' + target + ' h target</b> tonight — you’re on top of it.') }
    const wake = (log.wake) || (state.wake) || '06:30'
    const wp = wake.split(':'); const wmin = parseInt(wp[0], 10) * 60 + parseInt(wp[1] || '0', 10)
    const bed = wmin - Math.round((tonight + 0.33) * 60)
    items.push('For a ' + wake.replace(/^0/, '') + ' wake-up, lights-out around <b>' + fmtClock(bed) + '</b> (includes ~20 min to fall asleep).')
    const tm = new Date(today); tm.setDate(tm.getDate() + 1); const tp = planFor(tm)
    if (tp.tag !== 'rest') {
      if ((debt >= 2 || (last7.length && last7[last7.length - 1].h < 7)) && tp.load === 'hard')
        items.push('Tomorrow is a <b>hard session</b> (' + tp.name + '). With this debt, prioritise sleep tonight — or swap it to an easy run if you wake up flat.')
      else items.push('Tomorrow: ' + tp.name + '. A solid night sets you up for it.')
    } else items.push('Tomorrow is a rest day — a good chance to catch up if you’re short.')

    let chart = ''
    if (!last7.length) { chart = '<div class="none">Your last 7 nights will chart here.</div>' }
    else last7.forEach(n => { const hpct = Math.min(100, n.h / 10 * 100); const c = n.h >= target - 0.5 ? '' : (n.h >= 6 ? 'low' : 'vlow')
      const d = new Date(n.k + 'T00:00:00'); const lbl = DOW[d.getDay()]
      chart += '<div class="col"><span class="val">' + n.h + '</span><div class="bar ' + c + '" style="height:' + hpct + '%"></div><span class="lbl">' + lbl + '</span></div>'
    })

    const curH = (typeof log.sleep === 'number') ? log.sleep : ''
    const curQ = log.quality || ''

    host.innerHTML =
      '<div class="logblock">' +
        '<div class="load-head" style="margin-bottom:14px"><span class="d">Last night</span>' +
          '<span class="load-pill load-' + (wi >= 5 ? 'hard' : 'moderate') + '">Week ' + (wi + 1) + ' target ' + target + ' h</span></div>' +
        '<div class="sl-in">' +
          '<div class="f"><span>Hours slept</span><input id="slHours" type="number" min="0" max="14" step="0.25" value="' + curH + '" placeholder="7.5" inputmode="decimal"></div>' +
          '<div class="f"><span>Quality</span><div class="qbtns" id="slQual">' +
            ['Good', 'OK', 'Poor'].map(q => '<button data-q="' + q + '" aria-pressed="' + (curQ === q) + '">' + q + '</button>').join('') + '</div></div>' +
          '<div class="f"><span>Usual wake time</span><input id="slWake" type="time" value="' + wake + '"></div>' +
          '<button class="savebtn" id="slSave">Save night</button>' +
        '</div>' +
      '</div>' +
      '<div class="logblock">' +
        '<div class="sl-stats">' +
          '<div class="sl-stat"><div class="v" style="color:var(--pine)">' + (last7.length ? avg.toFixed(1) : '–') + '</div><div class="k">7-night avg (h)</div></div>' +
          '<div class="sl-stat"><div class="v" style="color:' + (debt > 3 ? 'var(--race)' : debt > 1 ? 'var(--amber)' : 'var(--go)') + '">' + (last7.length ? debt.toFixed(1) : '–') + '</div><div class="k">Sleep debt (h)</div></div>' +
          '<div class="sl-stat"><div class="v">' + target + '</div><div class="k">Tonight’s target</div></div>' +
        '</div>' +
        '<div class="chart">' + chart + '</div>' +
      '</div>' +
      '<div class="recal ' + scls + '"><div class="vh"><span class="badge">' + sbadge + '</span>' + shead + '</div>' +
        '<ul>' + items.map(x => '<li>' + x + '</li>').join('') + '</ul></div>'
  }

  // ---- delegated interactions ----
  function addCustomFood() {
    const name = (document.getElementById('cfName').value || '').trim()
    const cat = document.getElementById('cfCat').value
    const kcal = parseInt(document.getElementById('cfKcal').value, 10)
    const c = parseInt(document.getElementById('cfC').value, 10) || 0
    const p = parseInt(document.getElementById('cfP').value, 10) || 0
    const f = parseInt(document.getElementById('cfF').value, 10) || 0
    if (!name) { document.getElementById('cfName').focus(); return }
    if (isNaN(kcal) || kcal < 0) { document.getElementById('cfKcal').focus(); return }
    if (!state.customFoods) state.customFoods = {}
    const id = 'cust_' + Date.now().toString(36)
    state.customFoods[id] = [name, cat, kcal, c, p, f]
    const log = ensureLog(keyOf(new Date()))
    log.foods[id] = (log.foods[id] || 0) + 1        // log it once for today
    save(); renderFuel()
  }
  function removeCustomFood(id) {
    if (state.customFoods) delete state.customFoods[id]
    if (state.log) Object.keys(state.log).forEach(k => { if (state.log[k].foods && state.log[k].foods[id] !== undefined) delete state.log[k].foods[id] })
    save(); renderFuel()
  }

  document.getElementById('fuelToday').addEventListener('click', e => {
    const t = e.target.closest('button'); if (!t) return
    if (t.dataset.delfood) { removeCustomFood(t.dataset.delfood); return }
    if (t.id === 'cfAdd') { addCustomFood(); return }
    const today = keyOf(new Date()), log = ensureLog(today)
    if (t.dataset.add) { log.foods[t.dataset.add] = (log.foods[t.dataset.add] || 0) + 1 }
    else if (t.dataset.inc) { log.foods[t.dataset.inc] = (log.foods[t.dataset.inc] || 0) + 1 }
    else if (t.dataset.dec) { log.foods[t.dataset.dec] = Math.max(0, (log.foods[t.dataset.dec] || 0) - 1); if (log.foods[t.dataset.dec] === 0) delete log.foods[t.dataset.dec] }
    else if (t.dataset.water !== undefined) { log.water = Math.max(0, (log.water || 0) + parseInt(t.dataset.water, 10)) }
    else return
    save(); renderFuel()
  })

  const wtInput = document.getElementById('wt')
  wtInput.value = getWeight()
  wtInput.addEventListener('change', () => {
    const v = parseFloat(wtInput.value)
    if (v >= 30 && v <= 200) { state.weight = Math.round(v); save(); renderFuel() } else { wtInput.value = getWeight() }
  })

  document.getElementById('sleepPanel').addEventListener('click', e => {
    const q = e.target.closest('[data-q]')
    if (q) { document.querySelectorAll('#slQual button').forEach(b => b.setAttribute('aria-pressed', b === q)); return }
    if (e.target.id === 'slSave') {
      const h = parseFloat(document.getElementById('slHours').value)
      const wake = document.getElementById('slWake').value || '06:30'
      const qsel = document.querySelector('#slQual button[aria-pressed="true"]')
      const today = keyOf(new Date()), log = ensureLog(today)
      if (!isNaN(h) && h >= 0 && h <= 14) { log.sleep = Math.round(h * 4) / 4 }
      log.quality = qsel ? qsel.dataset.q : log.quality; log.wake = wake; state.wake = wake
      save(); renderSleep()
    }
  })

  updateCountdown()
  refresh()
  renderFuel()
  renderSleep()
}
