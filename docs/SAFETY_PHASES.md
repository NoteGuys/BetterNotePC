# แผนปรับความปลอดภัยและประสิทธิภาพ BetterNote

เริ่มจาก commit 205d60b บน branch sol-work
ทำทีละเฟส และหยุดให้ผู้ใช้ตรวจเมื่อจบแต่ละเฟส ไม่มีการ commit/push อัตโนมัติ

| เฟส | สิ่งที่ผู้ใช้จะได้รับ | ประเด็นจากแผน 24 ข้อ | สถานะ |
| --- | --- | --- | --- |
| 1 | Undo/Redo ของเนื้อหาและการเพิ่ม/ลบ/ทำสำเนาหน้า ประวัติแยกสมุดข้ามแท็บ เซฟตามลำดับ มีสถานะและลองเซฟใหม่ได้ ปิดตามปกติรอคิวทั้งหมด | 1–4, ประวัติข้ามแท็บ และส่วนลดการเซฟซ้ำของ 17 | ครบข้อ 1–4 เพิ่มภาษาและ 9 แท็บแล้ว รอผู้ใช้ตรวจ |
| 2 | สำรองนับงานที่เขียนจริง รายงานผลแต่ละปลายทางตามจริง เขียนแทนไฟล์อย่างปลอดภัย เก็บรุ่นก่อน ใช้รหัสสมุด และไม่ล้างสำรองเมื่อย้ายเข้าถังขยะ | 5–8, 11 | ปิดเฟสแล้ว: ผู้ใช้ยืนยันไฟล์ขึ้น Drive ครบ ตรวจโค้ดและแก้คิว Drive เพิ่ม ผ่าน 156 กรณี |
| 3 | ตรวจไฟล์ก่อนกู้คืน ไม่ค้างครึ่งทาง เก็บข้อมูลที่ขัดแย้ง ตรวจทุกแหล่ง และทดสอบย้ายจากเครื่องเก่าสู่ฐานข้อมูลทำการเครื่องใหม่ผ่านโฟลเดอร์ Drive จำลอง | 9–10 และการย้ายเครื่อง | 3.1 ตรวจ/เลือกไฟล์เสร็จ ผ่าน 63 กรณีใหม่และ 116 กรณีเดิม รอผู้ใช้ตรวจ ก่อน 3.2 |
| 4 | เก็บจุดปากกาครบ เส้นตรงทำงาน คืนสถานะเมื่อจบการเขียน และตรวจการสลับ/เลื่อนหน้ากับท่าทางสัมผัส | 12–14 และการเลื่อนหน้า | ยังไม่เริ่ม |
| 5 | ลดงานวาด โหลดข้อมูลและ Canvas ตามงบหน่วยความจำ จำกัดประวัติ งานหนักอยู่เบื้องหลัง รักษา PDF ต้นฉบับ และล้างแคชที่ใช้อยู่จริง | 15–21 | ยังไม่เริ่ม |
| 6 | ป้องกันหน้าต่างและ IPC เลือกแก้ไลบรารี PDF ที่จำเป็น ตรวจอัปเดตตามจริง และทดสอบเส้นทางใช้งานร่วมกัน | 22–24 | ยังไม่เริ่ม |

## เฟส 1: สิ่งที่แก้และตรวจแล้ว

- Undo/Redo ใช้ page ID; การเพิ่ม/ลบ/ทำสำเนาหน้าอยู่ในลำดับเดียวกับการเขียน หน้าที่ลบกู้กลับพร้อมลายมือ ข้อความ รูปภาพที่ล็อกอยู่ พื้นหลัง PDF และข้อมูลกระดาษครบ
- ประวัติแยกตาม notebook ID อยู่ระหว่างเปิดแอป จึงคง Undo และ Redo เมื่อสลับแท็บหรือกลับหน้าเอกสาร ไม่เก็บ Canvas ของสมุดที่ปิดหน้าจอไว้
- เก็บสูงสุด 200 รายการต่อสมุด และตั้งงบประวัติรวมประมาณ 64 MiB โดยนับภาพ/จุดปากกาที่ใช้ร่วมกันเพียงครั้งเดียว ล้างประวัติเก่าก่อน; ถ้ารายการล่าสุดรายการเดียวเกินงบยังเก็บไว้เพื่อให้ Undo การลบหน้าขนาดใหญ่ได้ทันที
- การทำรายการหน้าและ Undo/Redo เรียงคิวต่อสมุด สลับแท็บขณะทำรายการแล้วไม่ทิ้งประวัติ หาก transaction ล้มเหลวจะคงตำแหน่งประวัติและข้อมูลเดิมให้ลองใหม่ได้
- กด Undo/Redo ระหว่างโหลดหรือหน้าอ่านผิดพลาดจะไม่ล้างประวัติจากรายการหน้าที่ยังว่าง
- การเขียน IndexedDB ตอบสำเร็จหลัง transaction complete และปฏิเสธเมื่อ abort
- คิวเซฟเก็บเฉพาะหน้าที่ยังไม่เซฟ ปล่อยข้อมูลเมื่อเซฟเสร็จ เก็บงานล่าสุดเมื่อเซฟไม่ได้ และคงอยู่ขณะสลับแท็บ
- แถบแท็บแสดง Saved on this device / Saving / Not saved yet พร้อม Retry saving รองรับ 4 ภาษา
- การปิดหน้าต่างตามปกติรอคิวเซฟและคิว Undo/Redo รวมถึงช่วงระหว่าง transaction; ถ้าการเซฟไม่สำเร็จหรือหมดเวลาจะเปิดหน้าต่างไว้
- เพิ่ม/ทำสำเนา/ลบหน้า พร้อมจัดลำดับและ pageCount ใน transaction เดียว; เซฟเส้นจากตำแหน่งเก่าจะไม่เปลี่ยนลำดับหน้ากลับ
- ลบโฟลเดอร์ถาวรแล้วเก็บสมุดและโฟลเดอร์ย่อยไว้ที่โฟลเดอร์แม่ หรือระดับเอกสารถ้าไม่มีแม่ที่ใช้ได้
- สร้างข้อมูลตัวอย่างเฉพาะฐานข้อมูลว่างที่ยังไม่เคยเริ่มใช้; สมุดเดิมและ Welcome ที่มีงานแล้วไม่ถูกแทนที่
- หน้าที่อ่านไม่ได้แสดงทางลองเปิดอีกครั้ง และไม่แทนที่ข้อมูลด้วยหน้าว่าง
- หน้าหลักรับผลที่หน้าเขียนเซฟแล้วโดยไม่เซฟสมุดซ้ำ

## หลักฐานการตรวจเฟส 1

- 72 unit tests: คิวเซฟ ประวัติข้ามสมุด/งบหน่วยความจำ และ close guard ใช้ mock Electron
- 108 browser checks: IndexedDB ของ Chromium และ React components จริงในโปรไฟล์ชั่วคราว ครอบคลุมการกู้หน้า สลับแท็บจริง transaction abort และปิดขณะมี Undo ต่อคิว
- รวม 180 กรณีผ่าน; ชุด browser ไม่พบ renderer error
- Production build ผ่าน Vite 6.4.3 (2128 modules)
- Warning เดิม: autoBackupService/fileSystemService มีทั้ง static และ dynamic import และ bundle หลักเกิน 500 kB
- ไม่มีการเปลี่ยน DB version, object store หรือรูปแบบไฟล์ .bnote; package.json/package-lock.json ไม่เปลี่ยน

คำสั่ง unit tests สำหรับ Node 24:

```powershell
node --test --test-isolation=none tests/local-save.test.js tests/notebook-history.test.js tests/close-save-guard.test.cjs tests/document-tabs.test.js tests/notebook-cover.test.js
```

ชุด browser ใช้ esbuild ที่มีในโปรเจกต์ และ Playwright runtime ที่มีอยู่แล้ว ต้องระบุ BETTERNOTE_PLAYWRIGHT_PATH, BETTERNOTE_QA_BROWSER และ BETTERNOTE_QA_TEMP เป็นโฟลเดอร์ทดสอบชั่วคราว ก่อนรัน:

```powershell
node tests/local-persistence.browser.cjs
```

ไม่มีการติดตั้งแพ็กเกจเพิ่มเพื่อการตรวจนี้ ห้ามเปลี่ยน browser test ให้ชี้ไปยัง origin/โปรไฟล์จริงของผู้ใช้

## สิ่งที่ให้ผู้ใช้ตรวจในเฟส 1

