
import os
import reprlib

path = 'd:/GitHub/sabor-app/images'
files = [f for f in os.listdir(path) if f.startswith('postnoe-menyu-')]
for f in files:
    print(f"{f!r}")
