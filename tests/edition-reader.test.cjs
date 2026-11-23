const { chromium } = require('playwright-core');
const assert=require('node:assert/strict');
const base='http://127.0.0.1:8765/';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,args:['--no-sandbox']});
 try{
  for(const width of [320,390,768,1280,1600]){
   const p=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
   await p.route(/https:\/\/.+/,r=>r.abort());
   await p.goto(base+'edition.html',{waitUntil:'domcontentloaded'});
   const state=await p.evaluate(()=>{
    const ids=['reading-edition-title','lead-story','brief','top-stories','wire','explainers','newsletter','news-terminal'];
    const positions=Object.fromEntries(ids.map(id=>[id,document.getElementById(id)?.getBoundingClientRect().top+scrollY]));
    return {headings:document.querySelectorAll('h1').length,positions,screen:innerWidth,
     scrollWidth:document.documentElement.scrollWidth,briefOpen:document.querySelector('#brief details').open,
     terminalHeading:document.querySelector('#news-terminal-heading')?.tagName,
     main:(() => { const r=document.querySelector('main').getBoundingClientRect();return {left:r.left,right:r.right,width:r.width}; })()};
   });
   const pos=state.positions;
   assert.equal(state.headings,1,'Reading edition must have exactly one H1');
   assert.ok(pos['reading-edition-title']<pos['lead-story']&&pos['lead-story']<pos.brief,'reading hierarchy');
   assert.ok(pos.brief<pos['top-stories'],'brief belongs before featured articles');
   assert.ok(pos.newsletter<pos['news-terminal'],'news terminal belongs after newsletter');
   assert.equal(state.terminalHeading,'H2');
   assert.equal(state.briefOpen,true,'daily brief should be readily readable');
   assert.ok(state.scrollWidth<=width+1,'horizontal overflow '+width+' '+JSON.stringify(state));
   assert.ok(Math.abs(state.main.left-(width-state.main.right))<=8,'edition reading column must be centered at '+width+': '+JSON.stringify(state.main));
   const summary=p.locator('#brief details>summary');
   await summary.focus();
   await p.keyboard.press('Enter');
   assert.equal(await p.locator('#brief details').evaluate(e=>e.open),false,'brief collapse by keyboard');
   await p.keyboard.press('Enter');
   assert.equal(await p.locator('#brief details').evaluate(e=>e.open),true,'brief expand by keyboard');
   const jump=p.getByRole('navigation',{name:'Jump to sections of the reading edition'}).getByRole('link',{name:'News terminal'});
   await jump.click();
   assert.equal(new URL(p.url()).hash,'#news-terminal');
   console.log('EDITION READING',width,'PASS',JSON.stringify({scrollWidth:state.scrollWidth,order:pos}));
   await p.close();
  }
 }finally{await browser.close()}
})().catch(err=>{console.error(err);process.exitCode=1});
