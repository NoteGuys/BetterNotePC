# Optimize ชุดแรก — sol-prework

วันที่ 13 ตุลาคม 2026 เริ่มจาก bc8a30b (BetterNote 1.3.0.0)

## สิ่งที่เปลี่ยน

- Preview เส้นปากกายาว: วาดส่วนต้นที่คงที่ครั้งเดียวบน canvas เดิม แล้ววาดใหม่เฉพาะส่วนปลาย เก็บจุดและแรงกดต้นฉบับครบ ใช้ตัววาดเดิมสำหรับภาพหลังยกปากกา Brush, ปิดแรงกด, สีโปร่งใส, highlighter และรูปทรงยังใช้ preview เดิมเพื่อรักษาภาพ
- Whiteboard: เก็บผลแปลงพิกัดของวัตถุที่ไม่เปลี่ยน ช่วยให้ canvas ใช้การวาดเพิ่มเฉพาะเส้นใหม่ได้
- PDF สำรองอัตโนมัติ: รอไม่มี input อย่างน้อย 15 วินาที และต้องบันทึกในเครื่องเสร็จ ไม่มี pointer ค้าง แอปมองเห็นอยู่ และไม่มี export/capture ที่กำลังทำงาน ปุ่มสำรองด้วยตนเองไม่ต้องรอ 15 วินาที แต่ยังเคารพเงื่อนไขอื่น การทำ PDF ที่เริ่มแล้วไม่ได้ถูกขัดจังหวะกลางหน้า
- อ่านไฟล์รูปที่เลือกหรือวางผ่าน file-path clipboard ใน worker จำกัด 128 MiB อ่านเป็นช่วง และ timeout 30 วินาที ไม่อ่านไฟล์ด้วย readFileSync บน main process ส่วน bitmap clipboard ของ Electron ยังใช้ API เดิม
- Backup describe อ่านเฉพาะ metadata ของหน้า Full-library JSON export อ่านและประกอบ Blob ทีละหน้าใน worker ภายใต้ readonly transaction เดียว จำกัด 256 MiB เท่ากับ import เดิม ตรวจขนาดก่อนสร้าง JSON ของหน้าใหญ่
- Capture ใช้ raster budget ร่วมกับ export ไม่เกิน 16 ล้านพิกเซลและด้านละ 8192 พิกเซล ตรวจรูปให้ครบก่อนส่งออก รูปเสียหรืออ่านไม่ได้จะจบด้วย error แทนภาพที่ขาดบางส่วน
- รายงานวินิจฉัยภายในเครื่อง: เก็บเหตุการณ์ process crash/unresponsive, สถานะ GPU, CPU/RAM และสถิติ ink/save/long task สูงสุดสองไฟล์รวมประมาณ 512 KiB ส่งออกเมื่อผู้ใช้กดใน Settings > Updates & Version เท่านั้น ไม่ส่งขึ้น server และไม่เก็บข้อความโน้ต ชื่อโน้ต clipboard หรือ path ส่วนตัวในรายการเหตุการณ์
- Close guard เลิกขอ save acknowledgment จาก renderer ที่ตายแล้ว ไม่มีการ reload หรืออ้างว่ากู้เส้นที่ยังไม่ได้บันทึกได้

คง schema ฐานข้อมูลและรูปแบบ backup เดิม รวมถึง changed-only backup, การเลือก device, manual Restore และนโยบาย latest + ย้อนหลัง 3 ชุด ไม่มีการเปลี่ยน dependencies, รุ่นเผยแพร่ หรือ default GPU ของ production

## หลักฐานและข้อจำกัด

ทดสอบด้วยข้อมูลจำลองใน scratch: logic/native, Electron browser จริง, IndexedDB/worker export, ภาพปากกา, pointer-up/cancel และการเปิดแอปกับ trusted IPC ส่งออกรายงาน

ภาพ preview 24 กรณี (3 nib × เปิด/ปิดแรงกด × taper × DPR 1/2) ต่างไม่เกิน 2/255 ระดับสีจาก antialiasing ภาพหลัง commit เทียบตัววาดเดิมตรงทุกพิกเซลในกรณีทดสอบ

เส้นจำลอง 5,000 จุด: เวลาสั่งวาด JavaScript p95 ตัวเดิมประมาณ 3–3.6 ms และ incremental ประมาณ 0.1 ms ในเครื่องพัฒนา ตัวเลขนี้ไม่รวม GPU completion, input latency และ Teams จึงไม่ใช่ผลทดสอบ Surface หรือการรับประกัน FPS

