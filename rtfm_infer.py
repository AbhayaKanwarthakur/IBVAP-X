"""
rtfm_infer.py
--------------
Inference wrapper around RTFM's real Model class (rtfm_model.py, copied
unmodified from the official repo). Loads the pretrained UCF-Crime
checkpoint and scores a features array for a single clip/track buffer.

Confirmed from the real source (model.py / test_10crop.py in the official
repo):
- Model.forward(inputs) expects inputs shaped (batch, ncrops, T, feat_dim)
  — feat_dim=2048 for I3D ResNet-50 features.
- ncrops is normally 10 (10-crop augmentation) but the model doesn't
  hardcode this — passing ncrops=1 (center crop only) runs, at a real
  accuracy cost versus the paper's evaluated setting (see README's Path A
  vs Path B tradeoff).
- At inference (batch size 1), the special-case branch in forward() copies
  the "normal" pathway into the "abnormal" pathway — this is expected
  RTFM behavior for single-video scoring, not a bug.
- The 7th return value (index 6) is `scores`: shape (batch, T, 1), one
  score per T-length temporal segment, already averaged over ncrops.
"""

from __future__ import annotations
import torch
import numpy as np

from rtfm_model import Model


class RTFMDetector:
    def __init__(self, checkpoint_path: str, feature_size: int = 2048, device: str = None):
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        self.model = Model(n_features=feature_size, batch_size=1).to(self.device)

        state = torch.load(checkpoint_path, map_location=self.device)
        # RTFM checkpoints are sometimes a raw state_dict, sometimes wrapped —
        # handle both without guessing silently wrong.
        state_dict = state.get("state_dict", state) if isinstance(state, dict) else state
        self.model.load_state_dict(state_dict, strict=True)
        self.model.eval()

    @torch.no_grad()
    def score_features(self, features: np.ndarray) -> np.ndarray:
        """
        features: numpy array shaped (T, ncrops, feat_dim) for ONE clip/track
                  buffer — T temporal segments, ncrops spatial crops (10 for
                  the paper's setting, 1 if you're using Path B / center-crop
                  only), feat_dim=2048.

        Returns: numpy array of shape (T,) — one anomaly score per segment.
        """
        if features.ndim != 3:
            raise ValueError(f"expected (T, ncrops, feat_dim), got shape {features.shape}")

        t, ncrops, feat_dim = features.shape
        x = torch.from_numpy(features.astype(np.float32)).unsqueeze(0)  # (1, T, ncrops, F)
        x = x.permute(0, 2, 1, 3).to(self.device)  # -> (1, ncrops, T, F), matches test_10crop.py

        outputs = self.model(inputs=x)
        scores = outputs[6]  # `logits`/`scores` in the original test script — see module docstring
        scores = scores.squeeze(0).squeeze(-1)  # (T,)
        return scores.cpu().numpy()

    def signal_for_track(self, track_id: int, features: np.ndarray, threshold: float = 0.5,
                          aggregate: str = "max") -> dict | None:
        """
        Same output shape as zone_engine.py's signals and the earlier
        infer_signal.py, so it merges into the existing risk-engine
        pipeline unchanged.
        """
        scores = self.score_features(features)
        agg_score = float(scores.max() if aggregate == "max" else scores.mean())

        if agg_score < threshold:
            return None
        return {
            "type": "activity_anomaly_rtfm",
            "track_id": track_id,
            "zone": None,
            "detail": f"track {track_id} RTFM anomaly score {agg_score:.2f} ({aggregate} over {len(scores)} segments)",
            "severity": min(agg_score, 0.95),
        }
