import re

with open('app/src/components/ui/CustomSelect.tsx', 'r') as f:
    content = f.read()

old_input = """        <input
          type="text"
          readOnly
          tabIndex={-1}
          className={`flex-1 p-0 min-w-0 bg-transparent border-0 outline-none text-sm cursor-pointer ${selectedOption ? 'text-ink' : 'text-ink-light opacity-50'}`}
          value={selectedOption ? selectedOption.label : ''}
          placeholder={placeholder}
        />"""

new_span = """        <span
          className={`flex-1 min-w-0 text-left truncate text-sm ${selectedOption ? 'text-ink' : 'text-ink-light opacity-50'}`}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </span>"""

content = content.replace(old_input, new_span)

with open('app/src/components/ui/CustomSelect.tsx', 'w') as f:
    f.write(content)

print("Reverted CustomSelect trigger to span")
