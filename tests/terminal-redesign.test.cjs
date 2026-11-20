const {chromium}=require('playwright-core');
const assert=require('node:assert/strict');
const axe=require('axe-core');
const base='http://127.0.0.1:8765/';
const sample=Array.from({length:44},(_,i)=>({
 title:'Verified '+(['Markets','World','Sports','Economy'][i%4])+' coverage update '+i,
 source:i%2?'Associated Press':'Reuters',
 category:['Markets','World','Sports','Economy'][i%4],
 source_type:'Publisher RSS',
 url:'https://example.org/article/'+i,
 published_at:new Date(Date.now()-i*60000-120000).toISOString()
}));
sample[10].title = 'Markets%20rose%205%25%20after%20Fed%20report';
sample[11].title = 'Stocks rose 5% after earnings';
sample[12].title = 'Bank &amp; investors welcomed earnings';
async function main(){
 const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,args:['--no-sandbox']});
 try{
 for(const width of [1440,390,320]){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce',permissions:['clipboard-read','clipboard-write']});
  const page=await context.newPage();
  await page.route('**/api/wire',r=>r.fulfill({json:{checked_at:new Date().toISOString(),feeds:[{source:'Reuters',available:true}],items:sample}}));
  await page.route('**/data/news.json',r=>r.fulfill({json:{updated_at:new Date().toISOString(),items:[]}}));
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.locator('#headlines button.row-title').first().waitFor();
  assert.equal(await page.locator('#headlines .row').count(),25);
  assert.equal(await page.locator('#headlines .row-share').first().locator('svg[aria-hidden="true"]').count(),1);
  assert.match(await page.locator('#headlines .row-share').first().getAttribute('aria-label'), /^Share: /);
  const shareBox=await page.locator('#headlines .row-share').first().boundingBox();
  assert.ok(shareBox.width>=44&&shareBox.height>=44,'share touch target');
  assert.ok(await page.locator('.primary-nav a[href="./economic-calendar.html"]').count()>0);
  assert.ok(await page.locator('#quick-topics button').count()>6);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth+1),true,'horizontal overflow at '+width);
  await page.getByRole('group',{name:'Filter headlines by topic'}).getByRole('button',{name:'Sports',exact:true}).click();
  assert.equal(await page.locator('#headlines .row').count(),11);
  await page.locator('#quick-topics button').filter({hasText:'All'}).first().click();
  await page.locator('#headline-page-size').selectOption('10');
  assert.equal(await page.locator('#headlines .row').count(),10);
  await page.locator('#headline-pagination #headlines-next').click();
  assert.match(await page.locator('#result-count').innerText(),/11–20 of 44/);
  const trigger=page.locator('#headlines button.row-title').first();
  const title=await trigger.innerText();
  assert.equal(title,'Markets rose 5% after Fed report','percent-encoded headline should display as human-readable text');
  await trigger.click();
  const dialog=page.getByRole('dialog',{name:title});
  await dialog.waitFor();
  assert.ok(await dialog.getByRole('link',{name:/Read the original report/}).getAttribute('href').then(v=>v.startsWith('https://example.org/article/')));
  await dialog.getByRole('button',{name:'Copy headline'}).click();
  await page.waitForFunction(()=>document.querySelector('#story-action-status').textContent.includes('copied'));
  assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),title);
  assert.ok(!(await page.evaluate(()=>navigator.clipboard.readText())).includes('%20'));
  assert.match(await dialog.getByRole('link',{name:'X',exact:true}).count().then(n=>String(n)),/^[01]$/);
  await dialog.getByRole('button',{name:'Copy link'}).click();
  assert.ok((await page.evaluate(()=>navigator.clipboard.readText())).startsWith('https://example.org/article/'));
  await dialog.getByRole('button',{name:'Share via…'}).click();
  assert.ok(await page.getByRole('link',{name:'X',exact:true}).isVisible());
  assert.ok((await page.locator('#story-share-x').getAttribute('href')).includes('intent/tweet'));
  await page.getByRole('button',{name:'Close story details'}).click();
  assert.ok(!(await page.locator('#story-dialog').evaluate(el=>el.open)));
  await page.addScriptTag({content:axe.source});
  const issues=await page.evaluate(async()=> (await axe.run({runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']},iframes:false})).violations.map(v=>({id:v.id,target:v.nodes.map(n=>n.target)})));
  assert.deepEqual(issues,[],'accessibility violations '+width+' '+JSON.stringify(issues));
  console.log('TERMINAL',width,'PASSED');
  await context.close();
 }
 const extra=await browser.newPage({viewport:{width:390,height:850}});
 await extra.route('https://api.fiscaldata.treasury.gov/**',r=>r.fulfill({json:{data:[{record_date:'2026-11-18',tot_pub_debt_out_amt:'40000000000000'},{record_date:'2026-11-19',tot_pub_debt_out_amt:'40100000000000'}]}}));
 await extra.route('https://mempool.space/api/blocks/tip/height',r=>r.fulfill({body:'920001'}));
 await extra.goto(base+'us-debt.html',{waitUntil:'domcontentloaded'});
 await extra.locator('#debt-value').getByText('$40,100,000,000,000').waitFor();
 assert.equal(await extra.locator('h1').innerText(),'U.S. National Debt.');
 assert.equal(await extra.locator('#bitcoin').count(),0,'debt page must not contain Bitcoin tracker');
 await extra.goto(base+'bitcoin-halving.html',{waitUntil:'domcontentloaded'});
 await extra.locator('#btc-height').getByText('920,001').waitFor();
 assert.equal(await extra.locator('#btc-height').innerText(),'920,001');
 assert.equal(await extra.locator('h1').innerText(),'Bitcoin Halving.');
 assert.equal(await extra.locator('#debt').count(),0,'halving page must not contain debt tracker');
 assert.equal(await extra.evaluate(()=>document.documentElement.scrollWidth <= innerWidth+1),true);
 await extra.addScriptTag({content:axe.source});
 const issues=await extra.evaluate(async()=> (await axe.run({runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']},iframes:false})).violations.map(v=>v.id));
 assert.deepEqual(issues,[]);
 console.log('TRACKERS MOBILE PASSED');
 await extra.goto(base+'trackers.html#debt',{waitUntil:'domcontentloaded'});
 await extra.waitForURL('**/us-debt.html');
 await extra.goto(base+'trackers.html#bitcoin',{waitUntil:'domcontentloaded'});
 await extra.waitForURL('**/bitcoin-halving.html');
 await extra.close();
 for(const name of ['economic-calendar.html','live-releases.html','markets.html']){
  const page=await browser.newPage({viewport:{width:390,height:850}});
  await page.goto(base+name,{waitUntil:'domcontentloaded'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth+1),true,name+' overflow');
  if(name==='markets.html'){
    assert.equal(await page.locator('#watch-widget').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(18, 26, 37)');
    assert.equal(await page.locator('.watch-tabs').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(18, 26, 37)');
  }
  console.log(name,'RESPONSIVE');
  await page.close();
 }
 }finally{await browser.close()}
}
main().catch(err=>{console.error(err);process.exitCode=1;});
