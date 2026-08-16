import {mathjax} from 'mathjax-full/js/mathjax.js';
import {MathML} from 'mathjax-full/js/input/mathml.js';
import {SVG} from 'mathjax-full/js/output/svg.js';
import {liteAdaptor} from 'mathjax-full/js/adaptors/liteAdaptor.js';
import {RegisterHTMLHandler} from 'mathjax-full/js/handlers/html.js';
import sharp from 'sharp';
import fs from 'fs'; import path from 'path';

const adaptor = liteAdaptor(); RegisterHTMLHandler(adaptor);
const doc = mathjax.document('', {InputJax:new MathML(), OutputJax:new SVG({fontCache:'local'})});

const [file, slug, outdir] = process.argv.slice(2);
fs.mkdirSync(outdir, {recursive:true});
let html = fs.readFileSync(file,'utf8');

const blocks = [...html.matchAll(/<math\b[\s\S]*?<\/math>/g)].map(m=>m[0]);
const index = [];
let n = 0;

for (const block of blocks) {
  n += 10;
  const name = `${slug}-${String(n).padStart(3,'0')}.png`;
  const mml = block.replace(/<annotation\b[\s\S]*?<\/annotation>/g,'');
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
  html = html.replace(block, wrapper);
  const latex = (block.match(/annotation encoding="latex"[^>]*>\{"version":"1.1","math":"([\s\S]*?)"\}<\/annotation>/)||[])[1] || '(wiris)';
  index.push(`| \`${name}\` | ${display?'block':'inline'} | ${meta.width}x${meta.height} | \`${latex.replace(/\|/g,'\\|')}\` |`);
}
fs.writeFileSync(file.replace(/\.html$/,'.IMG.html'), html);
fs.writeFileSync(path.join(outdir,`INDEX-${slug}.md`),
  `| File | Mode | PNG px | Source |\n|---|---|---|---|\n${index.join('\n')}\n`);
console.log(`${blocks.length} equations rendered for ${slug}`);
