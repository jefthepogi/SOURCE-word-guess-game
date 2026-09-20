"""
Generates data/selfie.json so "selfie" can stay in wordbank.json.

Run from the project root (with your venv active and gensim installed):
    python make_selfie.py

It uses the same model and ranking logic as build_wordbank.py, but only for
this one word. If "selfie" is not in the model's vocabulary (which is probably
why it was skipped originally), it blends the vectors of related words instead.
"""
import json
import os

import gensim.downloader as api

TARGET = "selfie"
FALLBACK_WORDS = ["self", "photo", "smartphone", "camera"]  # used only if needed

print("Loading model (first run downloads about 128 MB)...")
model = api.load("glove-wiki-gigaword-100")

if TARGET in model.key_to_index:
    print(f"'{TARGET}' is in the model, using it directly.")
    similar = model.most_similar(TARGET, topn=10000)
else:
    print(f"'{TARGET}' is not in the model, blending: {FALLBACK_WORDS}")
    similar = model.most_similar(positive=FALLBACK_WORDS, topn=10000)

ranked = {TARGET: 1}  # rank 1 is the exact answer
for rank, (word, _score) in enumerate(similar, start=2):
    clean = word.lower()
    if clean.isalpha() and clean not in ranked:
        ranked[clean] = rank

out_path = os.path.join("data", f"{TARGET}.json")
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(ranked, f, separators=(",", ":"))

print(f"Wrote {out_path} with {len(ranked)} words.")