รายงาน `frame` วัดเวลาจากขอ requestAnimationFrame จน callback เริ่ม ไม่ใช่ระยะเวลาทั้งเฟรม ค่า memory working set เป็นผลรวม process ซึ่งอาจนับ shared memory ซ้ำ ใช้ privateKiB และ Windows Task Manager ประกอบ ค่า peak เป็นผลรวม peak ของแต่ละ process ไม่ใช่ peak รวมที่เกิดพร้อมกัน

App smoke test ตรวจ startup/export และ window.close ตามปกติ โดยต้องจบ process ด้วย exit code 0 จึงผ่าน ใช้ forced cleanup เฉพาะเมื่อทดสอบล้มเหลว ส่วน close guard จำลอง getter ที่โยน Object has been destroyed หลังหน้าต่างถูกทำลาย

ยังไม่มี crash dump ของ 5 เหตุการณ์ใน Store จึงยังระบุสาเหตุไม่ได้ และยังต้องทดสอบจริงบน Surface 8GB พร้อมแชร์ Teams การ serialize snapshot ของสมุดแต่ละเล่มและ PDF merge ยังเก็บเอกสารเต็มใน worker ส่วนการแยก media store/schema migration ยังไม่ได้ทำ

## วิธีทดสอบบน Surface

ใช้ตัวทดสอบจาก sol-prework กับสมุดทดสอบชุดเดียวกัน เปรียบเทียบกับรุ่นเดิม เริ่มหลังรีสตาร์ตและรอเครื่องว่าง เปิด Task Manager ดู CPU, Memory และ GPU ของ BetterNote ก่อนเริ่มและหลังจบ ไม่ใช้การลบงานจริงเป็นวิธีลดโหลด

| ทดสอบ | วิธี | ผลที่คาดหวัง |
|---|---|---|
| เส้นยาว | เขียนเส้นต่อเนื่อง 30 วินาที ทั้ง pen/brush/highlighter เปิด/ปิดแรงกดและ taper แล้ว Undo/Redo เปิดสมุดใหม่ | เส้นไม่หาย สีและความหนาเดิม หลังเปิดใหม่เหมือนก่อนปิด |
| สลับ input | เขียนแล้วเลื่อน/ซูมด้วยมือซ้ายและขวา ทั้งหน้ากระดาษและ Whiteboard | นิ้วตอบสนองทั่วพื้นที่ เส้นไม่เลื่อนตำแหน่งหรือค้างเป็น preview |
| รูปใหญ่ | วางรูปความละเอียดสูงหนึ่งรูป เขียนทับ ย้าย/ย่อรูป แล้ว capture | รูปและเส้นครบ หรือแจ้งข้อผิดพลาดชัดเจนถ้าเกินขนาด/รูปเสีย |
| สมุด PDF | เปิด PDF 91 หน้า เลื่อนสลับหน้า เขียน และ export | จำนวนหน้าและ annotations ครบ export ไม่ทับงานในเครื่อง |
| Backup ระหว่างเขียน | เขียนต่อเนื่อง สังเกต PDF สำรองอัตโนมัติ แล้วหยุด input 15 วินาที | PDF ไม่เริ่มใหม่ระหว่างเขียน เริ่มต่อเมื่อเข้าเงื่อนไข idle ข้อมูล editable ยังคงสำรองตามระบบเดิม |
| กด Backup | หลังบันทึกในเครื่องเสร็จกดครั้งเดียว แก้หนึ่งสมุดแล้วกดซ้ำ | ตอบรับงานครั้งเดียว ใช้ artifact เดิมของสมุดที่ไม่เปลี่ยน ไม่บังคับรอ idle 15 วินาที |
| Restore เดิม | Backup จากเครื่องหนึ่ง เลือก device และ Restore อีกเครื่อง เลือก device ซ้ำหลังเสร็จ | รอยเขียนและตำแหน่งโฟลเดอร์ถูกต้อง ไม่คืนรายการที่ลบตามกฎเดิม ไม่เกิด copy ของข้อมูลเก่าที่เป็น ancestor |
| ปิดระหว่าง save | เขียนแล้วกดปิดทันที เปิดใหม่ | การปิดปกติรอ local save เสร็จ และงานที่บันทึกครบเปิดกลับมาได้ |
| สอนผ่าน Teams | ทำชุดเขียน/รูปซ้ำโดยไม่แชร์ แล้วแชร์จอ Teams 30–60 นาที | เปรียบเทียบอาการและ RAM/CPU/GPU อย่างมีหลักฐาน ไม่ใช้การคาดเดาว่า Teams เป็นสาเหตุ |
| ใช้นานและหลายแท็บ | สลับ 5 สมุด เขียน/ซูม/Undo/ปิดเปิดซ้ำ 30–60 นาที | หน่วยความจำไม่โตต่อเนื่องในงานซ้ำหลัง idle ไม่มี crash หรือข้อมูลหายในรอบทดสอบ |