ใช้สมุดทดลองที่ไม่มีข้อมูลสำคัญ:
1. เขียนในหน้าที่สอง ลบหน้าแรก แล้ว Undo; หน้าแรกต้องกลับมาตำแหน่งเดิมพร้อมข้อมูลครบ Undo อีกครั้งจึงย้อนลายมือในหน้าที่สอง และ Redo ต้องทำตามลำดับเดิม
2. เพิ่มหรือทำสำเนาหน้า แล้ว Undo/Redo; หน้าและข้อมูลต้องกลับมาครบ ลองเขียนในหน้าใหม่ด้วยเพื่อดูว่าการย้อนลายมือเกิดก่อนการเอาหน้าออก
3. เขียนในสมุด 1 สองครั้ง Undo ครั้งหนึ่ง สลับไปเขียนสมุด 2 แล้วกลับสมุด 1; ต้อง Redo และ Undo งานเดิมต่อได้ โดยสมุด 2 ไม่เปลี่ยน
4. ปิด–เปิดตามปกติ; งานที่เซฟแล้วต้องครบ ประวัติ Undo/Redo เป็นของช่วงเปิดแอปและจะเริ่มใหม่หลังเปิดแอปใหม่
5. ดูสถานะบนแถบแท็บและภาษาที่เลือกไว้
6. หากลองลบโฟลเดอร์ทดลองถาวร รายการข้างในต้องยังเข้าถึงได้ที่โฟลเดอร์แม่

## จุดตรวจตามคำขอเพิ่มเติม

ช่วงแรกแก้เฉพาะข้อ 1 (Undo/Redo ของหน้า) และข้อ 3 (ประวัติข้ามแท็บ) แล้ว และหยุดให้ผู้ใช้ตรวจ
ช่วงภาษาและ 9 แท็บเสร็จแล้วตามคำอนุญาตเพิ่มเติม และหยุดรอผู้ใช้ตรวจ:
- เมนูลูกศรสมุดใช้คำแปลของ Rename / Duplicate / Export to PDF / Move / Move to Trash ครบทั้ง 4 ภาษา และเปลี่ยนได้ทันทีแม้เปิดเมนูอยู่
- ผู้ใช้เลือกให้แปลชื่อสำเนาเดิมเฉพาะการแสดงผล; ชื่อในฐานข้อมูลและชื่อไฟล์ส่งออกเดิมไม่ถูกเปลี่ยน การแก้ชื่อยังเริ่มจากชื่อจริงที่เซฟไว้
- สำเนาใหม่ใช้คำต่อท้ายตามภาษาที่เลือก หากมีสำเนาเดิมคนละภาษาที่แสดงชื่อเดียวกัน จะต่อเลขถัดไปโดยไม่เปลี่ยนชื่อเดิม
- เปิดสูงสุด 9 แท็บ คืนรายการเดิมครบ 9 หลังเปิดอีกครั้ง; เมื่อเปิดสมุดที่ 10 ใช้นโยบายเดิมแทนแท็บที่ใช้น้อยที่สุด โดยไม่ลบสมุดหรือประวัติที่ยังมีอยู่ในช่วงเปิดแอป
- แท็บย่อและเหลื่อมกันตามพื้นที่โดยคงพื้นที่กดชื่อและปิดแต่ละแท็บ; จอแคบมากใช้การเลื่อนแนวนอนเฉพาะแถบแท็บ แท็บที่เลือกจะเลื่อนเข้ามาให้เห็น
- ยังเปิดหน้าเขียนเฉพาะสมุดที่เลือก ไม่เก็บตัว editor หรือ Canvas ของทุกแท็บไว้พร้อมกัน
- ตรวจการกดทุกแท็บ/ปิดแต่ละแท็บบนจอ 1024, 1360 และ 1920 px รวมถึงจอแคบ 700 px ธีมสว่าง/มืด แป้นพิมพ์ และสลับ Undo/Redo ระหว่างแท็บแรกกับแท็บที่เก้า
- ตรวจชื่อ .bnote และชื่อใน payload ด้วย save picker จำลองในหน่วยความจำ ไม่สร้างไฟล์โน้ตทดลองลงเครื่อง

ให้ผู้ใช้ลองเลือก English แล้วเปิดเมนูลูกศรสมุด ตรวจชื่อสำเนาเดิม/สร้างสำเนาใหม่ จากนั้นเปิด 9 สมุดทดลอง สลับและปิดแท็บ ลองย่อหน้าต่าง และสลับกลับมา Undo/Redo ก่อนให้เริ่มเฟสถัดไป
ไม่ได้ commit หรือ push งานชุดนี้

## คำขอเพิ่มเติม: เมนูและปกหน้าแรก

- เอา Share และ Copy link ออกจากเมนูสมุดและตัวเรียกที่ไม่ได้มีระบบจริง รายการอื่นในเมนูยังเรียกด้วย notebook ID/ข้อมูลเดิม
- Cover Style มี Thumbnail เป็นค่าเริ่มต้นทุกครั้งที่เปิด New Notebook ปกสีเดิมทั้ง 8 แบบยังเลือกได้ สมุดเดิมคงปกที่เคยเลือกไว้
- หน้าคลังใช้ภาพย่อที่เก็บไว้ในข้อมูลสมุด หรือภาพกระดาษตัวอย่างขณะยังไม่มีภาพย่อ ไม่โหลด/วาดข้อมูลหน้าของสมุด Thumbnail แต่ละเล่มบนหน้า Documents
- หลังเปิดหรือแก้หน้าแรก จะรวมงานที่มาถี่ ๆ รอการเซฟหน้า แล้วสร้าง PNG ขอบยาวไม่เกิน 320 px ใน worker เดียว งานแก้หน้าถัดไปไม่สร้างปกใหม่โดยไม่จำเป็น
- ภาพย่อรวมพื้นหลังกระดาษ/PDF ลายมือ ข้อความ และรูปภาพตามลำดับชั้น; ไวท์บอร์ดครอบคลุมเนื้อหาที่อยู่ในพิกัดลบด้วย ปกแสดงทั้งหน้าโดยไม่ตัดขอบ
- เขียนเฉพาะ metadata ภาพปกเมื่อ first page ID/updatedAt ยังตรงกับภาพที่สร้าง ไม่เปลี่ยนชื่อ จำนวนหน้า วันที่ผู้ใช้แก้ หรือข้อมูลหน้า หากสร้างภาพไม่ได้จะเก็บปกเดิมและให้ลองใหม่เมื่อเปิด/แก้หน้าแรกครั้งถัดไป
- ปกตามการลบ/Undo/Redo ของหน้าแรก; ผลงานสร้างปกเก่าที่ถูกแทนด้วยงานใหม่จะถูกทิ้ง ฟอร์มเปลี่ยนชื่อ/รายการโปรดที่เปิดค้างไว้ไม่แทนที่ภาพปกที่ใหม่กว่า
- ตรวจเพิ่มเติม 9 unit cases และ 18 browser cases; รวมชุดเดิมเป็น 64 + 100 = 164 กรณีผ่าน ไม่พบ renderer error และตรวจ worker ที่ได้จาก production build โดยตรงในโปรไฟล์จำลอง
- Production build ผ่าน พร้อมไฟล์ worker ใน dist/assets ขนาดประมาณ 10 kB และ warning เดิมเรื่อง static/dynamic import และ bundle หลักเกิน 500 kB
- ไม่มีการเปลี่ยน schema/version ของ IndexedDB รูปแบบไฟล์ .bnote dependency หรือโค้ดปากกา/ส่งออก/สำรอง ไม่แตะข้อมูลจริง ไม่ commit/push และยังไม่เริ่มเฟส 2

ให้ผู้ใช้สร้างสมุดทดลองโดยใช้ปก Thumbnail เขียน/ใส่ภาพบนหน้าแรก กลับ Documents เพื่อตรวจปก ลองแก้หน้าอื่น ลบหน้าแรกแล้ว Undo/Redo และลองสร้างอีกเล่มด้วยปกสีเดิม ก่อนอนุญาตเฟสถัดไป

## แก้ Thumbnail ไม่อัปเดต (6 ตุลาคม 2026)

- ทำซ้ำปัญหาด้วยเมาส์จริงใน browser และสมุดจำลอง: หน้าเซฟลายมือครบ แต่คิวปกรอไม่สิ้นสุดเพราะ flag ปากกาของ editor ยังเป็น true หลังปล่อยเมาส์ การตรวจปกรอบก่อนใช้ forced flush จึงไม่ครอบคลุมการรออัตโนมัตินี้
- เปลี่ยนเฉพาะการรอของ Thumbnail ให้ติดตาม pointer down/up/cancel/lost capture/blur ผ่าน passive observers แยกจาก editor; ไม่เปลี่ยน global flags หรือโค้ดปากกา ภาพยังสร้างใน worker เดียวหลังรวมคำขอและรอเซฟหน้า
- ใช้ worker แบบ inline ที่ Vite bundle ไว้ในเครื่อง แล้วเปิดผ่าน Blob URL รองรับ origin แบบ file://; ตรวจ factory จาก production build ใน Chromium โปรไฟล์ใหม่ผ่านไฟล์ HTML จำลอง โดยไม่ลด web security และไม่เปิดแอปจริง
- เพิ่มการอ่านหน้าแรกสำหรับ Thumbnail ด้วย composite index notebookPage ที่มีอยู่แล้ว เพื่อตรงกับ pageIndex 0 แม้เพิ่มหน้าหรือ ID เรียงไม่ตรงลำดับหน้า; ตัวอ่านเดิมสำหรับส่วนอื่นและ schema ไม่เปลี่ยน
- เพิ่ม 4 unit checks และ 4 browser checks: เมาส์แล้วกลับ Home, ปากกา, เพิ่มหน้าแรกที่ ID เรียงหลังหน้าเดิม และ worker production ผ่าน file:// โดยกรณีอัตโนมัติไม่เรียก forced flush
- 68 unit + 104 browser = 172 กรณีผ่าน ไม่พบ renderer error; ยืนยันว่าข้อมูลหน้าเดิมไม่เปลี่ยนหลังสร้างปก Production build ผ่าน 2128 modules พร้อม warning เดิม
- รอบนี้แก้ source เฉพาะ notebookCoverService.js และเพิ่มตัวอ่าน Thumbnail ใน db.js พร้อม tests/บันทึกผล; ไม่เปลี่ยนระบบเซฟหน้า Undo/Redo สำรอง ส่งออก ภาษา แท็บ หรือ CanvasBoard

