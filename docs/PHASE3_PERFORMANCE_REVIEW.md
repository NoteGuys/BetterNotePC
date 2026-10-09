# เฟส 3 — ลดการสะดุดระหว่างสำรองและสร้าง PDF

วันที่: 7 ตุลาคม 2026
ฐานก่อนแก้: c3f8a00 บน sol-work
สถานะ: ปรับปรุงและตรวจโค้ดเสร็จ พร้อมให้ผู้ใช้ตรวจในแอป; ยังไม่ commit/push รอบนี้

## สิ่งที่ปรับ

- ย้ายการอ่าน metadata สำรองและ snapshot ของสมุดจาก IndexedDB ไป worker เดียว อ่านสมุดพร้อมหน้าจาก readonly transaction เดียวตามเดิม ไม่ใช้ pages.getAll()
- หน้าจอหลักรับเฉพาะหัวข้อมูลหน้าและ ArrayBuffer ของ JSON ไม่รับ object รอยเขียนหลายแสนจุด Native writer ตรวจและแปลงข้อมูลใน disk worker ก่อนใช้เส้นทาง hash, revision, conflict, atomic replacement และ manifest เดิม
- สร้าง PDF สำรองด้วย OffscreenCanvas และ jsPDF ใน worker; ส่ง PDF เป็น binary พร้อมตรวจหัว %PDF- และท้าย %%EOF ก่อนเขียน
- โหลด worker/PDF bundle เมื่อใช้งาน ไม่เพิ่ม PDF worker เข้า main bundle ตอนเปิดแอป มี worker เดียว จัดคิว metadata ร่วมกับ PDF และคืนหน่วยความจำเมื่อว่าง 45 วินาที
- คง cache ภาพสูงสุด 12 MiB/8 หน้า และ PDF ที่พักไว้สูงสุด 16 MiB ตามเดิม แคชหมดอายุ 30 วินาที ภาพหลักและภาพแทรกจำกัด 16 ล้านพิกเซล/ด้านละ 8192 พิกเซล
- ตรวจ idle ก่อนแต่ละหน้าและหลังงานเสร็จ เริ่มเขียนแล้วพัก PDF ได้และทำต่อจากหน้าที่ยังค้าง ตรวจ revision ใหม่ใน worker เพื่อไม่สร้าง PDF ให้ snapshot รุ่นเก่า
- รูป PNG/JPEG ถอดใน worker; รูป SVG ใช้ HTMLImage/createImageBitmap ของ Chromium แบบอะซิงโครนัส ส่งกลับเป็น transferable bitmap มี timeout และไม่เปิด network/file URL
- ทดสอบภาพเทียบตัวเดิมแล้วแก้ baseline ข้อความให้ตรง ลายมือ รูปใต้/เหนือหมึก ข้อความไทย พื้นหลัง PDF และขอบเขต whiteboard ผ่าน
- เพิ่มการปฏิเสธ snapshot/PDF binary เสีย การรับมือ worker ล้ม/หมดเวลา และการคืนทรัพยากร ไม่เปลี่ยน pen/Canvas editor, Undo, การส่งออก PDF ที่ผู้ใช้สั่ง, วิธีเชื่อม Drive หรือ OAuth

## ผลวัด Electron จริง

ใช้สมุดจำลองเดิม 24 หน้า 144,000 จุด ขนาด JSON 4,706,217 bytes ผ่าน preload และ IPC จริง เปิดจาก file:// บล็อก HTTP(S) แยกโปรไฟล์ A/B; ไม่ใช้ Playwright เป็นสะพานส่งเนื้อหาของแอป

| งาน | ก่อนแก้ | หลังแก้ |
| --- | ---: | ---: |
| รับและสำรองข้อมูลแก้ไขได้ | 1,193.5 ms | 509.6 ms |
| ช่องว่าง heartbeat สูงสุดระหว่างรับ/สำรอง | 358.2 ms | 21.8 ms |
| สร้าง PDF 24 หน้า | 5,122.0 ms | 2,131.1 ms |
| ช่องว่าง heartbeat สูงสุดระหว่าง PDF | 172.5 ms | 21.0 ms |
| long task บน renderer ในสองช่วงวัดหลังแก้ | มีในฐานเดิม | ไม่พบในรอบนี้ |

ปรับเกณฑ์ regression จากช่องว่างไม่เกิน 5 วินาที เป็นไม่เกิน 150 ms สำหรับสองช่วงใน Electron native test ไม่ใช่การรับรอง 60 FPS บนทุกเครื่อง ตัวเลขนี้วัดงานเดียวกันบนเครื่องนี้และอาจเปลี่ยนตาม CPU/โหลดเครื่อง

หลักฐานก่อนแก้: QA/betternote-native-migration-MvP8tT/results.json
หลังแก้: QA/betternote-native-migration-14fA7Y/results.json และ phase3-performance-native.log
QA = โฟลเดอร์ visualizations ที่แยกจากข้อมูล BetterNote ที่ติดตั้งจริง

