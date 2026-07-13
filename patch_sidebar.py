import re

# Patch SidebarNavItem.tsx
with open('app/src/components/SidebarNavItem.tsx', 'r') as f:
    content = f.read()

# Replace <button ...> with <a href="#" ... onClick={(e) => { e.preventDefault(); onClick(); }}>
button_pattern = r'<button\n\s*type="button"\n\s*onClick=\{onClick\}\n\s*className=\{`([^`]+)`\}\n\s*>\n\s*\{content\}\n\s*</button>'
replacement = r'<a\n      href="#"\n      role="button"\n      onClick={(e) => {\n        e.preventDefault();\n        onClick();\n      }}\n      className={`\1`}\n    >\n      {content}\n    </a>'

content = re.sub(button_pattern, replacement, content)

with open('app/src/components/SidebarNavItem.tsx', 'w') as f:
    f.write(content)

# Patch Sidebar.tsx
with open('app/src/components/Sidebar.tsx', 'r') as f:
    content = f.read()

# Replace Help button
help_button = r'<button\n\s*type="button"\n\s*onClick=\{onOpenHelp\}\n\s*title="Help"\n\s*className="sidebar-icon-link"\n\s*>\n\s*<HelpCircle size=\{16\} strokeWidth=\{1\.5\} />\n\s*</button>'
help_replacement = r'<a\n            href="#"\n            role="button"\n            onClick={(e) => {\n              e.preventDefault();\n              onOpenHelp?.();\n            }}\n            title="Help"\n            className="sidebar-icon-link"\n          >\n            <HelpCircle size={16} strokeWidth={1.5} />\n          </a>'
content = re.sub(help_button, help_replacement, content)

# Replace Logout button
logout_button = r'<button\n\s*type="button"\n\s*onClick=\{handleLogout\}\n\s*title="Logout"\n\s*className="sidebar-icon-link"\n\s*>\n\s*<LogOut size=\{16\} strokeWidth=\{1\.5\} />\n\s*</button>'
logout_replacement = r'<a\n            href="#"\n            role="button"\n            onClick={(e) => {\n              e.preventDefault();\n              handleLogout();\n            }}\n            title="Logout"\n            className="sidebar-icon-link"\n          >\n            <LogOut size={16} strokeWidth={1.5} />\n          </a>'
content = re.sub(logout_button, logout_replacement, content)

with open('app/src/components/Sidebar.tsx', 'w') as f:
    f.write(content)

print("Patched Sidebar and SidebarNavItem")
