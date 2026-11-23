const {chromium}=require('playwright-core');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const axe=require('axe-core');
const root=process.cwd(),base='http://127.0.0.1:8765/';
const tops=fs.readdirSync(root).filter(x=>x.endsWith('.html')&&!x.startsWith('shadow-test')).sort();
const article=fs.readdirSync(path.join(root,'articles')).filter(x=>x.endsWith('.html')).map(x=>'articles/'+x).sort();
const pages=[...tops,...article];
const essential=['index.html','edition.html','markets.html','sports.html','research.html','discuss.html','economic-calendar.html','live-releases.html','us-debt.html','bitcoin-halving.html','articles/index.html','accessibility.html','privacy.html','terms.html','standards.html','contact.html'];
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,args:['--no-sandbox']});
 const errors=[],outcomes=[];
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
  await context.route(/https:\/\/.+/,r=>r.abort());
  for(let i=0;i<pages.length;i++){
   const file=pages[i];
   const page=await context.newPage();
   try{
    const response=await page.goto(base+file,{waitUntil:'domcontentloaded',timeout:14000});
    assert.equal(response?.status(),200);
    await page.addScriptTag({content:axe.source});
    const scan=await page.evaluate(async()=> {
     const result=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']},iframes:false});
     return result.violations.map(v=>({id:v.id,impact:v.impact,help:v.help,targets:v.nodes.slice(0,5).map(n=>n.target.join(' '))}));
    });
    const overflow=await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-innerWidth));
    const fail=scan.filter(x=>['critical','serious'].includes(x.impact));
    if(fail.length || overflow>1)errors.push({file,fail,overflow});
    if(scan.length)outcomes.push({file,violations:scan,overflow});
    if(i%20===0)console.log('AUDITED',i+1,'of',pages.length);
   }catch(err){errors.push({file,error:String(err)});}
   await page.close();
  }
  await context.close();
  // Essential destinations also receive a wide-screen browser pass.
  const wide=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'});
  await wide.route(/https:\/\/.+/,r=>r.abort());
  for(const file of essential){
   const page=await wide.newPage();
   try{
    await page.goto(base+file,{waitUntil:'domcontentloaded',timeout:14000});
    await page.addScriptTag({content:axe.source});
    const scan=await page.evaluate(async()=>{
      const result=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']},iframes:false});
      return result.violations.filter(v=>['critical','serious'].includes(v.impact)).map(v=>({id:v.id,impact:v.impact,targets:v.nodes.slice(0,5).map(n=>n.target.join(' '))}));
    });
    if(scan.length)errors.push({file,viewport:'1440px',fail:scan});
   }catch(err){errors.push({file,viewport:'1440px',error:String(err)});}
   await page.close();
  }
  await wide.close();
 }finally{await browser.close()}
 const report={pagesAudited:pages.length,desktopSample:essential.length,generated:new Date().toISOString(),violations:outcomes,blocking:errors,notes:['Automated axe-core WCAG 2.2 A/AA checks only','Remote iframes and third-party scripts disabled in these checks','Not a complete ADA certification; manual assistive-technology and legal review remain necessary']};
 fs.writeFileSync('accessibility-audit-results.json',JSON.stringify(report,null,2));
 console.log('AUDIT SUMMARY',JSON.stringify({pages:pages.length,mobileIssues:outcomes.length,blocking:errors.length,examples:errors.slice(0,10)}));
 // Do not silently ignore serious/critical a11y defects or horizontal clipping.
 if(errors.length){console.error('BLOCKING AUDIT FINDINGS',JSON.stringify(errors.slice(0,40)));process.exitCode=1}
})().catch(err=>{console.error(err);process.exitCode=1});