ให้ผู้ใช้ปิด–เปิดแอปที่ใช้ทดสอบ แล้วเปิดสมุดที่เลือกปก Thumbnail และกลับ Documents รอสักครู่เพื่อตรวจปกเดิมอัปเดต ลองเขียนด้วยเมาส์และ Surface Pen; การทดสอบปากกาข้างต้นเป็น pointer events จำลอง ยังต้องลองกับ Surface จริง
ยังไม่ commit/push และไม่เริ่มเฟสถัดไป

## ปรับ Thumbnail ให้สร้างเมื่อกลับหน้าคลัง (6 ตุลาคม 2026)

- ผู้ใช้อนุญาตให้ลดงาน Thumbnail ระหว่างเขียน โดยเริ่มสร้างเมื่อกลับ Documents และทำเฉพาะสมุดที่หน้าแรกเปลี่ยน
- ระหว่างอยู่ใน editor หรือสลับแท็บ คิวเก็บเฉพาะ notebook ID และรวมคำขอของเล่มเดียวกัน ไม่อ่านหน้าจาก DB ไม่สร้างภาพ และไม่ตั้ง timer วนตรวจ คิวอ่านข้อมูลที่เซฟล่าสุดต่อเมื่อหน้าคลังแสดง
- ถ้าหน้าแรกตรงกับปกที่เก็บไว้ตั้งแต่เปิดสมุด จะไม่เข้าคิว การเปิดสมุดเดิมหรือเขียนหน้าอื่นจึงไม่ทำให้ Thumbnail โหลด/สร้าง/เขียนปกใหม่
- App ควบคุมการพัก/เริ่มคิวตามพื้นที่ที่แสดง เมื่อเปิดสมุดระหว่าง worker สร้างภาพ จะยกเลิก worker เก็บ ID ไว้ แล้วอ่าน revision ล่าสุดเมื่อกลับหน้าคลังอีกครั้ง งานอ่าน/นำเข้าตัว worker ที่ถูกยกเลิกจะไม่เริ่มวาดหรือเซฟปกต่อ
- หน้าคลังยังใช้ภาพเดิมที่เก็บไว้ระหว่างรอ และได้รับภาพใหม่ผ่าน subscription; งานสร้างภาพยังทำทีละเล่มด้วย worker แบบออฟไลน์ ขอบยาวไม่เกิน 320 px และตรวจ first-page ID/revision ก่อนเขียน metadata
- การเซฟหน้าและประวัติ Undo/Redo เป็นคิวเดิม ไม่รอ Thumbnail และไม่เปลี่ยนรูปแบบข้อมูล/รูปแบบไฟล์สำรอง
- เพิ่ม 4 unit checks และ 4 browser checks: ไม่ทำงานระหว่างช่วงพักเขียน 3 ครั้ง, เปิดสมุดเดิม/แก้หน้า 2 ไม่ทำงานปก, คำขอจากหลายแท็บรวมเป็นครั้งเดียวต่อเล่มเมื่อกลับ Home และยกเลิก worker ที่ค้างก่อนลองใหม่จากข้อมูลล่าสุด
- ชุดอัตโนมัติวัดจำนวนการอ่านหน้า/ส่งงานเข้า worker/เขียนปกใน browser กับ React และ IndexedDB จริง ใช้ข้อมูลจำลองเท่านั้น ไม่เรียก forced flush; explicit flush เดิมใช้เฉพาะการตรวจ pipeline แบบแยก ไม่มีการเรียกจากระบบเซฟหรือปิดแอปจริง
- 72 unit + 108 browser = 180 กรณีผ่าน ไม่พบ renderer error; production build ผ่าน 2128 modules พร้อม warning เดิมเรื่อง static/dynamic import และ bundle หลักเกิน 500 kB
- เปลี่ยน source เฉพาะ notebookCoverService.js และ hooks ของ Thumbnail ใน App.jsx/NoteEditor.jsx พร้อม tests/บันทึกผล ยังไม่ commit/push และไม่เริ่มเฟสถัดไป

ให้ผู้ใช้ปิด–เปิดแอป เขียนหรือใส่ภาพในหน้าแรก เว้นช่วงเขียนและสลับแท็บ แล้วกลับ Documents ตรวจว่าปกอัปเดตจากงานล่าสุด ลองกลับไปเขียนทันทีระหว่างรอปกด้วย ความลื่นบน Surface จริงยังต้องให้ผู้ใช้ลอง

## ขอบเขตที่ยังไม่ยืนยัน

ไม่ได้เปิดแอปที่ติดตั้ง ไม่แตะฐานข้อมูลโน้ตจริง ไฟล์สำรองจริง หรือ Google Drive จริง
close guard ตรวจด้วย mock Electron และ renderer protocol ใน browser; ยังไม่ได้ทดลองวงจรปิดจริงบน Electron/Surface
เฟสแรกยังไม่แก้ความถูกต้องของสำรอง/กู้คืนทั้งหมด ไม่ยืนยันการอัปโหลดคลาวด์หรือย้ายเครื่องสำเร็จจนกว่าจะตรวจเฟส 2–3
ความหน่วงปากกา การเลื่อนหน้าใหญ่ และ RAM ต้องวัดบน Surface จริงหลังเฟส 4–5
การปิดตามปกติที่ตรวจในเฟสนี้ครอบคลุมงานที่ส่งเข้าคิวเซฟแล้ว; การเก็บ stroke/text draft ที่ยังไม่จบต้องตรวจเพิ่มในเฟสการเขียน

## เฟส 2: ระบบสำรองและสถานะ (6 ตุลาคม 2026)

ผู้ใช้อนุมัติแผนเฟส 2 และตำแหน่งสถานะด้วย “ตกลง” แล้วสั่ง “ต่อ”
เริ่มงานจาก checkpoint f620bec บน sol-work; ไม่เปลี่ยน branch ไม่ commit/push ระหว่างพัฒนา

