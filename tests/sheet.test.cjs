const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const elements = new Map();
const element = () => ({textContent:'',value:'',className:'',append(){},addEventListener(){},focus(){}});
const context = vm.createContext({
  document:{querySelector(s){if(!elements.has(s)) elements.set(s,element()); return elements.get(s);},querySelectorAll(){return [];},createElement:element},
  fetch:async()=>{throw new Error('Offline test');}, AbortSignal, Date, console
});
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../app.js'),'utf8'),context);
const run = s => vm.runInContext(s,context);
const fixture = 'google.visualization.Query.setResponse('+JSON.stringify({status:'ok',table:{cols:[{label:'Tour'},{label:'Destination'},{label:'Price'},{label:'Places available'}],rows:[{c:[{v:'Coastal Adventure'},{v:'Galway'},{v:50,f:'€50'},{v:0}]},{c:[{v:'City Walk'},{v:'Dublin'},{v:20,f:'€20'},{v:8}]}]}})+');';
context.fixture = fixture;
run('globalThis.rows = parseSheet(fixture)');
test('preserves formatted prices and zero availability',()=>{
  assert.equal(run('rows[0][2].value'),'€50');
  assert.equal(run('rows[0][3].value'),'0');
});
test('filters destination and returns actual availability',()=>{
  const result = run('answer("Galway availability", rows)');
  assert.match(result,/Places available: 0/);
  assert.doesNotMatch(result,/City Walk/);
});
test('follow-up uses fresh row values',()=>{
  run('answer("Galway", rows); rows[0][2].value = "€60"');
  const result = run('answer("What is its price", rows)');
  assert.match(result,/€60/);
  assert.doesNotMatch(result,/€50/);
});
test('unknown questions do not invent answers',()=>{
  assert.match(run('answer("helicopter Antarctica", rows)'),/couldn’t match/);
});
test('rejects sheet error payloads',()=>{
  assert.throws(()=>run('parseSheet(\'{"status":"error"}\')'));
});
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../snapshot.js'),'utf8'),context);
run('globalThis.tours = TOUR_SNAPSHOT.rows.map(row => TOUR_SNAPSHOT.headers.map((header,i)=>({header,value:String(row[i] ?? "")})))');
test('snapshot contains 30 complete rows with unique IDs',()=>{
  assert.equal(run('tours.length'),30);
  assert.equal(run('new Set(tours.map(rowIdentity)).size'),30);
  assert.ok(run('TOUR_SNAPSHOT.rows.every(r=>r.length===12)'));
});
test('numeric minimum finds the 11 euro tour',()=>{
  const result = run('answer("What is the cheapest tour?",tours)');
  assert.match(result,/Dog's Bay/);
  assert.match(result,/€11\.00/);
});
test('preserves exceptional prices from structured fields',()=>{
  assert.match(run('answer("ACT017 price",tours)'),/€4,870,233\.00/);
  assert.match(run('answer("most expensive tour",tours)'),/ACT017/);
  assert.match(run('answer("ACT021 price",tours)'),/€999,999\.00/);
});
test('combines category, budget and slots',()=>{
  const result = run('answer("available kayaking under €70",tours)');
  assert.match(result,/ACT020/);
  assert.doesNotMatch(result,/ACT012|ACT004/);
});
test('zero slots is distinct from operating season and capacity',()=>{
  const result = run('answer("sold out tours",tours)');
  assert.match(result,/ACT012/);
  assert.match(result,/slots this week: 0/);
  assert.doesNotMatch(result,/ACT011/);
});
test('filters offers without inventing discounts',()=>{
  const result = run('answer("special offers in Clare",tours)');
  assert.match(result,/Kids under 12 half price/);
  assert.doesNotMatch(result,/ACT011/);
});
test('offline answers are explicitly labelled snapshots',async()=>{
  await run('loadTours()');
  assert.match(run('answer("ACT001 price",tours)'),/saved snapshot.*live sheet unavailable/);
  assert.match(run('answer("ACT001 price",tours)'),/may be out of date/);
});
