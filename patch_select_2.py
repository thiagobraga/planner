import re

with open('app/src/components/ui/CustomSelect.tsx', 'r') as f:
    content = f.read()

# 1. Add useEffect to force isOpen if alwaysOpen is true (handles HMR)
effect = """  const [isOpen, setIsOpen] = useState(alwaysOpen);
  
  useEffect(() => {
    if (alwaysOpen) setIsOpen(true);
  }, [alwaysOpen]);"""
content = content.replace('  const [isOpen, setIsOpen] = useState(alwaysOpen);', effect)

# 2. Update itemClass padding to h-10 to match Input height and be more readable
content = content.replace(
    'let itemClass = `flex items-center h-8 px-3 text-[14px] font-journal cursor-pointer select-none `;',
    'let itemClass = `flex items-center h-10 px-3 text-sm cursor-pointer select-none `;'
)

with open('app/src/components/ui/CustomSelect.tsx', 'w') as f:
    f.write(content)

print("Patched.")
