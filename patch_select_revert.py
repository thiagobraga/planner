import re

with open('app/src/components/ui/CustomSelect.tsx', 'r') as f:
    content = f.read()

# 1. Revert popup container padding from p-1 to py-1
content = content.replace('p-1 bg-cream border', 'py-1 bg-cream border')

# 2. Revert item classes back to h-10 px-3
old_item_class = "let itemClass = `flex items-center py-1.5 px-2 rounded-[4px] text-sm cursor-pointer select-none `;"
new_item_class = "let itemClass = `flex items-center h-10 px-3 text-sm cursor-pointer select-none `;"
content = content.replace(old_item_class, new_item_class)

with open('app/src/components/ui/CustomSelect.tsx', 'w') as f:
    f.write(content)

print("Reverted options spacing")
