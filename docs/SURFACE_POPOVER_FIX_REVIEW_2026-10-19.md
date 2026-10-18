# Surface pen และเมนูขอบจอ — UIFix1

ตรวจและแก้บน `sol-prework` วันที่ 18–19 ตุลาคม 2026 สำหรับรุ่นทดสอบ 1.3.1.0 ไม่ merge/push เข้า main และไม่แก้บั๊ก `.bnote` Worker ที่ผู้ใช้ให้เลื่อนออกไป

## หลักฐานก่อนแก้

ชุดทำซ้ำ `tests/surface-popovers.browser.cjs` ใช้ React components จริงและ CSS ของแอปใน Edge กับข้อมูลจำลอง ไม่เปิดฐานข้อมูลงานจริง

- หน้าต่าง 1024 px: เมนู PDF อยู่ช่วง x=942.53 ถึง 1072.53 จึงล้นขอบขวา เนื่องจากตำแหน่งพื้นฐานยึดซ้ายและ utility classes ที่ใช้ไม่ได้มีกฎ CSS รองรับ
- เมนูโฟลเดอร์การ์ดริมซ้ายอยู่ช่วง x=-55 ถึง 195 จึงหลุดขอบซ้ายก่อนแก้ และการวางเมนูในกรอบที่ clip ทำให้บางส่วนเข้าถึงไม่ได้
- ปากกาแบบ CDP ของ Edge กด Options/X ได้ใน baseline จึงไม่อ้างว่าจำลองอาการฮาร์ดแวร์ Surface ได้ตรงทั้งหมด พบจุดเสี่ยงในตัวช่วยปากกา: pointer leave ล้างการแตะ และการกัน compatibility click เดิมอาศัยปุ่มเดิม/ancestor เดิม จึงไม่ครอบคลุมคลิกที่ไปตกบน overlay ใหม่หลังปุ่มหาย
- บันทึก baseline: `scratch/surface-popovers-20261018/baseline.json`

## ขอบเขตแก้

1. `usePenButtonTap.js`: ตัดสิน tap จากการเคลื่อนที่/ตำแหน่งปล่อย/การยกเลิก ไม่ล้างเพียงเพราะ hover leave; เก็บสถานะยกเลิกเมื่อเลื่อนเกินระยะ และกัน compatibility click ที่ตามมาตำแหน่งเดิมบน document เป็นเวลาสูงสุด 500 ms การเริ่ม pointer press ใหม่ยกเลิก guard เพื่อให้การแตะเร็วครั้งต่อไปทำงานได้ คีย์บอร์ดและ `.click()` แบบ detail=0 ยังทำงาน
2. `ViewportPopover.jsx`: เมนูที่เปิดเท่านั้นใช้ portal หลบกรอบ clip วัดขอบ viewport จริง เว้น 8 px ปรับซ้าย/ขวาและเปิดด้านบนเมื่อพื้นที่ล่างไม่พอ เลื่อนภายในได้เมื่อพื้นที่น้อย; ตอบสนอง scroll/resize ผ่าน requestAnimationFrame และถอด observer/listeners เมื่อปิด
3. ใช้ตัววางตำแหน่งนี้กับเมนูเดิม 7 จุดใน EditorToolbar (pen/highlighter/eraser/shape/width/more/PDF) และเมนู FolderCard/NotebookCard โดยคง callbacks ของคำสั่งเดิม
4. ExportModal ปิดด้วยพื้นหลังเฉพาะเมื่อ gesture เริ่มที่พื้นหลัง ป้องกันการเปิด dialog แล้วรับคลิกปล่อยตามมาปิดเอง; X และ Close ยังเรียก callback เดิม
5. CSS เฉพาะชั้นเมนูและพื้นที่กดรายการคำสั่ง ไม่มีการเปลี่ยนแถว/ลำดับของ toolbar

ไม่มีการแก้ transaction เซฟ, ฐานข้อมูล, Backup/Restore controller, `.bnote` import worker, PDF export engine หรือรูปแบบไฟล์ ข้อมูลไม่ถูกย้าย การแก้การรับปากกาใช้ร่วมกับปุ่ม Backup เดิม จึงทดสอบตรงนั้นด้วย

## ผลทดสอบ

