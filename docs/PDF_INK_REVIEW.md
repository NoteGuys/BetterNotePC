# PDF handwriting review — 2026-10-18

## Findings and limits

Reviewed the pen sampling/commit/preview path in CanvasBoard, inkingEngine and inkPreview, and the manual PDF, image export and background PDF backup renderers. The editor and SVG exporter use the same renderStroke routine. Pressure handwriting is drawn as individually stroked quadratic segments with round caps; the export does not deliberately simplify away handwriting points.

Read the supplied five-page PDF without modifying it. Its first page contains 22,399 stroke operations and 21,779 cubic curve operations. Its graphics states explicitly specify round caps and joins. PDF.js and Poppler render the supplied file without the severe cracks shown in the screenshots. Therefore the exact failing reader has not been reproduced: a reader-specific treatment of the short segment caps is a supported hypothesis, not a proven diagnosis for every screenshot.

## Implemented plan

1. Keep the original point coordinates, pressure formulas, taper, pen input, persistence and stroke commands.
2. On the native vector export path, add explicit filled endpoint disks to opaque hexadecimal-color handwriting segments. This makes their intended round endpoint area independent of PDF stroke-cap interpretation.
3. Coalesce coincident endpoints, retaining the larger radius where neighboring pressure segments meet. Flush at paint-order boundaries so caps cannot cover a later stroke/image/text incorrectly. Never connect separate erased fragments.
4. Encode each disk as four cubic quarters (radial approximation error below 0.028% of radius). SVG arc commands caused Chromium to produce many more PDF curves; the cubic representation reduced that overhead substantially.
5. Exclude translucent colors, highlighters and angular shapes. Leave the raster export/backup route on its existing renderer; no redundant cap geometry is needed there.
6. Validate native PDFs against Canvas pixels, simulate a reader using butt caps, run existing export and inking regressions, and inspect the exported page with a second PDF renderer.
7. Confirm the result in the user's originally affected PDF reader before considering the reader-specific report fully closed.

Production changes are limited to src/utils/svgCanvas.js and src/utils/exportDocument.js. Existing uncommitted Optimize work was preserved. No database schema, Backup/Restore logic, main branch, installer, commit or push was changed by this task.

## Validation

- tests/svg-canvas.test.js: 3 passing tests covering source/geometry preservation, endpoint deduplication, translucent markers/colors, shapes, dots, paint order and separated fragments.
- Existing PDF export/batch tests plus optimization-browser.test.cjs: 10 passing tests; the browser suite includes 24 inking comparisons and confirms the committed ink remains exact.
- tests/pdf-ink-fidelity.browser.cjs: actual Electron printToPDF, rasterized through PDF.js at 4x; tests fountain/ballpoint/brush pressure, taper, uniform widths, thin strokes, sharp turns, dots, two-point strokes, rectangle and overlapping highlighters. Source stroke JSON remains unchanged.
- Simulated degraded-cap rendering: 617 white pixels inside dark ink before, 0 after. This is a controlled regression, not a screenshot from the user's reader.
- Native PDF vs Canvas mean RGB error: 0.153 on a 0–255 scale over the entire test page (includes white background; this is not a percentage accuracy score). Zero detected white holes inside dark ink.
- Poppler visual inspection of the native PDF: smooth curves, no visible segment cracks; round/pointed ends, shapes and highlighter overlap retained.
- Final dense fixture: 22,000 points; preparation 209 ms, native print 1,044 ms, PDF 2,207,200 bytes on this machine. Synthetic measurements, not a Surface or classroom benchmark.
- Synthetic small PDF grew from 116,602 to 210,110 bytes (~80%). More vector geometry has a storage cost. The discarded initial implementation grew to 929,448 bytes. No claim that all real PDFs increase by this ratio.
- Native 91-page export passed: ordering, page dimensions, Thai text, ink color, progress and temporary-file cleanup. About 5.97 seconds in that synthetic run. Initially the QA command lacked its required asset-protocol flag; rerunning with BETTERNOTE_QA_HARDENED=1 passed.
- Production build passed. Existing font-resolution, mixed-import and chunk-size warnings remain.

Final fidelity artifacts: scratch/pdf-ink-review/fidelity-aZZqX9/
Logs: scratch/pdf-ink-review/fidelity-final.log, native-91.log, build.log.

## User acceptance check

Open the updated test app, export the original notebook again, and open the new PDF in the same reader that showed cracks. Compare 100%, 200% and 400% zoom: curved letters, arrow heads, pressure changes, thin strokes, dots, highlighter overlaps and erased gaps. Compare the current-page and entire-notebook exports. The old PDF does not change by itself; export from the original editable notebook, not by importing the already-exported PDF as a background.

The original affected PDF reader has not yet been identified. Physical Surface and that reader still require confirmation. The pre-existing .bnote auto-open bug is outside this task.

## Edge confirmation after identifying the affected reader

The user confirmed Microsoft Edge. Opened the old and new native PDFs in a separate Edge QA profile (Edge 154.0.4258.53, built-in PDF viewer showing Powered by Adobe Acrobat). The legacy synthetic PDF visibly reproduced the radial/segment cracks from the report; the corrected PDF removed those visible segment cracks. The supplied five-page PDF also visibly reproduced segment seams in Edge. This supplies the reader-specific reproduction missing from the initial investigation above.

Evidence: scratch/pdf-ink-review/edge-compare-4VHP6q/legacy.png, fixed.png and supplied.png. No production code changed during this confirmation. The user should still re-export the actual editable notebook and check the new output in their installed Edge version; the supplied already-exported PDF was not modified.
