# แผนตรวจโค้ดและค้นหาบั๊ก sol-prework

วันที่ 18 ตุลาคม 2026 — แผนงาน ยังไม่ใช่ผลรับรองการทดสอบรอบใหม่

## ฐานตรวจและขอบเขต

- เทียบกับรุ่นใช้งานเดิม v1.3.0 / main bc8a30b รวม commit 0f94558, 1f90391, 4797c9a และ working tree งานภาษา/Settings ทั้งหมด รวมไฟล์ untracked
- ตรวจ production diff ทุกไฟล์ และตามผู้เรียก/ผู้รับข้อมูลที่เกี่ยวข้อง แม้ไฟล์นั้นไม่ได้แก้ ไม่ถือว่าทุกบรรทัดของทั้ง repository ถูกตรวจแล้วจากการอ่าน diff
- งานหลัก: Optimize RAM/คิวงาน, ปากกา/Whiteboard, PDF export, รูปภาพ, snapshot/backup/restore, worker lifecycle, close/save, diagnostics/GPU, เวอร์ชัน, ภาษา/คู่มือ/Settings/GitHub
- คงพฤติกรรมที่ผู้ใช้ยอมรับ: นำเข้าแล้วอยู่ Library ต่อได้, toolbar แถวเดียว, ไม่จำกัดรูปด้วย policy 128 MiB, Restore ต้องมาจากคำสั่งผู้ใช้
- ใช้โปรไฟล์และฐานข้อมูลจำลองใต้ scratch แยกเครื่อง A/B; ห้ามใช้โน้ตจริงเป็นข้อมูลทดลองลบหรือทำเสีย
- ก่อนรันบันทึก HEAD, diff, รายการ untracked และ hash source/fixtures เพื่อผูกผลกับโค้ดชุดที่ทดสอบ ผลก่อนหน้าเป็นข้อมูลประกอบ ไม่ใช่ผลทดสอบของ snapshot ใหม่

## หลักตัดสินจากมุมผู้ใช้

1. สิ่งที่เขียนและเห็นต้องตรงกับสิ่งที่บันทึก เปิดใหม่ ส่งออก และกู้คืน
2. กดหนึ่งครั้งต้องมีสถานะตอบรับ งานสำเร็จ/ล้มเหลว/ยกเลิกต้องจบและลองใหม่ได้
3. งานพื้นหลังต้องไม่ทำให้ปากกา เปลี่ยนหน้า หรือบันทึกงานหยุดทำงาน
4. ล้มเหลวกลางทางต้องไม่ทำให้งานเดิมเสีย และไม่รายงานสำเร็จทั้งที่ข้อมูลไม่ครบ
5. หลังใช้งานซ้ำ หน่วยความจำ/worker/listener/URL ต้องไม่สะสมไม่สิ้นสุด การ cache ที่มีขอบเขตยอมรับได้
6. ภาษาเปลี่ยนเฉพาะการนำเสนอ ไม่แก้ชื่อที่ผู้ใช้ตั้ง เนื้อหา พิกัด หรือความหมายของคำสั่ง

## ลำดับตรวจโค้ด

