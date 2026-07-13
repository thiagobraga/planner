import re

# Patch Input.tsx
with open('app/src/components/ui/Input.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    'className="flex-1 min-w-0 bg-transparent border-0 outline-none',
    'className="flex-1 p-0 min-w-0 bg-transparent border-0 outline-none'
)

with open('app/src/components/ui/Input.tsx', 'w') as f:
    f.write(content)

# Patch CustomSelect.tsx
with open('app/src/components/ui/CustomSelect.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    'className={`flex-1 min-w-0 bg-transparent border-0 outline-none',
    'className={`flex-1 p-0 min-w-0 bg-transparent border-0 outline-none'
)

with open('app/src/components/ui/CustomSelect.tsx', 'w') as f:
    f.write(content)

print("Added p-0 to inputs")
