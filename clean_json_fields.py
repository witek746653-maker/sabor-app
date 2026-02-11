import json
import os

def clean_json_file(file_path):
    print(f"Cleaning: {file_path}")
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        if not isinstance(data, list):
            print(f"Skipping {file_path}: Not a list")
            return

        keys_to_remove = ["section_icon", "updated_at", "update_source", "source_file"]
        
        for item in data:
            if isinstance(item, dict):
                for key in keys_to_remove:
                    if key in item:
                        del item[key]
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            
    except Exception as e:
        print(f"Error processing {file_path}: {e}")

directories = [
    r"d:\GitHub\sabor-app\data",
    r"d:\GitHub\sabor-app\frontend\public\data"
]

for directory in directories:
    if os.path.exists(directory):
        for filename in os.listdir(directory):
            if filename.endswith(".json"):
                clean_json_file(os.path.join(directory, filename))