| ลำดับ | จุดตรวจ | คำถามที่ต้องตอบพร้อมหลักฐาน |
|---|---|---|
| P0 | App.jsx, localSaveService, localSaveGuard | blur commit ครบก่อนปิดหรือไม่? รอ transaction สำเร็จจริงหรือแค่เริ่ม? เมื่อ save ล้มเหลวหน้าต่างยังอยู่และ Retry ได้ไหม? |
| P0 | foregroundJobs และทุก caller | มีงานถือคิวแล้วรอคิวตัวเองหรือไม่? Restore รอ backup ก่อนเข้าคิวหรือไม่? exception ทุกเส้นทางคืนสถานะ busy หรือไม่? |
| P0 | notebookBlob, fullBackup worker, db, backupValidation | snapshot อยู่ revision เดียวกันหรือไม่? cursor จบ/abort/missing notebook จบ promise ครบไหม? หน้ากระดาษ รูปและ PDF references ครบ/เรียงถูกหรือไม่? |
| P0 | recovery core/service/worker และ native reader/writer | cancel แล้วมีผลกลับมาเขียน DB ได้ไหม? rollback ครบไหม? conflict/การลบ/parent folder/restore ซ้ำยังทำงานเดิมหรือไม่? |
| P1 | backupPreparation, autoBackup, backupController | cache key ครอบคลุมทุกสิ่งที่เปลี่ยนภาพหรือไม่? ข้อมูลสำรองหลักสำเร็จได้เมื่อ PDF ยังรอไหม? หน้าระหว่างแก้ไม่ถูกประกาศว่าเป็น PDF ล่าสุดผิดรุ่นหรือไม่? |
| P1 | inkPreview, inkingEngine, CanvasBoard, WhiteboardBoard | stable prefix ถูกล้างทุก cancel/เปลี่ยนหน้า/undo หรือไม่? memo invalidate ครบเมื่อแก้หรือย้ายวัตถุไหม? raw points ไม่หายไหม? |
| P1 | svgCanvas, exportDocument, pdfExportEngine | cap/join/pressure/alpha/transform/clipping ตรงจอหรือไม่? สีทึบดีขึ้นแต่ highlighter เข้มซ้อนผิดไหม? |
| P1 | imageRead worker/base64, pdfRaster, pdfService | partial read/ไฟล์เปลี่ยน/timeout/cancel จบได้ไหม? ปิด bitmap, canvas, worker และ object URL ทุกเส้นทางไหม? |
| P1 | languageCatalog/i18n/preferences, localization.css, guide, UI, IPC titles | fallback/placeholder/RTL/วันที่/ชื่อสำเนาถูกไหม? UI เปลี่ยนโดยไม่เปลี่ยนข้อมูลและ geometry ไหม? |
| P1 | diagnostics, GPU, main/preload | ไม่บันทึกเนื้อหาโน้ต/ข้อมูลลับ? log มีขอบเขต? worker หรือ renderer ล้มแล้วรายงานได้? IPC ยังตรวจ payload/URL เดิมไหม? |
| P2 | package/manifest/release notes/community links | เลขรุ่นตรงกัน? ลิงก์ไป downloads/issues ที่ตั้งใจ? assets/ไอคอน/worker พร้อมใน production bundle ไหม? |

## สถานการณ์ทดสอบที่ต้องทำ

ทุกกรณีบันทึกขั้นตอน ผลคาดหวัง ผลจริง log และข้อมูลก่อน/หลัง ไม่ใช้เพียงการไม่มี error เป็นเกณฑ์ผ่าน

