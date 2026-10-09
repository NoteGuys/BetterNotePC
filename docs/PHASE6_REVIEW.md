# เฟส 6 — ความปลอดภัยและความพร้อมใช้งาน

ฐาน: 9bd52cb บน sol-work วันที่ 8 ตุลาคม 2026 ผู้ใช้อนุญาตทำตามแผน 6.1–6.5
ยังไม่ commit/push; ปรับตามผลทดสอบผู้ใช้แล้ว 9 ตุลาคม 2026; รอผู้ใช้ทดสอบจุดที่แก้อีกครั้งก่อนปิดเฟส

## สิ่งที่เปลี่ยน

### 6.1 หน้าต่างและ IPC
- หน้าต่างหลัก webSecurity:true, sandbox:true, contextIsolation:true, nodeIntegration:false
- ทุก invoke ผ่านตัวตรวจ sender, mainFrame และ URL ของหน้าแอปก่อนทำงาน ตรวจชนิดคำสั่งสำรองและพาธ absolute ไม่มี NUL/device namespace
- ปฏิเสธ navigation/redirect ไปหน้าอื่น, popup, webview และสิทธิ์ที่ไม่ใช้ คลิปบอร์ดให้เฉพาะหน้าแอปที่เชื่อถือได้
- close guard ไม่รับข้อความที่ไม่มี mainFrame
- CSP จำกัด script/worker/image/connect; ไม่มี Google scripts จากอินเทอร์เน็ตสำหรับ direct connection ที่เป็น Coming soon
- คง main page ที่ file URL เดิม ไม่มีการเปลี่ยน DB origin/version/schema
- betternote-assets://app/assets อ่านได้เฉพาะ PDF JS/font/CMap ที่ bundle ใน dist ตรวจ realpath เพื่อป้องกันออกนอกโฟลเดอร์ พร้อม CORS สำหรับ blob worker
- นโยบายใหม่อยู่ใน electron/appSecurity.cjs; แก้ preload เฉพาะ bridge ที่จำเป็น

### 6.2 โฟลเดอร์และลิงก์
- เลิก existsSync ใน reveal-backup-file; ตรวจ/สร้างโฟลเดอร์แบบ async และตรวจผล shell.openPath
- งานเปิดมี timeout 8 วินาทีและรวมการกดซ้ำ; หาก OS ยังทำงานหลัง timeout จะเก็บ lock จนงานจริงจบ
- URL ใช้ HTTPS ของบริการที่แอปใช้ หรือ Store URI ของ BetterNote product ID เท่านั้น ปฏิเสธ URL/file/protocol ที่ไม่เกี่ยวข้อง
- Store เปิดไม่สำเร็จลองเว็บ; ตรวจ success จริงและแสดงข้อความเมื่อเปิดไม่ได้
- ปุ่มดาวน์โหลด Drive ตรวจผล false ด้วย ไม่เงียบเมื่อ native bridge ปฏิเสธ
- แสดงข้อความเมื่อโฟลเดอร์ตอบช้า ไม่แสดง raw error/path ในข้อความผิดพลาด
- legacy popup Google sign-in คืน coming-soon; ทางเชื่อมโดยตรงยังปิดใน UI

### 6.3 ออฟไลน์และ PDF dependencies
- bundle ฟอนต์เดิม Caveat/Inter/Plus Jakarta Sans/Sarabun จำนวน 16 ไฟล์ (~2.66 MiB) พร้อม SIL OFL แยกแต่ละตระกูล
- index.html ไม่โหลด Google Fonts หรือ Google API scripts ตอนเปิด
- jsPDF 2.5.2 → 4.2.1 exact; package-lock เปลี่ยนเฉพาะ dependency ที่เกี่ยวข้อง
- npm audit --omit=dev หลังแก้: 0 reported vulnerabilities (เป็นผลของฐาน advisory ณ เวลาตรวจ ไม่รับรองว่าไม่มีช่องโหว่ทั้งหมด)
- pdfjs-dist คง 4.10.38; advisory GHSA-hq66-cqwq-w95j ระบุรุ่น >=5.6.83 จึงไม่อัปเกรดข้ามรุ่นโดยไม่จำเป็น
- loadPdfFromFile ปิด isEvalSupported และ enableScripting; worker รุ่นเดิมปิด eval อยู่แล้ว
- ไม่เปลี่ยนรูปแบบ .bnote/สำรอง การวาดปากกา ประวัติ หรือคุณภาพการ raster ที่กำหนดในเฟส 5

