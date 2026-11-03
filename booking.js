'use strict';
const id=new URLSearchParams(location.search).get('tour');
const row=TOUR_SNAPSHOT.rows.find(r=>r[0]===id);
if(/^ACT\d{3}$/.test(id || '')) {
 document.querySelector('#tour').textContent=(row ? row[1] : 'Your selected tour')+' · '+id;
 const button=document.querySelector('#demo-confirm');button.hidden=false;
 button.addEventListener('click',()=>{
  document.querySelector('#result').textContent='Practice complete! This was a demo—no booking has been made and no places have been reserved.';
  button.disabled=true;
 });
}
