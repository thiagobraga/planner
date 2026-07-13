with open('app/src/pages/StyleguidePage.tsx', 'r') as f:
    lines = f.readlines()

new_lines = []
in_palette = False

for i, line in enumerate(lines):
    if "11 — Color Palette" in line:
        in_palette = True
    elif "12 — Navigation" in line:
        in_palette = False
        
    if in_palette:
        line = line.replace('<div className="flex flex-col gap-4">', '<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-4">')
        line = line.replace('<div className="flex flex-col gap-4 sm:flex-row">', '<div className="grid grid-cols-2 sm:grid-cols-4 gap-4">')
        line = line.replace('className="flex-1 flex items-start gap-3 sm:flex-col sm:items-center sm:text-center"', 'className="flex items-start gap-3 sm:flex-col sm:items-center sm:text-center"')
        
        # We also need to replace the text rendering parts.
        line = line.replace('<span className="text-sm text-ink font-medium">{name}</span>', '<span className="text-sm text-ink font-medium leading-none mb-1">{name}</span>')
        line = line.replace('<span className="text-[10px] text-ink-light font-mono">{varName}</span>', '<span className="text-[10px] text-ink-light font-mono leading-none">{varName}</span>')
        line = line.replace('<span className="text-[10px] text-ink-light font-mono">{hex}</span>', '<span className="text-[10px] text-ink-light font-mono leading-none">{hex}</span>')

    new_lines.append(line)

with open('app/src/pages/StyleguidePage.tsx', 'w') as f:
    f.writelines(new_lines)