### 6.4 อัปเดตตามจริง
- ใช้ version จาก package.json และ native app.getVersion; native แจ้ง distribution Store/installer
- shared bounded request: ตรวจซ้ำรวมคิว, 4 วินาทีครอบคลุม response/body, JSON ไม่เกิน 64 KiB
- ตรวจ version และชนิดข้อมูล รายการเป็นข้อความธรรมดา จำกัดจำนวน/ความยาว
- available/current/unavailable แยกกัน; ล้มเหลวไม่บันทึกว่าเช็กสำเร็จ มี cooldown อัตโนมัติ กดเช็กเองลองใหม่ได้
- ไม่ใช้ demo flag หรือ feed URL ที่แก้จาก localStorage; เอาปุ่ม Preview Update Dialog ออกจาก Settings
- ไม่มีการแต่งรายการแก้บั๊ก/ฟีเจอร์/วันที่เมื่อแหล่งข้อมูลไม่ได้ส่งมา
- ลิงก์รุ่นใหม่มาจากค่ากำหนดในแอป ไม่เชื่อ URL จาก manifest; Store → Store product ID, installer → GitHub Releases
- อัตโนมัติรอ 15 วินาทีและช่วงที่ไม่มี pen/drag/hidden window ก่อนแสดง และรอผู้ใช้กลับหน้าคลังหากเปิดหน้าเขียนอยู่; ไม่มีติดตั้ง/ปิดแอปอัตโนมัติ

ข้อจำกัดเผยแพร่: ตรวจ endpoint เดิม https://raw.githubusercontent.com/NoteGuys/BetterNotePC/main/release-info.json ได้ HTTP 404
โค้ดจัดการถูกต้องและข้อมูลจำลองทดสอบผ่าน แต่ต้องเผยแพร่ manifest ที่ตรวจแล้วให้ endpoint นี้ก่อนแจ้งรุ่นใหม่จริง
เตรียม docs/release-info.example.json เป็นตัวอย่างเท่านั้น ไม่ประกาศรุ่นที่ยังไม่ได้ปล่อย ไม่ push main หรือสร้าง Release ในงานนี้
การทราบรุ่นใน manifest เป็นการตรวจแหล่งข้อมูลผู้พัฒนา ไม่ใช่การเรียก Microsoft Store API เพื่อตรวจรุ่นที่อนุมัติแล้ว

## หลักฐานตรวจ 6.5

ใช้ฐานข้อมูล/โปรไฟล์/ไฟล์จำลองใน scratch เท่านั้น ปิด HTTP ภายนอกใน QA และไม่อ่านโน้ตหรือโฟลเดอร์ Drive จริง
- unit ทั้งชุด: 372 ผ่าน 0 fail (รวม security/update 25 กับ close guard)
- editor/IndexedDB/Undo/Redo/ภาพย่อ/navigation: 159 ผ่าน ไม่พบ renderer errors
- PDF import/raster/backup validation/export flow/UI: 30 ผ่าน ไม่พบ renderer errors
- หน้าจอ Settings/UpdateNotification จริง: 17 checks ผ่านทั้ง en/th/zh/ru; offline/current/new release; ไม่มี demo หรือ changelog ปลอม; เปิดลิงก์ไม่สำเร็จยังคง dialog และมีข้อความ
- production backup PDF worker: 8 ผ่าน; เปรียบเทียบพื้นหลัง/สี/ลายมือ/ข้อความกับ renderer เดิมและตรวจ pause/corrupt image
- Electron main จริง: sandbox + webSecurity + CSP, preload, bundled fonts, same file origin, popup/navigation/path guard, resource protocol ผ่าน
- native PDF 91 หน้า จาก fresh process: whole notebook เป็นคำสั่งแรก; CSP และ guarded IPC จริง; local PDF worker/fonts/CMaps; ข้อมูลต้นฉบับ lazy; temp พาธภาษาไทยพร้อม %/#; 46,422,899 bytes, ~13.4 วินาทีบน synthetic fixture
  ตรวจครบหน้า/ลำดับ 1/46/91/ภาษาไทย/portrait-landscape/พิกเซลพื้นหลังและรอยเขียน; มี timer ticks ระหว่างทำงาน; ไม่มี print window/temp export folder ค้าง
- electron-builder --dir ไม่ publish; แปลงเฉพาะ QA artifact เป็น ASAR พร้อม bootstrap แยก userData/session/documents/temp
  ตัว exe และโค้ด main/preload/dist ใน ASAR ผ่านฟอนต์ออฟไลน์, resource protocol, backup worker และ native PDF merge worker
  bootstrap เป็น test fixture ใน scratch เท่านั้น ไม่รวมเข้า product หรือ Git
