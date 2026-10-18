#!/usr/bin/env python3
"""Refresh public SEC EDGAR company directory and a bounded set of company filings.

Requires SEC_USER_AGENT (company identity + contact email) in GitHub Actions secrets.
SEC requests happen only in GitHub Actions, never visitors' browsers.
No classifications of Form 4 transaction type or institutional ownership are inferred.
"""
import datetime as dt
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/"data"
DIRECTORY=DATA/"research-companies.json"
SNAPSHOTS=DATA/"research-snapshots.json"
NOW=lambda: dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()
STARTERS=("AAPL","NVDA","MSFT","TSLA","AMZN","GOOGL","META","JPM","AMD","GOOG","NFLX","COST","WMT","DIS","BAC","PLTR","INTC","ORCL","CRM","AVGO")
FORMS=frozenset(("10-K","10-K/A","10-Q","10-Q/A","8-K","8-K/A","4","4/A","13F-HR","13F-HR/A"))
CONTACT=os.getenv("SEC_USER_AGENT","").strip()
CLEAN_TICKER=re.compile(r"^[A-Z][A-Z0-9.\-]{0,9}$")
CLEAN_FILE=re.compile(r"^[A-Za-z0-9_.-]+$")
def download(url,agent):
    req=urllib.request.Request(url,headers={"User-Agent":agent,"Accept":"application/json","Accept-Encoding":"identity"})
    with urllib.request.urlopen(req,timeout=26) as response:
        return json.load(response)

def save(path,body):
    DATA.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(body,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")

def existing(path,fallback):
    try:
        data=json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data,dict) else fallback
    except (FileNotFoundError,ValueError):
        return fallback

def exchange_label(name):
    name=str(name or '').lower()
    if "nasdaq" in name:return "NASDAQ"
    if name=="nyse" or "new york stock exchange" in name:return "NYSE"
    if "nyse arca" in name or "nyse american" in name:return "AMEX"
    return ""

def company_index(raw):
    fields=raw.get("fields",[])
    rows=raw.get("data",[])
    if not all(x in fields for x in ("cik","name","ticker")):raise ValueError("Unexpected SEC ticker directory format")
    indexes={s:fields.index(s) for s in fields}
    out=[];seen=set()
    for row in rows:
        try:
            ticker=str(row[indexes["ticker"]]).upper().strip()
            cik=int(row[indexes["cik"]])
            name=str(row[indexes["name"]]).strip()
            ex=exchange_label(row[indexes["exchange"]]) if "exchange" in indexes else ""
            if not CLEAN_TICKER.fullmatch(ticker) or not (0<cik<10**10) or not name or ticker in seen:continue
            seen.add(ticker);out.append({"ticker":ticker,"name":name[:140],"cik":cik,"exchange":ex})
        except (ValueError,TypeError,IndexError,KeyError):
            continue
    if len(out)<500:raise ValueError("SEC directory too small; refusing to overwrite existing data")
    return sorted(out,key=lambda x:x["ticker"])

def accession_link(cik,accession,document):
    if not re.fullmatch(r"\d{10}-\d{2}-\d{6}",str(accession)):return None
    if not CLEAN_FILE.fullmatch(str(document)):return None
    return ("https://www.sec.gov/Archives/edgar/data/"+str(int(cik))+"/"
            +str(accession).replace("-","")+"/"+urllib.parse.quote(str(document)))

def filings_from_submissions(raw,cik):
    recent=raw.get("filings",{}).get("recent",{})
    forms=recent.get("form",[])
    result=[]
    for i,form in enumerate(forms):
        if form not in FORMS:continue
        try:
            filed=recent.get("filingDate",[])[i]
            accession=recent.get("accessionNumber",[])[i]
            doc=recent.get("primaryDocument",[])[i]
            description=recent.get("primaryDocDescription",[])[i] if i<len(recent.get("primaryDocDescription",[])) else ""
        except IndexError:continue
        link=accession_link(cik,accession,doc)
        if not link or not re.fullmatch(r"\d{4}-\d{2}-\d{2}",str(filed)):continue
        result.append({"form":form,"filed":filed,"description":str(description or form)[:140],"url":link})
        if len(result)>=80:break
    return result

def self_test():
    sample={"fields":["cik","name","ticker","exchange"],"data":[[320193,"Apple Inc.","AAPL","Nasdaq"]]*501}
    sample["data"]=[ [i+1000,"Test "+str(i),"S"+str(i),"Nasdaq"] for i in range(501)]
    assert len(company_index(sample))==501
    assert accession_link(320193,"0000320193-26-000001","form10k.htm").startswith("https://www.sec.gov/Archives/")
    assert accession_link(320193,"0000320193-26-000001","../bad") is None
    data={"filings":{"recent":{"form":["4","10-K"],"filingDate":["2026-10-17","2026-10-16"],"accessionNumber":["0000320193-26-000001"]*2,"primaryDocument":["x4.xml","x10.htm"]}}}
    assert len(filings_from_submissions(data,320193))==2
    print("SEC research parser self-tests passed.")

def main():
    if "--self-test" in sys.argv:self_test();return 0
    if "@" not in CONTACT or len(CONTACT)<15:
        print("::warning::SEC_USER_AGENT secret is missing. Add an identifiable name and monitored email address. Existing research files are unchanged.")
        return 0
    try:
        source=download("https://www.sec.gov/files/company_tickers_exchange.json",CONTACT)
        companies=company_index(source)
    except (OSError,ValueError,urllib.error.URLError) as err:
        print("::warning::SEC ticker directory unavailable: "+str(err))
        return 0
    now=NOW()
    save(DIRECTORY,{"updated_at":now,"source":"https://www.sec.gov/files/company_tickers_exchange.json","companies":companies})
    by_ticker={c["ticker"]:c for c in companies}
    previous=existing(SNAPSHOTS,{"updated_at":None,"companies":{}})
    snapshots=previous.get("companies",{})
    if not isinstance(snapshots,dict):snapshots={}
    for ticker in STARTERS:
        company=by_ticker.get(ticker)
        if not company:continue
        cik=company["cik"]
        try:
            time.sleep(.65)  # Well below SEC's 10 requests/second fair access threshold.
            url="https://data.sec.gov/submissions/CIK"+str(cik).zfill(10)+".json"
            filings=filings_from_submissions(download(url,CONTACT),cik)
            if not filings:
                print("No usable recent SEC filings: "+ticker)
                continue
            snapshots[ticker]={"cik":cik,"name":company["name"],"exchange":company["exchange"],"updated_at":now,"filings":filings}
            print(ticker+": "+str(len(filings))+" original filing links")
        except (OSError,ValueError,urllib.error.URLError) as err:
            print("::warning::SEC filings temporarily unavailable for "+ticker+": "+str(err))
            # Retain last successful snapshot rather than overwrite with fake or empty data.
    save(SNAPSHOTS,{"updated_at":now,"source":"https://data.sec.gov/submissions/","companies":snapshots})
    return 0

if __name__=="__main__":
    sys.exit(main())