- รอให้คิวเซฟหน้าและคิว Undo/Redo commit สำเร็จก่อนสำรอง อ่าน notebook และหน้าทั้งหมดของเล่มนั้นใน transaction เดียว; งานใหม่ระหว่างสำรองยังคงเป็น pending และเข้ารอบถัดไป
- แยกสถานะเซฟบนเครื่องออกจากสำรอง: ปุ่มข้างแถบแท็บ, ปุ่มบน Documents และรายละเอียดในหน้าสำรอง/Google Drive ใช้สถานะร่วมเดียวกัน รองรับภาษา en/th/zh/ru และ 9 แท็บ
- รายงานแยกโฟลเดอร์สำรองใน Documents ของเครื่องกับโฟลเดอร์ที่เลือก/Drive โดยนับสมุดที่แก้ไขได้ PDF และ snapshot ทั้งคลังตามรุ่นที่ตรวจยืนยัน พร้อมเวลารอบที่เสร็จจริง
- คำว่า Drive folder up to date ยืนยันว่าเขียนและตรวจไฟล์ในโฟลเดอร์แล้ว; BetterNote ยังไม่ยืนยันการอัปโหลดของ Google Drive Desktop ขึ้นคลาวด์ ไม่ใช้ connected flag หรือเวลาเดิมมาทำให้เป็นสีเขียว
- หลังมีการแก้ไข เปลี่ยนสถานะทันทีและรวมคำขอ รอประมาณ 10 วินาทีหลังการแก้ล่าสุดเพื่อสำรอง ไม่อ่าน metadata วนระหว่างช่วงหยุดท้ายเส้น ไม่อ่านหน้า/สร้าง PDF/สั่ง filesystem ทุก stroke
- ทำคิวทีละรอบและทีละสมุด งาน JSON/ตรวจ hash/เขียนไฟล์อยู่ใน Node worker; ใช้ async filesystem แยกผลและจำกัดเวลาของแต่ละปลายทาง ปลายทางหนึ่งล้มเหลวไม่ทำให้โฟลเดอร์ในเครื่องหายตามไปด้วย
- ตรวจไฟล์ชั่วคราวและอ่านกลับก่อน rename แทนไฟล์เดิม ไม่ unlink ไฟล์เดิมเพื่อบังคับให้ replace สำเร็จ; หลัง replace สำเร็จเก็บก่อนหน้าที่สมบูรณ์ไว้ไม่เกิน 3 รุ่นใน .history ของไฟล์ที่เปลี่ยน
- ผูกชื่อไฟล์สำรองใหม่กับ notebook ID; ชื่อซ้ำ ชื่อที่ Windows แปลงเหมือนกัน และ rename ไม่ทับอีกเล่ม ชื่อและไฟล์สำรองเดิมคงอยู่ในรายการและการอ่านสำรองเดิม
- รวม snapshot ตาม ID โดยเก็บสมุด/โฟลเดอร์ที่มีอยู่ที่ปลายทางแต่ไม่มีบนเครื่องนี้ไว้ หาก same-ID เดิมใหม่กว่า หรือเวลาเท่ากันแต่ข้อมูลหน้าไม่ตรง จะเก็บเดิมและแจ้งปัญหาแทนการเขียนทับ
- ฐานข้อมูลว่างไม่เขียนทับสำรองทั้งคลังด้วยข้อมูลว่าง; ย้ายเข้าถังขยะไม่ prune สำรอง การลบถาวรต้องมี ID และลบเฉพาะ ID นั้น ตรวจ manifest/path ก่อนลบและไม่สั่งซ้ำ
- PDF สำรองสร้างเฉพาะเมื่อเนื้อหาหน้าเปลี่ยน/ไฟล์หาย/ตรวจไม่ได้; rename หรือย้ายโฟลเดอร์ไม่ render PDF เดิมซ้ำ พัก PDF เมื่อมี contact หรือกำลังเซฟ แล้วลองรอบถัดไป
- ตัวสร้าง PDF สำหรับสำรองแยกจากคำสั่ง export เดิม ใช้ renderer ที่มีอยู่แบบจำกัด bitmap ที่ 150 DPI ตรวจการ decode ของรูปและจำนวนหน้า หากรูปเสียหรือสร้าง PDF ไม่ครบ ยังคงสำรอง .bnote แต่แสดง incomplete โดยไม่อัปเดตเวลาสำเร็จทั้งรอบ
- เก็บ original pdfBase64 ของสมุด ลายมือ ข้อความ รูปที่ล็อก พื้นหลัง PDF ขนาดกระดาษ และพิกัดติดลบของ whiteboard ใน editable/full snapshot
- ไม่เปลี่ยน DB version/stores/indexes, dependencies, package.json, package-lock.json, HANDOFF.md, โค้ดปากกา NoteEditor/CanvasBoard/WhiteboardBoard หรือคำสั่ง export ของผู้ใช้

ผลตรวจ: ชุดเดิม 72 unit + 108 browser ผ่าน และเฟส 2 เพิ่ม 48 unit/worker/filesystem + 35 browser/integration รวม 263 กรณีผ่าน
Browser ใช้ React และ IndexedDB จริง พร้อม Node worker ที่เขียนเฉพาะโฟลเดอร์จำลองในพื้นที่ QA; ไม่มี renderer exception
ตรวจหน้าต่าง 700/900/1024/1360/1920 px ภาษา 4 ภาษา คีย์บอร์ด ธีมสว่าง พาธยาว เซฟล้มเหลว งานใหม่ระหว่างสำรอง ปลายทางเขียนไม่ได้ และรูปเสีย
Production build ผ่าน 2132 modules; ยังมี warning static/dynamic import ของ autoBackupService/fileSystemService และ bundle หลักเกิน 500 kB
ไม่ติดตั้งหรืออัปเดต dependency; npm มี notice อัปเดตเวอร์ชันในรอบบิลด์ก่อนหน้าแต่ไม่ได้ดำเนินการ

ขอบเขตที่ยังต้องตรวจ: ไม่เปิดแอปที่ติดตั้ง ไม่อ่านฐานข้อมูลโน้ตจริง/Google Drive จริง/ไฟล์สำรองจริง และไม่เข้าถึงโฟลเดอร์ส่วนตัวที่ห้ามแตะ
เฟส 3 ยังไม่เริ่ม การเลือกไฟล์ที่ใหม่ที่สุด ตรวจไฟล์ก่อน restore และทดสอบย้ายเครื่องแบบครบกระบวนการยังอยู่ในเฟส 3
ยังไม่ยืนยันการอัปโหลด Drive หรือความลื่นบน Surface จริง; ปากกาที่ทดสอบเป็น synthetic pointer events

ให้ผู้ใช้ปิด–เปิดแอปที่ใช้ทดสอบเพื่อโหลด native worker ใหม่ ใช้สมุดทดลองตรวจสถานะ “Saved on this device” แยกจาก “Backup pending”
เปิดรายละเอียดจากแถบแท็บหรือ Documents แล้วกด Backup Now ตรวจผล editable/PDF/full snapshot และแต่ละโฟลเดอร์ ก่อนให้ผ่านไปเฟสถัดไป

รายการไฟล์ที่จะเซฟเฟส 2 มี 23 ไฟล์ (ยังไม่ stage/commit/push):

| ไฟล์ | สิ่งที่เปลี่ยน |
| --- | --- |
| [electron/main.cjs](<D:/AI WorkShop/Codex/BetterNotePC/electron/main.cjs>) | ส่งงานสำรองไป worker และเปิดโฟลเดอร์แบบ async |
| [electron/preload.cjs](<D:/AI WorkShop/Codex/BetterNotePC/electron/preload.cjs>) | ส่ง notebook ID สำหรับการลบสำรองถาวร |
| [electron/backupWriter.cjs](<D:/AI WorkShop/Codex/BetterNotePC/electron/backupWriter.cjs>) | ตรวจและเขียนไฟล์สำรอง เก็บรุ่นเดิม ป้องกันข้อมูลชน |
| [electron/backupWorkerClient.cjs](<D:/AI WorkShop/Codex/BetterNotePC/electron/backupWorkerClient.cjs>) | คิวรับส่งงานกับ worker และจัดการ worker ล้มเหลว |
| [electron/backup.worker.cjs](<D:/AI WorkShop/Codex/BetterNotePC/electron/backup.worker.cjs>) | ทำงานไฟล์ใน Node worker |
| [src/App.jsx](<D:/AI WorkShop/Codex/BetterNotePC/src/App.jsx>) | เปิดรายละเอียดจากแถบแท็บ และลบสำรองถาวรเพียงครั้งเดียว |
| [src/components/Common/DocumentTabBar.jsx](<D:/AI WorkShop/Codex/BetterNotePC/src/components/Common/DocumentTabBar.jsx>) | ปุ่มสถานะสำรองข้างสถานะเซฟในเครื่อง |
| [src/components/Common/BackupStatusIndicator.jsx](<D:/AI WorkShop/Codex/BetterNotePC/src/components/Common/BackupStatusIndicator.jsx>) | สถานะร่วมและผลแยกแต่ละปลายทาง |
| [src/components/Common/GoogleDriveModal.jsx](<D:/AI WorkShop/Codex/BetterNotePC/src/components/Common/GoogleDriveModal.jsx>) | ใช้ผลสำรองจริงและแยกการเขียนโฟลเดอร์จากคลาวด์ |
| [src/components/Library/LibraryView.jsx](<D:/AI WorkShop/Codex/BetterNotePC/src/components/Library/LibraryView.jsx>) | แสดงสถานะจริงและคงสำรองเมื่อย้ายสมุดเข้าถังขยะ |
| [src/components/Library/BackupStatusModal.jsx](<D:/AI WorkShop/Codex/BetterNotePC/src/components/Library/BackupStatusModal.jsx>) | รายละเอียดรุ่นล่าสุด จำนวนไฟล์ และผลของการลองสำรอง |
| [src/index.css](<D:/AI WorkShop/Codex/BetterNotePC/src/index.css>) | หน้าตาปุ่มและกรอบสถานะ รองรับพาธยาวและหน้าจอเล็ก |
| [src/services/autoBackupService.js](<D:/AI WorkShop/Codex/BetterNotePC/src/services/autoBackupService.js>) | เชื่อมคิวเซฟ ตัวตรวจช่วงเขียน และ controller |
| [src/services/backupController.js](<D:/AI WorkShop/Codex/BetterNotePC/src/services/backupController.js>) | คิวสำรอง สถานะตามรุ่นข้อมูล และการรอช่วงว่าง |
| [src/services/db.js](<D:/AI WorkShop/Codex/BetterNotePC/src/services/db.js>) | แจ้งเมื่อ transaction สำเร็จ และอ่าน snapshot ใน transaction เดียว |
| [src/services/i18n.js](<D:/AI WorkShop/Codex/BetterNotePC/src/services/i18n.js>) | ข้อความสถานะใหม่ 4 ภาษา |
| [src/utils/backupRevision.js](<D:/AI WorkShop/Codex/BetterNotePC/src/utils/backupRevision.js>) | ตัวระบุรุ่นข้อมูลขนาดเล็ก |
| [src/utils/backupPdf.js](<D:/AI WorkShop/Codex/BetterNotePC/src/utils/backupPdf.js>) | สร้าง PDF สำหรับสำรองพร้อมตรวจรูปและจำนวนหน้า |
| [tests/backup-controller.test.js](<D:/AI WorkShop/Codex/BetterNotePC/tests/backup-controller.test.js>) | ทดสอบคิว รุ่นข้อมูล และสถานะ |
| [tests/backup-writer.test.cjs](<D:/AI WorkShop/Codex/BetterNotePC/tests/backup-writer.test.cjs>) | ทดสอบไฟล์ล้มเหลว ชื่อซ้ำ รุ่นก่อน และข้อมูลจากหลายเครื่อง |
| [tests/backup-worker.test.cjs](<D:/AI WorkShop/Codex/BetterNotePC/tests/backup-worker.test.cjs>) | ทดสอบ Node worker จริงด้วยโฟลเดอร์จำลอง |
| [tests/backup-status.browser.cjs](<D:/AI WorkShop/Codex/BetterNotePC/tests/backup-status.browser.cjs>) | ทดสอบ React/IndexedDB/UI จริงกับ worker และข้อมูลจำลอง |
| [docs/SAFETY_PHASES.md](<D:/AI WorkShop/Codex/BetterNotePC/docs/SAFETY_PHASES.md>) | บันทึกขอบเขต ผลตรวจ และรายการไฟล์เฟส 2 |

