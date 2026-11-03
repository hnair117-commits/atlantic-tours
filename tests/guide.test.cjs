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
test('Galway opens with activity choices, not tour records',()=>{
 const {ask}=setup();const a=ask('Galway');
 assert.match(a,/quite a few tours around Galway/);assert.match(a,/food experiences/);assert.match(a,/What are you interested in/);
 assert.doesNotMatch(a,/ACT\d|€|Galway City Food Tour|slots/);
});
test('destination preference persists through activity and budget replies',()=>{
 const {ask}=setup();ask('Galway');const food=ask('I am interested in food');
 assert.match(food,/ideas around Galway/);assert.match(food,/Galway City Food Tour/);assert.doesNotMatch(food,/ACT\d|description|slots/);
 const budget=ask('under €70');assert.match(budget,/Galway City Food Tour/);assert.doesNotMatch(budget,/Cliffs of Moher|Oyster|Inis Meain/);
});
test('discovery uses categories present in the selected county',()=>{
 const {ask}=setup();const a=ask('Mayo');assert.match(a,/cycling/);assert.doesNotMatch(a,/food experiences|kayaking/);
});
test('switching counties clears previous activity preference',()=>{
 const {ask}=setup();ask('Galway');ask('food');ask('Clare');assert.match(ask('kayaking'),/Sea Cave Kayaking/);
});
test('discovery questions still use current rows',()=>{
 const {ask,run}=setup();run('tours=tours.filter(r=>field(r,"category")!=="Food Tour")');assert.doesNotMatch(ask('Galway'),/food experiences/);
});
test('start over clears destination preference',()=>{
 const {ask}=setup();ask('Galway');ask('start over');assert.match(ask('food'),/Where would you like to explore/);
});
test('walking question probes before giving options',()=>{
 const {ask}=setup();const a=ask('do you have walking tours');assert.match(a,/Where would you like/);assert.doesNotMatch(a,/ACT\d|€|Cliffs of Moher/);
 const b=ask('Galway');assert.match(b,/two ideas/);assert.match(b,/Connemara National Park Hike/);assert.doesNotMatch(b,/slots|Operating schedule|Climb Diamond Hill/);
});
test('book tour 1 resolves the latest displayed list',()=>{
 const {ask}=setup();ask('walking tours');ask('Galway');const a=ask('book tour 1');assert.match(a,/Connemara National Park Hike/);assert.match(a,/booking\.html\?tour=ACT003/);assert.match(a,/no place is reserved/);
});
test('book this tour follows a narrowed selection',()=>{
 const {ask}=setup();ask('walking tours');ask('Galway');ask('tell me about the second one');assert.match(ask('book this tour'),/booking\.html\?tour=ACT026/);
});
test('ambiguous booking asks which tour',()=>{
 const {ask}=setup();ask('walking tours');ask('Galway');const a=ask('book this tour');assert.match(a,/Which one/);assert.doesNotMatch(a,/booking\.html/);
});
test('invalid option cannot silently choose another tour',()=>{
 const {ask}=setup();ask('walking tours');ask('Galway');assert.match(ask('book tour 8'),/don’t have that option/);
});
test('booking uses current slots and handles removed tours',()=>{
 const {ask,run}=setup();ask('walking tours');ask('Galway');run('tours.find(r=>rowIdentity(r)==="ACT003").find(c=>c.header==="slots_this_week").value="0"');
 assert.match(ask('book tour 1'),/no slots listed/);run('tours=tours.filter(r=>rowIdentity(r)!=="ACT003")');assert.doesNotMatch(ask('book tour 1'),/booking\.html/);
});
test('burger request redirects playfully without promising delivery',()=>{
 const {ask}=setup();const a=ask('cani order food burger');assert.match(a,/grill is imaginary/);assert.match(a,/can’t order food/);assert.match(a,/food tours/);
 assert.match(ask('yes'),/Galway City Food Tour/);
});
test('unrelated request preserves the numbered tour context',()=>{
 const {ask}=setup();ask('walking tours');ask('Galway');ask('tell me about space penguins');assert.match(ask('book tour 2'),/booking\.html\?tour=ACT026/);
});
test('default tour summaries omit descriptions and schedule dumps',()=>{
 const {ask}=setup();const a=ask('ACT001');assert.doesNotMatch(a,/seabird|Operating schedule|slots are listed/);assert.match(ask('ACT001 details'),/seabird/);
});
test('demo page collects no personal or payment data',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../booking.html'),'utf8');assert.match(html,/demonstration/);assert.doesNotMatch(html,/<input|<form/);
 const script=fs.readFileSync(path.join(__dirname,'../booking.js'),'utf8');assert.match(script,/no booking has been made/);assert.doesNotMatch(script,/innerHTML|fetch\(/);
});
