from pathlib import Path
import argparse, json, os, struct

parser = argparse.ArgumentParser(description='Extract local DSH resources for optional SDK compatibility tests.')
parser.add_argument('destination', nargs='?', help='Extraction directory; omit to list entries.')
local_app_data = Path(os.environ.get('LOCALAPPDATA', Path.home() / 'AppData' / 'Local'))
parser.add_argument('--archive', type=Path, default=local_app_data / 'Programs' / 'DeepSeek Harness' / 'resources' / 'app.asar', help='Path to the installed DSH app.asar.')
args = parser.parse_args()
archive = args.archive
with archive.open('rb') as source:
    prefix = source.read(16)
    _, header_size, _, json_size = struct.unpack('<4I', prefix)
    header = json.loads(source.read(json_size))
    entries = []
    def walk(node, prefix=''):
        for name, item in node.get('files', {}).items():
            path = prefix + name
            if 'files' in item:
                walk(item, path + '/')
            else:
                entries.append((path, item))
    walk(header)
    if args.destination is None:
        for path, item in entries:
            if path.startswith('dsh/') and ('node_modules/' not in path or path.endswith('/@playwright/test/package.json') or path.endswith('/playwright-core/package.json')):
                print(path, item.get('size', 0))
    else:
        destination = Path(args.destination).resolve()
        count = 0
        for path, item in entries:
            if not path.startswith('dsh/') or ('/node_modules/' in path and not path.startswith('dsh/node_modules/@deepseek-ai/')):
                continue
            if item.get('unpacked') or 'offset' not in item:
                continue
            target = (destination / path[4:]).resolve()
            if not target.is_relative_to(destination):
                raise ValueError(f'Archive entry escapes destination: {path}')
            target.parent.mkdir(parents=True, exist_ok=True)
            source.seek(8 + header_size + int(item['offset']))
            target.write_bytes(source.read(item['size']))
            count += 1
        print(f'Extracted {count} DSH inspection files to {destination}')