ไฟล์ชั่วคราว core-js-banners และ node-compile-cache/ มีอยู่ก่อนเริ่มเฟส ไม่อ่าน ไม่ลบ และไม่รวมในการเซฟ
รอผู้ใช้ตอบ “ตกลง” ตามกติกาเซฟ Git ก่อน add/commit/push ไป sol-work; ห้าม push main

## เฟส 2 — รอบรวม Backup & Sync และปรับคิว Local (2026-10-07)

Checkpoint ก่อนรอบนี้เซฟและ push ไป sol-work แล้ว: badcc7948a76d581f5268d0f20c056e43b1c7ace (ปรับระบบสำรองและสถานะ)
ข้อความ “ยังไม่ stage/commit/push” ในรายงานเฟส 2 ก่อนหน้าคือสถานะขณะรายงานครั้งนั้น; checkpoint นั้นเสร็จแล้ว
รอบใหม่ด้านล่างยังไม่ stage/commit/push และรอผู้ใช้ตรวจ พร้อมคำตอบ “ตกลง” ตามกติกา Git ของผู้ใช้

งานรอบนี้:
- รวมหน้าต่าง Local/Google Drive เป็น Backup & Sync หนึ่งหน้าต่าง สองแท็บ กว้าง 94% ของหน้าจอ ปุ่มจากแถบแท็บ Documents และ Settings เปิดหน้าต่างเดียวกัน
- Local ใช้โฟลเดอร์ที่เลือกแทนโฟลเดอร์เริ่มต้น มีผล จำนวนไฟล์ ขนาด เวลา และรายชื่อไฟล์ของปลายทางนั้น ไม่สร้าง Local สองสำเนาโดยอัตโนมัติ ไม่ลบหรือย้ายไฟล์ในโฟลเดอร์เดิม
- ยืนยัน .bnote และ full snapshot ก่อนสร้าง PDF; ข้อมูลกู้คืนครบแล้วจะแสดงครบแม้ PDF ยังทำต่อหรือมีรูปเสีย แยก PDF pending/error และปุ่มลองใหม่เฉพาะเล่ม
- ไม่อ่าน snapshot สมุดที่ข้อมูลไม่เปลี่ยน ไม่ render PDF เดิมเมื่อเปลี่ยนเฉพาะชื่อ ใช้ digest cache ขนาดจำกัดพร้อม stat ก่อน/หลัง และตรวจ hash ลึกเมื่อผู้ใช้สั่งตรวจหรือรอบตรวจรายชั่วโมง
- ส่งความคืบหน้าของไฟล์/จำนวนสมุด/หน้า PDF ตามงานจริง งานไฟล์อยู่ใน Node worker; แคชภาพ PDF จำกัด 12 MiB/8 หน้า เก็บ PDF ที่ค้างเพียงหนึ่งเอกสารช่วงสั้น และหยุดงาน PDF ระหว่างมี contact
- วิธี Google account แสดงการเชื่อมต่อเมื่อ provider ยืนยันเท่านั้น ไม่ใช้ saved connected flag หรือ Local path แทนบัญชี
- วิธี Drive Desktop ให้เลือกโฟลเดอร์ซิงค์อย่างชัดเจน แสดงไฟล์ที่เตรียมในโฟลเดอร์นั้น ผลของแท็บ Drive ไม่ใช้ผล Local มาตอบสำเร็จ และยังบอกตรง ๆ ว่า BetterNote ไม่ยืนยันการอัปโหลดคลาวด์
- คงการเขียนแบบไฟล์ชั่วคราว ตรวจอ่านกลับก่อน replace รุ่นก่อนหน้า และการกันข้อมูลจากเครื่องเก่าทับข้อมูลใหม่; คงช่องทาง restore เดิมโดยไม่ปรับอัลกอริทึม restore ในรอบนี้

ผลตรวจรอบนี้:
- 130 unit/native worker/filesystem ผ่านทั้งหมด
- 108 browser regression เดิมผ่านทั้งหมด: การเซฟ Undo/Redo หน้า แท็บ ภาษา รูปที่ล็อก และ thumbnail
- 39 browser/integration สำหรับหน้าต่างรวมผ่านทั้งหมด รวม 277 กรณี ไม่มี renderer exception
- ทดสอบด้วย React และ IndexedDB จริง เชื่อม native worker ที่เขียนเฉพาะโฟลเดอร์ QA และใช้โปรไฟล์เบราว์เซอร์แยกที่บล็อกเครือข่าย; OAuth ใช้คำตอบจำลอง ไม่ใช่บัญชี Google จริง
- ตรวจความกว้าง 700/900/1024/1360/1920 px ทั้ง 4 ภาษา การใช้คีย์บอร์ด ธีมสว่าง ข้อมูลมาก่อน PDF รูปเสีย การทำ PDF ต่อหลังหยุด การแก้ระหว่างสำรอง เซฟ local ล้มเหลว และ Drive เขียนไม่ได้แต่ Local สำเร็จ
- Production build ผ่าน 2133 modules; ยังมี warning static/dynamic import ของ autoBackupService/fileSystemService และ bundle เกิน 500 kB
- ตรวจ hash เทียบ checkpoint: CanvasBoard/NoteEditor/WhiteboardBoard, db.js, ตัว export เดิม, package.json, package-lock.json และ HANDOFF.md ไม่เปลี่ยน
- ตรวจรายชื่อไฟล์ Git: ไม่พบ .env/.env.*, .bnote หรือ BetterNote_Latest_Backup.json ที่จะติดไป และไม่มี staged file

ขอบเขตที่ยังไม่ยืนยัน: ไม่ทดสอบบัญชี Google จริง ไม่อ่านโน้ต/สำรอง/Drive จริง และไม่เปิดแอปที่ติดตั้งไว้
ขั้นถัดไปหลังผู้ใช้ตรวจรอบนี้คือการอัปโหลดตรง พร้อมผลตอบรับ Google/รายชื่อไฟล์ที่ยืนยันแล้ว/ความคืบหน้า/ทำต่อเมื่อสะดุด
ยังไม่เริ่มเฟสกู้คืนและย้ายเครื่องครบกระบวนการ หรือเฟสปากกา; ผลจำลองไม่ยืนยันความลื่นบน Surface จริง

ตรวจรอบนี้ในแอปทดสอบ: ปิดและเปิดใหม่เพื่อโหลด native worker ใหม่ ใช้สมุดทดลอง เปิด Backup & Sync จากปุ่มสถานะ
ตรวจ Local ให้เหลือหนึ่งโฟลเดอร์ ดู .bnote/full snapshot แยกจาก PDF จากนั้นสลับแท็บ Google Drive และตรวจว่าผลเขียนโฟลเดอร์ไม่ถูกเรียกว่าขึ้นคลาวด์แล้ว

รายชื่อไฟล์รอบใหม่ที่จะขอเซฟมี 23 ไฟล์:

