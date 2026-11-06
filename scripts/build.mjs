import { readFile, writeFile, mkdir } from 'node:fs/promises';

// DSW values are submitted to the official Theme service. Our CSS owns only
// --lg-* material values and gated surface rules, not the Host's inline tokens.
export function compileTheme(source) {
  const modes = { light: {}, dark: {} };
  const css = source.replace(/body\[data-dsh-liquid-glass\](\[data-ds-dark-theme\])? \{([^}]+)\}/g, (block, dark, declarations) => {
    const cleaned = declarations.replace(/^[ \t]*(--dsw-[\w-]+):\s*([^;\n]+);\n?/gm, (_, name, value) => {
      modes[dark ? 'dark' : 'light'][name] = value.trim();
      return '';
    });
    return `body[data-dsh-liquid-glass]${dark || ''} {${cleaned}}`;
  });
  const tokens = {};
  for (const [name, light] of Object.entries(modes.light)) tokens[name] = { light, dark: modes.dark[name] ?? light };
  for (const name of Object.keys(modes.dark)) if (!tokens[name]) throw new Error(`Missing light value for ${name}`);
  return { css, tokens };
}

export async function build() {
  const assets = compileTheme(await readFile('src/theme.css', 'utf8'));
  assets.controlsCss = await readFile('src/controls.css', 'utf8');
  const sources = await Promise.all(['preferences', 'adapters', 'runtime', 'client'].map(name => readFile(`src/${name}.js`, 'utf8')));
  const code = sources.map(source => source.replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '')).join('\n');
  const manifest = JSON.parse(await readFile('package.json', 'utf8'));
  const bundle = `/* dsh-liquid-glass ${manifest.version} | MIT | uses DSH shared React and UI primitives */\nwindow.__ModuleLoader__.load({\n  id: 'dsh-liquid-glass',\n  factory(require) {\n'use strict';\n${code}\nreturn createClientPlugin(require('react'), require('@deepseek-ai/dsh-client-ui-primitives'), ${JSON.stringify(assets)});\n  }\n});\n`;
  await mkdir('dist', { recursive: true });
  await writeFile('dist/client.js', bundle);
  console.log(`Built dist/client.js (${Buffer.byteLength(bundle)} bytes; ${Object.keys(assets.tokens).length} native theme tokens)`);
  return assets;
}
if (process.argv[1] && new URL(import.meta.url).pathname.endsWith(process.argv[1].replaceAll('\\', '/').split('/').pop())) await build();
