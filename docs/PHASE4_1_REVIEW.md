# เฟส 4.1 — รับรอยเขียนครบและรวมการวาดตามรอบหน้าจอ

วันที่: 8 ตุลาคม 2026
ฐานก่อนแก้: a5bf3a6 บน sol-work
สถานะ: ทำและทดสอบเสร็จ รอผู้ใช้ตรวจปากกาจริงก่อนเฟส 4.2; ยังไม่ commit/push

## สิ่งที่แก้

- แก้ทางรับจุดปากกา/ไฮไลต์ให้ใช้ native PointerEvent ภายใน React เพื่อรับจุดย่อยที่ digitizer ส่งมาครบตามลำดับ รวม parent endpoint ด้วย รองรับรายการว่าง ไม่มี API และ API ใช้งานไม่ได้
- ใช้ทางอ่าน samples เดียวกันกับการยกเลิกเมนูกดค้างเมื่อขยับ โดยคงเวลาหน่วงและเกณฑ์ระยะเดิม
- เก็บจุดลงหน่วยความจำทันที แยกจากการวาดภาพ ตัวอย่างเส้นระหว่างเคลื่อนที่วาดไม่เกินหนึ่งครั้งต่อ requestAnimationFrame และอ่านขอบเขต Canvas เพียงครั้งต่อชุดจุด
- ตัดเฉพาะจุดติดกันที่พิกัดและแรงกดเหมือนกันทั้งหมด เก็บการเปลี่ยนแรงกดแม้ปากกาอยู่ตำแหน่งเดิม
- เก็บปลายเส้นที่มาพร้อม pointer-up ก่อนส่งเข้าทางเซฟเดิม หากแรงกดตอนปล่อยเป็นศูนย์ใช้แรงกดสัมผัสล่าสุด เพื่อไม่สร้างจุดหนา 0.5 เทียมขึ้นมา ไม่เติมพิกัด pointer-cancel ที่อาจไม่มีความหมาย
- ยกเลิกรอบวาดที่ค้างเมื่อจบเส้น เริ่มเส้นใหม่ เปลี่ยนหน้า/เครื่องมือ/ขนาดหน้า หรือ unmount และเมื่อ QuickShape รับช่วงแสดงรูปทรง ป้องกันภาพวาดล่าช้าทับภาพใหม่
- คง renderer ปากกาเดิม หัวปากกา แรงกด และการเรียวเส้น ไม่เปลี่ยนรูปแบบข้อมูล การเซฟ Undo/Redo ระบบสำรอง หรือการเชื่อม Drive

ไฟล์ runtime ที่แก้มีเพียง src/components/Editor/CanvasBoard.jsx

## หลักฐานก่อนและหลัง

ทดสอบด้วย React CanvasBoard จริงบน file:// บล็อก HTTP(S) ใช้โปรไฟล์แยกและ PointerEvent จำลอง 20 เหตุการณ์ เหตุการณ์ละ 100 จุดย่อย พร้อมเริ่มและจบเส้น

| รายการ | ก่อนแก้ | หลังแก้ |
| --- | ---: | ---: |
| จุดที่ถูกบันทึก | 21 | 2,002 |
| รอบวาดช่วง pointer-move ภายในหนึ่งรอบหน้าจอที่ควบคุมไว้ | 20 | 1 |

ฐานเดิมพลาดจุดย่อย จึงไม่ใช้เวลาวาดก่อนและหลังมาอ้างความเร็วเป็นจำนวนเท่า เพราะจำนวนจุดที่ประมวลผลต่างกัน การรวมรอบวาดไม่ลดจำนวนจุดของรอยเขียน

- ฐานก่อนแก้: QA/betternote-ink-input-A0Rcei/results.json
- หลังแก้ browser: QA/betternote-ink-input-4RKk1d/results.json และ ink.png
- หลังแก้ Electron: QA/betternote-ink-input-EWprcA/results.json
- Migration หลังแก้: QA/betternote-migration-oe2CIw/results.json

QA = [local QA path]

## ผลตรวจ

| ชุด | ผ่าน |
| --- | ---: |
| ปากกา/ไฮไลต์ React CanvasBoard บน browser, DPR 2 | 19 |
| กรณีปากกาเดียวกันบน Electron จริง, DPR 2 | 19 |
| เซฟ/Undo/Redo/เพิ่มลบหน้า/แท็บ/ภาษา/ภาพย่อ ผ่าน editor จริง | 108 |
| คิวเซฟ ประวัติ และคิวภาพย่อ unit tests | 53 |
| ย้ายข้อมูล editor/ปิดเปิดโปรไฟล์/สำรองกู้คืนออฟไลน์ระหว่าง 3 โปรไฟล์ | 17 |

ตรวจพิกเซล active preview เทียบ static committed layer แล้วตรงทุกพิกเซลทั้งปากกาและไฮไลต์ใน fixture ที่ทดสอบ ตรวจเก็บจุดตอนยกปากกา แรงกด ยกเลิก รอบวาดที่ยังไม่ทำงาน QuickShape การซูม การแตะนิ้ว และการคืนทรัพยากรผ่าน