หลังทดสอบ กด “บันทึกรายงานเพื่อแจ้งปัญหา” ใน Updates & Version เลือกตำแหน่งไฟล์ หากมีปัญหาแนบรายงานพร้อมเวลา ขั้นตอน และบอกว่าแชร์ Teams อยู่หรือไม่ ผลดีในเครื่องเดียวไม่เพียงพอใช้ยืนยันกับทุก GPU/อุปกรณ์

## รัน automated QA ในเครื่องพัฒนา

PowerShell จาก root repository (ติดตั้ง dependencies แล้ว):

```powershell
$env:NODE_DISABLE_COMPILE_CACHE='1'
$env:BETTERNOTE_QA_TEMP=Join-Path (Get-Location) 'scratch/optimize-implementation-qa'
New-Item -ItemType Directory -Force -Path $env:BETTERNOTE_QA_TEMP | Out-Null
node --test --test-concurrency=4 tests/*.test.js tests/*.test.cjs
npm run build
```

สำหรับเปรียบเทียบ GPU เฉพาะ unpackaged browser fixture:

```powershell
$env:BETTERNOTE_GPU_PROFILE='default'
node --test tests/optimization-browser.test.cjs
Remove-Item Env:BETTERNOTE_GPU_PROFILE
```

ค่า default นี้ใช้ได้เฉพาะตัวทดสอบ unpackaged Production packaged ยังใช้ค่าเดิม หลักฐานจากเครื่องพัฒนาอย่างเดียวไม่ใช่เหตุผลให้เปลี่ยนการตั้งค่าของรุ่น Store


## ผลตรวจรอบนี้

- ชุดรวม 466/466 ผ่านด้วย test-concurrency=4 (ประมาณ 65 วินาที)
- ตรวจซ้ำส่วนแก้ล่าสุด optimize + close guard 27/27 ผ่าน
- GPU default fixture + native checks 6/6 ผ่าน และ legacy fixture ผ่านในชุดรวม
- PDF failure/timeout tests 5/5 ผ่านเมื่อรันแยก รอบที่เปิดทุก test file พร้อมกันเคยทำให้ synthetic deadline 500 ms ชนะ print failure จึงจำกัด concurrency ของ QA ไม่มีการแก้ timeout ของ PDF production
- Production build ผ่าน ยังมีคำเตือนเดิมเรื่อง chunk ขนาดใหญ่และ import ผสม ไม่ได้ปิดคำเตือนเพื่อให้รายงานดูดี
- การทดสอบใช้ scratch/profile จำลอง ไม่อ่านหรือ restore โน้ตจริง ไม่มี commit, push, สร้าง installer หรือเปลี่ยน main ในรอบ implementation นี้

## แก้ error ตอนปิดหน้าต่างก่อนเซฟงาน

พบว่า cleanup ที่เพิ่มใน Optimize เข้าถึง BrowserWindow.webContents ภายใน closed event หลัง native window ถูกทำลาย แก้โดยเก็บ WebContents reference ขณะติดตั้ง guard และใช้ reference นั้นถอด renderer listener ไม่เปลี่ยนลำดับ local save, Backup หรือ Restore

Regression fixture ใช้ getter ที่โยน Object has been destroyed หลังปิด จับบั๊กเดิมได้ก่อนแก้ และผ่านหลังแก้ ทดสอบ native app ในโปรไฟล์แยกให้ window.close แล้ว process จบตามปกติ ไม่ใช้ forced termination เป็นเงื่อนไขผ่าน รวม targeted checks 13/13 ผ่าน

หลังแก้ close cleanup ชุดรวม 467/467 ผ่านด้วย test-concurrency=4 (ประมาณ 55 วินาที) log: scratch/optimize-save-final-tests.txt


