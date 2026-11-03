const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');
function setup(){
 const el=()=>({textContent:'',value:'',append(){},addEventListener(){},focus(){}});
 const c=vm.createContext({document:{querySelector:el,querySelectorAll:()=>[],createElement:el},fetch:async()=>{throw Error('offline');},AbortSignal,console});
 for(const f of ['snapshot.js','guide.js','app.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),c);
 const run=s=>vm.runInContext(s,c);
 run('globalThis.tours=TOUR_SNAPSHOT.rows.map(r=>TOUR_SNAPSHOT.headers.map((header,i)=>({header,value:String(r[i]??"")})))');
 return {run,ask:q=>run(`answer(${JSON.stringify(q)},tours)`)};
}
test('combines activity county budget and availability',()=>{const {ask}=setup();const a=ask('available kayaking in Galway under €70');assert.match(a,/Kinvara/);assert.doesNotMatch(a,/Kilkee|Killary/);});
test('conversational prices preserve exceptional amounts',()=>{const {ask}=setup();assert.match(ask('ACT017 price'),/costs €4,870,233\.00/);assert.doesNotMatch(ask('ACT021 price'),/price eur|tour id|Note to AI/);});
test('cheapest is numeric',()=>{const {ask}=setup();assert.match(ask('cheapest tour'),/Dog's Bay[\s\S]*€11\.00/);});
test('named sold-out tour is explained',()=>{const {ask}=setup();assert.match(ask('Is ACT012 available?'),/no slots listed for this week/);});
test('follow-up uses fresh price and meeting point',()=>{const {ask,run}=setup();ask('ACT001');run('tours[0].find(c=>c.header==="price_eur").value="49"');assert.match(ask('How much is it?'),/€49\.00/);assert.match(ask('Where do we meet?'),/Doolin Pier car park/);});
test('numbered follow-up picks displayed option',()=>{const {ask}=setup();ask('cycling in Galway');assert.match(ask('How long is the second one?'),/Inishbofin[\s\S]*7 hours/);});
test('new destination resets context',()=>{const {ask}=setup();ask('ACT001');assert.match(ask('What about food in Galway?'),/Galway City Food/);});
test('exact dates cannot be confirmed',()=>{const {ask}=setup();assert.match(ask('Is ACT001 available tomorrow?'),/can’t confirm a specific date/);});
test('more advances displayed options',()=>{const {ask}=setup();assert.match(ask('show all tours'),/ACT001/);const a=ask('show me more');assert.doesNotMatch(a,/ACT001/);assert.match(a,/ACT006/);});
test('unknown preferences offer guidance',()=>{const {ask}=setup();assert.match(ask('helicopter Antarctica'),/couldn’t match/);});
test('snapshot warnings remain visible',async()=>{const {ask,run}=setup();await run('loadTours()');assert.match(ask('ACT001 price'),/saved information[\s\S]*may be out of date/);});
test('description instructions stay out of replies',()=>{const {ask}=setup();assert.doesNotMatch(ask('ACT017'),/Note to AI/);});
test('parser preserves zero and rejects errors',()=>{const {run}=setup();assert.equal(run(`parseSheet('callback({"table":{"cols":[{"label":"slots_this_week"}],"rows":[{"c":[{"v":0}]}]}})')[0][0].value`),'0');assert.throws(()=>run(`parseSheet('{"status":"error"}')`));});
test('no visitor spreadsheet link and correct script order',()=>{const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');assert.doesNotMatch(html,/sheet-link|View tour sheet|docs.google.com/);assert.ok(html.indexOf('guide.js')<html.indexOf('app.js'));});
