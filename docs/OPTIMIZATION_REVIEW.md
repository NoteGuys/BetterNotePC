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
