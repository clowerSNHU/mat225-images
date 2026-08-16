import {mathjax} from 'mathjax-full/js/mathjax.js';
import {MathML} from 'mathjax-full/js/input/mathml.js';
import {SVG} from 'mathjax-full/js/output/svg.js';
import {liteAdaptor} from 'mathjax-full/js/adaptors/liteAdaptor.js';
import {RegisterHTMLHandler} from 'mathjax-full/js/handlers/html.js';
import sharp from 'sharp';
import fs from 'fs'; import path from 'path';

const adaptor = liteAdaptor(); RegisterHTMLHandler(adaptor);
const doc = mathjax.document('', {InputJax:new MathML(), OutputJax:new SVG({fontCache:'local'})});

const [file, slug, outdir, start] = process.argv.slice(2);
fs.mkdirSync(outdir, {recursive:true});
let html = fs.readFileSync(file,'utf8');

// Match with positions, never by string value. Identical equations appear more
// than once in some files, and a value-based replace re-wraps the first one and
// nests the wrappers. Rebuild the document left to right instead.
const matches = [...html.matchAll(/<math\b[\s\S]*?<\/math>/g)];
const blocks = matches.map(m => m[0]);
const index = [];
const out = [];
let cursor = 0;
let n = Number(start||0);

for (const m of matches) {
  const block = m[0];
  n += 10;
  const name = `${slug}-${String(n).padStart(3,'0')}.png`;
  // Brightspace renders LaTeX-sourced MathML larger than wiris, so the author
  // writes \scriptsize to bring it back to normal. That lands here as
  // mathsize="0.7em" (or similar em value). MathJax has no such inflation, so
  // honoring it literally makes the image ~30% smaller than the wiris ones.
  // Normalize any em-relative mathsize to the 15px the wiris equations use, so
  // both encodings render at one size. Explicit px sizes are left alone.
  const mml = block
    .replace(/<annotation\b[\s\S]*?<\/annotation>/g,'')
    .replace(/mathsize="[\d.]+em"/g, 'mathsize="15px"');
  const display = /display="block"/.test(block);
  const node = doc.convert(mml, {display, em:16.8, ex:7.8, containerWidth:1000});
  let svg = adaptor.innerHTML(node);
  const w = (svg.match(/width="([\d.]+)ex"/)||[])[1];
  const h = (svg.match(/height="([\d.]+)ex"/)||[])[1];
  const va = (svg.match(/vertical-align:\s*(-?[\d.]+)ex/)||[])[1] || '0';
  svg = svg.replace(/<svg /, '<svg color="#1d1c18" ');
  await sharp(Buffer.from(svg), {density: 72*5})
    .flatten({background:'#ffffff'})
    .extend({top:4,bottom:4,left:6,right:6,background:'#ffffff'})
    .png().toFile(path.join(outdir,name));
  const meta = await sharp(path.join(outdir,name)).metadata();

  const url = `https://cdn.jsdelivr.net/gh/clowerSNHU/mat225-images/eq/${name}`;
  const style = display
    ? `display: block; margin: 12px auto; height: ${(h/2).toFixed(3)}em; max-width: 100%;`
    : `height: ${(h/2).toFixed(3)}em; vertical-align: ${(va/2).toFixed(3)}em; max-width: 100%;`;
  const wrapper =
    `<span class="math-container">${block}<span style="position: absolute; left: -9999px; top: auto;">` +
    `<img src="${url}" alt="EQUATION_ALT_${n}" style="${style}"></span></span>`;
  out.push(html.slice(cursor, m.index), wrapper);
  cursor = m.index + block.length;
  const latex = (block.match(/annotation encoding="latex"[^>]*>\{"version":"1.1","math":"([\s\S]*?)"\}<\/annotation>/)||[])[1] || '(wiris)';
  index.push(`| \`${name}\` | ${display?'block':'inline'} | ${meta.width}x${meta.height} | \`${latex.replace(/\|/g,'\\|')}\` |`);
}
out.push(html.slice(cursor));
const result = out.join('');

// Guard: the only difference from the source must be the inserted wrappers.
const stripped = result
  .replace(/<span class="math-container">/g,'')
  .replace(/<span style="position: absolute; left: -9999px; top: auto;"><img [^>]*><\/span><\/span>/g,'');
if (stripped !== html) { console.error('ABORT: output differs from source beyond the wrapper'); process.exit(1); }
if (/<span class="math-container">(?:(?!<\/math>)[\s\S])*<span class="math-container">/.test(result)) {
  console.error('ABORT: nested wrapper detected'); process.exit(1);
}

fs.writeFileSync(file.replace(/\.html$/,'.IMG.html'), result);
fs.writeFileSync(path.join(outdir,`INDEX-${slug}.md`),
  `| File | Mode | PNG px | Source |\n|---|---|---|---|\n${index.join('\n')}\n`);
console.log(`${blocks.length} equations rendered for ${slug}`);