## Optimize รอบสอง — รักษาวิธีใช้งานเดิม

ทำบน sol-prework จาก 0f94558 ไม่เปลี่ยนรุ่นเผยแพร่/ฐานข้อมูล/รูปแบบ backup/กฎเลือก device และ conflict resolution ไม่สร้าง installer และไม่ commit/push ในรอบนี้

- ยกเลิกข้อจำกัดรูป 128 MiB อ่านต้นฉบับใน worker ด้วย buffer 3 MiB และแปลง base64 ทีละช่วง ไม่ลดคุณภาพหรือทิ้ง bytes ใช้เพดานความยาว string ที่ runtime รองรับจริงเท่านั้น Timeout นับช่วงไม่มีความคืบหน้าแทนเวลารวมของไฟล์ใหญ่
- Editable Backup และ .bnote ประกอบ Blob ทีละหน้าภายใต้ readonly transaction เดียว จึงไม่ต้องเก็บ page objects ทั้งเล่มหรือ JSON string ทั้งเล่มพร้อมกัน ตัวตรวจข้อมูลเดิมใช้ร่วมกันในการตรวจทีละหน้า และตรวจ PDF source references ครบหลังอ่านหน้าเสร็จ
- เส้นทาง .bnote ในแอปใช้ Blob; API binary เดิมยังมีเพื่อความเข้ากันได้ การตรวจไฟล์ก่อนบันทึกและ native readback ยังอยู่
- PDF Backup เก็บ descriptor/key/dimensions ของหน้า อ่านข้อมูลจริงทีละหน้า และเปิด PDF original หนึ่ง document ต่อ source ตรวจ content key ระหว่างอ่านและ revision หลังจบ หากมีการแก้ไขจะพักงาน ไม่รับ PDF ที่ปะปนคนละรุ่น
- คิวเดียวควบคุมจุดเริ่ม Export/Capture/Import/Restore/Full Backup และ preparation ของ editable/PDF Backup งาน foreground ที่รออยู่ทำให้ PDF สำรองพักตามกลไกเดิม การวาดและ local save อยู่นอกคิวนี้ Priority scope เดิมยังเรียกซ้อนได้; เฉพาะจุดเริ่มงานหนักจองคิว
- Restore ระบาย Backup ก่อนจองคิว และปล่อย reference ของ encoded input หลัง parse เพื่อไม่เก็บ bytes ต้นทางตลอดการเขียน atomic

### หลักฐาน

- รวม 471/471 ผ่าน (ประมาณ 61 วินาที): scratch/optimize-round2-tests.txt
- Chromium จริง: snapshot/portable content และข้อมูลเสีย/size budget ผ่าน ภาพปากกา 24 กรณีต่างไม่เกิน 2/255 ภาพหลัง commit เทียบเดิมตรงทุกพิกเซล
- Production PDF Backup worker 11/11 ผ่าน: resume จากหน้าที่พัก, Whiteboard bounds, ภาพ/ข้อความ/SVG, damaged image และ changed revision
- สมุดจำลอง 91 หน้า: สร้างครั้งแรก 91 หน้า; แก้หนึ่งหน้าแล้วสร้างใหม่ 1 ใช้เดิม 90; รอบไม่เปลี่ยนใช้เดิม 91 ค่าทดสอบประมาณ 2,817 / 515 / 374 ms เป็น fixture เล็กบนเครื่องพัฒนา ไม่ใช่เวลาของ lecture จริง
- .bnote roundtrip 91 หน้า 7/7 ผ่าน; Restore production worker 16/16 ผ่าน; PDF import/export/navigation 30/30 ผ่าน รวมรักษา PDF original bytes และข้อความไทย
- Native image read ของไฟล์จำลอง 135,266,306 bytes (เกิน 128 MiB) ผ่านและ SHA-256 ของข้อมูลทั้งหมดตรงต้นฉบับ เป็น PNG เล็กต่อ padding สำหรับตรวจ transport ไม่ใช่ benchmark การ decode รูปความละเอียดสูง
- Build ผ่าน มีคำเตือนเดิมเรื่อง font URL, mixed imports และ chunk ใหญ่ ไม่มีการปิด warning

### ขอบเขตของผล

