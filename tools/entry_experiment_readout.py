"""Interpret aggregate CSV from ENTRY-EXPERIMENT-READOUT.sql without interim outcomes."""
import argparse
import csv
import math
from statistics import NormalDist


def binomial_p(a, b):
    n = a + b
    k = min(a, b)
    if n == 0 or a == b:
        return 1.0
    # Accumulate the smaller tail starting at its largest term, keeping scale in log space.
    term = total = 1.0
    for i in range(k, 0, -1):
        term *= i / (n - i + 1)
        total += term
        if term < total * 1e-16:
            break
    log_pk = math.lgamma(n + 1) - math.lgamma(k + 1) - math.lgamma(n - k + 1) - n * math.log(2)
    return min(1.0, 2 * math.exp(log_pk) * total)


def wilson(x, n):
    p = x / n
    z = NormalDist().inv_cdf(0.975)
    base = 1 + z * z / n
    center = (p + z * z / (2 * n)) / base
    radius = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / base
    return center - radius, center + radius


def readout(rows, intact):
    a, b = rows['A'], rows['B']
    na, nb = (int(r['assigned']) for r in (a, b))
    p = binomial_p(na, nb)
    srm = na + nb >= 100 and p < 0.001
    print(f'Přiřazeno A {na}, B {nb}. Kontrola poměru p={p:.5g}.')
    for name, row in rows.items():
        failures, assigned = (int(row[k]) for k in ('load_failures_last_hour', 'assigned_last_hour'))
        if assigned >= 30 and failures >= 5 and failures / assigned >= 0.1:
            print(f'Zastavit nábor. Selhání načtení v poslední hodině ve větvi {name}.')
    if srm:
        print('Pozastavit nábor a prověřit přiřazování.')
    if any(int(r['investigate']) for r in rows.values()):
        print('Prověřit integritu přiřazení a vazeb pokusů.')
    if any(r['completed_24h'] in ('', None) for r in rows.values()):
        return
    if na and nb:
        xa, xb = (int(r['completed_24h']) for r in (a, b))
        pa, pb = xa / na, xb / nb
        la, ua = wilson(xa, na)
        lb, ub = wilson(xb, nb)
        diff = pb - pa
        low = diff - math.hypot(pb - lb, ua - pa)
        high = diff + math.hypot(ub - pb, pa - la)
        print(f'Dokončilo A {xa}/{na}, B {xb}/{nb}. B-A {diff*100:+.2f} p. b., 95% interval [{low*100:+.2f}, {high*100:+.2f}].')
        valid = intact and min(na, nb) >= 100 and not srm and not any(int(r['investigate']) for r in rows.values())
        # Compare the preregistered 3-point threshold exactly at its boundary.
        numerator = 100 * (xb * na - xa * nb)
        threshold = 3 * na * nb
        if valid and ((numerator >= threshold and low > 0) or (numerator <= -threshold and high < 0)):
            print('Výsledek podporuje větev ' + ('B.' if diff > 0 else 'A.'))
            return
    print('výsledek zatím není přesvědčivý')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('csv')
    parser.add_argument('--intact-final', action='store_true', help='Potvrdit celé okno bez zastavení a doloženou úplnost sběru.')
    args = parser.parse_args()
    with open(args.csv, encoding='utf-8-sig', newline='') as source:
        data = list(csv.DictReader(source))
    if len(data) != 2 or {r['variant'] for r in data} != {'A', 'B'} or len({r['cutoff'] for r in data}) != 1:
        parser.error('Očekávány dvě větve A/B ke stejnému času.')
    readout({r['variant']: r for r in data}, args.intact_final)
