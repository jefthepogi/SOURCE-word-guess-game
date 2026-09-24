"""Validate wordbank.json and its ranking dictionaries.

Run from the project root: python tools/validate_wordbank.py
"""
import json
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
BANK_PATH = DATA_DIR / "wordbank.json"


def main():
    bank = json.loads(BANK_PATH.read_text(encoding="utf-8"))
    errors = []

    for word, hints in bank.items():
        if not isinstance(hints, list) or not hints:
            errors.append(f"{word}: expected at least one hint")
        elif any(not isinstance(hint, str) or not hint.strip() for hint in hints):
            errors.append(f"{word}: every hint must be non-empty text")

        dictionary_path = DATA_DIR / f"{word}.json"
        if not dictionary_path.exists():
            errors.append(f"{word}: missing {dictionary_path.name}")
            continue
        dictionary = json.loads(dictionary_path.read_text(encoding="utf-8"))
        if dictionary.get(word) != 1:
            errors.append(f"{word}: ranking dictionary must map the answer to rank 1")

    if errors:
        print("Wordbank validation failed:")
        print("\n".join(f"- {error}" for error in errors))
        raise SystemExit(1)

    print(f"Wordbank OK: {len(bank)} words, hints, and ranking dictionaries.")


if __name__ == "__main__":
    main()
