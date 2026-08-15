#!/usr/bin/env python3
COLORS=['#ff9585','#68cfaa','#7ca8ff','#ffd064','#b295ff','#f391c3','#62cbd8','#ffad63','#a6d86d','#76c3ee','#da87e4','#66bea0']
BASE='#211f2c'; TEXT='#0c0b10'; P=.70
def rgb(h): return tuple(int(h[i:i+2],16) for i in (1,3,5))
def mix(a,p,b):
    a,b=rgb(a),rgb(b); return tuple(round(a[i]*p+b[i]*(1-p)) for i in range(3))
def chan(v):
    x=v/255; return x/12.92 if x<=.04045 else ((x+.055)/1.055)**2.4
def lum(c): return .2126*chan(c[0])+.7152*chan(c[1])+.0722*chan(c[2])
def contrast(a,b):
    a,b=lum(a),lum(b); return (max(a,b)+.05)/(min(a,b)+.05)
ratios=[contrast(mix(c,P,BASE),rgb(TEXT)) for c in COLORS]
assert min(ratios)>=4.5, min(ratios)
print(f'PASS: v3.22.1 found-cell contrast min={min(ratios):.2f}:1 across {len(COLORS)} colors')