| ไฟล์ | สิ่งที่เปลี่ยน |
| --- | --- |
| [electron/backup.worker.cjs](<D:/AI WorkShop/Codex/BetterNotePC/electron/backup.worker.cjs>) | ส่งความคืบหน้าจาก worker |
| [electron/backupWorkerClient.cjs](<D:/AI WorkShop/Codex/BetterNotePC/electron/backupWorkerClient.cjs>) | รับ progress และตรวจการหยุดตอบสนองของงาน |
| [electron/backupWriter.cjs](<D:/AI WorkShop/Codex/BetterNotePC/electron/backupWriter.cjs>) | หนึ่ง Local ปลายทาง ตรวจ hash ข้ามไฟล์เดิม และแยกข้อมูลกู้คืนจาก PDF |
| [electron/main.cjs](<D:/AI WorkShop/Codex/BetterNotePC/electron/main.cjs>) | ส่ง progress ให้หน้าจอแบบจำกัดความถี่ |
| [electron/preload.cjs](<D:/AI WorkShop/Codex/BetterNotePC/electron/preload.cjs>) | ช่องรับ progress และยกเลิก listener |
| [src/App.jsx](<D:/AI WorkShop/Codex/BetterNotePC/src/App.jsx>) | ใช้หน้าต่างสำรองส่วนกลางหนึ่งหน้าต่าง |
| [src/components/Common/BackupStatusIndicator.jsx](<D:/AI WorkShop/Codex/BetterNotePC/src/components/Common/BackupStatusIndicator.jsx>) | แยกผลข้อมูลกู้คืนกับ PDF และผลตามปลายทาง |
| [src/components/Common/BackupFilesTable.jsx](<D:/AI WorkShop/Codex/BetterNotePC/src/components/Common/BackupFilesTable.jsx>) | ตารางไฟล์ จำนวน ขนาด เวลา และลอง PDF ใหม่เฉพาะเล่ม |
| [src/components/Common/GoogleDriveModal.jsx](<D:/AI WorkShop/Codex/BetterNotePC/src/components/Common/GoogleDriveModal.jsx>) | ทางเปิดเดิมพาไปหน้าต่างรวม |
| [src/components/Common/GoogleDrivePanel.jsx](<D:/AI WorkShop/Codex/BetterNotePC/src/components/Common/GoogleDrivePanel.jsx>) | บัญชี Google และ Drive Desktop แยกจาก Local ไม่อ้างการอัปโหลดที่ไม่มีผลยืนยัน |
| [src/components/Library/BackupStatusModal.jsx](<D:/AI WorkShop/Codex/BetterNotePC/src/components/Library/BackupStatusModal.jsx>) | หน้าต่างกว้างสองแท็บและผลของแท็บที่เลือก |
| [src/components/Library/LibraryView.jsx](<D:/AI WorkShop/Codex/BetterNotePC/src/components/Library/LibraryView.jsx>) | ปุ่มเดิมพาไปหน้าต่างส่วนกลาง |
| [src/components/Library/SettingsModal.jsx](<D:/AI WorkShop/Codex/BetterNotePC/src/components/Library/SettingsModal.jsx>) | เหลือหนึ่งทางเข้า Backup & Sync |
| [src/index.css](<D:/AI WorkShop/Codex/BetterNotePC/src/index.css>) | หน้าต่างใหม่ รองรับหน้าจอแคบ ธีม และคีย์บอร์ด |
| [src/services/autoBackupService.js](<D:/AI WorkShop/Codex/BetterNotePC/src/services/autoBackupService.js>) | ตั้ง Local/Drive คนละปลายทางและรับ progress |
| [src/services/backupController.js](<D:/AI WorkShop/Codex/BetterNotePC/src/services/backupController.js>) | ยืนยันข้อมูลก่อนทำ PDF ต่อและข้ามสมุดที่ไม่เปลี่ยน |
| [src/services/i18n.js](<D:/AI WorkShop/Codex/BetterNotePC/src/services/i18n.js>) | ข้อความใหม่ครบ 4 ภาษา |
| [src/utils/backupPdf.js](<D:/AI WorkShop/Codex/BetterNotePC/src/utils/backupPdf.js>) | แคชจำกัดขนาดและทำต่อจากหน้าที่ค้าง |
| [tests/backup-controller.test.js](<D:/AI WorkShop/Codex/BetterNotePC/tests/backup-controller.test.js>) | ตรวจคิว สถานะ และข้อมูลก่อน PDF |
| [tests/backup-status.browser.cjs](<D:/AI WorkShop/Codex/BetterNotePC/tests/backup-status.browser.cjs>) | ตรวจ React/IndexedDB/หน้าจอจริงด้วยข้อมูลจำลอง |
| [tests/backup-worker.test.cjs](<D:/AI WorkShop/Codex/BetterNotePC/tests/backup-worker.test.cjs>) | ตรวจ native worker |
| [tests/backup-writer.test.cjs](<D:/AI WorkShop/Codex/BetterNotePC/tests/backup-writer.test.cjs>) | ตรวจไฟล์จริงในโฟลเดอร์จำลอง |
| [docs/SAFETY_PHASES.md](<D:/AI WorkShop/Codex/BetterNotePC/docs/SAFETY_PHASES.md>) | บันทึกงานและผลตรวจรอบนี้ |

core-js-banners และ node-compile-cache/ เป็นไฟล์ชั่วคราวเดิม ไม่อ่าน ไม่ลบ และไม่รวมเซฟ

## เฟส 2 — คงสองทางเชื่อม Google และแก้เส้นทางล็อกอิน (2026-10-07)

ผู้ใช้ยืนยันว่าต้องมีทั้ง Google Drive for desktop และทาง Google account ที่ไม่ต้องติดตั้ง Drive ผู้ใช้ปลายทางต้องไม่กรอก Client ID
ผู้ใช้ยืนยันว่าเครื่องเดิมใช้ Drive for desktop และยังไม่แน่ใจว่าเข้าถึง Google Cloud project เดิมได้หรือไม่

งานที่ทำเพิ่ม:
- คงตัวเลือกทั้งสองไว้ ใช้ Desktop เป็นค่าเริ่มต้นเมื่อยังไม่มีค่าที่เลือกไว้ และจำวิธีที่ผู้ใช้เลือก
- ปุ่มเชื่อมของ Desktop เปิด GoogleDriveFS.exe ที่ติดตั้งไว้ เพื่อให้ผู้ใช้ลงชื่อเข้าใช้/เลือกบัญชีในแอป Google จากนั้นเลือกโฟลเดอร์ซิงค์ครั้งแรก
- ตรวจเฉพาะ executable ที่อยู่ในโฟลเดอร์ติดตั้งของ Google ภายใต้ Program Files ไม่สแกนข้อมูลผู้ใช้หรือโฟลเดอร์ Drive เปิดจากปุ่มที่ผู้ใช้กดเท่านั้น ไม่ติดตั้งแอปแทน
- ทางตรงบน Electron ใช้ browser ของระบบ, OAuth authorization code + PKCE และ callback ชั่วคราวบน 127.0.0.1 แทนการใช้เว็บ OAuth JavaScript จาก file:// หรืออาศัยว่าหน้าเว็บ Drive เปิดได้แล้ว
- ตรวจ state/host/method/path, แลก code ที่ endpoint Google ที่กำหนดตายตัว และตรวจบัญชีกับ userinfo; สถานะ connected ต้องมีผลตอบรับจริง ไม่ใช้ stored flag
- ยกเลิกและหมดเวลาได้ ปิด listener เมื่อจบ/ยกเลิก/ปิดแอป ป้องกันผลที่มาช้าหลังยกเลิกจากการกลับมาเปิด connected
- access token อยู่ในหน่วยความจำ ไม่เซฟ token ใหม่ลงฐานข้อมูลโน้ต; ข้อความผิดพลาดแสดงเหตุผลที่กำหนด ไม่แสดง payload/รหัส/ค่าลับ
- ข้อความครบ 4 ภาษา และทั้งสองวิธียังไม่อ้างว่าสำรองขึ้นคลาวด์แล้วจากเพียงการเปิดแอป/การล็อกอิน/การเขียนโฟลเดอร์

หลักฐานขอบเขตเดิม: HANDOFF.md หัวข้อ Google OAuth API Direct Sync ระบุ DEFAULT_GOOGLE_CLIENT_ID ว่าง และรุ่น PC อาศัย Drive for desktop
โค้ด sign-in เดิมเปิด AccountChooser และเก็บ connected flag ส่วนคำสั่ง backup ใน Electron ใช้ folder writer
การตรวจไฟล์ googleConfig.js ของ repo และสำเนาโค้ด Full_System_Backup แบบอ่านอย่างเดียวพบค่ารหัสแอปว่าง ไม่อ่านไฟล์สำรองข้อมูลหรือโน้ตในสำเนานั้น