ตัวทดสอบ Electron ใช้ bootstrap ควบคุมปลายทางและ preload เดิมทุกไบต์ มีการรีโหลดได้หนึ่งครั้งหาก bridge ยังไม่พร้อมก่อนเริ่ม จึงไม่ได้รับรอง cold-start ของ installer

ชุด browser migration มีค่า heartbeat ที่รวมการแปลงข้อมูลผ่าน Playwright ของเครื่องมือทดสอบด้วย จึงใช้ยืนยันข้อมูล/editor และใช้ชุด Electron native ข้างบนเป็นหลักฐานความเร็ว ไม่เอาเวลาสะพานจำลองมารวมผลวัด IPC ของแอป

## ผลตรวจ

| ชุด | ผ่าน |
| --- | ---: |
| Unit/native รวมกรณี binary และ worker lifecycle ใหม่ | 319 |
| Backup UI/idle/ภาษาทั้ง 4/9 แท็บ/รูปเสีย/การเขียนระหว่างสำรอง | 41 |
| Drive sync/conflict/revision guard/prune | 13 |
| Atomic recovery/receipt/ลำดับหน้า/rollback | 16 |
| Discovery/ไฟล์อ้างอิงเก่า/โฟลเดอร์ที่ใช้ไม่ได้ | 11 |
| Migration กับ App, editor, pen events, ปิด–เปิดโปรไฟล์จริง | 17 |
| Worker PDF fidelity/คิว metadata/pause-resume/SVG/รุ่นเก่า/รูปเสีย | 8 |
| Electron จริงสมุดใหญ่/ไบนารี/PDF/ปิด–เปิด/idle | 6 |
| รวม | 431 |

ไม่รวมการรันทดสอบข้อเดิมซ้ำ และไม่สร้าง fixture อ่านไฟล์ใหญ่ 268 MiB ซ้ำจากรอบที่ผ่านก่อนหน้า Production build ผ่าน 2,140 modules; ยังมีคำเตือนขนาด chunk และ static/dynamic import เดิม ไม่มีการเปลี่ยน chunking ของหน้าจออื่นเพื่อปิดคำเตือน

PDF comparison 3 หน้า: ขนาดกระดาษตรงกัน ค่าแตกต่างสีเฉลี่ย 0.26–1.09 จาก 255 และจำนวนพิกเซลลายมือ/รูปใกล้กัน ตรวจภาพ worker.png/legacy.png ด้วยตาแล้ว ข้อความไทยและตำแหน่งตรงกันภายในความต่างของการ rasterize

หลักฐานภาพ: QA/betternote-backup-preparation-TXG9Kj/results.json, worker.png, legacy.png

## สิ่งที่ยังต้องตรวจโดยผู้ใช้

- ลองเปิดรุ่นจากโค้ดล่าสุด แล้วเขียน/เปลี่ยนหน้า/สลับสมุดขณะสำรองสมุดที่ใช้จริง
- การย้ายระหว่างคอมพิวเตอร์สองเครื่องจริงยังไม่ทดสอบบนฮาร์ดแวร์สองตัว รอบนี้ใช้โปรไฟล์แยกบนเครื่องเดียว
- การขึ้นคลาวด์จริงของชุดเฟส 3.4 เดิมได้รับคำยืนยันจากผู้ใช้แล้ว รอบนี้ไม่เขียน Drive จริงซ้ำหรือแตะ backup เดิม Google Drive for desktop ยังเป็นผู้รับผิดชอบอัปโหลด และ BetterNote ไม่อ้าง cloudUploadVerified จากการเขียนไฟล์ในโฟลเดอร์

## ไฟล์ในรอบนี้สำหรับตรวจ Git

Runtime/build 9 ไฟล์:
- electron/backupWorkerClient.cjs
- electron/backupWriter.cjs
- src/services/autoBackupService.js
- src/services/backupController.js
- src/services/backupPreparation.worker.js
- src/services/backupPreparationService.js
- src/utils/backupPageImage.js
- src/utils/backupPdf.js
- vite.config.js

Tests 8 ไฟล์:
- tests/backup-migration-native.browser.cjs
- tests/backup-migration.browser.cjs
- tests/backup-preparation.browser.cjs
- tests/backup-preparation.test.js
- tests/backup-status.browser.cjs
- tests/backup-sync.browser.cjs
- tests/backup-writer.test.cjs
- tests/helpers/recovery-worker.cjs

เอกสาร 2 ไฟล์: docs/PHASE3_PERFORMANCE_REVIEW.md และ docs/SAFETY_PHASES.md
ไม่รวม core-js-banners และ node-compile-cache/ ที่มีอยู่ก่อนเริ่มงาน และไม่รวมไฟล์ QA/ข้อมูลสำรองจริง
