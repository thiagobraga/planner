import re

with open('app/src/pages/StyleguidePage.tsx', 'r') as f:
    content = f.read()

# 1. Update Card component
content = re.sub(
    r'function Card\(\{\n\s*n,\n\s*title,',
    'function Card({\n  title,',
    content
)
content = re.sub(
    r'n: number;\n\s*title: string;',
    'title: string;',
    content
)
content = re.sub(
    r'<span className="text-ink-light">\{n\}\.</span> ',
    '',
    content
)

# 2. Remove n={X} from all <Card usages
content = re.sub(r'<Card n=\{\d+\} ', '<Card ', content)

# 3. Rename "Interface Typography" to "Typography"
content = content.replace('title="Interface Typography"', 'title="Typography"')

# 4. Rename "Fields & Controls" to "Forms"
content = content.replace('title="Fields & Controls"', 'title="Forms"')

# 5. Extract "Color Palette" card
color_palette_match = re.search(r'\{\/\* 11 — Color Palette \*\/\}\n\s*<Card title="Color Palette" span>.*?</Card>', content, re.DOTALL)
if color_palette_match:
    color_palette = color_palette_match.group(0)
    # Remove it from current position
    content = content.replace(color_palette, '')
    
    # Insert it before {/* 1 — Interface Typography */}
    # which is now {/* 1 — Interface Typography */} or similar
    typography_match = re.search(r'\{\/\* 1 — Interface Typography \*\/\}\n\s*<Card title="Typography" span>', content)
    if typography_match:
        content = content.replace(
            typography_match.group(0),
            color_palette + '\n\n        ' + typography_match.group(0)
        )
else:
    print("Color palette not found!")

# 6. Replace the native Select with CustomSelect inside Forms
# Find the Forms card contents
forms_match = re.search(r'<Field label="Select">.*?<Select defaultValue="">.*?</Select>\n\s*</Field>', content, re.DOTALL)
if forms_match:
    custom_select = """<Field label="Select">
                <CustomSelect
                  options={[
                    { value: '1', label: 'Select option' },
                    { value: '2', label: 'Another option' },
                  ]}
                  value="1"
                  onChange={setCustomSelectValue}
                />
              </Field>"""
    content = content.replace(forms_match.group(0), custom_select)

# 7. Remove CustomSelect card entirely since we moved it
custom_select_card_match = re.search(r'\{\/\* 12 — Custom Select \*\/\}\n\s*<Card title="Custom Select">.*?</Card>\n', content, re.DOTALL)
if custom_select_card_match:
    content = content.replace(custom_select_card_match.group(0), '')

with open('app/src/pages/StyleguidePage.tsx', 'w') as f:
    f.write(content)

print("Done")
