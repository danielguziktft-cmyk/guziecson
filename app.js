
const CFG = window.G90_CONFIG;

const defaults = {
  // "day" zostaje tylko dla kompatybilności ze starymi danymi.
  // Prawdziwy DAY projektu liczymy automatycznie od daty startu.
  day: 1,
  trainingIndex: 1,
  weight: null,
  games: [],
  lastGame: null,
  squats: 0,
  donationsPLN: 0,
  history: [],
  yesterdayFood: null,
  notes: "",
  schedule: {
    offDays: [
      {date:"2026-08-28", label:"KAWALERSKIE"},
      {date:"2026-08-29", label:"KAWALERSKIE"},
      {date:"2026-08-30", label:"KAWALERSKIE"}
    ]
  },
  promo: {
    trailerUrl: "",
    pickem: {
      enabled: false,
      title: "PICK'EM — Zgadnij wagę Guziecsona",
      description: "Zgadnij moją wagę na czczo i wyniki streama.",
      url: "",
      deadline: "",
      prize: "Wybrany smak kreatyny WKDZIK",
      edition: "#1"
    }
  },
  progress: {
    weightLog: [],
    measurements: [],
    photos: []
  }
};

let state = JSON.parse(JSON.stringify(defaults));
let ready = false;

if (!firebase.apps.length) firebase.initializeApp(CFG.firebaseConfig);
const db = firebase.database();
const stateRef = db.ref("project/state");

function normalize(raw){
  raw = raw || {};
  const history = Array.isArray(raw.history) ? raw.history : [];
  const inferredTrainingIndex = Number(raw.trainingIndex) || Math.max(1, history.length + 1);

  return {
    ...JSON.parse(JSON.stringify(defaults)),
    ...raw,
    trainingIndex: inferredTrainingIndex,
    games: Array.isArray(raw.games) ? raw.games : [],
    history,
    schedule: {
      ...defaults.schedule,
      ...(raw.schedule || {}),
      offDays: Array.isArray(raw.schedule?.offDays)
        ? raw.schedule.offDays
        : JSON.parse(JSON.stringify(defaults.schedule.offDays))
    },
    promo: {
      ...defaults.promo,
      ...(raw.promo || {}),
      pickem: {
        ...defaults.promo.pickem,
        ...((raw.promo || {}).pickem || {})
      }
    },
    progress: {
      weightLog: Array.isArray(raw.progress?.weightLog) ? raw.progress.weightLog : [],
      measurements: Array.isArray(raw.progress?.measurements) ? raw.progress.measurements : [],
      photos: Array.isArray(raw.progress?.photos) ? raw.progress.photos : []
    }
  };
}

stateRef.on("value", snap => {
  const raw = snap.val();
  state = raw === null ? JSON.parse(JSON.stringify(defaults)) : normalize(raw);
  ready = true;
  window.dispatchEvent(new Event("g90update"));
});

function localISODate(d = new Date()){
  const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,"0"), day=String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}

function isoDayNumber(iso){
  const [y,m,d] = String(iso).split("-").map(Number);
  return Math.floor(Date.UTC(y,m-1,d)/86400000);
}

function addDaysISO(iso, days){
  const [y,m,d] = String(iso).split("-").map(Number);
  const dt = new Date(Date.UTC(y,m-1,d+days));
  return dt.toISOString().slice(0,10);
}

function projectDay(dateISO = localISODate()){
  const diff = isoDayNumber(dateISO) - isoDayNumber(CFG.projectStartDate) + 1;
  return Math.max(1, Math.min(CFG.maxDays, diff));
}

function offDayFor(dateISO = localISODate()){
  return (state.schedule?.offDays || []).find(x => x.date === dateISO) || null;
}

function dayStatus(dateISO = localISODate()){
  const off = offDayFor(dateISO);
  return off
    ? {type:"off", label:off.label || "OFF DAY", date:dateISO}
    : {type:"stream", label:"STREAM", date:dateISO};
}

function nextStreamDate(fromISO = localISODate()){
  for(let i=1;i<=14;i++){
    const candidate = addDaysISO(fromISO, i);
    if(projectDay(candidate) >= CFG.maxDays && isoDayNumber(candidate) > isoDayNumber(addDaysISO(CFG.projectStartDate, CFG.maxDays-1))) return null;
    if(!offDayFor(candidate)) return candidate;
  }
  return null;
}

function exercise(){
  const idx = Math.max(1, Number(state.trainingIndex) || 1);
  return CFG.exercises[(idx-1)%CFG.exercises.length];
}

function avg(){
  return state.games.length
    ? state.games.reduce((a,b)=>a+Number(b.place),0)/state.games.length
    : null;
}

function foodFor(a){
  if(a===null) return null;
  if(a<=4.4) return "SOS WKDZIK";
  if(a<=4.7) return "NEUTRAL";
  return "KARA";
}

