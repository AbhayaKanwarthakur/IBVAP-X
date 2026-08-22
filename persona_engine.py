"""
persona_engine.py
------------------
Synthetic demo-persona matching for IBVAP-X hackathon demos.

IMPORTANT SCOPE:
This module is for demoing "the system can re-identify an enrolled
profile" using ONLY people who have explicitly consented (e.g. team
members) and ONLY fictional case metadata that you invent for the demo.

It must never be pointed at real people's photos scraped from anywhere,
and every match result carries `"synthetic": true` plus a visible label
so the UI cannot present it as a real criminal-identification result.

Uses face embeddings (facenet-pytorch: MTCNN for detection + Inception
ResnetV1 for embeddings) compared by cosine similarity. Install with:

    pip install facenet-pytorch torch torchvision

If you'd rather avoid a face-specific model and reuse a general person
re-id embedding (e.g. OSNet) instead, the interface below is agnostic —
`get_embedding()` is the only function that would need swapping out.
"""

from __future__ import annotations
import json
import os
import time
from dataclasses import dataclass, asdict
from typing import Optional, List, Dict

import numpy as np

try:
    import torch
    from facenet_pytorch import MTCNN, InceptionResnetV1
    _HAS_FACENET = True
except ImportError:
    _HAS_FACENET = False


@dataclass
class Persona:
    persona_id: str          # e.g. "SUBJECT-014" — never a real name
    display_label: str       # what shows in the UI, e.g. "Demo Subject 014"
    consented_by: str        # who enrolled / consented, for your own audit trail
    fictional_case_note: str # entirely made-up case text for the demo
    embedding: List[float]
    enrolled_at: float
    synthetic: bool = True   # always True — this flag must never be set False


class EmbeddingModel:
    """Thin wrapper so the matching logic doesn't care which model backs it."""

    def __init__(self, device: str = "cpu"):
        if not _HAS_FACENET:
            raise RuntimeError(
                "facenet-pytorch not installed. Run: "
                "pip install facenet-pytorch torch torchvision"
            )
        self.device = device
        self.mtcnn = MTCNN(image_size=160, margin=20, device=device)
        self.resnet = InceptionResnetV1(pretrained="vggface2").eval().to(device)

    def get_embedding(self, pil_image) -> Optional[np.ndarray]:
        """pil_image: PIL.Image of a cropped face or full frame containing one face."""
        face = self.mtcnn(pil_image)
        if face is None:
            return None
        with torch.no_grad():
            emb = self.resnet(face.unsqueeze(0).to(self.device))
        return emb.squeeze(0).cpu().numpy()


class PersonaEngine:
    def __init__(self, store_path: str = "personas.json", match_threshold: float = 0.75):
        self.store_path = store_path
        self.match_threshold = match_threshold
        self.personas: Dict[str, Persona] = {}
        self._load()

    def _load(self):
        if os.path.exists(self.store_path):
            with open(self.store_path, "r") as f:
                raw = json.load(f)
            for p in raw.get("personas", []):
                if not p.get("synthetic", False):
                    # Refuse to load any record not explicitly marked synthetic.
                    continue
                embedding = p.get("embedding")
                if not isinstance(embedding, list) or not embedding or not all(isinstance(value, (int, float)) for value in embedding):
                    continue
                self.personas[p["persona_id"]] = Persona(**p)

    def _save(self):
        payload = {
            "_warning": "All entries are synthetic demo personas. Never store real "
                        "identification data here.",
            "personas": [asdict(p) for p in self.personas.values()],
        }
        with open(self.store_path, "w") as f:
            json.dump(payload, f, indent=2)

    def enroll(
        self,
        persona_id: str,
        display_label: str,
        consented_by: str,
        fictional_case_note: str,
        embedding: np.ndarray,
    ) -> Persona:
        """
        Enroll a consenting demo persona. Call this only for people who have
        explicitly agreed to be part of the demo (e.g. teammates), with
        case metadata you've clearly invented for the demo.
        """
        persona = Persona(
            persona_id=persona_id,
            display_label=display_label,
            consented_by=consented_by,
            fictional_case_note=fictional_case_note,
            embedding=embedding.tolist(),
            enrolled_at=time.time(),
            synthetic=True,
        )
        self.personas[persona_id] = persona
        self._save()
        return persona

    def match(self, embedding: np.ndarray) -> Optional[dict]:
        """
        Compare a live embedding against enrolled personas.
        Returns None if no match above threshold, else a result dict that
        is always explicitly labeled synthetic/demo.
        """
        best_id, best_sim = None, -1.0
        for pid, persona in self.personas.items():
            sim = self._cosine_sim(embedding, np.array(persona.embedding))
            if sim > best_sim:
                best_id, best_sim = pid, sim

        if best_id is None or best_sim < self.match_threshold:
            return None

        persona = self.personas[best_id]
        return {
            "matched": True,
            "synthetic": True,  # always present — UI must gate display on this
            "persona_id": persona.persona_id,
            "display_label": f"[DEMO/SYNTHETIC] {persona.display_label}",
            "similarity": round(float(best_sim), 3),
            "fictional_case_note": persona.fictional_case_note,
            "disclaimer": "This is a synthetic demo match against a consenting "
                           "enrolled profile. It is not a real identification "
                           "or criminal record.",
        }

    @staticmethod
    def _cosine_sim(a: np.ndarray, b: np.ndarray) -> float:
        return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-9))
