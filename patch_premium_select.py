import re

with open('app/src/components/ui/CustomSelect.tsx', 'r') as f:
    content = f.read()

# 1. Update popup container padding to p-1 for BOTH popups (alwaysOpen and createPortal)
content = content.replace('py-1 bg-cream border border-border', 'p-1 bg-cream border border-border')

# 2. Update item classes to h-10 px-2 rounded-[4px]
# Text is 12px from outer edge (4px from p-1 + 8px from px-2)
old_item_class = "let itemClass = `flex items-center h-10 px-3 text-sm cursor-pointer select-none `;"
new_item_class = "let itemClass = `flex items-center h-10 px-2 rounded-[4px] text-sm cursor-pointer select-none `;"
content = content.replace(old_item_class, new_item_class)

with open('app/src/components/ui/CustomSelect.tsx', 'w') as f:
    f.write(content)

print("Patched CustomSelect to premium rounded highlight with h-10")