function reps(){
  const m=exercise().multiplier;
  return state.games.reduce((s,g)=>s+Number(g.place)*m,0);
}

function avgRunMeters(a){
  if(a===null) return 0;
  if(a<=4.2) return 0;
  if(a<=4.4) return 300;
  if(a<=4.6) return 600;
  if(a<=4.8) return 900;
  return 1200;
}

function donationMeters(){
  return Math.floor((Number(state.donationsPLN)||0)/2)*CFG.donationMetersPer2PLN;
}

function finalRun(){
  return Math.min(CFG.runCapMeters, avgRunMeters(avg())+donationMeters());
}

function save(){ return stateRef.set(state); }

async function nextDay(){
  const a=avg(), ex=exercise();
  if(!state.games.length) return false;

  const currentDay = projectDay();
  state.history.unshift({
    day:currentDay,
    trainingIndex:Number(state.trainingIndex)||1,
    date:localISODate(),
    avg:a,
    reps:reps(),
    exercise:ex.name,
    runMeters:finalRun(),
    food:foodFor(a),
    games:[...state.games]
  });

  state.yesterdayFood=foodFor(a);
  state.trainingIndex=(Number(state.trainingIndex)||1)+1;
  state.day=currentDay; // legacy
  state.games=[];
  state.lastGame=null;
  state.squats=0;
  state.donationsPLN=0;
  await save();
  return true;
}

window.G90 = {
  get state(){return state},
  get ready(){return ready},

  save, avg, foodFor, reps, exercise, avgRunMeters, donationMeters, finalRun, nextDay,
  localISODate, projectDay, offDayFor, dayStatus, nextStreamDate, addDaysISO,

  addGame(place){
    const p=Number(place), e=exercise(), ts=Date.now();
    state.games.push({place:p,ts});
    state.lastGame={
      place:p,
      multiplier:e.multiplier,
      reps:p*e.multiplier,
      exercise:e.name,
      repLabel:e.repLabel || "REP",
      ts
    };
    return save();
  },

  undoGame(){
    state.games.pop();
    state.lastGame=null;
    return save();
  },

  addSquats(n){
    state.squats=Math.min(CFG.squatCap,Number(state.squats||0)+n);
    return save();
  },

  resetStream(){
    state.games=[];
    state.lastGame=null;
    state.squats=0;
    state.donationsPLN=0;
    return save();
  },

  async resetProject(){
    state=JSON.parse(JSON.stringify(defaults));
    await save();
  },

  set(k,v){
    state[k]=v;
    return save();
  },

  async addOffDay(date,label){
    if(!date) return;
    state.schedule = state.schedule || {offDays:[]};
    state.schedule.offDays = Array.isArray(state.schedule.offDays) ? state.schedule.offDays : [];
    state.schedule.offDays = state.schedule.offDays.filter(x=>x.date!==date);
    state.schedule.offDays.push({date,label:(label||"OFF DAY").trim()});
    state.schedule.offDays.sort((a,b)=>a.date.localeCompare(b.date));
    await save();
  },

  async deleteOffDay(date){
    state.schedule.offDays = (state.schedule?.offDays||[]).filter(x=>x.date!==date);
    await save();
  },

  async addWeight(weight,date){
    const val=Number(weight);
    if(!Number.isFinite(val) || val<=0) return;
    const d=date || localISODate();
    state.weight=val;
    state.progress.weightLog = Array.isArray(state.progress.weightLog) ? state.progress.weightLog : [];
    // Jedna oficjalna waga dziennie — ponowny zapis tego dnia ją zastępuje.
    state.progress.weightLog = state.progress.weightLog.filter(x=>x.date!==d);
    state.progress.weightLog.unshift({
      day:projectDay(d),
      date:d,
      weight:val,
      ts:Date.now()
    });
    state.progress.weightLog.sort((a,b)=>String(b.date).localeCompare(String(a.date)));
    await save();
  },

  async deleteWeight(ts){
    state.progress.weightLog=(state.progress.weightLog||[]).filter(x=>x.ts!==ts);
    const latest=(state.progress.weightLog||[])[0];
    if(latest) state.weight=latest.weight;
    await save();
  },

  async addMeasurement(m){
    state.progress.measurements = Array.isArray(state.progress.measurements) ? state.progress.measurements : [];
    state.progress.measurements.unshift({
      ...m,
      weight: m.weight ?? state.weight ?? null
    });
    await save();
  },

  async addPhoto(p){
    state.progress.photos.unshift(p);
    await save();
  },

  async deleteMeasurement(ts){
    state.progress.measurements = state.progress.measurements.filter(x=>x.ts!==ts);
    await save();
  },

  async deletePhoto(ts){
    state.progress.photos = state.progress.photos.filter(x=>x.ts!==ts);
    await save();
  }
};
