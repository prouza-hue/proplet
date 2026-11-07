"""Interpret aggregate CSV from ENTRY-EXPERIMENT-READOUT.sql without interim outcomes."""
import argparse
import csv
import json
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


def random_cohort_readout(rows, intact):
    a, b = rows['A'], rows['B']
    na, nb = (int(r['assigned']) for r in (a, b))
    p = binomial_p(na, nb)
    srm = na + nb >= 100 and p < 0.001
    print(f'Přiřazeno A {na}, B {nb}. Kontrola poměru p={p:.5g}.')
    if srm:
        print('Pozastavit nábor a prověřit přiřazování.')
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


def technical_health(rows):
    for name, row in rows.items():
        failures, assigned = (int(row[k]) for k in ('load_failures_last_hour', 'assigned_last_hour'))
        if assigned >= 30 and failures >= 5 and failures / assigned >= 0.1:
            print(f'Zastavit nábor. Selhání načtení v poslední hodině ve větvi {name}.')
    if any(int(row['investigate']) for row in rows.values()):
        print('Prověřit integritu přiřazení a vazeb pokusů.')


def readout(rows, intact):
    technical_health(rows)
    # Archived callers without policy metadata contain the original hash cohort.
    if not any('policy_metrics' in row for row in rows.values()):
        random_cohort_readout(rows, intact)
        return
    policies = {}
    for variant, row in rows.items():
        raw = row.get('policy_metrics')
        policies[variant] = json.loads(raw) if isinstance(raw, str) else raw
        if not isinstance(policies[variant], dict):
            raise ValueError('Chybí rozpad přiřazení podle politiky.')
    supported = ({'hash50_v1', 'alternating_v1'}, {'hash50_v1', 'alternating_v1', 'catchup_v1'})
    if set(policies['A']) != set(policies['B']) or set(policies['A']) not in supported:
        raise ValueError('Neznámá nebo neúplná politika přiřazování.')
    for variant, row in rows.items():
        if sum(int(cohort['assigned']) for cohort in policies[variant].values()) != int(row['assigned']):
            raise ValueError('Součet kohort neodpovídá všem přiřazením.')
    print(f"Celkem přiřazeno A {rows['A']['assigned']}, B {rows['B']['assigned']}.")
    print('Původní náhodné přiřazování hash50_v1')
    random_cohort_readout({v: policies[v]['hash50_v1'] for v in ('A', 'B')}, intact)
    for policy in ('alternating_v1', 'catchup_v1'):
        if policy in policies['A']:
            descriptive_cohort_readout(policies['A'][policy], policies['B'][policy], policy, intact)


def descriptive_cohort_readout(a, b, policy, intact):
    label = 'Střídání' if policy == 'alternating_v1' else 'Dorovnání'
    print(f"{label} {policy}. Přiřazeno A {a['assigned']}, B {b['assigned']}.")
    if any(r['completed_24h'] in ('', None) for r in (a, b)):
        return
    na, nb = int(a['assigned']), int(b['assigned'])
    if policy == 'catchup_v1':
        print(f"Dokončilo A {a['completed_24h']}/{na}, B {b['completed_24h']}/{nb}.")
        print('Dorovnávací fáze se vykazuje popisně, s ohledem na čas a zdroj příchodů.')
        return
    if na and nb:
        xa, xb = int(a['completed_24h']), int(b['completed_24h'])
        print(f'Dokončilo A {xa}/{na}, B {xb}/{nb}. Popisný rozdíl B-A {(xb / nb - xa / na) * 100:+.2f} p. b.')
    if min(na, nb) < 100 or any(int(row['investigate']) for row in (a, b)) or not intact:
        print('výsledek zatím není přesvědčivý')
    else:
        print('Popisné výsledky střídavé fáze vyžadují posouzení časového a akvizičního složení.')


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
