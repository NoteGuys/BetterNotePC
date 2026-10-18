# เพิ่มภาษาและปรับหน้าตั้งค่า — 18 ตุลาคม 2026

งานนี้ต่อจาก commit `4797c9a` บน `sol-prework` จำกัดขอบเขตที่คำแปล การเลือก/จำภาษา ทิศทางข้อความ คู่มือ และหน้าตั้งค่า/ลิงก์ที่ผู้ใช้ขอ ไม่เปลี่ยนอัลกอริทึมเขียน รูปทรง ซูม PDF export ฐานข้อมูล หรือกระบวนการ Backup/Restore

## สิ่งที่เพิ่ม

- เพิ่มอาหรับมาตรฐาน (`ar`), สเปน (`es`), เยอรมัน (`de`) ครบ 1,022 keys เดิมต่อภาษา พร้อมข้อความใหม่และเติม label ที่เดิมใช้ inline fallback รวม 1,066 keys ต่อภาษา ครอบคลุมเมนู เครื่องมือ แจ้งเตือน ข้อผิดพลาด อัปเดต และ accessibility labels
- อาหรับแสดง `العربية (نسخة تجريبية)`; ใน UI ไทยมีวงเล็บ `(รุ่นทดสอบ)` พร้อมอธิบายว่ากำลังทดสอบคำแปลและ RTL ไม่มีการอนุมานภาษาจากประเทศ
- คู่มือแปล 55 บทต่อภาษา รวมหมวดหมู่ ค้นหา ปุ่ม คำอธิบายภาพและจุดกำกับทั้งหมด 44 ภาพ ใช้ภาพ PNG เดิมร่วมกัน ภาพและพิกัดกำกับไม่ถูก mirror คู่มือไทย/อังกฤษยังใช้ได้ และจีน/รัสเซียยังใช้คู่มืออังกฤษตามพฤติกรรมเดิม
- แชร์รายการภาษาระหว่างระบบ UI และ preferences สองจุด ป้องกันภาษาใหม่ถูกปรับกลับเป็นภาษาเก่า ใช้ locale ของภาษาใหม่ในจุดแสดงวันที่ที่มีการกำหนด locale เดิม
- ตั้ง `lang`/`dir` สำหรับอาหรับ และทิศทางคู่มือแยกจากภาษาของแอป พื้นที่ Editor, Canvas และแท็บสมุดคง LTR เพื่อรักษาพิกัด การเลื่อน และ toolbar แถวเดียว ชื่อที่ผู้ใช้พิมพ์ในช่องสร้าง/เปลี่ยนชื่อ/ค้นหาใช้ `dir=auto`; พาธไฟล์แยกทิศทาง LTR
- suffix ของ Duplicate รองรับสามภาษาใหม่โดยไม่เขียนทับชื่อที่เก็บไว้ ปรับการแทนตัวแปรข้อความให้เก็บ `$&`, `$1` และอักขระพิเศษในชื่อได้ตรงตัว
- หน้าตั้งค่าขยายได้ถึง 920px ย่อเข้ากับหน้าจอ มี body เลื่อนได้และ tabs wrap ตามพื้นที่ การ์ดภาษาอาหรับเต็มแถวสุดท้าย รองรับ keyboard selection
- เพิ่ม GitHub SVG ขนาดเล็กในปุ่มวงกลม 44px พร้อมลิงก์ดาวน์โหลด/แจ้งปัญหา ใช้ SVG inline ไม่เพิ่ม dependency หรือโหลด avatar ทางเครือข่าย มีข้อความเมื่อเปิดลิงก์ไม่สำเร็จ
- native folder picker และหน้าบันทึกรายงานวินิจฉัยรับเฉพาะข้อความชื่อหน้าต่างที่จำกัดความยาว ไม่เปลี่ยนชนิดไฟล์ วิธีเลือกโฟลเดอร์ การตรวจ IPC หรือการบันทึกข้อมูล

## GitHub: สิ่งที่ตรวจพบจริง

ตรวจ GitHub public API พบ `https://github.com/NoteGuys/BetterNote-Releases` เปิด Issues และไฟล์ใน tree มีเพียง README ไม่มีซอร์สแอป ลิงก์ในแอปจำกัดไว้ที่:

- `https://github.com/NoteGuys/BetterNote-Releases/releases`
- `https://github.com/NoteGuys/BetterNote-Releases/issues`

ไม่มีลิงก์โปรไฟล์หรือ repository โค้ดในส่วนใหม่ของหน้าตั้งค่า อย่างไรก็ตาม README ออนไลน์ของ BetterNote-Releases ยังมี **Main Source Code** เชื่อมไป `BetterNotePC` และ BetterNotePC เป็นสาธารณะ จึงยังรับประกันไม่ได้ว่าผู้ใช้ GitHub จะเข้าถึงโค้ดไม่ได้ ไม่แก้ README ออนไลน์ ไม่เปลี่ยนสิทธิ์ repository และไม่เปลี่ยน URL ของระบบอัปเดตเดิมในงานนี้

