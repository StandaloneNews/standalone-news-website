(()=>{'use strict';
const $=id=>document.getElementById(id),nf=new Intl.NumberFormat('en-US'),usd=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
const url='https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/debt_to_penny?sort=-record_date&page%5Bsize%5D=110&fields=record_date,tot_pub_debt_out_amt';
async function loadDebt(){
 $('debt-value').textContent='Loading official data…';$('debt-status').textContent='Contacting Treasury Fiscal Data…';
 try {
 const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(13000)});
 if(!response.ok)throw Error('Treasury returned '+response.status);
 const body=await response.json();
 const rows=(body.data||[]).map(x=>({date:x.record_date,total:Number(String(x.tot_pub_debt_out_amt).replace(/,/g,''))})).filter(x=>Number.isFinite(x.total)&&x.total>0&&/^\d{4}-\d{2}-\d{2}$/.test(x.date));
 if(!rows.length)throw Error('No valid data');
 rows.sort((a,b)=>a.date.localeCompare(b.date));
 const newest=rows[rows.length-1];$('debt-value').textContent=usd.format(newest.total);
 $('debt-status').textContent='Official as of '+newest.date+' · Not a continuously updated counter';
 if(rows.length>1)renderChart(rows);
 }catch(e){$('debt-value').textContent='Official figure unavailable';$('debt-status').textContent='Unable to read Treasury API: '+e.message+'. Open the linked source for the latest figure.';}
}
function renderChart(rows){
 const ns='http://www.w3.org/2000/svg',w=700,h=230,pad=16;
 const min=Math.min(...rows.map(r=>r.total)),max=Math.max(...rows.map(r=>r.total)),range=Math.max(max-min,1);
 const pts=rows.map((r,i)=>[pad+i/(rows.length-1)*(w-2*pad),h-pad-(r.total-min)/range*(h-2*pad)]);
 const svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 700 230');
 svg.setAttribute('role','img');svg.setAttribute('aria-label','Official U.S. debt chart from '+rows[0].date+' to '+rows[rows.length-1].date);
 const fill=document.createElementNS(ns,'polygon');
 fill.setAttribute('points',pad+','+(h-pad)+' '+pts.map(v=>v.join(',')).join(' ')+' '+(w-pad)+','+(h-pad));fill.setAttribute('fill','#ffc500');fill.setAttribute('fill-opacity','.12');
 const path=document.createElementNS(ns,'polyline');path.setAttribute('fill','none');path.setAttribute('stroke','#ffc500');path.setAttribute('stroke-width','2.5');path.setAttribute('points',pts.map(v=>v.join(',')).join(' '));svg.append(fill,path);$('debt-graph').replaceChildren(svg);
}
async function loadBitcoin(){
 $('btc-status').textContent='Checking Bitcoin block height…';
 try {
 const response=await fetch('https://mempool.space/api/blocks/tip/height',{cache:'no-store',signal:AbortSignal.timeout(13000)});
 if(!response.ok)throw Error('Blockchain endpoint returned '+response.status);
 const height=Number((await response.text()).trim());if(!Number.isInteger(height)||height<1)throw Error('Invalid height');
 const target=(Math.floor(height/210000)+1)*210000,remaining=target-height;
 $('halving-target').textContent='Block '+nf.format(target);$('btc-height').textContent=nf.format(height);
 $('btc-remaining').textContent=nf.format(remaining);$('btc-estimate').textContent=nf.format(Math.round(remaining/144))+' days';
 $('btc-progress').value=height%210000;$('btc-status').textContent='Observed '+new Date().toLocaleString()+' · Based on 10 min per block, estimate only';
 }catch(e){$('halving-target').textContent='Block data unavailable';$('btc-status').textContent='Unable to read blockchain endpoint: '+e.message+'. Use the linked source.';}
}
$('debt-refresh').addEventListener('click',loadDebt);$('btc-refresh').addEventListener('click',loadBitcoin);
loadDebt();loadBitcoin();
})();