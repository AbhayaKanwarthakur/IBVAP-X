"""
generate_synthetic_case.py
---------------------------
Generates a varied, clearly-fictional "case note" for a demo persona.

Design choice: incident types are deliberately simulation/test-flavored
rather than realistic serious crimes. This is intentional — even with
consent and a "synthetic" label, attaching a real person's face to a
fictional violent-crime narrative reads badly out of context (a
screenshot, a judge remembering it later). Mock-QA-style incidents
demo the persona-matching feature just as well without that problem.

Usage (as a library):

    from generate_synthetic_case import generate_case_note
    note, case_id = generate_case_note(seed="SUBJECT-014")

Or run directly to preview a few examples:

    python generate_synthetic_case.py
"""

import random
import hashlib
from datetime import datetime, timedelta

# Deliberately mundane/simulation-flavored — not real offense categories.
MOCK_INCIDENT_TYPES = [
    "flagged in a simulated restricted-zone test",
    "matched during a mock loitering-detection drill",
    "included in a test run of the abandoned-object alert",
    "used in a demo run of the cross-camera tracking test",
    "part of a scripted QA scenario for the alert pipeline",
    "enrolled as a control profile for a hackathon judging demo",
]

MOCK_LOCATIONS = [
    "Test Zone A", "Demo Lobby", "Simulation Dock", "QA Corridor", "Sandbox Area 3",
]


def _case_id(seed: str) -> str:
    h = hashlib.sha256(seed.encode()).hexdigest()[:6].upper()
    return f"MOCK-{h}"


def generate_case_note(seed: str, event_date: datetime = None) -> tuple[str, str]:
    """
    Returns (note_text, case_id). Deterministic per `seed` (e.g. persona_id)
    so re-running enrollment for the same persona gives a stable case note,
    but different personas get different flavor text.
    """
    rng = random.Random(seed)
    incident = rng.choice(MOCK_INCIDENT_TYPES)
    location = rng.choice(MOCK_LOCATIONS)
    event_date = event_date or (datetime.now() - timedelta(days=rng.randint(1, 14)))
    case_id = _case_id(seed)

    note = (
        f"[SYNTHETIC/NON-REAL] Case {case_id}: {incident} "
        f"at {location} on {event_date.strftime('%Y-%m-%d')}. "
        f"This record was generated for hackathon demo purposes only and "
        f"does not describe any real event or real allegation."
    )
    return note, case_id


if __name__ == "__main__":
    for pid in ["SUBJECT-014", "SUBJECT-015", "SUBJECT-016"]:
        note, cid = generate_case_note(pid)
        print(f"{pid} -> {cid}\n  {note}\n")
