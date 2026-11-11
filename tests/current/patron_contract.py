"""Validate the additive patron surface before hashing the historical API."""
PATHS={'/api/patrons/gift':{'post'},'/api/admin/patrons/gifts':{'get'},'/api/patrons':{'get'},'/api/patrons/intents':{'post'},'/api/patrons/intents/{intent_id}':{'get'},'/api/patrons/preferences':{'post'},'/api/patrons/offers/claim':{'post'},'/api/patrons/offers/display':{'post'},'/api/patrons/offers/qr':{'post'},'/api/patrons/offers/engage':{'post'},'/api/patrons/thanks/claim':{'post'},'/api/patrons/offers/dismiss':{'post'},'/api/admin/patrons':{'get'},'/api/admin/patrons/confirm':{'post'}}
def normalize_patron_routes(routes):
 rows=list(routes)
 assert {(p,m.lower()) for p,methods,_ in rows if p in PATHS for m in methods}=={(p,m) for p,methods in PATHS.items() for m in methods}
 return [r for r in rows if r[0] not in PATHS]
def normalize_patrons(contract):
 models=set()
 for path,methods in PATHS.items():
  operation=contract['paths'].pop(path);assert set(operation)==methods
  for method in methods:
   op=operation[method]
   assert any(p['name']=='authorization' and p['in']=='header' for p in op.get('parameters',[]))
   body=op.get('requestBody')
   if body:
    name=body['content']['application/json']['schema']['$ref'].rsplit('/',1)[-1];models.add(name)
    assert contract['components']['schemas'][name]['additionalProperties'] is False
 for name in models:contract['components']['schemas'].pop(name)
