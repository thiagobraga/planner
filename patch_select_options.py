import re

with open('app/src/components/ui/CustomSelect.tsx', 'r') as f:
    content = f.read()

# 1. Update the popup container padding to p-1 (which gives 4px padding all around)
# In both absolute and fixed portal versions
content = content.replace('py-1 bg-cream', 'p-1 bg-cream')

# 2. Update the item classes to use px-2, rounded-[4px], h-auto, py-1.5
# This keeps the text aligned at 12px (4px from p-1 + 8px from px-2)
old_item_class = "let itemClass = `flex items-center h-10 px-3 text-sm cursor-pointer select-none `;"
new_item_class = "let itemClass = `flex items-center py-1.5 px-2 rounded-[4px] text-sm cursor-pointer select-none `;"
content = content.replace(old_item_class, new_item_class)

with open('app/src/components/ui/CustomSelect.tsx', 'w') as f:
    f.write(content)

print("Patched options spacing")
