#!/usr/bin/env python3
"""Generate VAPID values for Proplet Web Push.
Run after: python -m pip install cryptography
Never commit the printed private key to GitHub.
"""
from base64 import urlsafe_b64encode
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import serialization


def b64u(raw: bytes) -> str:
    return urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")

key = ec.generate_private_key(ec.SECP256R1())
private_der = key.private_bytes(
    serialization.Encoding.DER,
    serialization.PrivateFormat.PKCS8,
    serialization.NoEncryption(),
)
public_raw = key.public_key().public_bytes(
    serialization.Encoding.X962,
    serialization.PublicFormat.UncompressedPoint,
)
print("VAPID_PUBLIC_KEY=" + b64u(public_raw))
print("VAPID_PRIVATE_KEY=" + b64u(private_der))
print("\nSoukromy klic patri jen do Vercel Environment Variables. Nedavej ho do GitHubu.")