ยังไม่มีค่าลด RAM ทั้งแอปแบบ A/B และยังไม่ได้ยืนยันบนเครื่อง Surface 8 GB จริง ต้องทดสอบพร้อม Teams ตามตารางก่อนหน้า การรวม PDF ยังสะสมโครงสร้าง output document; การตรวจ/วางแผน Restore และ native .bnote validation ยังอ่าน JSON ทั้งชุดใน worker รูปต้นฉบับ/data URL และการ decode ภาพยังใช้ RAM ตามขนาดจริง จึงไม่อ้างว่า RAM มีเพดาน 3 MiB หรือรองรับเอกสารไม่จำกัด การเปลี่ยน media schema, streaming JSON parser/atomic restore staging และ GPU flags ต้องมีการออกแบบ/ทดสอบแยก ไม่ทำการเปลี่ยนที่เสี่ยงต่อข้อมูลเพื่อให้ตัวเลขดูต่ำ


### วัด RAM ของ snapshot แบบก่อน/หลัง

ใช้ Electron สองโปรไฟล์ใหม่ต่อคู่ ทำซ้ำ 3 คู่ ข้อมูลจำลองเดียวกัน 24 หน้า หน้าแต่ละหน้ามี encoded image string 1 MiB ขนาดผลลัพธ์ 25,170,013 bytes ไม่ decode รูป เปรียบเทียบวิธีเตรียม snapshot เดิม (รวม size guard) กับ prepareNotebookBlob + binary output รุ่นใหม่ ทุกผลลัพธ์มี SHA-256 ตรงกัน

เก็บผลรวม private memory ของ Electron fixture ทุก 10 ms ค่ากลาง peak เดิม 405.4 MiB → ใหม่ 256.4 MiB ลดประมาณ 36.8% เฉพาะ workload นี้ ค่ากลางเวลาเตรียม 248.8 → 303.1 ms เพิ่มประมาณ 54.3 ms การทำ Blob ทีละหน้ามีค่าใช้จ่ายเพิ่ม แลกกับการลด peak memory ไม่อ้างว่าเร็วขึ้นทุกงานหรือ RAM ทั้งแอปลด 36.8% ระหว่างงานแต่ละ process และ GC อาจทำให้ค่าต่างกัน ผลนี้ไม่รวมการ decode ภาพ/Teams และไม่ใช่ผล Surface 8 GB

ข้อมูลดิบ: scratch/optimize-round2-memory.json; helper: scratch/optimize-round2-memory.cjs (ข้อมูลจำลองทั้งหมด)

หลังปรับข้อความ error .bnote และให้ validation/native save อยู่ในคิวงานหนัก: targeted 13/13 + .bnote production roundtrip 7/7 ผ่าน Build สุดท้ายผ่าน 19.07 วินาที


## ตรวจทาน Optimize เพิ่มเติม — 2026-10-13

ตรวจ diff ของ Optimize ทั้งสองรอบและเส้นทางที่เชื่อมกัน: คิวงานหนัก, snapshot/validator, import/export, worker startup/cancellation, local save/window close, cache/raster/history budgets และ Backup/Restore ใช้ regression suite ของโปรเจกต์ประกอบการตรวจ ไม่ถือว่าการเลือกระดับ reasoning เป็นหลักฐานว่าโค้ดถูกหรือผิด

### ปัญหาที่ยืนยันและแก้ไข

ทุกกรณีด้านล่างมีการจำลองที่ล้มเหลวก่อนแก้และผ่านหลังแก้ ไม่ได้ใช้ข้อมูลจริงของผู้ใช้

