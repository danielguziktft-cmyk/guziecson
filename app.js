const CFG=window.G90_CONFIG;
const KEY="g90_state_v3";
const defaults={
 day:1, weight:null, measurements:{waist:null,chest:null,arm:null,thigh:null},
 games:[], squats:0, donationsPLN:0, photos:[], history:[],
 yesterdayFood:null, currentFood:null, notes:""
};
let state={...defaults,...JSON.parse(localStorage.getItem(KEY)||"{}")};
function exercise(){return CFG.exercises[(Math.max(1,Number(state.day))-1)%CFG.exercises.length]}
function avg(){return state.games.length?state.games.reduce((a,b)=>a+Number(b.place),0)/state.games.length:null}
function foodFor(a){if(a===null)return null;if(a>=3.8&&a<=4.4)return "SOS WKDZIK";if(a>=4.5&&a<=4.7)return "NEUTRAL";if(a>=4.8)return "KARA";return "SOS WKDZIK";}
function reps(){let m=exercise().multiplier;return state.games.reduce((s,g)=>s+Number(g.place)*m,0)}
function avgRunMeters(a){if(a===null)return 0;if(a<=4.2)return 0;if(a<=4.4)return 300;if(a<=4.6)return 600;if(a<=4.8)return 900;return 1200}
function donationMeters(){return Math.floor((Number(state.donationsPLN)||0)/2)*CFG.donationMetersPer2PLN}
function finalRun(){return Math.min(CFG.runCapMeters,avgRunMeters(avg())+donationMeters())}
function save(){localStorage.setItem(KEY,JSON.stringify(state)); window.dispatchEvent(new Event("g90update"))}
function nextDay(){
 const a=avg(), ex=exercise();
 if(state.games.length) state.history.unshift({day:state.day,date:new Date().toISOString().slice(0,10),avg:a,reps:reps(),exercise:ex.name,runMeters:finalRun(),food:foodFor(a),games:[...state.games]});
 state.yesterdayFood=foodFor(a); state.day=Math.min(CFG.maxDays,Number(state.day)+1); state.games=[];state.squats=0;state.donationsPLN=0;save();
}
window.G90={get state(){return state},save,avg,foodFor,reps,exercise,avgRunMeters,donationMeters,finalRun,nextDay,
 addGame(place){state.games.push({place:Number(place),ts:Date.now()});save()},
 undoGame(){state.games.pop();save()},
 addSquats(n){state.squats=Math.min(CFG.squatCap,Number(state.squats||0)+n);save()},
 addDonation(pln){state.donationsPLN=Number(state.donationsPLN||0)+Number(pln);save()},
 resetStream(){state.games=[];state.squats=0;state.donationsPLN=0;save()},
 resetProject(){localStorage.removeItem(KEY);state=JSON.parse(JSON.stringify(defaults));save()},
 set(k,v){state[k]=v;save()}
};