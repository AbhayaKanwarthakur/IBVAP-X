"""
enroll_persona.py
------------------
CLI to enroll ONE consenting demo persona into personas.json.

Usage:
    python enroll_persona.py \
        --image ./demo_photos/teammate1.jpg \
        --persona-id SUBJECT-014 \
        --display-label "Demo Subject 014" \
            --consented-by "Alex (teammate, verbal consent for demo)"

        (case note is auto-generated as clearly-synthetic, simulation-flavored
        text — see generate_synthetic_case.py. Pass --case-note yourself only
        if you want to override it.)

Before running: only point --image at a photo of someone who has agreed to
    be enrolled for the demo. Do not use photos of people who haven't consented.
"""

import argparse
from pathlib import Path
from PIL import Image

from persona_engine import EmbeddingModel, PersonaEngine
from generate_synthetic_case import generate_case_note


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--image", required=True, help="Path to a consenting demo persona's photo")
    parser.add_argument("--persona-id", required=True, help="e.g. SUBJECT-014")
    parser.add_argument("--display-label", required=True)
    parser.add_argument("--consented-by", required=True,
                         help="Record who consented, for your own audit trail")
    parser.add_argument("--case-note", default=None,
                         help="Optional fictional case text override")
    parser.add_argument("--store", default=str(Path(__file__).resolve().parent / "personas.json"))
    args = parser.parse_args()

    print("Confirm: this photo is of someone who has explicitly consented "
          "to be enrolled for a hackathon demo, and the case note is "
          "fictional. Press Enter to continue, Ctrl+C to abort.")
    input()

    model = EmbeddingModel()
    engine = PersonaEngine(store_path=args.store)

    img = Image.open(args.image).convert("RGB")
    embedding = model.get_embedding(img)
    if embedding is None:
        print("No face detected in image — try a clearer, front-facing photo.")
        return

    case_note = args.case_note
    if case_note is None:
        case_note, case_id = generate_case_note(seed=args.persona_id)
        print(f"Auto-generated synthetic case note ({case_id}):\n  {case_note}")

    persona = engine.enroll(
        persona_id=args.persona_id,
        display_label=args.display_label,
        consented_by=args.consented_by,
        fictional_case_note=case_note,
        embedding=embedding,
    )
    print(f"Enrolled {persona.persona_id} ({persona.display_label}) into {args.store}")


if __name__ == "__main__":
    main()