เพิ่ม assertion ในกรณี pen ของ local-persistence เดิม: ตรวจพิกัดและแรงกด 5 จุดใน IndexedDB, Undo หนึ่งครั้งลบเส้นเดียว, Redo ได้ข้อมูลเดิมครบ และเปิด editor ใหม่ยังเก็บข้อมูลครบ

Production build ผ่าน 2,140 modules และ git diff --check ผ่าน มีคำเตือนเดิมว่า main bundle ใหญ่กว่าเกณฑ์ 500 kB และ autoBackupService ถูก import ทั้ง static/dynamic จึงยังไม่แยกเป็น chunk ตาม dynamic import ไม่มี build error

Electron harness ซ่อนหน้าต่าง จึงตรวจพิกเซลผ่าน Canvas โดยตรง บันทึก screenshot เฉพาะ browser; การ capture หน้าต่าง Electron ที่ซ่อนเคย timeout ในตัวทดสอบและแก้ไม่ให้เรียก capture นั้นแล้ว ไม่แก้ runtime เพื่อรองรับตัวทดสอบ

## ขอบเขตและสิ่งที่ยังต้องตรวจ

- ทุกกรณีใช้ข้อมูลจำลอง ไม่เปิดโปรไฟล์ BetterNote ที่ติดตั้งจริง ไม่อ่าน credentials และไม่เขียน Drive จริง
- Migration ในชุด browser มี Playwright binding สำหรับส่งข้อมูล จึงไม่ใช้ heartbeat ของชุดนี้อ้างความเร็ว native IPC ของแอป
- ยังต้องให้ผู้ใช้ลองปากกาจริง: เขียนเร็ว วงกลม จุดสั้น เส้นยาว ไฮไลต์ ซูม และ Undo/Redo ตรวจปลายเส้นและความรู้สึกของแรงกด
- เฟส 4.2 ยังไม่เริ่ม: รวบทางจบ/ขัดจังหวะการเขียน คืน pen/mouse lock และตรวจ pointer ownership รวม blur/lost capture
- เฟส 4.3 ตรวจรูปทรง และ 4.4 ตรวจท่าทาง/เลื่อน/สลับหน้า ยังต้องทำต่อหลังผู้ใช้ตรวจแต่ละช่วง
- ยังไม่เปลี่ยน whole-notebook loading, thumbnails virtualization หรือ Canvas memory budget ซึ่งอยู่เฟส 5 เส้นยาวมากยังใช้ renderer เดิมวาดทั้งเส้นครั้งละเฟรม จึงไม่รับรองเวลาเฟรมบนทุกเครื่อง

## รันซ้ำ

ตั้ง NODE_DISABLE_COMPILE_CACHE=1, BETTERNOTE_QA_TEMP เป็นโฟลเดอร์ QA แยก, BETTERNOTE_PLAYWRIGHT_PATH เป็น runtime ที่มีอยู่ และ BETTERNOTE_QA_BROWSER เป็น Edge

- node tests/ink-input.browser.cjs
- BETTERNOTE_QA_INK_ELECTRON=1 สำหรับกรณีเดิมบน Electron
- npm run build แล้วตั้ง BETTERNOTE_QA_BUILT_WORKER=1
- node tests/local-persistence.browser.cjs
- node tests/backup-migration.browser.cjs
- node --test tests/notebook-history.test.js tests/local-save.test.js tests/notebook-cover.test.js

ไม่ตั้ง BETTERNOTE_QA_DRIVE_PARENT ในการตรวจรอบนี้

## ไฟล์สำหรับเซฟ Git

- src/components/Editor/CanvasBoard.jsx
- tests/ink-input.browser.cjs
- tests/local-persistence.browser.cjs
- docs/PHASE4_1_REVIEW.md
- docs/SAFETY_PHASES.md

ไม่รวม core-js-banners และ node-compile-cache/ ที่มีอยู่ก่อนเริ่ม


## เพิ่มเติมตามคำขอ UI สีและไฮไลต์ (8 ตุลาคม 2026)

ขอบเขตเพิ่มเติมเฉพาะปุ่มสีใน toolbar/Lasso และไฮไลต์ ไม่เริ่มเฟส 4.2

