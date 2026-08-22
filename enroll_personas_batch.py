"""Enroll ordered three-angle synthetic demo personas."""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image

from enroll_persona import EmbeddingModel
from generate_synthetic_case import generate_case_note
from persona_engine import PersonaEngine


def main() -> None:
    parser = argparse.ArgumentParser(description="Enroll synthetic demo personas from ordered three-angle photos")
    parser.add_argument("--images", default=".", help="Directory containing ordered WhatsApp JPEG images")
    parser.add_argument("--store", default=str(Path(__file__).resolve().parent / "personas.json"))
    parser.add_argument("--consented-by", default="Consenting demo participants")
    args = parser.parse_args()

    images = sorted(Path(args.images).glob("WhatsApp Image *.jpeg"))
    if len(images) != 21:
        raise SystemExit(f"Expected exactly 21 images for 7 people x 3 angles, found {len(images)}")

    model = EmbeddingModel()
    engine = PersonaEngine(store_path=args.store)
    for index in range(7):
        group = images[index * 3:(index + 1) * 3]
        embeddings = []
        for image_path in group:
            with Image.open(image_path) as image:
                embedding = model.get_embedding(image.convert("RGB"))
            if embedding is None:
                raise SystemExit(f"No face detected in {image_path.name}; profile PERSON-{index + 1} was not enrolled")
            embeddings.append(embedding)
        average = np.mean(np.stack(embeddings), axis=0)
        average /= np.linalg.norm(average) + 1e-9
        persona_id = f"PERSON-{index + 1}"
        case_note, _ = generate_case_note(persona_id)
        persona = engine.enroll(persona_id, f"Person {index + 1}", args.consented_by, case_note, average)
        print(f"Enrolled {persona.persona_id} from: {', '.join(path.name for path in group)}")


if __name__ == "__main__":
    main()