- production build ผ่าน; warning เดิม chunk >500 KiB ยังมี

logs: scratch/phase5-qa/phase6-{all-unit,editor,pdf-suite,ui,backup-pdf,native-csp,pack-app,build}.log
ผลเวลาเป็น synthetic บนเครื่องนี้ ไม่รับรอง zero lag/zero bug บนทุกอุปกรณ์
ยังไม่ได้ทดสอบติดตั้งทับแอปจริงของผู้ใช้หรือ Store update จริง เพื่อรักษาข้อมูลจริง
สัมผัส/ปากกา/สองเครื่องจริงยังอาศัยผู้ใช้ตรวจ แม้ชุดจำลองผ่าน

## ให้ผู้ใช้ลองก่อนปิดเฟส
1. ปิดเปิดแอปใหม่ให้โหลด Electron main/preload ล่าสุด (reload หน้าอย่างเดียวไม่พอ)
2. ปิดอินเทอร์เน็ต เปิดสมุดเดิม เลื่อน/เขียน สลับสมุด Undo/Redo และปิดเปิดใหม่: งานที่เซฟแล้วครบ ภาพ/ฟอนต์ยังแสดง
3. เปิดสมุด PDF หลายหน้า แล้วส่งออกทั้งเล่มเป็นคำสั่งแรก: ไม่ต้องส่งออกหน้าเดียวก่อน หน้า/ลายมือ/พื้นหลังครบ
4. เปิด Backup & Sync ลองเปิดโฟลเดอร์/แสดงไฟล์ และดาวน์โหลด Drive; ไดรฟ์ที่ไม่พร้อมต้องแจ้งปัญหาและเขียนต่อได้
5. Settings → Updates: รุ่น Store เปิดหน้า BetterNote ให้ Store ตรวจอัปเดต; รุ่นติดตั้งโดยตรงแจ้งยังไม่มีข้อมูลเวอร์ชันเมื่อ manifest เป็น 404 โดยไม่อ้างว่าเป็นรุ่นล่าสุด
6. ก่อนเผยแพร่: ตั้ง manifest จริง ติดตั้งทับรุ่นเดิมด้วยโปรไฟล์ทดสอบ แล้วตรวจโน้ต/การตั้งค่า/ปลายทางสำรอง ก่อนทดสอบ Store channel จริง

## แหล่งอ้างอิง
- https://www.electronjs.org/docs/latest/tutorial/security
- https://github.com/parallax/jsPDF/releases/tag/v4.2.1
- https://github.com/mozilla/pdf.js/security/advisories/GHSA-hq66-cqwq-w95j
- public/fonts/SOURCES.md และ OFL ของแต่ละตระกูล

## แก้ตามผลทดสอบผู้ใช้ — 9 ตุลาคม 2026

ขอบเขต: ซูมจาก toolbar, ส่งออก/นำเข้า .bnote, ชื่อไฟล์สำรอง, ปลายทาง Store และข้อความตรวจเวอร์ชัน

- ซูมเข้า/ออก/รีเซ็ตยึดตำแหน่งบนกระดาษที่อยู่กลาง viewport รวมกรณีเลื่อนทันทีไปยังหน้า preview ที่ยังไม่โหลดข้อมูลเต็ม ใช้ wrapper ของหน้าเป็นจุดยึดเพื่อคงตำแหน่งเมื่อ preview เปลี่ยนเป็น canvas
- .bnote ยังคง JSON รูปแบบเดิม; Windows บันทึกผ่าน dialog/IPC ที่ตรวจ sender และ payload ส่งครั้งละไม่เกิน 2 MiB ไปยัง worker เขียนไฟล์ชั่วคราว ตรวจ hash/JSON ก่อนแทนไฟล์ปลายทาง และอ่านตรวจหลังแทน ตรวจการเปลี่ยนไฟล์จากภายนอกก่อนแทน ยกเลิกหรือไฟล์เสียไม่แทนไฟล์เดิม
- นำเข้าอ่าน ArrayBuffer/UTF-8 และตรวจ schema ใน worker รองรับ portable/standalone รุ่นเดิม เก็บ PDF ต้นฉบับและเนื้อหาทุกหน้า สร้าง ID ใหม่ ตรวจโฟลเดอร์และเขียนสมุด/ทุกหน้าในธุรกรรมเดียว ไม่ทิ้งสมุดบางส่วน ไม่อ้างอิง folderId ของเครื่องเดิม จำกัดไฟล์ 272 MiB
- ชื่อสำรองใหม่เริ่มด้วยชื่อสมุดตามด้วยรหัสแยกสมุดชื่อซ้ำ; ไฟล์เดิมที่ manifest เป็นเจ้าของและตรวจ hash ผ่านจะถูกคัดลอกเป็นชื่อใหม่ ตรวจไฟล์ใหม่ อัปเดต manifest แล้วเก็บชื่อเดิมใน .history ส่วนไฟล์เก่าที่ไม่อยู่ใน manifest ยังอ่านได้และไม่ได้ย้าย
- Store product ID แก้เป็น 9N9NH9GHFV8J ทั้ง URI และ web fallback; รุ่น Store ไม่เรียก feed สำหรับ installer ปุ่มตรวจเปิดหน้า BetterNote และให้ Store เป็นผู้ตรวจรุ่นใหม่ รุ่น installer แยก HTTP404 (ยังไม่มีข้อมูลเวอร์ชัน) ออกจาก offline ไม่แสดงว่าเป็นรุ่นล่าสุดเมื่อไม่ได้ตรวจจริง ป้ายชนิดแอป/version อิง native app info ข้อความ 4 ภาษา