| ชุด | ผล |
|---|---|
| Surface popovers | 17/17 กลุ่ม |
| Navigation/Input — Edge | 40/40 |
| Navigation/Input — Electron จริง | 40/40 |
| Library export/Backup button/Restore UI | 5/5 |
| ภาษา/Settings/geometry/ข้อมูลสมุด | 16/16 กลุ่ม |
| PDF import/raster/export-flow/export-error UI | 32/32 |
| Production build | ผ่าน |
| ตัวติดตั้ง UIFix1/ASAR + เปิด .exe จริง | ผ่าน 9 กลุ่ม รวม pen Options/X, native PDF/backup worker และปิด–เปิดตรวจข้อมูล |
| ไอคอนตัวติดตั้งและแอป | ตรง BetterNote ICO ที่ตรวจ 32×32 ทุกพิกเซล |
| Git diff whitespace check เฉพาะไฟล์ที่แก้รอบนี้ | ผ่าน |

กลุ่มใหม่ครอบคลุม trusted pen เปิด Options/X 8 รอบ, ส่งคำสั่ง current-page ครั้งเดียว, hover leave ก่อนปล่อย, fault injection ของ compatibility click ที่ตกบน overlay/พื้นหลังหลังปุ่มหาย, เมาส์/นิ้ว/Enter/ขอบปุ่ม, cancelled/drifting tap, การ์ดสองชนิดที่ขอบทั้งสี่ใน en/th/de/ar, toolbar menus บนหน้าต่าง 800/1024/1368 px ที่สูง 600 px, scroll/resize, deviceScaleFactor 1.5/2, observer disconnect หลังเปิด–ปิด/ถอด component และธีมสว่าง

กรณี compatibility click ที่ retarget และ hover leave ใช้การจำลองลำดับเหตุการณ์ ไม่ใช่การวัด Windows Ink บน Surface จริง การปรับ deviceScaleFactor จำลอง DPI ใน Chromium ไม่ใช่การเปลี่ยน Windows scaling ของฮาร์ดแวร์จริง

คำสั่ง `node tests/pdf-raster.browser.cjs` เป็นโมดูลย่อย จึงไม่ถือผล exit=0 ของคำสั่งนั้นเป็นการรันทดสอบ ได้รันตัวหลัก `pdf-import.browser.cjs` ซึ่งเรียกโมดูลย่อยและตรวจ export-flow/error จริงแล้วผ่าน 32 กรณี

หลักฐานทั้งหมด: `scratch/surface-popovers-20261018/` ได้แก่ `ui-final.log`, `results.json`, `navigation.log`, `navigation-electron.log`, `library.log`, `languages.log`, `pdf-import.log`, `build.log` ภาพที่ตรวจจริงอยู่ใต้ `popovers-uiUkf5/` (`pdf-menu-light.png`, `folder-bottom-left.png`)

## ยืนยันบน Surface

ใช้ตัวติดตั้ง UIFix1 ทับเฉพาะ BetterNote Sol Prework (Test) รุ่นทดสอบเดิม ทดสอบ:

1. ใช้ปากกากด PDF → Export all pages/options → X ทำซ้ำ 5–10 รอบ ทั้งแตะไอคอน ข้อความ และขอบปุ่ม ต้องไม่หายเองหรือกดซ้ำหลายครั้ง
2. ลอง Export current page หนึ่งครั้ง ต้องได้ไฟล์เดียว และลอง export ทั้งสมุดตามปกติ
3. เปิดเมนูโฟลเดอร์/สมุดริมซ้าย ริมขวา และแถวล่างสุด ต้องเห็นและกดได้ครบ
4. ลองย่อหน้าต่างและ Windows scaling ที่ใช้จริง เปิด pen settings/eraser/shape/width ต้องไม่หลุดขอบ
5. ปิดเมนูแล้วเขียนต่อ ต้องไม่เกิดเส้นหลง ปิด–เปิดแอปแล้วตรวจงานยังอยู่

การทดสอบรอบนี้ใช้ข้อมูลจำลองและฮาร์ดแวร์ PC ไม่สามารถรับรองการรับปากกา Surface จริงได้จนผู้ใช้ลองตัวติดตั้งนี้

ไฟล์ส่งมอบ: `BetterNote-Test-1.3.1-SolPrework-UIFix1-x64-Setup.exe` ขนาด 119,204,619 bytes; SHA256 `10174c9213233cc9bc293dafa6f892886034fe22376d8c60ba1759ef680c55a9` หลักฐานแพ็กเกจอยู่ใน `scratch/surface-uifix1-20261018/` ตรวจ 168 ไฟล์ production ที่บรรจุตรงต้นฉบับ ไม่พบ .env/ไฟล์โน้ตหรือไฟล์สำรองส่วนตัว ไม่ได้เซ็นด้วยใบรับรองผู้เผยแพร่
