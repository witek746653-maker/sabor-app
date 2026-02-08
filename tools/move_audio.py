import os
import json
import shutil

# Paths
root_dir = r"d:\GitHub\sabor-app"
audio_src_base = os.path.join(root_dir, "audio")
audio_dest_base = os.path.join(root_dir, "frontend", "public", "audio")

json_files = [
    os.path.join(root_dir, "frontend", "public", "data", "menu-kitchen.json"),
    os.path.join(root_dir, "frontend", "public", "data", "menu-bar.json"),
    os.path.join(root_dir, "frontend", "public", "data", "menu-wine.json"),
    os.path.join(root_dir, "frontend", "public", "data", "menu-tea.json")
]

# Ensure dest dirs exist
os.makedirs(os.path.join(audio_dest_base, "en"), exist_ok=True)
os.makedirs(os.path.join(audio_dest_base, "wine"), exist_ok=True)

moved_count = 0

for json_path in json_files:
    if not os.path.exists(json_path):
        print(f"File not found: {json_path}")
        continue
    
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    for item in data:
        audio_rel_path = item.get('i18n', {}).get('en', {}).get('audio-en')
        item_id = item.get('id')
        
        if audio_rel_path and item_id:
            # audio_rel_path is like "../audio/en/filename.mp3"
            # We need to find where it is on disk.
            # Convert rel path to absolute.
            # We assume it's relative to public/data, but actually it's just a string.
            # Based on user info, it's in audio\en
            
            clean_rel = audio_rel_path.replace('../', '').replace('/', os.sep)
            src_path = os.path.join(root_dir, clean_rel)
            
            if os.path.exists(src_path):
                # Determine category: en or wine
                category = "en" if "audio\\en" in clean_rel else "wine"
                dest_path = os.path.join(audio_dest_base, category, f"{item_id}.mp3")
                
                shutil.copy2(src_path, dest_path)
                moved_count += 1
            else:
                # Try fallback: some might be missing category in path or have different separators
                pass

print(f"Total files copied and renamed: {moved_count}")
