#!/usr/bin/env python3
"""Refresh the same-origin RiftVault ban/rule metadata from Riot's Rules Hub.
Safety: only write changes if BOTH format lists and both rules documents parse.
This script does not reproduce the copyrighted rulebooks; it links to them.
"""
import datetime as dt
import json
import os
import re
import sys
from pathlib import Path
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup

URL = 'https://playriftbound.com/en-us/rules-hub/'
OUTPUT = Path(__file__).resolve().parents[1] / 'official-updates.json'
TODAY = dt.datetime.now(dt.timezone.utc)
DATE_RE = r'(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+20\d\d'


def iso_date(value):
    m = re.search(DATE_RE, value, flags=re.I)
    if not m:
        return None
    return dt.datetime.strptime(re.sub(r'\s+', ' ', m.group()).replace(',', ''), '%B %d %Y').date().isoformat()


def normalize(v):
    return re.sub(r'[^a-z0-9]+', ' ', str(v).lower().replace('’', "'")).strip().removeprefix('the ')


def parse(source):
    soup = BeautifulSoup(source, 'html.parser')
    # Our parser looks for headings, then items below them. It rejects
    # unexpected site changes instead of guessing banned-card names.
    current = None
    category = None
    got = {'standard': [], 'duo': []}
    dates = {'standard': None, 'duo': None}
    doc_urls = {}
    doc_dates = {}
    for item in soup.find_all(['h1', 'h2', 'h3', 'h4', 'h5', 'p', 'li', 'a']):
        t = item.get_text(' ', strip=True)
        l = t.lower()
        if item.name in ('h1','h2','h3','h4','h5'):
            if '2v2 constructed legality' in l:
                current='duo';category=None;continue
            if 'constructed format legality' in l:
                current='standard';category=None;continue
            if 'core rules' == l:
                current='core';category=None;continue
            if 'tournament rules' == l:
                current='tournament';category=None;continue
            if current in ('standard','duo'):
                if l in ('cards','card'):
                    category='Card';continue
                if l in ('battlefields','battlefield'):
                    category='Battlefield';continue
                if l in ('legends','legend'):
                    category='Legend';continue
        if current in ('standard','duo'):
            if item.name=='p' and 'last updated' in l:
                dates[current]=dates[current] or iso_date(t)
            if item.name=='li' and category:
                name=re.sub(r'\s+', ' ',t).strip(' |•')
                if name and len(name)<100 and not any(normalize(x['name'])==normalize(name) for x in got[current]):
                    got[current].append({'name':name,'category':category})
        if current in ('core','tournament') and item.name=='a' and item.get('href'):
            href=item['href'];u=urlparse(href)
            if href.endswith('.pdf') and u.scheme=='https' and u.hostname and u.hostname.endswith('.rgpub.io'):
                doc_urls[current]=href
                parent=item.parent.get_text(' ',strip=True) if item.parent else ''
                doc_dates[current]=iso_date(parent) or doc_dates.get(current)
        if current in ('core','tournament') and item.name=='p':
            doc_dates[current]=doc_dates.get(current) or iso_date(t) if 'last updated' in l else doc_dates.get(current)
    # Defensive: avoid replacing known bans with incomplete lists.
    if len(got['standard'])<8 or len(got['duo'])<len(got['standard']):
        raise ValueError(f'Ban lists failed validation: standard={len(got["standard"])} duo={len(got["duo"])}')
    if not dates['standard'] or not dates['duo']:
        raise ValueError('Missing official ban effective dates')
    if not all(k in doc_urls for k in ('core','tournament')) or not all(doc_dates.get(k) for k in ('core','tournament')):
        raise ValueError('Could not verify latest official rulebook links and revision dates')
    # Correct the occasional omission of the character's name in the 2v2
    # title by using the canonical matching Standard name whenever possible.
    main={normalize(row['name']):row for row in got['standard']}
    main_compact={normalize(row['name']).replace(' ',''):row for row in got['standard']}
    merged=list(got['standard'])
    for extra in got['duo']:
        key=normalize(extra['name'])
        if key in main or key.replace(' ','') in main_compact:continue
        # Draven Vanquisher on Riot's page omits a comma. Treat it as standard.
        if key=='draven vanquisher':continue
        merged.append(extra)
    if len(merged)>100:raise ValueError('Unexpected ban-count size')
    effective=max(dates.values())
    return {'source':URL,'checkedAt':TODAY.isoformat(timespec='seconds'),
       'bans':{'effectiveAt':effective,'standard':got['standard'],'duo':merged},
       'rules':{'coreUpdated':doc_dates['core'],'tournamentUpdated':doc_dates['tournament'],
                'coreUrl':doc_urls['core'],'tournamentUrl':doc_urls['tournament']}}


def main():
    res=requests.get(URL,timeout=30,headers={'User-Agent':'RiftVault-Official-Update-Checker/1.0 (fan project; source verification)'})
    res.raise_for_status()
    data=parse(res.text)
    previous=json.loads(OUTPUT.read_text()) if OUTPUT.exists() else {}
    # Ban dates refer to the official format's currently active list. An
    # announcement with a future effective date should not mark cards early.
    if data['bans']['effectiveAt']>TODAY.date().isoformat():
        print('Upcoming official list detected; keep prior active status until effective date')
    if data['bans']!=previous.get('bans') or data['rules']!=previous.get('rules'):
        print('Official source contents changed; refreshing ban/rule metadata')
    OUTPUT.write_text(json.dumps(data,indent=2,ensure_ascii=False)+'\n')
    print(f'Wrote verified source data ({len(data["bans"]["standard"])} Standard, {len(data["bans"]["duo"])} 2v2)')

if __name__=='__main__':
    main()
