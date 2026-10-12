"""Bounded, server-owned play session transport. No client identity or clock authority."""
from typing import Literal
from uuid import UUID
from fastapi import HTTPException
from pydantic import BaseModel, Field


class FoundWord(BaseModel):
    answerIndex: int = Field(ge=0, le=99)
    path: list[int] = Field(max_length=100)


class Progress(BaseModel):
    found: list[FoundWord] = Field(default_factory=list, max_length=99)
    elapsedMs: int = Field(default=0, ge=0, le=86_400_000)
    moves: int = Field(default=0, ge=0, le=10000)
    hints: int = Field(default=0, ge=0, le=99)
    wrongAttempts: int = Field(default=0, ge=0, le=999)
    maxHintLevel: int = Field(default=0, ge=0, le=3)
    calmMode: bool = False
    unverified: bool = False
    mergedAttempts: bool = False


class SessionCommand(BaseModel):
    action: Literal['open', 'pulse', 'pause', 'finish']
    puzzle_id: str = Field(min_length=1, max_length=100)
    challenge_key: str = Field(min_length=1, max_length=140)
    mode: Literal['daily', 'daily_special', 'free', 'tajenka']
    difficulty: str = Field(max_length=20)
    attempt_id: str = Field(min_length=8, max_length=80)
    owner_id: UUID
    sequence: int = Field(ge=1, le=9007199254740991)
    progress: Progress = Field(default_factory=Progress)


def canonical_progress(command, puzzle):
    result = command.progress.model_dump()
    found = []
    seen = set()
    answers = puzzle.get('answers') or []
    for word in command.progress.found:
        if word.answerIndex >= len(answers) or word.answerIndex in seen:
            raise HTTPException(400, 'Neplatný rozehraný postup')
        answer = answers[word.answerIndex]
        if answer.get('path') != word.path:
            raise HTTPException(400, 'Neplatná cesta slova')
        seen.add(word.answerIndex)
        found.append({'answerIndex': word.answerIndex, 'word': answer['word'],
                      'path': answer['path'], 'colorIndex': len(found)})
    if command.action == 'finish' and len(found) != len(answers):
        raise HTTPException(400, 'Deska ještě není dokončená')
    result['found'] = found
    result['moves'] = max(result['moves'], len(found) + result['wrongAttempts'])
    return result


def execute(command, actor, puzzle, rpc):
    player = actor.get('player_id')
    actor_key = 'p:' + str(player) if player else 'a:' + str(actor['anonymous_id'])
    value = rpc('proplet_play_session_v1', {
        'p_actor': actor_key, 'p_player': player, 'p_key': command.challenge_key,
        'p_puzzle': command.puzzle_id, 'p_mode': command.mode, 'p_attempt': command.attempt_id,
        'p_owner': str(command.owner_id), 'p_sequence': command.sequence,
        'p_action': command.action, 'p_progress': canonical_progress(command, puzzle),
    })
    if isinstance(value, list):
        value = value[0] if value else {}
    if not isinstance(value, dict):
        raise HTTPException(503, 'Pokračování hry se nepodařilo načíst')
    if value.get('error') in ('busy', 'ownership'):
        raise HTTPException(409, 'Tahle hra je otevřená na jiném zařízení. Nejprve ji tam pozastav.')
    if value.get('error'):
        raise HTTPException(409, 'Herní pokus je potřeba znovu otevřít')
    return {key: value.get(key) for key in ('attempt_id', 'progress', 'elapsed_ms', 'verified', 'finished', 'sequence')}
