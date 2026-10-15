# Agensi.io marketplace listing — Illustrator MCP

Testo pronto per la pagina prodotto. Lingua: inglese (marketplace internazionale).

---

## Product title

**Illustrator MCP**

Alternative più descrittiva, se Agensi vuole un titolo più lungo in SERP interna:
**Illustrator MCP — Control a Real Illustrator Document**

---

## Tagline (one line)

**Give your AI assistant real control of an open Adobe Illustrator document, not another image generator.**

---

## Marketplace description (persuasive, honest)

Most "AI design" tools end the same way: you get a flattened picture and start over by hand. Illustrator MCP doesn't work like that. It connects Claude, ChatGPT, or Cursor directly to a copy of Adobe Illustrator that's actually open on your screen, through Illustrator's own scripting engine, and edits the real document: layers, artboards, live text, vector paths, all of it still yours to touch afterward.

Ask your assistant to create a document, drop in a few shapes, align them to an artboard, place and vectorize a client's raster logo, or export a clean transparent PNG, and it does exactly that inside your file. Nothing gets rasterized behind your back. Nothing shows up as a flat layer you have to rebuild. If you want to nudge, recolor, or retype something after the AI is done, you do it the same way you always have, because it's the same Illustrator document it's always been.

This is built for the parts of a design day that are mechanical, not creative: setting up ten variants of an artboard, aligning a grid of icons, batch-exporting assets at the right size, cleaning up a messy raster logo into real paths. It hands those off in plain English and gets back a file you can keep working in, instead of a render you have to import and retrace.

29 tools cover documents, artboards, layers, shapes, text, images, image vectorization (via the open-source VTracer engine or Illustrator's own Image Trace), transforms, alignment, color, selection, and export to PNG and PDF. For anything the built-in tools don't cover, an `illustrator_run_script` escape hatch runs arbitrary ExtendScript, so you're never boxed into a fixed tool list.

Runs locally on macOS or Windows, talking to your own copy of Illustrator. No files leave your machine. Open source, actively maintained, MIT licensed.

---

## What you can do (bullets with concrete examples)

- **Spin up a document in seconds.** "Create a 1080x1080 RGB document and add the title 'SALE' in bold orange" gives you a ready artboard with live, editable text, not a flattened mockup.
- **Vectorize a raster logo into real paths.** Hand it a client's blurry PNG logo and ask for a clean vector trace. It runs through VTracer (or Illustrator's Image Trace as a fallback) and hands back editable anchor points you can refine by hand.
- **Align and arrange a grid in one go.** "Draw six circles in two rows and center them on the artboard" turns a fiddly manual alignment job into one sentence.
- **Batch-create variants.** Ask for three color or copy variations of the same layout and get three real artboards, each still fully editable, instead of three static exports.
- **Export production-ready files.** "Export the current artboard as a 2x transparent PNG to my Desktop" or as a print-ready PDF, matched to how you'd already name and size your deliverables.
- **Go off-script when you need to.** The `run_script` tool executes any ExtendScript you (or your AI) write, for the one-off automation the 29 built-in tools don't cover.

---

## Pricing recommendation

**Recommended: $49 one-time.**

Reasoning: this sits in the middle tier on purpose, not the bottom. Illustrator MCP isn't a quick prompt template or a single-purpose macro, it's a 29-tool server with ongoing engineering behind it (two transport modes, two vectorization engines, active GitHub maintenance, cross-platform support for macOS and Windows). That's closer to a small developer tool than a lightweight skill, and $49 is the going one-time rate on marketplaces for things in that weight class.

Against a subscription: the tool's value doesn't compound monthly the way a data feed or an API-backed service does. Once installed, it runs locally against the user's own copy of Illustrator with no server cost on Gherardo's side, so there's no recurring delivery cost to justify a recurring charge. Design freelancers and in-house designers, the realistic buyer here, are used to paying once for a plugin or extension (Astute Graphics, Vectorscribe-style pricing) rather than adding another monthly line item for a tool they might use in bursts around specific projects.

Against the $99 top tier: $99 is a stretch for a tool whose target buyer is an individual designer or small studio, not an agency with a procurement budget. $49 is enough to signal "this is a real tool, not a toy prompt" while staying within what most freelance and in-house designers will buy on impulse after watching a 60-second demo.

If Agensi's data later shows meaningful interest from design agencies or studios buying multiple seats, a $29/month "pro" tier with priority support or early access to new tools (the roadmap already has an in-app chat panel and more workflow tools planned) could sit alongside the $49 one-time plan rather than replace it. But as a first listing, one-time at $49 is the right call: simpler to buy, simpler to justify, and matched to what the tool actually is.

---

## Notes / things to verify before publishing

- Agensi's exact pricing UI (whether they support a one-time price directly, or only subscription tiers) should be confirmed before locking in the $49 recommendation; if a one-time option isn't supported, the next-best translation is the low subscription tier ($19/month), not the high one.
- `[DA VERIFICARE: eventuale screenshot o demo GIF richiesti da Agensi per la pagina prodotto]` — non disponibile in questo passaggio, chiedere al collega che prepara `SKILL.md`/`reference/` se esiste già materiale visivo da riusare.
- Nessun numero di download, utenti o recensioni è stato inserito: il progetto è open source su GitHub senza metriche di adozione verificate, quindi non ne va inventata nessuna nel copy finale.
