"""Enroll the two synthetic demo personas from their reference angles."""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image

from enroll_persona import EmbeddingModel
from generate_synthetic_case import generate_case_note
from persona_engine import PersonaEngine


def main() -> None:
    parser = argparse.ArgumentParser(description="Enroll synthetic demo personas from T/H reference angles")
    parser.add_argument("--images", default=".", help="Directory containing ordered WhatsApp JPEG images")
    parser.add_argument("--store", default=str(Path(__file__).resolve().parent / "personas.json"))
    parser.add_argument("--consented-by", default="Consenting demo participants")
    args = parser.parse_args()

    image_dir = Path(args.images)
    named_groups = [
        ("PERSON-1", "Person 1 (T1-T3)", [image_dir / f"t{index}.jpeg" for index in range(1, 4)]),
        ("PERSON-2", "Person 2 (H1-H4)", [image_dir / f"h{index}.jpeg" for index in range(1, 5)]),
    ]
    if not all(path.exists() for _, _, group in named_groups for path in group):
        images = sorted(image_dir.glob("WhatsApp Image *.jpeg"))
        if len(images) != 21:
            raise SystemExit("Expected t1-t3 and h1-h4, or the legacy 21-image enrollment set")
        named_groups = [(f"PERSON-{index + 1}", f"Person {index + 1}", images[index * 3:(index + 1) * 3]) for index in range(7)]

    model = EmbeddingModel()
    engine = PersonaEngine(store_path=args.store)
    engine.personas.clear()
    for persona_id, display_label, group in named_groups:
        embeddings = []
        for image_path in group:
            with Image.open(image_path) as image:
                embedding = model.get_embedding(image.convert("RGB"))
            if embedding is None:
                raise SystemExit(f"No face detected in {image_path.name}; profile {persona_id} was not enrolled")
            embeddings.append(embedding)
        average = np.mean(np.stack(embeddings), axis=0)
        average /= np.linalg.norm(average) + 1e-9
        case_note, _ = generate_case_note(persona_id)
        persona = engine.enroll(persona_id, display_label, args.consented_by, case_note, average)
        print(f"Enrolled {persona.persona_id} from: {', '.join(path.name for path in group)}")


if __name__ == "__main__":
    main()
