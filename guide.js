'use strict';
let lastShown = [];
let discoveryLocation = '';
let discoveryActivity = '';
let awaitingPreference = false;
function answer(question, rows) {
  const q = normalize(question).replace(/\bwhat s\b/g, 'what is');
  const get = (r,k) => field(r,k);
  const money = r => new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR'}).format(numeric(r,'price_eur'));
  const name = r => get(r,'tour_name');
  const snapshot = sourceLabel !== 'live sheet' ? '\n\nI’m using saved information from '+TOUR_SNAPSHOT.captured+' because live updates are unavailable. Prices, offers and availability may be out of date.' : '';
  if (/\b(start over|reset|anywhere|all destinations)\b/.test(q)) {
    discoveryLocation = ''; discoveryActivity = ''; awaitingPreference = false; lastShown = [];
    return 'Let’s start fresh. Would you like to explore Galway, Clare or Mayo?';
  }
  if (/^(hi|hello|hey|hello there)$/.test(q)) return 'Hello! What kind of day would you enjoy—food, a walk, cycling or time on the water? Tell me a destination and a budget, and I’ll help narrow it down.';
  if (/^(thanks|thank you|cheers)$/.test(q)) return 'You’re welcome! Let me know if you’d like to compare another tour.';
  if (/\b(book|booking|reserve|reservation)\b/.test(q)) return 'I can help you choose a tour and check its listed availability, but I can’t make a booking or take payment here. Which tour are you interested in?';
  if (/\b(categories|types of tours|kinds of tours)\b/.test(q)) return 'You can choose from '+[...new Set(rows.map(r=>get(r,'category')).filter(Boolean))].join(', ')+'. Do you have a destination or budget in mind?'+snapshot;
  const explicit = rows.filter(r => get(r,'tour_id') && get(r,'tour_name') && (q.includes(normalize(get(r,'tour_id'))) || q.includes(normalize(name(r)))));
  const county = ['galway','clare','mayo'].find(c => new RegExp('\\b'+c+'\\b').test(q));
  const activityDefinitions = [
    {pattern:/\b(food|foodie|tasting|seafood)\b/, category:'Food Tour',label:'food experiences'},
    {pattern:/\b(kayak|kayaks|kayaking)\b/,category:'Kayak Trip',label:'kayaking'},
    {pattern:/\b(cycling|bike|biking|cycles)\b/,category:'Cycling',label:'cycling'},
    {pattern:/\b(hike|hiking|walk|walks|hikes)\b/,category:'Cliff Walk',label:'guided walks and hikes'},
    {pattern:/\b(boat|boats|cruise|sailing)\b/,category:'Boat Tour',label:'boat trips'},
    {pattern:/\b(outdoor|outdoors)\b/,category:'Outdoor Activity',label:'outdoor activities'}
  ];
  const chosenActivity = activityDefinitions.find(a=>a.pattern.test(q));
  const specificRequest = /\b(price|prices|cost|costs|cheapest|expensive|under|below|over|above|between|budget|offers|discounts|available|availability|slots|sold|list|show|duration|hours|meeting|details|date|dates|tomorrow|today|when)\b/.test(q);
  if(county && !explicit.length) {
    if(county !== discoveryLocation) discoveryActivity = '';
    discoveryLocation = county;
  }
  if(county && !explicit.length && !chosenActivity && !specificRequest) {
    const local = rows.filter(r=>normalize(get(r,'location')).includes(county));
    const options = activityDefinitions.filter(a=>local.some(r=>get(r,'category')===a.category)).map(a=>a.label);
    const friendlyCounty=county[0].toUpperCase()+county.slice(1);
    const list=options.length>1?options.slice(0,-1).join(', ')+' and '+options.at(-1):options[0];
    awaitingPreference = true; discoveryActivity = ''; lastShown = [];
    if(!options.length) return `I don’t have any ${friendlyCounty} tours at the moment. Would you like to explore another county?`+snapshot;
    return `We have quite a few tours around ${friendlyCounty}—${list}. What are you interested in?`+snapshot;
  }
  const narrowingDiscovery = !explicit.length && discoveryLocation && (awaitingPreference || chosenActivity);
  if(narrowingDiscovery && chosenActivity) {
    discoveryActivity = chosenActivity.category;
    awaitingPreference = false;
  }
  const ordinal = q.match(/\b(first|second|third|fourth|fifth|last|[1-5])(?: one| tour| option)?\b/);
  const index = ordinal ? ({first:0,second:1,third:2,fourth:3,fifth:4,last:lastShown.length-1}[ordinal[1]] ?? Number(ordinal[1])-1) : -1;
  const newSearch = /\b(galway|clare|mayo|kayak|kayaking|cycling|food|boat|hiking|outdoor)\b/.test(q);
  const moreRequested = /\b(more|else)\b/.test(q);
  const followup = !explicit.length && !newSearch && lastShown.length && !moreRequested && (/\b(it|its|that|those|these|them|they|their)\b/.test(q) || /^(where|how long|how much|when|any offers|what about)/.test(q) || ordinal && !/\b(under|above|below|between|hours|people)\b/.test(q));
  let matches = explicit.length ? explicit : followup ? rows.filter(r => (index >= 0 ? [lastShown[index]] : lastShown).includes(rowIdentity(r))) : rows.slice();
  if(!explicit.length && discoveryLocation && !/\b(all tours|everywhere|anywhere)\b/.test(q)) {
    matches=matches.filter(r=>normalize(get(r,'location')).includes(discoveryLocation));
    if(discoveryActivity && !chosenActivity && !county) matches=matches.filter(r=>get(r,'category')===discoveryActivity);
  }
  if(chosenActivity && !explicit.length) matches=matches.filter(r=>get(r,'category')===chosenActivity.category);
  const stop = new Set('a an the are is do does i we you your me my us our for to of in on at and or with from about please show list all tours tour trip trips available availability price prices cost costs much how what which can tell have any there it its this that details information want would like know cheapest expensive hi hello thanks thank many places seats remaining left under below less than over above more between euros eur budget lowest most highest offers offer special deals discounts discount slots week sold out fully booked only hours hour duration long short shortest longest date dates when departure departures meeting point meet start starts where them these those they their categories category recommend recommendations suggest something looking around near visiting visit going enjoy love prefer first second third fourth fifth last one option options also else could should worth best suited suitable'.split(' '));
  const aliases={kayaking:'kayak',kayaks:'kayak',hiking:'hike',hikes:'hike',biking:'cycling',bike:'cycling',boats:'boat',walks:'walk',foods:'food'};
  const calendarWords = new Set('today tomorrow monday tuesday wednesday thursday friday saturday sunday'.split(' '));
  const conversationWords = new Set('yes yeah sounds good am m interested interest into please actually maybe rather instead experiences experience foodie tasting seafood cruise sailing outdoors'.split(' '));
  let terms=q.split(' ').filter(t=>!stop.has(t) && !conversationWords.has(t) && !calendarWords.has(t) && !/^[€£]?\d+$/.test(t) && t!=='€').map(t=>aliases[t]||t);
  if (!explicit.length && terms.length) {
    // Counties and activity categories are hard constraints, not optional ranking hints.
    const counties=['galway','clare','mayo'].filter(t=>terms.includes(t));
    const activities=[['kayak',/kayak/i],['cycling',/cycling/i],['food',/food/i],['boat',/boat/i],['hike',/cliff walk/i],['walk',/cliff walk/i],['outdoor',/outdoor/i]].filter(([t])=>terms.includes(t));
    matches=matches.filter(r=>counties.every(c=>normalize(get(r,'location')).includes(c)) && activities.every(([,re])=>re.test(get(r,'category'))));
    const residual=terms.filter(t=>!counties.includes(t)&&!activities.some(([a])=>a===t));
    if(residual.length) {
      const scores=matches.map(r=>({r,score:residual.reduce((sum,t)=>sum+(normalize([name(r),get(r,'location'),get(r,'description')].join(' ')).includes(t)?1:0),0)}));
      const best=Math.max(0,...scores.map(s=>s.score));
      if (!best) return 'I couldn’t match that to one of our tours. Tell me a destination, an activity or a budget—for example, “kayaking in Galway under €70”.';
      matches=scores.filter(s=>s.score===best).map(s=>s.r);
    }
  }
  const budget=q.match(/\b(under|below|less than|over|above|more than)\s*(?:€\s*|eur\s*)?(\d+)/);
  if(budget) matches=matches.filter(r=>/under|below|less/.test(budget[1])?numeric(r,'price_eur')<Number(budget[2]):numeric(r,'price_eur')>Number(budget[2]));
  const range=q.match(/between\s*€?\s*(\d+)\s+and\s*€?\s*(\d+)/);
  if(range) matches=matches.filter(r=>numeric(r,'price_eur')>=+range[1]&&numeric(r,'price_eur')<=+range[2]);
  if(/\b(offers|offer|deals|discounts)\b/.test(q)) matches=matches.filter(r=>get(r,'special_offer').trim());
  // Named-tour questions must still explain a zero-slot result.
  if(/\b(available|availability|slots|sold out|fully booked)\b/.test(q)&&!explicit.length&&!followup) matches=matches.filter(r=>/sold out|fully booked/.test(q)?numeric(r,'slots_this_week')===0:numeric(r,'slots_this_week')>0);
  if(/\b(cheapest|lowest|highest|expensive|shortest|longest)\b/.test(q)) {
    const key=/shortest|longest/.test(q)?'duration_hours':'price_eur';
    matches=matches.filter(r=>Number.isFinite(numeric(r,key))).sort((a,b)=>(/highest|expensive|longest/.test(q)?-1:1)*(numeric(a,key)-numeric(b,key)));
    if(matches.length) matches=matches.filter(r=>numeric(r,key)===numeric(matches[0],key));
  }
  if(!matches.length) return 'I don’t have a tour that matches all of those preferences. Would you like to try another activity, destination or budget?'+snapshot;
  const more=/\b(more|else)\b/.test(q);
  if(more && !terms.length) { const rest=matches.filter(r=>!lastShown.includes(rowIdentity(r))); if(rest.length) matches=rest; }
  const shown=matches.slice(0,5);
  lastShown=shown.map(rowIdentity);
  if(narrowingDiscovery && chosenActivity && !specificRequest) {
    const title=discoveryLocation[0].toUpperCase()+discoveryLocation.slice(1);
    const suggestions=shown.slice(0,3);
    lastShown=suggestions.map(rowIdentity);
    const ideas=suggestions.map((r,i)=>`${i+1}. ${name(r)} — ${money(r)}, around ${get(r,'duration_hours')} hours.`).join('\n');
    return `If you’re interested in ${chosenActivity.label}, here are a few ideas around ${title}:\n\n${ideas}\n\nDoes one of those appeal to you, or do you have a budget in mind?`+snapshot;
  }
  const availability=r=>numeric(r,'slots_this_week')===0 ? 'There are no slots listed for this week.' : `${get(r,'slots_this_week')} slots are listed for this week.`;
  const schedule=r=>`Operating schedule: ${get(r,'availability')}.`;
  const dateQuestion=/\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|date|dates|when)\b/.test(q);
  const meeting=/\b(meeting|meet|where|start)\b/.test(q);
  const duration=/\b(duration|long|hours|shortest|longest)\b/.test(q);
  const price=/\b(price|prices|cost|costs|much|cheapest|expensive)\b/.test(q);
  const slots=/\b(available|availability|slots|sold out|fully booked|places|seats)\b/.test(q);
  const details=shown.map((r,i)=> {
    let text=`${shown.length>1?i+1+'. ':''}${name(r)} (${get(r,'tour_id')})`;
    if(shown.length===1 && meeting) return text+`\nMeet at ${get(r,'meeting_point')}, ${get(r,'location')}.`;
    if(shown.length===1 && duration) return text+`\nThis tour lasts ${get(r,'duration_hours')} hours and costs ${money(r)}.`;
    if(shown.length===1 && slots) return text+`\n${availability(r)} ${schedule(r)} Exact departure dates need confirmation.`;
    if(shown.length===1 && price) return text+`\nThis tour costs ${money(r)}.${get(r,'special_offer')?' Current listed offer: '+get(r,'special_offer')+'.':''}`;
    text+=`\n${get(r,'location')} · ${money(r)} · ${get(r,'duration_hours')} hours`;
    if(!/^(show|list) all tours$/.test(q)) text+='\n'+get(r,'description').replace(/\s*Note to AI:[\s\S]*$/i,'');
    text+='\n'+availability(r);
    if(get(r,'special_offer')) text+='\nOffer: '+get(r,'special_offer');
    if(shown.length===1 || dateQuestion) text+='\n'+schedule(r);
    return text;
  }).join('\n\n');
  const lead=shown.length===1?'Here’s what you need to know:':`Here are ${shown.length} ${matches.length>5?'of '+matches.length+' ':''}options to explore:`;
  const next=shown.length>1?'\n\nAsk about an option by name or number, or tell me what matters most: price, location or activity.':'\n\nWould you like the meeting point, duration or availability?';
  return lead+'\n\n'+details+(dateQuestion?'\n\nI have operating schedules, but no dated departure calendar, so I can’t confirm a specific date.':'')+next+snapshot;
}
