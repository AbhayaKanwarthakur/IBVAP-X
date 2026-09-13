# RTFM Pretrained Integration — Setup Guide

This replaces training-from-scratch with a **pretrained** weakly-supervised
anomaly model: RTFM (Tian et al., ICCV 2021), official repo
[tianyu0207/RTFM](https://github.com/tianyu0207/RTFM). `rtfm_model.py` in
this folder is their real `model.py`, copied unmodified so the architecture
exactly matches the checkpoint below — don't edit its internals.

## 1. Download (confirmed working links, from the official README)

- **UCF-Crime checkpoint**: linked from the repo's README under
  "checkpoint for Ucf-crime" (OneDrive link — grab it from the README
  directly, since OneDrive links can rotate).
- **Precomputed UCF-Crime test I3D features** (10-crop, matches the
  checkpoint exactly): also linked in the README, both OneDrive and Google
  Drive mirrors are given.

On Kaggle, `gdown` works fine for the Google Drive links:
```python
!pip install gdown -q
!gdown <file_id> -O ucf_model.pkl
```

## 2. Sanity-check FIRST — reproduce their reported AUC before wiring anything in

Do not skip this step. There's a known open issue on the RTFM repo of
people reporting they can't reproduce the paper's UCF-Crime AUC — usually
traced to a mismatched feature extractor or preprocessing step, not a bug
in the model itself. Confirming the *unmodified* repo reproduces a
reasonable AUC on *their own* precomputed features tells you the
checkpoint and your environment are sound, before you introduce any of
your own moving parts (webcam frames, a different I3D extractor, etc.).

```bash
git clone https://github.com/tianyu0207/RTFM.git
cd RTFM
# edit list/ucf-i3d-test.list to point at your downloaded test features
# edit option.py defaults, or pass --dataset ucf --test-rgb-list ... --gt list/gt-ucf.npy
python test_10crop.py   # or however main.py/test wiring expects it in your checkout
```

If this doesn't land near the paper's reported range, stop and debug here
— don't move to live inference on a broken baseline.

## 3. Feature extraction for YOUR OWN clips — two paths, be honest about the tradeoff

RTFM's checkpoint expects features from **this specific I3D ResNet-50**
(ported from Facebook's Caffe2 nonlocal-net weights, via
[Tushar-N/pytorch-resnet3d](https://github.com/Tushar-N/pytorch-resnet3d)),
with 10-crop augmentation. That repo's own README now says *"Stop using
this repo, start using pytorchvideo"* — but for RTFM specifically, using a
different I3D implementation changes the feature distribution the
classifier head was trained on, which is the most likely explanation for
the reproducibility complaints in RTFM's issues.

**Path A — exact match (recommended if you have time before judging):**
1. Clone `Tushar-N/pytorch-resnet3d`.
2. Download + convert the Caffe2 I3D ResNet-50 weights (commands are in
   that repo's README).
3. Extract 10-crop features from your own clips using their `models.resnet.i3_res50()`.
4. Feed those into `rtfm_infer.py` below — this is the path most likely to
   reproduce the paper's accuracy on your own footage.

**Path B — faster, approximate (what we already built for Path B originally):**
- Reuse `ai/anomaly/extract_features.py`'s `pytorchvideo` I3D extractor
  from earlier in this project.
- Faster to stand up, but expect a real accuracy gap versus Path A — treat
  RTFM's output as a rougher directional signal in this case, same as we
  already frame `activity_anomaly` scores elsewhere in the pipeline (a
  probabilistic signal feeding the risk engine, not a precise number).
- If you go this route, say so plainly in your judging demo — "we're using
  a pretrained anomaly model with an approximate feature extractor for
  live inference" is an honest, defensible statement; claiming full paper
  accuracy without Path A's exact extractor would not be.

## 4. Live inference

See `rtfm_infer.py` — it loads the real `Model` class, runs a forward pass
on whatever features you extracted (Path A or B), and returns a score in
the same signal shape as `zone_engine.py` and the earlier `infer_signal.py`,
so the rest of the pipeline (risk engine, config weights) doesn't change.