| ID | จำลองการใช้งานจริง | ผลที่ต้องได้ |
|---|---|---|
| S01 | เขียนเส้นสุดท้าย/พิมพ์ข้อความโดยยังไม่ออกจากช่อง แล้วปิดทันที ทำทั้งปกติ ย่อ ซ่อน และกดปิดซ้ำ | เปิดใหม่แล้วงานครบ ปิดสำเร็จเมื่อ save จบ ไม่มี destroyed object |
| S02 | หน่วง/ทำให้ local save ล้มเหลว แล้วปิดและ Retry | ไม่ปิดทิ้งข้อมูล ไม่แจ้งว่าเซฟแล้วผิด ๆ Retry แล้วเปิดใหม่ตรวจได้ |
| S03 | เขียนเร็ว เส้นยาว เส้นสั้น จุด แรงกดต่างกัน ยกเลิก pointer สลับหน้า Undo/Redo และลบ | ไม่มีเส้นหลอน ส่วนต้นค้าง เส้นขาด หรือ history ซ้ำ; เปิดใหม่ยังเหมือนเดิม |
| S04 | Whiteboard เขียนขวาแล้วใช้มือซ้ายเลื่อน/ซูมไกลจากตำแหน่งเขียน สลับโล่/เครื่องมือ | การนำทางสม่ำเสมอ ไม่มีหมึกจากฝ่ามือ และไม่มีวัตถุหายเพราะ cache |
| S05 | สมุด 91 หน้า ทำ PDF backup ครั้งแรก ไม่แก้ทำซ้ำ แก้หน้าเดียวแล้วทำซ้ำ | รอบไม่แก้ไม่ render ใหม่; รอบแก้หน้าเดียว render เฉพาะหน้าที่เปลี่ยนและ reuse ที่เหลืออย่างถูกต้อง |
| S06 | เปลี่ยนรูป ข้อความ สีพื้น ขนาดกระดาษ ลบ/เรียงหน้า แล้ว backup | PDF cache ไม่คืนภาพเก่า รายการหน้าและลำดับครบ; ทดสอบแก้ระหว่างสร้าง PDF ด้วย |
| S07 | ระหว่าง PDF backup เริ่มเขียน นำเข้า Export หรือ Restore | งานตอบสนองและคิวจบ ไม่มี deadlock; PDF ที่เริ่มแล้วพักตามขอบเขตที่ออกแบบ และกลับมาทำต่อได้ |
| S08 | กด Backup/Export/Restore ซ้ำ ยกเลิก ลองใหม่ ทำให้ worker เริ่มช้า/ตาย/ส่งผลช้า | ไม่มีงานเก่าทับงานใหม่ ปุ่มกลับใช้ได้ progress จบ และคำสั่งถัดไปไม่ติด busy |
| S09 | A backup → B restore → restore ซ้ำ → A แก้ → B restore | ไม่มีสำเนาเพิ่มโดยไม่จำเป็น ข้อมูลใหม่มา; ถ้าแก้ทั้ง A/B ต้องรักษาความขัดแย้งตามกฎเดิมไม่ทิ้งงานเงียบ ๆ |
| S10 | ลบโน้ต/โฟลเดอร์ ล้างขยะ ย้ายโฟลเดอร์ แล้ว backup/restore ข้าม A/B | การลบและ parent folder ตามนโยบายเดิม ไม่คืนของที่ลบจาก snapshot ล่าสุด; การเลือก backup เก่าต้องแยกจากกรณีนี้ |
| S11 | Restore หลายสมุด/91 หน้า จาก local, Drive จำลองช้า, ขาดไฟล์, checksum ผิด, disconnect, cancel | ไม่ import ครึ่งชุด ไม่ทำลายข้อมูลเดิม ระบุสาเหตุและ retry ได้ ไม่ auto restore เมื่อเปิดแอป |
| S12 | เขียนระหว่าง snapshot และ export .bnote จากนั้น import ในโปรไฟล์ว่าง | snapshot เป็นชุดที่สอดคล้องกัน ไม่ผสม header/หน้าต่าง revision; ตรวจเนื้อหา/รูป/ลำดับจริง |
| S13 | PDF เส้นโค้ง จุด ลูกศร pressure ทุกหัวปากกา สีทึบ/โปร่งใส highlighter และรูปหมุน | เทียบภาพในแอปกับ PDF ใน Edge หลายระดับซูมและ renderer อีกตัว ไม่มีรอยแตกเป็นปล้อง ความหนา/สี/ตำแหน่งตรง |
| S14 | ส่งออกหน้าเดียว/ทั้งสมุด/เมนู Library/backup PDF/PNG/JPEG รวม cancel save dialog และเขียนไฟล์ล้มเหลว | เนื้อหาครบ progress หายเมื่อจบ ปุ่มกดใหม่ได้ ความล้มเหลวไม่ค้างสถานะสำเร็จ |
| S15 | นำเข้ารูปใหญ่รวมไฟล์เกิน 128 MiB ที่ decode ได้, รูปเสีย, ไฟล์อ่านขาด, ไฟล์เปลี่ยนระหว่างอ่าน | ไม่มี policy ปฏิเสธเพียงเพราะเกิน 128 MiB; ข้อจำกัด runtime ต้องล้มเหลวอย่างมีข้อความและไม่ทำลายงาน |
| S16 | เปิด/ปิดสมุดหนัก 30 รอบ เปลี่ยนหน้าไกล ๆ Export/Cancel ซ้ำ เปิดคู่มือแล้วกลับเขียน | จำนวน worker/canvas/URL/listener ที่หมดงานไม่โตต่อเนื่อง และ RAM หลัง idle มีแนวโน้มคงตัว |
| S17 | สลับ 7 ภาษา ขณะมีงานที่ยังบันทึกไม่จบ/Backup/เปิด Editor แล้วเปิดแอปใหม่ | งานครบ จำภาษา วันที่/ข้อความถูก ปากกาและ toolbar ไม่กลับด้าน ชื่อที่ผู้ใช้ตั้งไม่เปลี่ยน |
| S18 | อาหรับผสมไทย/อังกฤษ ตัวเลข และชื่อมี $&/$1; หน้าต่างแคบ/เตี้ย DPI หลายระดับ | placeholder ไม่เพี้ยน ไม่แปลชื่อไฟล์เอง ปุ่มสำคัญเข้าถึงได้ path อ่านได้ และ scrollbar ไม่ซ่อนคำสั่ง |
| S19 | เปิดทุกหมวด/บทคู่มือ ค้นหาแต่ละภาษา สลับธีม กด GitHub และจำลองเปิดลิงก์ไม่สำเร็จ | ภาพ/ลูกศรชี้ถูก ไม่มีภาพกลับด้านหรือข้อความหาย ลิงก์/ข้อความล้มเหลวตรงปลายทางที่ตั้งไว้ |
| S20 | เปิด production build แบบ offline แล้วเปิด PDF/รูป/คู่มือ/backup และปิดแอป | assets/fonts/workers อยู่ในเครื่องครบ ไม่มีการพึ่ง dev server; ไม่มี process งานค้างหลังออก |