| กรณี | ผลเดิม | การแก้ |
|---|---|---|
| ปิด preparation ขณะ worker กำลังเริ่ม | งานยังส่งต่อหลัง close และ retry อาจติด startup เดิม | ลงทะเบียนคำขอ/timeout ก่อนเริ่ม worker ยกเลิกคำขอทันที และ terminate worker ที่มาถึงหลัง session หมดอายุ |
| เริ่ม worker ไม่สำเร็จหรือส่ง PDF continuation ไม่ได้ | startup รอได้ไม่จำกัด หรือ postMessage โยน exception จาก message event | คุม timeout ตั้งแต่ startup และส่งข้อความผ่าน guard ที่ตรวจทั้ง worker และ request ปัจจุบัน |
| เริ่ม import PDF แล้ว postMessage ล้มเหลว | Promise ปฏิเสธ แต่ worker กับ timer ยังอยู่ | ทุกทางออกผ่าน finish ครั้งเดียว ถอด handler และ terminate ทันที รวม messageerror และ callback ความคืบหน้าที่โยนข้อผิดพลาด |
| เริ่ม full backup export แล้ว postMessage ล้มเหลว | worker กับ timer ยังอยู่หลังคำขอล้มเหลว | รวม cleanup ครั้งเดียวและจัดการ send failure ทันที |
| ใช้ปากกา interrupt PDF raster ระหว่างเตรียม assets | continuation เก่ายัง post ไปยัง worker ที่ถูก terminate | ตรวจ settled ก่อน continuation, ผูก cancel กับ attempt และปิดเฉพาะ worker ของ attempt นั้น |
| Export รูปขณะมีงานหนักอื่น | เริ่ม canvas ได้ขณะคิวข้อมูลยังทำงาน | จองคิวหนักแบบเดียวกับ PDF/Capture ก่อนโหลด raster หรือเริ่มวาด canvas |
| storage คืนข้อมูลรูปทีละน้อย | ไม่ส่ง progress จนเต็มก้อน base64 เสี่ยงหมด inactivity timeout แม้ยังอ่านอยู่ | อ่านครั้งละไม่เกิน 1 MiB และส่ง progress ทุก partial read คง buffer/base64 boundary และ bytes ต้นฉบับเดิม |

การแก้รอบตรวจทานนี้ไม่เปลี่ยนรูปแบบข้อมูล กฎ merge/conflict ของ Restore หน้าตาของแอป หรือ GPU profile ไม่เพิ่มข้อจำกัดรูป 128 MiB

### ผลตรวจหลังแก้

- ชุดรวม 475/475 ผ่าน ไม่มี skipped/cancelled (58.88 วินาที) รวมกรณีปิดแอปปกติและการคืนทรัพยากร: scratch/optimize-audit-tests.txt
- Production build ผ่าน (20.13 วินาที): scratch/optimize-audit-build.txt คำเตือนเดิมเรื่อง font URL, mixed import และ chunk ใหญ่ยังแสดงตามจริง
- Production PDF Backup worker 11/11 ผ่าน รวม 91 หน้า: แก้หนึ่งหน้าสร้างใหม่ 1 ใช้เดิม 90; รอบไม่แก้ใช้เดิม 91: scratch/optimize-audit-backup.txt
- Production .bnote roundtrip 91 หน้า 7/7 ผ่าน: scratch/optimize-audit-bnote.txt
- Production recovery worker 16/16 ผ่าน รวม atomic rollback/receipt และข้อมูลในเครื่อง: scratch/optimize-audit-restore.txt
- PDF import/export/raster/navigation และกรณี worker failure/cancellation 32/32 ผ่าน ไม่มี renderer errors: scratch/optimize-audit-pdf.txt
- เทียบ validator รุ่น HEAD กับรุ่นปัจจุบันด้วยข้อมูลจำลอง 10,000 กรณี: การยอมรับ/ปฏิเสธ ผล normalize และ error code ตรงกันทั้งหมด
- Chromium ink 24 กรณี: preview ต่างไม่เกิน 2/255; ภาพหลัง commit ตรงทุกพิกเซล; snapshot/portable bytes, queued image export และ full-backup failure cleanup ผ่าน
- git diff --check ผ่าน อยู่บน sol-prework; รอบนี้ไม่มี commit/push/main หรือสร้าง installer

### สิ่งที่หลักฐานยังยืนยันไม่ได้

การตรวจโค้ดและ QA ไม่รับประกันว่าไม่มีบั๊กทุกอุปกรณ์หรือไฟล์ทุกชนิด ยังไม่มี dump ของ Store crash 5 เหตุการณ์ จึงไม่ระบุว่ากรณีที่แก้คือสาเหตุของ crash เหล่านั้น ไม่ใช้ build warnings เป็นหลักฐานของ runtime crash

PDF merge, การตรวจ JSON ทั้งชุดใน worker, data URL/การ decode รูปใหญ่ และ native clipboard ยังใช้หน่วยความจำตามข้อมูลจริง ขอบเขตของผลลด RAM 36.8% ก่อนหน้ายังคงเป็น snapshot fixture เท่านั้น ไม่ใช่การลด RAM ทั้งแอป และยังต้องทดสอบ Surface RAM 8 GB พร้อม Teams จริง ไม่เปลี่ยน data schema หรือการกู้คืนที่ผ่านแล้วเพื่ออ้างตัวเลขประสิทธิภาพที่ยังไม่ได้วัด
