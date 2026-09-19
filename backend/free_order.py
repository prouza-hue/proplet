"""Order preferences only: never writes results, rewards or play sessions."""
from typing import Literal
from pydantic import BaseModel, Field
from fastapi import HTTPException

VERSION = 'pestre-v1'
TEST_PROJECT = 'https://eanzztstmwlamwfdskbf.supabase.co'
BRANCH = 'feat/pestre-poradi-production'


class OrderCommand(BaseModel):
    difficulty: Literal['easy', 'medium']
    mode: Literal['numeric', 'varied']
    expected_revision: int = Field(ge=0)
    request_id: str = Field(min_length=16, max_length=80, pattern=r'^[A-Za-z0-9-]+$')
    ids: list[str] = Field(default_factory=list, max_length=5000)
    import_guest: bool = False
    newcomer: bool = False


def validate_ids(ids, bank, existing):
    """Accept only released IDs or already persisted tombstones; client reconciles new batches."""
    allowed = {p['id'] for p in bank} | set(existing or [])
    if len(ids) != len(set(ids)) or any(i not in allowed for i in ids):
        raise HTTPException(400, 'Neplatný plán úrovní')
    return list(ids)


def public_record(row):
    return {'difficulty': row['difficulty'], 'mode': row['mode'],
            'revision': row['revision'], 'offered': True,
            'newcomer': row['newcomer'],
            'plan': {'version': VERSION, 'difficulty': row['difficulty'],
                     'kind': 'varied', 'ids': row['ids']}}