## วิธีตรวจความครบของข้อมูล

- สร้าง expected inventory: notebook/page IDs, parent folder, page order, stroke points/style, text, image/PDF hashes และ revision ก่อนทดสอบ
- เทียบข้อมูลแบบ canonical โดยแยก timestamp หรือ ID ใหม่ที่คาดหมายจากการ import ออกจากเนื้อหาที่ต้องเท่ากัน
- ตรวจทั้งฐานข้อมูลและเปิดใน UI หลัง reload; backup status สีเขียวหรือจำนวนไฟล์เท่ากันเพียงอย่างเดียวไม่พอ
- Fault injection ทำเฉพาะ fixtures: storage/permission failure, transaction abort, worker error, delayed response, incomplete backup และไฟล์เสีย
- ความผิดพลาดที่คาดไว้ต้องไม่มีข้อความ success และต้องทำคำสั่งเดิมใหม่ได้หลังแก้เงื่อนไข

## การวัด RAM และความลื่น

- เทียบ v1.3.0 กับ source snapshot นี้บนเครื่องเดียวกัน ข้อมูลเดียวกัน DPI/zoom/โหมดพลังงานเดียวกัน ใช้โปรไฟล์แยก และบันทึก runtime ของแต่ละรุ่น
- workload: กระดาษว่าง, รูปหนึ่งรูป, PDF 91 หน้า, หลายแท็บ, backup พร้อมเขียน, export/restore และวนใช้ 30–60 นาที
- วัดหน่วยความจำรวม process tree ของ Electron แยกจาก JS heap; เก็บ peak, หลังจบงาน และหลัง idle พร้อม CPU, worker count, long tasks และ frame time p95/p99
- ตรวจ 3 รอบต่อเงื่อนไข แยก cold/warm cache; การลด RAM ต้องไม่แลกกับข้อมูล/คุณภาพ PDF หรือ latency ที่แย่ลง
- ทดสอบจริง RAM 8 GB และ 16 GB; แยก BetterNote อย่างเดียว กับ BetterNote + Teams แชร์หน้าจอ โดยใช้ฉากเดียวกัน ไม่สรุปว่า Teams หรือแอปผิดจากอาการอย่างเดียว
- รายงานเปอร์เซ็นต์เฉพาะ workload ที่วัดได้จริง และระบุ baseline/ค่าที่วัด ไม่มีเปอร์เซ็นต์ประสิทธิภาพรวมแทนทั้งแอป
- VM จำกัด RAM เป็นหลักฐานเสริม ไม่แทน Surface pen/GPU หรือ Teams จริง

