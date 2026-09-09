import { liteAdaptor, type LiteAdaptor } from "mathjax-full/js/adaptors/liteAdaptor.js";
import { RegisterHTMLHandler } from "mathjax-full/js/handlers/html.js";
import { TeX } from "mathjax-full/js/input/tex.js";
import { AllPackages } from "mathjax-full/js/input/tex/AllPackages.js";
import { mathjax } from "mathjax-full/js/mathjax.js";
import { SVG } from "mathjax-full/js/output/svg.js";
import type { MathDocument } from "mathjax-full/js/core/MathDocument.js";

let adaptor: LiteAdaptor | null = null;
let document: MathDocument<unknown, unknown, unknown> | null = null;

/**
 * Obsidian ships only MathJax's CommonHTML output, so producing real vector SVG means running a
 * second, SVG-only MathJax. It is bundled as a module rather than loaded as a script so it never
 * touches the global `MathJax` that Obsidian's own rendering depends on.
 */
function ensureDocument(): { adaptor: LiteAdaptor; document: MathDocument<unknown, unknown, unknown> } {
  if (!adaptor || !document) {
    adaptor = liteAdaptor();
    RegisterHTMLHandler(adaptor);
    document = mathjax.document("", {
      InputJax: new TeX({ packages: AllPackages }),
      // "local" keeps every glyph inside this one <svg>; the default "global" points at a
      // page-wide cache that would not survive being copied out.
      OutputJax: new SVG({ fontCache: "local" }),
    });
  }
  return { adaptor, document };
}

export function texToSvg(tex: string, display: boolean): string {
  const { adaptor: a, document: d } = ensureDocument();
  const container = d.convert(tex, { display });
  const svg = a.firstChild(container as never);
  if (!svg) throw new Error("MathJax ไม่ได้คืน SVG");
  // `vertical-align` only makes sense for math sitting on a text baseline; in a standalone file
  // it is dead weight that Inkscape warns about.
  const markup = a.outerHTML(svg as never).replace(/vertical-align:\s*[^;"]+;?/u, "");
  return `<?xml version="1.0" encoding="UTF-8"?>\n${markup}`;
}
