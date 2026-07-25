"""Server-side password policy — the authoritative one.

The browser shows a strength meter, but that is advice: a low zxcvbn score never
blocks registration, because telling somebody their genuinely random passphrase
is unacceptable is worse than letting it through. What is enforced here is the
part that is not a matter of opinion — a hard minimum length, and rejection of
passwords that appear on a public list of already-cracked ones.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

MIN_LENGTH = 10
MAX_LENGTH = 200
_LIST = Path(__file__).resolve().parent.parent / "data" / "common_passwords.txt"


@lru_cache(maxsize=1)
def common_passwords() -> frozenset[str]:
    try:
        return frozenset(
            line.strip().lower()
            for line in _LIST.read_text(encoding="utf-8", errors="ignore").splitlines()
            if line.strip()
        )
    except OSError:
        return frozenset()


def validate(password: str) -> str | None:
    """Return a field-level error message, or None when the password is allowed."""
    if len(password) < MIN_LENGTH:
        return f"Passwords need at least {MIN_LENGTH} characters."
    if len(password) > MAX_LENGTH:
        return f"Passwords can be at most {MAX_LENGTH} characters."
    if password.lower() in common_passwords():
        return "That password appears on public lists of cracked passwords. Choose another."
    return None