ผลตรวจล่าสุด:
- 152 unit/native/worker/filesystem ผ่านทั้งหมด (รวม native auth/Desktop launcher 22 กรณี)
- 44 browser/integration ของหน้าต่างรวมและการเชื่อมสองแบบผ่านทั้งหมด ใช้ service จริงกับคำตอบ provider จำลอง
- 108 browser regression ผ่านซ้ำหลังเปลี่ยนส่วนเชื่อม Google: เซฟ Undo/Redo แท็บ ภาษาและ thumbnail
- รวม 304 กรณีผ่าน ไม่มี renderer exception และ production build ผ่าน 2133 modules
- warning เดิมเรื่อง static/dynamic import และ bundle เกิน 500 kB ยังมีอยู่
- callback ทดสอบด้วย HTTP listener จริงบน localhost; Google endpoints เป็นตัวแทนจำลอง ไม่มีการเปิด browser ล็อกอินจริงหรืออ่าน/เขียน Drive จริง
- ตรวจ metadata พบ GoogleDriveFS.exe ในเครื่องนี้ แต่ไม่ได้เปิดโปรแกรมหรืออ่านไฟล์ข้อมูล Drive ระหว่างตรวจ
- ก่อนรับ public Client ID ตรวจ hash: editor/ปากกา/Undo/db.js/export engine/package.json/package-lock.json/HANDOFF.md/googleConfig.js ไม่เปลี่ยน; การตั้งค่ารหัสแอปรอบถัดไปบันทึกแยกด้านล่าง
- packaging เดิมรวม electron/**/* อยู่แล้ว จึงรวม native modules ใหม่โดยไม่แก้ package.json

สิ่งที่ยังไม่เสร็จและต้องได้ข้อมูลภายนอก:
- เจ้าของแอปสร้าง Google Cloud project และตั้งค่า OAuth แบบ Desktop app แล้วตามภาพ/ชื่อไฟล์ที่ส่ง; public Client ID ถูกตั้งในแอปแล้ว ยังต้องตรวจ Audience/Test users และลองล็อกอินกับ Google จริง
- ยังไม่ผ่านการลองล็อกอินกับบัญชี Google จริง และยังไม่ทดสอบอัปโหลด/restore/ย้ายเครื่องผ่าน Google จริง
- ข้อความ “connected” ไม่ใช้แทนหลักฐานการอัปโหลด; direct upload ledger/progress/refresh-token persistence ยังเป็นงานขั้นต่อไปหลังเชื่อมและตรวจรอบนี้
- ไม่เพิ่มช่องตั้ง Client ID ให้ผู้ใช้ปลายทาง เมื่อได้ public Client ID ของแอปจะตั้งฝั่งแอปและทดสอบการเลือกบัญชีกับผู้ใช้โดยให้ผู้ใช้ล็อกอินเอง
- หยุดรอผู้ใช้ตรวจรอบนี้และการตั้งค่า Google Cloud ไม่เริ่มเฟสกู้คืนหรือปากกา
- งานทั้งหมดรอบหน้าต่างรวม + การเชื่อมยังไม่ stage/commit/push รอ “ตกลง” ตามกติกา Git ของผู้ใช้

รายชื่อเดิม 23 ไฟล์ด้านบนยังเป็นขอบเขตเดิมของรอบที่ยังไม่เซฟ มีเพิ่มอีก 5 ไฟล์ รวมเป็น 28 ไฟล์:
| ไฟล์เพิ่มเติม | สิ่งที่เปลี่ยน |
| --- | --- |
| [electron/driveDesktop.cjs](<D:/AI WorkShop/Codex/BetterNotePC/electron/driveDesktop.cjs>) | หาและเปิดแอป Drive ที่ติดตั้งไว้จาก IPC ของหน้าต่างหลักเท่านั้น |
| [electron/googleDesktopAuth.cjs](<D:/AI WorkShop/Codex/BetterNotePC/electron/googleDesktopAuth.cjs>) | OAuth ผ่าน browser ระบบและ PKCE/callback ตรวจผล Google |
| [src/services/googleDriveService.js](<D:/AI WorkShop/Codex/BetterNotePC/src/services/googleDriveService.js>) | เชื่อม native auth เก็บ token ในหน่วยความจำ และยกเลิกผลที่มาช้า |
| [tests/drive-desktop.test.cjs](<D:/AI WorkShop/Codex/BetterNotePC/tests/drive-desktop.test.cjs>) | ตรวจตัวเปิดแอปแบบจำลองและการตรวจ trusted frame |
| [tests/google-desktop-auth.test.cjs](<D:/AI WorkShop/Codex/BetterNotePC/tests/google-desktop-auth.test.cjs>) | ตรวจ PKCE/callback/cancel/timeout ด้วย provider จำลองและ localhost จริง |

ไฟล์ชั่วคราว core-js-banners และ node-compile-cache/ ไม่รวมเซฟ; ไม่พบ .env/.env.*, .bnote หรือ BetterNote_Latest_Backup.json ในรายการไฟล์ Git

## เฟส 2 — ตั้ง public OAuth Client ID (2026-10-07)

- ผู้ใช้ส่งชื่อไฟล์ credentials และกำชับไม่เผยแพร่ข้อมูลลับ เครื่องมือไม่พบไฟล์ JSON ตามตำแหน่งที่แนบ จึงใช้เฉพาะ public Client ID ที่อยู่ในชื่อไฟล์ ไม่คัดลอกไฟล์ credentials และไม่อ่าน/ใส่ Client secret ในโค้ด
- ตั้งค่าเฉพาะ DEFAULT_GOOGLE_CLIENT_ID ใน src/config/googleConfig.js ไม่แก้ส่วนเขียนโน้ต การเซฟ ปากกา หรือระบบอื่น
- รูปแบบ public Client ID ผ่านตัวตรวจของ native auth; ยังไม่ใช่หลักฐานยืนยันว่าล็อกอินหรืออัปโหลดได้จริง
- ทดสอบ native OAuth และ Drive Desktop ซ้ำ 22 กรณีผ่านทั้งหมดด้วย provider จำลอง; production build ผ่าน 2133 modules มี warning เดิมเรื่อง static/dynamic import และ bundle เกิน 500 kB
- ตรวจรายชื่อไฟล์ Git ไม่พบ .env/.env.*, .bnote, BetterNote_Latest_Backup.json หรือ client_secret*.json; ตรวจ source/docs/tests ไม่พบค่าลับตามรูปแบบ credential ที่ตรวจ โดยไม่แสดงค่า
- ยังไม่ล็อกอินบัญชีจริง ไม่เปิดแอปผู้ใช้ ไม่อ่าน/อัปโหลดโน้ตหรือข้อมูล Drive ไม่ stage/commit/push
- รอบที่ยังไม่เซฟเพิ่ม src/config/googleConfig.js จาก 28 เป็น 29 ไฟล์; ต้องให้ผู้ใช้ตรวจรายการและตอบตกลงก่อนเซฟตามกติกาเดิม


## เฟส 2 — แก้การสำรองหยุดทั้งโฟลเดอร์เมื่อสมุดขัดแย้ง (2026-10-07)

- ภาพผู้ใช้แสดง Editable notes 9/11 และ PDF 0/11 พร้อมแจ้งข้อมูลใหม่กว่าหรือขัดแย้ง; จากภาพยังระบุสมุดต้นเหตุจริงไม่ได้ ไม่ได้เปิดอ่านข้อมูลโน้ต/ไฟล์สำรองจริงของผู้ใช้
- ยืนยันด้วยกรณีจำลองว่า conflict ของสมุดเล่มเดียวเคยหยุดการเขียนเล่มถัดไปทั้งปลายทาง แก้ให้พักเฉพาะเล่มที่ขัดแย้งและสำรองเล่มอื่น/PDF ที่ปลอดภัยต่อได้
- รักษาไฟล์สมุดที่ขัดแย้งและ Full_System snapshot เดิม ไม่เขียนทับเพื่อให้สถานะดูสำเร็จ; snapshot รวมยัง pending จนทุกเล่มผ่าน
- บันทึกเฉพาะข้อมูลปัญหาใน manifest เพื่อให้เปิดแอปใหม่หรือ retry แล้วไม่เปลี่ยนเป็นสำเร็จผิด; ตรวจซ้ำเล่มนั้นก่อนนำกลับมาใช้ verified cache
- หน้าสำรองแสดงชื่อเล่ม สาเหตุ เวลาแก้ไขของเครื่อง/สำรอง และคำแนะนำเลือกโฟลเดอร์ว่างใหม่เพื่อสำรองแยก เก็บไฟล์เดิมไว้; รองรับ en/th/zh/ru
- ไม่แก้ปากกา Undo การเปิดโน้ตหรือระบบ OAuth/บริการ cloud ที่พักไว้ ไม่เปิดแอป/บัญชีจริง ไม่อัปโหลดโน้ต ไม่ commit/push
- ตรวจ native/controller/worker/Drive launcher 72 กรณี และ browser integration 45 กรณี (ข้อมูลจำลองใน QA directory เท่านั้น); production build ผ่าน พร้อม warning เดิมเรื่องการแบ่ง module และขนาด bundle


## เฟส 2 — เปิดเฉพาะ Drive Desktop (2026-10-07)

