#!/usr/bin/env python3
from pathlib import Path
from bs4 import BeautifulSoup
ROOT=Path(__file__).resolve().parents[1]
p=(ROOT/'public/privacy.html').read_text()
t=(ROOT/'public/terms.html').read_text()
for token in ['Pavel Prouza','Nahlásit problém','Právním základem','oprávněný zájem','Push notifikace','Vercel','Supabase','standardních smluvních doložek','přístup','opravu','výmaz','omezení zpracování','přenositelnost','námitku','Úřad pro ochranu osobních údajů','automatizovanému rozhodování']:
    assert token.lower() in p.lower(), token
for false_claim in ['IP adresu nikdy nezpracovává','všechna data jsou v EU','100% anonymní','žádná osobní data']:
    assert false_claim.lower() not in p.lower(), false_claim
assert 'Není dovoleno automatizovaně falšovat výsledky' in t
for rel in ['public/privacy.html','public/terms.html']:
    soup=BeautifulSoup((ROOT/rel).read_text(),'html.parser')
    assert soup.find('h1') and soup.find('a',href='/')
print('PASS: v3.23 privacy/terms expose controller channel, purposes, legal bases, rights and infrastructure without false location claims')
