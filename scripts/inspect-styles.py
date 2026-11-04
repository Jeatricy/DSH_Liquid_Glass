from pathlib import Path
import json, re
root = Path('.cache/dsh/node_modules/@deepseek-ai')
out = Path('.cache/styles')
out.mkdir(parents=True, exist_ok=True)
for package in root.iterdir():
    client = package / 'lib/client.js'
    if not client.exists():
        continue
    text = client.read_text(encoding='utf-8')
    styles = []
    for match in re.finditer(r'(?:const css(?:\$\d+)?|var [\w$]+_css_default) = ("(?:[^"\\]|\\.)*");', text):
        css = json.loads(match[1])
        styles.append(css.replace('}', '}\n').replace(';', ';\n'))
    if styles:
        (out / (package.name + '.css')).write_text('\n'.join(styles), encoding='utf-8')
print('Extracted readable CSS from official client modules')
