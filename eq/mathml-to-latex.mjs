import {MathMLToLaTeX} from 'mathml-to-latex';
import fs from 'fs';

const strip = s => s.replace(/<[^>]+>/g,'').replace(/\s+/g,'').replace(/ /g,'');

function tidy(tex){
  let t = tex;
  // lim written as separate letters, plain or bold, becomes an operator
  t = t.replace(/(?:\\math(?:bf|it|rm)\{[lim]\}\s*){3}/g, '\\lim');
  t = t.replace(/(?<![\\a-zA-Z])l\s*i\s*m(?![a-zA-Z])/g, '\\lim');
  // underset/overset around lim is really \lim\limits
  t = t.replace(/\\underset\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}\{\\?lim\}/g, (_,u)=>`\\lim\\limits_{${u}}`);
  t = t.replace(/\\underset\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}\{\\lim\}/g, (_,u)=>`\\lim\\limits_{${u}}`);
  // leftover escapes and spacing artefacts
  t = t.replace(/\\&\\text\{nbsp\};/g,'\\ ').replace(/\\text\{nbsp\};?/g,'\\ ');
  t = t.replace(/\\rightarrow/g,'\\to');
  t = t.replace(/\^\{'\}/g,"'");
  t = t.replace(/(\d)\s+\.\s+(\d)/g,'$1.$2');
  t = t.replace(/\\mathbf\{\\mathit\{([^}]*)\}\}/g,'\\mathbf{$1}');
  t = t.replace(/\\begin\{matrix\}/g,'\\begin{array}{ll}').replace(/\\end\{matrix\}/g,'\\end{array}');
  t = t.replace(/\\right\\?$/,'\\right.');
  // \left( ... \right) inserts thin space, so f\left(x\right) renders as "f (x)".
  // Only worth it when the content is tall. Collapse the rest to plain parens.
  for (let i=0;i<6;i++){
    t = t.replace(/\\left\(((?:[^()\\]|\\(?!left|right|frac|sqrt|begin|end))*?)\\right\)/g, '($1)');
  }
  t = t.replace(/\(\s+/g,'(').replace(/\s+\)/g,')');
  t = t.replace(/([A-Za-z0-9}'])\s+\(/g, '$1(');
  return t.replace(/\s+/g,' ').trim();
}

const file=process.argv[2];
const html=fs.readFileSync(file,'utf8');
const blocks=[...html.matchAll(/<math\b[\s\S]*?<\/math>/g)].map(m=>m[0]);
let n=0, done=0, skipped=0, failed=[];
for (const b of blocks){
  n+=10;
  const tag=String(n).padStart(4,'0');
  if (/annotation encoding="latex"/.test(b)) { console.log(`${tag}  [already LaTeX, leave it]`); skipped++; continue; }
  const mml=b.replace(/<annotation\b[\s\S]*?<\/annotation>/g,'').replace(/<\/?semantics>/g,'');
  let tex;
  try { tex=tidy(MathMLToLaTeX.convert(mml)); } catch(e){ failed.push(tag); console.log(`${tag}  ** FAILED: ${e.message}`); continue; }
  console.log(`${tag}  \\(\\scriptsize ${tex}\\)`);
  // what the converter cannot carry, reported precisely
  const cols=[...mml.matchAll(/<(m[a-z]+)[^>]*mathcolor="([^"]+)"[^>]*>([\s\S]*?)<\/\1>/g)].map(x=>`${strip(x[3])||x[1]} -> ${x[2]}`);
  if (cols.length) console.log(`        colour: ${[...new Set(cols)].join(' , ')}`);
  done++;
}
console.error(`\n   ${done} converted, ${skipped} already LaTeX, ${failed.length} failed${failed.length?': '+failed.join(','):''}`);
