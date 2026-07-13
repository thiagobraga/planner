import re

with open('app/src/index.css', 'r') as f:
    content = f.read()

# We need to wrap the resets in @layer base
# Let's find the `body {` and wrap everything from there down to `/* Focus indicators` (exclusive) or just specific tags in @layer base

reset_block = """body {
  background-color: var(--color-cream);
  font-family: "Lora", serif;
  font-size: 14px;
  line-height: var(--dot-grid);
  color: var(--color-ink);
  margin: 0;
  padding: 0;
}

h1, h2, h3, h4, h5, h6, p, ul, ol, li, dl, dt, dd, blockquote, figure, figcaption, pre, code, form, input, button, select, textarea {
  margin: 0;
  padding: 0;
  line-height: var(--dot-grid);
}"""

layered_reset = """@layer base {
  body {
    background-color: var(--color-cream);
    font-family: "Lora", serif;
    font-size: 14px;
    line-height: var(--dot-grid);
    color: var(--color-ink);
    margin: 0;
    padding: 0;
  }

  h1, h2, h3, h4, h5, h6, p, ul, ol, li, dl, dt, dd, blockquote, figure, figcaption, pre, code, form, input, button, select, textarea {
    margin: 0;
    padding: 0;
    line-height: var(--dot-grid);
  }
}"""

content = content.replace(reset_block, layered_reset)

with open('app/src/index.css', 'w') as f:
    f.write(content)

print("Wrapped resets in @layer base")
