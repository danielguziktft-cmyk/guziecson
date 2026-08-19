const CFG = window.G90_CONFIG;
const defaults = {
  day: 1,
  weight: null,
  measurements: {waist:null, chest:null, arm:null, thigh:null},
  games: [],
  squats: 0,
  donationsPLN: 0,
  history: [],
  yesterdayFood: null,
  notes: ""
};

let state = JSON.parse(JSON.stringify(defaults));
let ready = false;

firebase.initializeApp(CFG.firebaseConfig);
const db = firebase.database();
const stateRef = db.ref("project/state");

function normalize(raw){
  raw = raw || {};
  return {
    ...JSON.parse(JSON.stringify(defaults)),
    ...raw,
    measurements: {...defaults.measurements, ...(raw.measurements || {})},
    games: Array.isArray(raw.games) ? raw.games : [],
    history: Array.isArray(raw.history) ? raw.history : []
  };
}

stateRef.on("value", snap => {
  const raw = snap.val();
  if (raw === null) {
    state = JSON.parse(JSON.stringify(defaults));
    stateRef.set(state);
  } else {
    state = normalize(raw);
  }
  ready = true;
  window.dispatchEvent(new Event("g90update"));
});

function exercise(){
  return CFG.exercises[(Math.max(1, Number(state.day)) - 1) % CFG.exercises.length];
}
function avg(){
  return state.games.length ? state.games.reduce((a,b)=>a+Number(b.place),0)/state.games.length : null;
}
function foodFor(a){
  if(a===null) return null;
  if(a>=3.8 && a<=4.4) return "SOS WKDZIK";
  if(a>=4.5 && a<=4.7) return "NEUTRAL";
  if(a>=4.8) return "KARA";
  return "SOS WKDZIK";
}
function reps(){
  const m = exercise().multiplier;
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
  return Math.min(CFG.runCapMeters, avgRunMeters(avg()) + donationMeters());
}
function save(){ return stateRef.set(state); }

async function nextDay(){
  const a = avg();
  const ex = exercise();

  if(state.games.length){
    state.history.unshift({
      day: state.day,
      date: new Date().toISOString().slice(0,10),
      avg: a,
      reps: reps(),
      exercise: ex.name,
      runMeters: finalRun(),
      food: foodFor(a),
      games: [...state.games]
    });
  }

  state.yesterdayFood = foodFor(a);
  state.day = Math.min(CFG.maxDays, Number(state.day)+1);
  state.games = [];
  state.squats = 0;
  state.donationsPLN = 0;
  await save();
}

window.G90 = {
  get state(){return state},
  get ready(){return ready},
  save, avg, foodFor, reps, exercise, avgRunMeters, donationMeters, finalRun, nextDay,
  addGame(place){state.games.push({place:Number(place),ts:Date.now()}); return save();},
  undoGame(){state.games.pop(); return save();},
  addSquats(n){state.squats=Math.min(CFG.squatCap,Number(state.squats||0)+n); return save();},
  resetStream(){state.games=[];state.squats=0;state.donationsPLN=0;return save();},
  async resetProject(){state=JSON.parse(JSON.stringify(defaults)); await save();},
  set(k,v){state[k]=v; return save();}
};