"""Stubbed mail service.

Email delivery is out of scope for v1 (see docs/ARCHITECTURE.md → Deferred).
Everything that would be sent is logged to stdout instead, so flows that depend
on a message being "sent" are still exercisable end to end.
"""

from __future__ import annotations

import logging

logger = logging.getLogger("cart-paper.mail")


def send(to: str, subject: str, body: str) -> None:
    logger.info("MAIL → %s | %s\n%s", to, subject, body)
    print(f"\n--- mail to {to} ---\n{subject}\n\n{body}\n--- end ---\n", flush=True)


def send_password_reset(to: str, token: str) -> None:
    send(
        to,
        "Reset your CART Paper password",
        f"Use this token to choose a new password: {token}",
    )


def send_invite(to: str, book_title: str, url: str) -> None:
    send(
        to,
        f"You have been invited to preview “{book_title}”",
        f"Open the draft here: {url}",
    )