## ชุดตรวจเดิมที่นำมาใช้

- Save/close/data: local-save, close-save-guard, local-persistence, bnote-roundtrip, backup-recovery
- Queue/worker/memory: optimization-core/memory/native/browser/app, backup-preparation, backup-page-cache
- Backup/Restore: backup-controller, backup-writer/reader, backup-generations/devices, backup-migration-native, restore-large, backup-status/sync
- Ink/PDF/navigation: ink-input, ink-session-editor, navigation-input, toolbar-zoom, svg-canvas, pdf-ink-fidelity, pdf-import/raster/export-flow/export-error
- UI/release/security: languages, user-guide, phase6-updates, daily-update, release-version, app-security, phase6-app
- อ่าน harness ก่อนรัน: บางชุด mock native API/ปิด scheduled backup จึงต้องเพิ่ม integration ของระบบจริงสำหรับกรณีงานชนกัน ไม่ใช้ผล mock ยืนยัน native end-to-end
- เริ่ม unit ที่เกี่ยวข้อง → build → browser integration → production Electron → hardware/manual test; เติม regression เฉพาะช่องว่างหรือบั๊กที่ทำซ้ำได้

## ผลส่งมอบและเกณฑ์จบ

รายงานแต่ละบั๊ก: ระดับความรุนแรง, source ที่ตรวจ, ขั้นตอนทำซ้ำ, คาดหวัง/จริง, log/ภาพ, เหตุที่โยงกับโค้ด, เป็นบั๊กเดิมหรือ regression, แนวแก้ที่เล็กที่สุด และ regression test

- ต้องแก้ก่อนปล่อย: ข้อมูลหาย/เสีย, restore ซ้ำทำลายงาน, ปิดไม่ได้, crash, deadlock, PDF ผิดจากต้นฉบับอย่างมีนัยสำคัญ
- ถ้าพบปัญหาให้เพิ่มกรณีทดสอบที่ล้มเหลวก่อน แล้วตรวจหลังแก้และชุดข้างเคียง หลีกเลี่ยงเปลี่ยนหลายระบบพร้อมกัน
- ทุกแถวมีสถานะ Passed / Failed / Not run / Blocked; ไม่ข้ามรายการแล้วนับว่าผ่าน
- ผลรอบนี้ต้องผูกกับ source snapshot ที่แน่นอน ผลทดสอบเก่าไม่รวมยอดเป็นผลใหม่
- เมื่อถึงขั้นสร้างแพ็กเกจในอนาคต ยังต้องตรวจไอคอน/identity/worker และอัปเกรดจาก Store 1.3.0.0 บนข้อมูลจำลองแยกต่างหาก

รอบจัดแผนนี้อ่านประวัติ/diff รายงานเดิม และโค้ดจุดเชื่อมสำคัญเท่านั้น ยังไม่ได้ทำ audit ทุกบรรทัดหรือรันชุดทดสอบใหม่ ไม่แก้ production code ไม่สร้าง installer และไม่ commit/push
