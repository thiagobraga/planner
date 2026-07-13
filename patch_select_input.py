import re

with open('app/src/components/ui/CustomSelect.tsx', 'r') as f:
    content = f.read()

# Replace the span with an input readonly
old_span = """        <span className={selectedOption ? 'text-ink' : 'text-ink-light opacity-50'}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>"""

new_input = """        <input
          type="text"
          readOnly
          tabIndex={-1}
          className={`flex-1 min-w-0 bg-transparent border-0 outline-none text-sm cursor-pointer ${selectedOption ? 'text-ink' : 'text-ink-light opacity-50'}`}
          value={selectedOption ? selectedOption.label : ''}
          placeholder={placeholder}
        />"""

content = content.replace(old_span, new_input)

# Also update the gap of the button to be gap-2 to mimic the input wrapper if necessary
# Wait, input wrapper has gap-2 but button has justify-between. justify-between naturally pushes them apart.
# If input has flex-1, justify-between might behave weirdly. 
# Let's change button classes:
old_button_classes = """    flex items-center justify-between w-full h-10 px-3
    text-sm text-left bg-cream border rounded-[8px]"""

new_button_classes = """    flex items-center gap-2 w-full h-10 px-3
    text-sm text-left bg-cream border rounded-[8px]"""

content = content.replace(old_button_classes, new_button_classes)

with open('app/src/components/ui/CustomSelect.tsx', 'w') as f:
    f.write(content)

print("Patched CustomSelect to use input readOnly")