- Google Drive for desktop เป็นตัวเลือกแรกพร้อม Recommended คำแนะนำและลิงก์ดาวน์โหลดทางการ; การเชื่อมโดยตรงแสดง Coming soon และไม่มีจุดเรียก OAuth จากหน้าสำรอง รองรับ 4 ภาษา
- ค่า direct เดิมไม่ถูกนำไปใช้เป็นโฟลเดอร์ Desktop โดยอัตโนมัติ ต้องเลือกโฟลเดอร์ให้ชัดเจน
- ทดสอบระบบสำรอง/worker/launcher 72 กรณี และ browser integration 41 กรณีผ่าน; build ผ่าน 2131 modules มี warning เดิมเรื่องแบ่ง module และขนาด bundle
- ผู้ใช้อนุญาตพาธ I:/My Drive/BetterNote.AppPC; ทดสอบเฉพาะโฟลเดอร์ย่อยใหม่ BetterNote-Phase2-Test-WplzjN ด้วยสมุดจำลอง ไม่อ่านหรือแก้สำรองเดิม
- ข้อ 1 เตรียมไฟล์: ผ่าน; ข้อ 2 ความครบถ้วน: ผ่าน .bnote 2, PDF 2, snapshot รวม 1 พร้อม manifest และตรวจอ่านกลับ
- ข้อ 3 การขึ้นคลาวด์: รอผู้ใช้ตรวจไฟล์บนเว็บ Google Drive; ความสำเร็จของ filesystem ไม่ใช่หลักฐาน cloud upload จึงยังไม่ปิดเฟส 2
- ยังไม่ได้ commit/push และไม่ได้เริ่มเฟสถัดไป


## ปิดเฟส 2 และตรวจโค้ดก่อนเฟส 3 (2026-10-07)

- ผู้ใช้ตอบว่าผ่าน หลังตรวจการขึ้นคลาวด์ของชุดทดสอบใน BetterNote-Phase2-Test-WplzjN; บันทึกเป็นผลยืนยันจากผู้ใช้ ไม่เปลี่ยน cloudUploadVerified ของแอปให้เป็น true จาก filesystem
- ตรวจ source ของ writer/worker/controller/PDF/UI/ตัวเรียก Drive/ส่วนประกอบ App/ภาษา/CSS และโค้ด OAuth ที่พักไว้ พร้อมอ่านตัวเชื่อม restore เพื่อระบุขอบเขตเฟส 3
- พบและทำซ้ำบั๊กจริง: Local current แต่เลือก Drive ใหม่ คิว idle ไม่ run เพราะเช็กเฉพาะ Local แก้ให้คำนึงถึงทุกปลายทาง และตอนเริ่มแอปและการตรวจประจำรอบตรวจ PDF/ข้อมูลทุกปลายทางด้วย
- เพิ่ม regression tests 3 กรณี: ตอนเลือกโฟลเดอร์ใหม่ใช้ writer จริงใน QA และตอนเริ่มแอป/ตรวจประจำรอบใช้เวลาจำลอง; ก่อนแก้ล้มเหลว หลังแก้ Drive ถูกสำรองอัตโนมัติพร้อมสมุด/PDF/snapshot โดยไม่ต้องแก้เนื้อหาหรือกดสำรองเอง
- 115 unit/integration tests (75 ระบบสำรอง/Drive launcher + 40 OAuth ที่พักไว้) และ 41 browser checks ผ่านรวม 156; build ผ่าน 2131 modules พร้อม warning เดิม; git diff --check ผ่าน
- ไม่พบ .env/.env.*, client_secret*.json, .bnote หรือ BetterNote_Latest_Backup.json ในรายการ Git และไม่พบรูปแบบ credential จริงที่ใช้ตรวจใน source/docs/tests; ไม่อ่าน credentials ของผู้ใช้
- เฟส 3 ยังไม่เริ่ม: ต้องแก้การเลือกข้อมูลเก่าจาก full snapshot ก่อน editable รุ่นใหม่ การ fallback ข้ามโฟลเดอร์ และการ restore ทีละรายการโดยไม่มี transaction รวม
- รายงานละเอียดอยู่ docs/PHASE2_REVIEW.md; รอบตรวจนี้แก้ source เฉพาะสามเงื่อนไขคิวใน backupController.js พร้อม test/เอกสาร ไม่แก้โน้ตจริง ไม่เขียน Drive เพิ่ม ไม่ commit/push

## เฟส 3.1: ตรวจและเลือกไฟล์สำรอง (7 ตุลาคม 2026)

- ตัวอ่านสำรองเป็น worker แยกจาก writer เริ่มเมื่อมีคำขอเท่านั้น ใช้ I/O แบบ async และจำกัดเวลารอ ไม่อ่านหรือเขียนฐานข้อมูลโน้ตด้วยตัวเอง
- โฟลเดอร์ที่ระบุหรือที่ตั้งไว้มีสิทธิ์เหนือการค้นหาเดิม: อ่านจากที่เลือกเท่านั้น ไม่มีการข้ามไปใช้สำรองจากที่อื่นเมื่ออ่านไม่ได้ หากยังไม่ได้เลือกและค้นพบหลายแหล่ง จะขอให้เลือก ไม่รวมไฟล์ข้ามปลายทาง
- ตรวจสมุดด้วย ID; ชื่อเหมือนกันไม่ทำให้สมุดอีกเล่มหายจากรายการ เลือกระหว่างไฟล์รวมกับ .bnote ในโฟลเดอร์เดียวกันตามฉบับที่ใหม่กว่า หากเวลาเท่ากันแต่เนื้อหาต่างกันจะหยุดและรายงานขัดแย้ง การตัดสินความขัดแย้งระหว่างสองเครื่องยังเป็นงาน 3.3
- สำรองรุ่น v2 ตรวจ manifest และไฟล์ที่ต้องมี ก่อนกู้คืนตรวจขนาด/hash/รหัสสมุด/จำนวนหน้า/ลำดับหน้า/รหัสหน้าซ้ำ/การเชื่อมโฟลเดอร์/ข้อมูลลายมือ รูปและข้อความ ไม่ข้ามไฟล์ที่เสียแล้วนำเข้าครึ่งชุด
- ตรวจไฟล์เปลี่ยนระหว่างอ่าน จำกัดการอ่านแต่ละช่วง 1 MiB และปิด file handle; ขีดจำกัดเริ่มต้นคือไฟล์ละ 256 MiB, จำนวนไบต์ที่อ่านรวมต่อการตรวจ 512 MiB, manifest 8 MiB และ .bnote 10,000 ไฟล์ หากเกินให้แจ้งเหตุผลและไม่ส่งข้อมูลไปนำเข้า
- หน้าหลักขอรายการสมุดแบบย่อ สำรอง v2 ไม่โหลดรูป/ลายมือ/ไฟล์รวมในขั้นแสดงรายการ สำรองเดิมที่ไม่มี manifest ใช้แคชรายการย่อสูงสุด 4 โฟลเดอร์และตรวจการเปลี่ยนไฟล์ก่อนใช้แคช ไม่มีการเก็บข้อมูลหน้าหรือรูปไว้ในแคชนี้
- การเปลี่ยนชื่อ/เวลาแก้ไข/thumbnail โดยรหัสสมุดไม่เปลี่ยน ไม่สั่งไล่อ่านสำรองซ้ำ ข้อผิดพลาดการกู้คืนแสดงตามภาษา en/th/zh/ru และไม่รายงานสำเร็จเมื่อไม่มีข้อมูลสำหรับนำเข้า

หลักฐานการตรวจ: 54 native/unit cases ของ reader และการเลือกโฟลเดอร์, 9 browser checks ของ Library/IndexedDB/ภาษา, 75 native cases เดิมของ writer/controller/Drive desktop และ 41 browser checks เดิม รวม 179 กรณีผ่าน บิลด์ผ่าน 2,132 modules พร้อม warning เรื่อง chunk เดิม

ขอบเขตที่ยังไม่เสร็จ: 3.2 การนำเข้าทั้งชุดใน transaction พร้อมคืนข้อมูลเดิมเมื่อพลาด/พักคิวสำรอง, 3.3 รับการแก้ไขสมุดเดิมข้ามเครื่องโดยใช้ฐานฉบับร่วมและเก็บทั้งสองฉบับเมื่อชนกัน, 3.4 ทดสอบย้ายเครื่องครบเส้นทาง งาน 3.1 ยังไม่ทำให้สมุดเดิมบนเครื่อง B รับรอยเขียนจาก A โดยอัตโนมัติ และยังไม่ควรใช้การกู้คืนเดิมเป็นหลักฐานว่าการอัปเดตสองเครื่องพร้อมใช้งาน

ทดสอบด้วยโน้ต/ไฟล์จำลองในพื้นที่ QA และเบราว์เซอร์แยก ไม่ได้อ่าน credential, ไม่ได้ทดสอบบน Surface จริงหรือย้ายข้อมูลผู้ใช้จริง ไม่มีการเปลี่ยนระบบปากกา Canvas Undo/Redo export หรือ OAuth และไม่ได้ commit/push งานช่วงนี้