ผลตรวจล่าสุด (ข้อมูลสังเคราะห์/โปรไฟล์แยก ไม่เปิดโน้ตจริง):
- unit ทั้งชุด 379/379 ผ่าน; รวม guarded Drive migration, ไฟล์ชื่อซ้ำ, ไฟล์เปลี่ยนขณะส่งออก, การยกเลิกและไฟล์ขาดตอน
- editor 162/162 ผ่าน รวมซูมกลางหน้า 40 ในสมุด 91 หน้าแบบ portrait/mixed และซูมทันทีหลังเลื่อนไปหน้า preview
- .bnote roundtrip 7 กรณีผ่าน ส่งออกจาก ExportModal จริง → เขียนลงดิสก์ → file input → import worker สมุด PDF 91 หน้า/รอยเขียน/ข้อความ/ขนาดหน้า/PDF ต้นฉบับครบ ไฟล์ว่าง/ขาดตอน/โฟลเดอร์หายไม่ทิ้งสมุดค้าง
- updates UI 21 กรณีผ่านใน 4 ภาษา; Store เปิด URI รหัสที่ผู้ใช้ระบุโดยไม่เรียก feed และ installer ไม่แจ้ง latest เมื่อ offline
- PDF import 30/30 ผ่านหลังเพิ่มตัวเลือกตรวจโฟลเดอร์เฉพาะ .bnote
- native PDF ทั้งเล่ม 91 หน้าเป็นคำสั่งแรก ผ่าน 46,422,896 bytes (~14.4 วินาทีบนเครื่องทดสอบ); ตรวจหน้าแรก/กลาง/ท้าย สีพื้นหลัง รอยเขียน และสัดส่วนแนวตั้ง/นอน
- packaged ASAR app ผ่าน sandbox/CSP/IPC จริง .bnote 91 หน้า save + immediate file-input readback, worker และ PDF merge; 404 ใน console เป็นการทดสอบปฏิเสธ resource ที่ไม่อนุญาตโดยตั้งใจ
- production build ผ่าน; git diff --check ผ่าน หลังแก้ trailing whitespace

logs: scratch/phase5-qa/phase6-fixes-{all-unit,editor,bnote,update-ui,pdf-import,native-pdf,pack,build}.log
ยังไม่ commit/push ไม่เผยแพร่ update manifest หรือ release ไม่เปลี่ยน main

ข้อ 12 สำหรับผู้ใช้: รอ Drive ซิงค์ครบ → Pause syncing ใน Drive → เขียนสมุดทดสอบและเตรียมไฟล์ใน BetterNote → โปรแกรมยังบันทึกลงโฟลเดอร์ที่ใช้ได้ แต่ไม่ยืนยัน cloud → Resume syncing → รอ Drive เสร็จและตรวจไฟล์บนเว็บ โฟลเดอร์เข้าไม่ได้ต้องแจ้งข้อผิดพลาดโดยงานในเครื่องยังอยู่

ให้ทดสอบซ้ำ: ปิดเปิดแอปเต็มรูปแบบ; หน้า 40 ซูมเข้า/ออก/100%; ส่งออก .bnote ใหม่แล้วนำกลับเข้า; Backup now ตรวจชื่อสมุดขึ้นก่อน; เปิดหน้า Store ให้ตรง BetterNote; installer ที่ยังไม่มี manifest ต้องแจ้งตามจริง