- ปุ่มสีใหม่ใช้วงกลมสีรุ้ง 32px และ native color input กดได้เต็มวง ปรับระยะเฉพาะกลุ่มสีให้ไม่เบียดพื้นที่ปุ่มเดิม
- แตะไฮไลต์เพื่อเลือกเครื่องมือ แตะซ้ำเปิดตั้งค่าหัวกลม/หัวเหลี่ยม จำค่าผ่าน preferences เดิม แต่ละรอยเก็บ highlighterTip ของตัวเอง
- ลากไฮไลต์ใกล้เส้นตรงแล้วพักปลาย 380ms เพื่อแปลงเป็นเส้นตรง สามารถลากปรับปลายต่อได้ ไม่เรียกตัวจำแนกวงกลม/รูปหลายเหลี่ยม
- คงความโปร่งใส multiply และความกว้างไฮไลต์เดิม ใช้ renderer ร่วมสำหรับหน้า editor ภาพย่อ และ PDF การเปลี่ยนค่าหัวไม่เปลี่ยนรอยเก่า
- ข้อความใหม่รองรับ en/th/zh/ru; การเปลี่ยนสี Lasso คงหัวของรอยที่เลือกและใช้ Undo/Redo เดิม

ไฟล์ runtime เพิ่มเติมในคำขอนี้: ColorWheelPicker.jsx, EditorToolbar.jsx, NoteEditor.jsx, CanvasBoard.jsx, index.css, userPreferences.js, i18n.js, inkingEngine.js โดยไม่มีการเปลี่ยนระบบบัญชี/Drive/การกู้คืน

ผลตรวจหลังคำขอเพิ่มเติม:
- ink-input browser 31 ผ่าน; Electron 31 ผ่าน (รวมปลายหัว พิกเซล preview เทียบ committed, hold เป็นเส้น และไม่แปลงรูปอื่น)
- local-persistence รวม UI สี/ไฮไลต์ 115 ผ่าน; renderer errors 0
- highlighter UI เฉพาะ 7 ผ่าน รวมปุ่มสี 32px สองจุด การจำค่า บันทึก เปิดใหม่ Recolor Undo/Redo และสี่ภาษา
- unit เซฟ/ประวัติ/ภาพย่อ 53 ผ่าน
- backup-preparation 8 ผ่าน โดย fixture รวมไฮไลต์หัวกลมและหัวเหลี่ยม ตรวจ snapshot และ PDF worker
- เทียบ renderer กับฐาน Git a5bf3a6: 15 กรณีของปากกาสามหัว/ไฮไลต์เก่า/ยางลบ ภาพตรงทุกพิกเซล
- build ผ่าน 2,141 modules; warnings bundle/static-dynamic import เดิม
- ระหว่างพัฒนาพบปุ่มสีใหม่เบียดจุดกดชื่อสมุดใน harness จึงแก้ระยะเฉพาะกลุ่มสีแล้ว ทดสอบชื่อสมุดและชุดเดิมผ่าน

หลักฐานใหม่ใน QA:
- betternote-ink-input-QKAlIM/results.json (browser)
- betternote-ink-input-67OwmJ/results.json (Electron)
- betternote-backup-preparation-VrdpGA/results.json
- betternote-legacy-ink-comparison.json
- betternote-highlighter-tips.png และ betternote-lasso-rainbow.png

การทดสอบยังใช้ข้อมูลและ pointer จำลอง ต้องให้ผู้ใช้ลองความรู้สึกของปากกาจริง ยังไม่ commit/push

ไฟล์เซฟ Git เพิ่มเติมจากรายการเดิม:
- src/components/Common/ColorWheelPicker.jsx
- src/components/Editor/EditorToolbar.jsx
- src/components/Editor/NoteEditor.jsx
- src/index.css
- src/services/i18n.js
- src/services/userPreferences.js
- src/utils/inkingEngine.js
- tests/highlighter-ui.browser.cjs
- tests/backup-preparation.browser.cjs

## ปรับจานสีตามคำขอเพิ่มเติม

- ขนาดวงล้อล่าสุดเป็น 24px แทน 32px ทั้ง toolbar และ Recolor
- ทั้งสองจุดใช้ชุดสีที่บันทึกไว้ชุดเดียวกัน 5 ช่อง อ่านข้อมูลเดิมจาก betternote_quick_color_slots ไม่เปลี่ยน key หรือรีเซ็ตสีผู้ใช้
- เลือกสีใหม่จากจุดใดจะปรับช่องสีร่วมทันที เลือก preset ใน Recolor เปลี่ยนเฉพาะรอยที่เลือกและทำให้สีที่ใช้งานตรงกับ toolbar; Undo/Redo ของรอยไม่ย้อนค่าจานสี
- กำหนดขนาดปุ่มสี Recolor เป็น 20px ชัดเจนและปรับจุดยึด popover ให้สีซ้ายไม่ถูกตัดในกรณีทดสอบ
- Runtime ที่แก้ในคำขอเพิ่มเติมนี้: EditorToolbar.jsx, NoteEditor.jsx, CanvasBoard.jsx, userPreferences.js และ index.css; ไม่เปลี่ยน renderer หัวไฮไลต์ ระบบสำรอง หรือฟังก์ชันอื่น
- ชุดเฉพาะ UI สี/ไฮไลต์ 8 ผ่าน; ชุด local-persistence รวม 116 ผ่าน ไม่มี renderer errors; build และ git diff --check ผ่าน
- ยังไม่ commit/push รอคำอนุมัติเซฟ Git เดิม
