import re

with open('app/src/pages/StyleguidePage.tsx', 'r') as f:
    content = f.read()

old_code = """                  <CustomSelect
                    options={[
                      { value: '1', label: 'Select option' },
                      { value: '2', label: 'Another option' },
                    ]}
                    value={customSelectValue}
                    onChange={setCustomSelectValue}
                  />
                  <CustomSelect
                    options={[
                      { value: '1', label: 'Available option' },
                      { value: '2', label: 'Disabled option', disabled: true },
                    ]}
                    value="1"
                  />"""

new_code = """                  <CustomSelect
                    options={[
                      { value: '1', label: 'Another option' },
                      { value: '2', label: 'Available option' },
                      { value: '3', label: 'Disabled option', disabled: true },
                    ]}
                    value={customSelectValue}
                    onChange={setCustomSelectValue}
                  />"""

content = content.replace(old_code, new_code)

with open('app/src/pages/StyleguidePage.tsx', 'w') as f:
    f.write(content)

print("Merged selects in StyleguidePage")
