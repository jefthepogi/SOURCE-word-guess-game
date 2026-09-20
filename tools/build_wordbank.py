import json
import os
import sys
import gensim.downloader as api

def generate_wordbanks():
    # 1. Read targets from the JSON file first (fail-fast)
    json_path = os.path.join('data', 'wordbank.json')
    
    if not os.path.exists(json_path):
        print(f"Error: Could not find '{json_path}'.")
        sys.exit(1)
        
    with open(json_path, 'r', encoding='utf-8') as f:
        try:
            master_bank = json.load(f)
            targets = list(master_bank.keys())
        except json.JSONDecodeError:
            print(f"Error: '{json_path}' contains invalid JSON format.")
            sys.exit(1)
            
    print(f"Found {len(targets)} targets in wordbank.json.")

    # 2. Load 128MB Wikipedia-trained model
    print("Loading model (this takes a moment the first time)...")
    model = api.load('glove-wiki-gigaword-100') 
    
    # 3. Process each target word
    for word in targets:
        print(f"Generating dictionary for: {word}")
        try:
            similar = model.most_similar(word, topn=10000)
            
            # Rank 1 is the exact answer
            ranked_dict = {word: 1}
            for rank, (sim_word, _) in enumerate(similar, start=2):
                clean = sim_word.lower()
                if clean.isalpha() and clean not in ranked_dict:
                    ranked_dict[clean] = rank
                    
            # Export tightly packed JSON
            with open(os.path.join('data', f"{word}.json"), 'w', encoding='utf-8') as f:
                json.dump(ranked_dict, f, separators=(',', ':'))
                
        except KeyError:
            print(f"Skipping '{word}', not in the model's vocabulary.")

if __name__ == "__main__":
    generate_wordbanks()