ฉบับแก้ที่เสนอสำหรับส่วน Project Links ของ README ออนไลน์ คือแทนที่ด้วยข้อความนี้ (ลบเพียงลิงก์ Main Source Code):

```markdown
## 🔗 Downloads & Feedback

- **All Release Downloads**: [Releases Archive](https://github.com/NoteGuys/BetterNote-Releases/releases)
- **Problems & Suggestions**: [Issues](https://github.com/NoteGuys/BetterNote-Releases/issues)
```

การซ่อน repository โค้ดเป็นอีกเรื่องหนึ่งและต้องตรวจผลต่อ update feed ของแอปเดิมก่อน ไม่ใช่สิ่งที่ปุ่มลิงก์ในแอปทำได้ ตรวจรายการ Releases ในรอบนี้ไม่พบรายการที่ API ส่งกลับ แม้ README มีข้อความเวอร์ชันเก่า จึงใช้ข้อความว่าให้ดูรุ่นที่มีในหน้า Downloads และไม่อ้างว่าติดตั้งรุ่นเก่าได้ทันที

## ผลตรวจ

หลักฐานอยู่ใน `scratch/languages-20261018/` ซึ่งถูก ignore และใช้ข้อมูล/โปรไฟล์สังเคราะห์เท่านั้น

| ชุดทดสอบ | ผ่าน | หลักฐาน |
|---|---:|---|
| คำแปล/ตัวแปร/คู่มือ/preferences/ชื่อสำเนา/ลิงก์ + release version + native security + close guard | 36/36 | targeted-tests.log |
| ภาษา UI จริงทั้งเจ็ด, คู่มือ 165 บท, layout 540–1368px/หน้าต่างเตี้ย, สองธีม, editor geometry, Library/Backup, เปิดใหม่แล้วจำภาษา | 16/16 กลุ่ม | languages-browser.log |
| Local persistence/editor/Undo/Redo/รูปทรง/รูปภาพ/นำเข้าและ preview เดิม | 164/164 | local-persistence.log |
| Atomic recovery และการปิดระหว่าง Restore | 16/16 | backup-recovery.log |
| Settings/updates เดิม | 21/21 | phase6-updates.log |
| คู่มือเดิม การนำทางและไม่แก้ข้อมูลสมุด | 8/8 | user-guide.log |

รวม 261 checks/กลุ่มข้างต้น บางส่วนทดสอบซ้อนกัน ไม่ใช่ 261 ฟังก์ชันแยกกัน รวมการเปิดบทคู่มือใหม่ทั้งหมดใน 3 กลุ่มภาษา ไม่พบ renderer exception และการสลับภาษาไม่เปลี่ยนเนื้อหาสมุด

ตรวจเพิ่มกับ production bundle ผ่าน repository Electron/preload/CSP จริง: fonts, native backup worker, PDF merge, .bnote save/import และ Settings 1.3.1.0 ผ่าน (`native-app.log`) คำว่า packaged/ASAR ในชื่อ check เป็นชื่อจาก harness เดิม รอบนี้ใช้ repository Electron กับ dist ไม่ได้สร้าง Appx/EXE หรือแพ็ก ASAR ใหม่ ข้อความ 404 ใน console เป็น negative security check ที่คาดไว้

Build ผ่าน มีคำเตือน font/mixed import/chunk size เดิม ตรวจ diff whitespace ผ่าน ไม่มีไฟล์สำรองโน้ตหรือไฟล์ลับใน tracked/unignored files

## ขนาดและข้อจำกัด

- เทียบขนาด JavaScript/CSS ที่ Vite รายงานใน build.log กับ build ก่อนเพิ่มภาษา: เพิ่มประมาณ 243 KB (0.23 MiB) รวมคู่มือและ UI แล้ว เป็นขนาด bundle ก่อนบีบอัด ไม่ใช่ขนาด Appx หรือ RAM ที่วัดจากการใช้งานจริง
- ไม่เพิ่มรูป ฟอนต์ dependency หรือไฟล์คู่มือภาพซ้ำ ชุดคู่มือใหม่โหลดเมื่อเปิดคู่มือตามโครงสร้าง lazy loading เดิม
- ตรวจภาพหน้าตั้งค่าอาหรับ คู่มืออาหรับ/เยอรมัน Library/Backup และ toolbar แล้ว ทดสอบ Surface เป็นขนาด viewport และ touch simulation ไม่ใช่เครื่อง Surface จริงในรอบนี้
- คำแปลถูกตรวจความครบและการแสดงผล แต่ยังไม่มีเจ้าของภาษาอิสระรับรองความเป็นธรรมชาติ จึงคงป้ายทดลองของอาหรับตามที่ผู้ใช้กำหนด
- ไม่มีการสร้าง installer, publish, push, merge main หรือ commit งานภาษาใหม่
