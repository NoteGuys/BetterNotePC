# ตรวจงานเฟส 3.2 — กู้คืนทั้งชุด (7 ตุลาคม 2026)

ก่อนหน้านี้การกู้คืนเซฟโฟลเดอร์ สมุด และหน้าแยกกัน ถ้าหน้าหลังเขียนไม่ได้ หน้าก่อนอาจถูกแทนแล้ว และ backup ที่ยังทำงานอาจเขียนชนกับข้อมูลนำเข้า รอบนี้เปลี่ยนเฉพาะการกู้คืนกับจุดที่ต้องประสานคิว/หน้าจอให้ปลอดภัย

## พฤติกรรมสำหรับผู้ใช้

1. กลับหน้า Documents แล้วกู้คืนจากโฟลเดอร์สำรองใน Backup & Sync หรือเลือกไฟล์รวม JSON ตามทางเดิม
2. ระบบพัก backup รอการเขียนเก่าจบ และเซฟงานในเครื่องให้ครบ หากยังมีงานเซฟไม่สำเร็จจะไม่เริ่มอ่านสำรองหรือนำเข้า ให้แก้การเซฟก่อน
3. ตรวจข้อมูลครบทั้งชุดก่อนเขียน แสดงสถานะการตรวจ/นำเข้า/อัปเดตรายการตามภาษาที่เลือก และกันการสลับสมุดระหว่างทำงาน
4. การนำเข้าที่สำเร็จแทนเนื้อหาของ ID ที่นำเข้า ลบหน้าเก่าที่ไม่ได้อยู่ในฉบับนั้น เก็บเวลาแก้ไขตามสำรอง และเก็บสมุดอื่นที่ไม่ได้อยู่ในชุดนำเข้า
5. ถ้าเขียนกลางทางไม่ได้ transaction ยกเลิกทั้งชุด ข้อมูลเดิมยังอยู่ ไม่สร้างหน้าว่างมาปิดข้อผิดพลาด
6. หลังสำเร็จรายการและแท็บอัปเดตโดยไม่เปิดแอปใหม่ Undo ของสมุดที่ถูกแทนจะเริ่มใหม่เพื่อไม่ให้ประวัติเก่าทับข้อมูลกู้คืน ส่วน Undo ของสมุดอื่นยังอยู่
7. หากกดปิดระหว่างกู้คืน จะรอให้ผลการเขียนและอัปเดตรายการเสร็จก่อน ภาวะยืนยันผลไม่ได้หลัง worker หยุดจะกันการแก้ไขและแนะนำเปิดแอปใหม่ แทนการรายงานสำเร็จหรือข้อมูลเดิมปลอดภัยโดยไม่มีหลักฐาน

## จุดเชื่อมในโค้ด

- electron/backupValidation.js: ตัวตรวจข้อมูลเดียวกันสำหรับ native reader และตัวนำเข้า JSON อยู่ใน package files ที่มีอยู่แล้ว
- src/services/backupRecoveryCore.js: ล็อกการกู้คืนหนึ่งงาน พัก/รอ backup เซฟงานเก่า รอ commit และการอัปเดตหน้าจอ แล้วคืนคิว
- src/services/backupRecoveryService.js: worker ที่โหลดเมื่อกู้คืน, ตรวจ receipt, ล้าง Undo เฉพาะ ID ที่นำเข้า และส่งข้อมูลย่อให้ App
- src/services/backupRecovery.worker.js กับ db.js: ตรวจข้อมูลทั้งหมดก่อน transaction เดียว ครอบคลุม folders/notebooks/pages และ receipt ใน settings ไม่มีการนำเข้า preferences หรือ credentials
- backupController.js: pause แบบนับผู้ใช้ รอ backup/prune ที่ค้างอยู่ งด PDF ระหว่างพัก ปิดทาง manual/idle/startup/periodic ที่อาจเริ่ม writer ระหว่างนำเข้า และ invalidate สถานะสำรองหลังข้อมูลเปลี่ยน
- App/LibraryView/SettingsModal: หน้าสถานะระหว่างกู้คืน การรอปิด อัปเดตรายการโดยไม่ reload และรักษาชื่อแท็บ/เลขหน้าที่อยู่ในขอบเขต

## ผลการตรวจ

| ชุดตรวจ | ผ่าน |
| --- | ---: |
| reader, writer, controller, worker, Drive launcher, local save, history และ recovery core | 183 |
| recovery browser ใหม่: App จริง + IndexedDB + production worker | 16 |
| discovery browser เดิม | 9 |
| backup status browser เดิม | 41 |
| local persistence/Undo/แท็บ/thumbnail browser เดิม | 108 |
| รวม | 357 |

- ทดสอบ rollback หลังเขียนหน้าแรกสำเร็จแล้ว abort และหลังสมุดที่สองพบรหัสหน้าชนกัน ตรวจเทียบสมุด/หน้า/โฟลเดอร์/receipt ก่อนและหลังครบ รวมถึงไฟล์ต้นทางไม่ถูกเปลี่ยนโดยการกู้คืนที่ล้มเหลว
- ทดสอบ worker หยุดหลัง commit ก่อนแจ้งผล โดยยืนยัน receipt และทดสอบภาวะ receipt ยืนยันไม่ได้ใน recovery core
- ทดสอบนำเข้า JSON เสียทั้ง 4 ภาษา ลำดับหน้าสลับกัน การลดจำนวนหน้า ข้อมูลรูปที่ล็อก/ข้อความ/พื้นหลัง PDF/whiteboard พิกัดติดลบ และเก็บสมุดอื่น/การตั้งค่าเดิม
- ทดสอบงานเขียนที่ยังเซฟไม่ได้ กู้คืนซ้ำ backup/prune ที่ยังทำงาน editor ที่เปิดอยู่ ปิดแอประหว่างนำเข้า และการอัปเดตรายการที่ช้าหรือผิดพลาด
- ตัวอ่านทำงานจากชุดไฟล์แพ็กที่ไม่มี src/ และ production recovery worker ทำงานจาก file:// เมื่อปิด network พร้อมอ่านข้อมูลที่คงอยู่หลัง reload
- build ผ่าน 2,135 modules มี warning เดิมเรื่อง static/dynamic import และขนาด chunk ไม่เปลี่ยนวิธีแบ่งบิลด์ในงานนี้

## ขอบเขตและขั้นต่อไป

- นี่คือการกู้คืนเมื่อผู้ใช้สั่ง ไม่ใช่การ merge อัตโนมัติสองเครื่อง การเทียบฐานฉบับร่วมและเก็บทั้งสองฉบับเมื่อแก้ชนกันอยู่ในเฟส 3.3
- ขีดจำกัดนำเข้า JSON 256 MiB ตรวจใน worker ก่อนอ่านไฟล์ ขีดจำกัดตัวอ่านโฟลเดอร์ยังตามเฟส 3.1 ไม่ขยายเพื่อซ่อนไฟล์ที่ผิดปกติ
- ไม่มีการเปลี่ยน schema/ปากกา/Canvas/การส่งออก PDF/การนำเข้า .bnote แบบเล่มเดียว/การเชื่อม Google โดยตรง ไม่มีการทดสอบบน Surface หรือข้อมูลผู้ใช้จริง
- การขึ้นคลาวด์ของ Google Drive for desktop ต้องตรวจด้วยแอปหรือเว็บ Drive ตามเฟส 2 ผล filesystem หรือการกู้คืนจำลองไม่ทำให้ cloudUploadVerified เป็น true
- เซฟก่อนเริ่มคือ 913c7cc บน origin/sol-work งาน 3.2 รอผู้ใช้ตรวจและอนุมัติรายการไฟล์ก่อนเซฟหลังเสร็จ ไม่เริ่ม 3.3 ในรอบนี้

## แก้เพิ่มเติมจาก Restore ของ Local และ Drive ที่ผู้ใช้ทดสอบ

สาเหตุ Local ยืนยันจากการตรวจแบบ read-only: สมุดสองเล่มมีข้อมูลครบ แต่ folderId ยังชี้ไปโฟลเดอร์ที่ถูกลบแล้ว ตัวตรวจตีความว่า backup ขาด ส่วน Drive มีการอ่านไฟล์ใหญ่และสำเนาเก่าซ้ำ พร้อมเงื่อนไข timeout เดิมที่สั้นและไม่ต่อเวลาตามความคืบหน้า ภาพ timeout ไม่ระบุขั้นตอนภายใน จึงตรวจด้วย delayed-I/O และ client-clock tests เพิ่มแทนการอ้างว่าเครือข่าย Google เสีย

การแก้จำกัดอยู่ที่ตัวอ่านสำรองและผลการกู้คืน: v2 อ่านไฟล์ .bnote ตาม manifest ตรวจ hash ของไฟล์จริง ใช้ข้อมูลใน snapshot ซ้ำได้เมื่อ hash/revision ตรง และสตรีมตรวจไฟล์ด้วย buffer 1 MiB สมุดที่โฟลเดอร์เดิมไม่มีถูกเก็บใน Documents พร้อมแจ้งจำนวนและปรับ notebook metadata revision ให้ backup รอบต่อไปไม่เข้าใจว่าเนื้อหาเปลี่ยนในเวลาเดียวกัน ไม่แก้หน้า ลายมือ รูป ข้อความ หรือ PDF และไม่ลบสำเนาเก่า

มีขอบเขตการรอ 30 วินาทีต่อ I/O, 60 วินาทีเมื่อไม่มีความคืบหน้าใน client, เพดานรวม 5 นาที ไม่ถอดการตรวจไฟล์เสีย/ไฟล์ขาด/เปลี่ยนระหว่างอ่าน/เส้นทางไม่ปลอดภัย/โครงโฟลเดอร์วนเป็นวง ข้อความ Local ไม่เหมารวมว่าต้องรอ Google Drive อีกต่อไป

ตรวจอ่านจากโฟลเดอร์จริงทั้งสองผ่าน ครบ 21 สมุด พบสองเล่มที่ต้องปรับตำแหน่ง อ่านข้อมูลลดเหลือประมาณ 216 MB จากประมาณ 323–327 MB ผลนี้เป็นการตรวจไฟล์ ไม่ใช่การกู้คืนทับฐานข้อมูลของผู้ใช้ ไม่ได้ส่งไฟล์หรือเนื้อหาโน้ตไปบริการภายนอก

ผลตรวจรอบแก้: 194 native/unit + 1 reader fixture ขนาด 268 MiB/21 สมุด + 10 browser discovery (รวมการกด Restore จริงทั้ง Local/Drive ใน 4 ภาษา) + 16 browser recovery + 41 browser backup status รวม 262 กรณีผ่าน รวมถึงสำรองต่อหลังย้ายสมุดที่โฟลเดอร์หาย บิลด์ผ่าน 2,135 modules มี warning chunk เดิม ส่วน 108 browser persistence/Undo/thumbnail ของรอบก่อนยังเป็นหลักฐานของเฟส 3.2 เดิม ไม่ได้รันซ้ำในรอบแก้ตัวอ่านนี้

หลังแก้ต้องโหลดแอปรุ่นบิลด์ใหม่และเริ่ม worker ใหม่ก่อนทดสอบซ้ำ งานยังรอผู้ใช้ตรวจและอนุมัติ Git ไม่เริ่มเฟส 3.3

## แก้เพิ่มจากภาพล่าสุด: Drive มีรายการค้างที่ไม่อยู่ในชุดปัจจุบัน

รอบตรวจใหม่พบ Local มีข้อมูล/รายการ 9 สมุด ส่วน Drive มีข้อมูลและขอบเขตล่าสุด 9 สมุด แต่รายการสำรองยังมีอีกสองรายการที่เก่าและไม่มีไฟล์หรือเนื้อหาใน snapshot ล่าสุด การตรวจยืนยัน hash ของ snapshot ผ่านทั้งสองโฟลเดอร์ ไม่ได้กู้คืนทับโน้ตจริงหรือเรียกการลบ/สำรองกับไฟล์จริง

แก้ reader ให้แยกรายการ stale ด้วยหลักฐานครบ: inactive ID, ไฟล์ไม่มี, ID ไม่อยู่ใน snapshot ที่ hash ตรง, snapshot ประกาศว่าทำครบแล้ว และเวลา entry ไม่ใหม่กว่าการสำรองครบครั้งนั้น จึงข้าม metadata เก่าได้และแจ้งจำนวนตามภาษา ส่วนไฟล์ปัจจุบันที่หาย ข้อมูล retained ที่ยังอยู่ใน snapshot ข้อมูลใหม่ที่ยังมาไม่ครบ และไฟล์เสียยังถูกปฏิเสธ

แก้ writer ให้การเก็บกวาดเมื่อสำรองตามปกติซ่อมเฉพาะ metadata ที่ยืนยันว่าเก่า ไม่ลบไฟล์หรือประวัติ และให้ prune อัปเดตขอบเขต/manifest ก่อนลบไฟล์ ไม่เกิดรายการที่ยังชี้ไปไฟล์ที่ถูกลบหากการอัปเดต manifest ล้มเหลว

ทำซ้ำบั๊ก budget ของ writer จาก 913c7cc ได้: การรอ snapshot 1 วินาทีภายใน allowance สำหรับไฟล์ 2 MiB ถูกตัดที่ขั้น manifest เล็ก ทำให้ snapshot อยู่บนดิสก์แต่รายการไม่อัปเดต โค้ดใหม่ไม่ลด allowance ที่ได้มาและจัด budget ก่อนอ่าน snapshot โดยยังจำกัด 90 วินาทีต่อปลายทาง กรณีเดียวกันสำเร็จและ manifest hash ตรง บั๊กนี้อธิบายกลไกหนึ่งที่อาจทำให้รายการค้างได้ แต่ไม่มี log เก่าที่พิสูจน์ว่าการเขียนจริงบน Drive ครั้งใดถูกตัดเวลา

ผลตรวจ: 207 native/unit รวมการป้องกัน current/retained/staged entries, manifest publication failure, cleanup interruption และ budget; 11 browser discovery/ปุ่ม Restore จริงครบ 4 ภาษา, 16 browser atomic recovery, 41 browser backup status รวม 275 กรณีผ่าน นอกจากนี้ตรวจ fixture 268 MiB/21 สมุดเดิมอีกครั้งผ่านแบบ read-only ไม่เขียนไฟล์ชุดใหญ่เพิ่ม บิลด์ผ่าน 2,135 modules พร้อม warning chunk เดิม

ยังไม่ได้ import/prune หรือเขียน metadata ในโฟลเดอร์จริงจากเครื่องมือตรวจ ไม่ commit/push และไม่เริ่ม 3.3 ต้องโหลดแอป/worker จากบิลด์นี้ใหม่ก่อนทดลอง Restore ซ้ำ

## รายการไฟล์รอเซฟหลังเสร็จ

ตรวจ git status มี 33 ไฟล์ของงาน 3.2 รวมการแก้ Restore ไม่พบไฟล์ลับ/สำรองโน้ตในรายการหรือรูปแบบ credential ที่ตรวจ ไม่รวม core-js-banners และ node-compile-cache/ ยังไม่ git add/commit/push

- D:/AI WorkShop/Codex/BetterNotePC/docs/PHASE3_2_REVIEW.md
- D:/AI WorkShop/Codex/BetterNotePC/docs/SAFETY_PHASES.md
- D:/AI WorkShop/Codex/BetterNotePC/electron/backupReader.cjs
- D:/AI WorkShop/Codex/BetterNotePC/electron/backupReader.worker.cjs
- D:/AI WorkShop/Codex/BetterNotePC/electron/backupReaderClient.cjs
- D:/AI WorkShop/Codex/BetterNotePC/electron/backupValidation.js
- D:/AI WorkShop/Codex/BetterNotePC/electron/backupWriter.cjs
- D:/AI WorkShop/Codex/BetterNotePC/src/App.jsx
- D:/AI WorkShop/Codex/BetterNotePC/src/components/Library/LibraryView.jsx
- D:/AI WorkShop/Codex/BetterNotePC/src/components/Library/SettingsModal.jsx
- D:/AI WorkShop/Codex/BetterNotePC/src/index.css
- D:/AI WorkShop/Codex/BetterNotePC/src/services/autoBackupService.js
- D:/AI WorkShop/Codex/BetterNotePC/src/services/backupController.js
- D:/AI WorkShop/Codex/BetterNotePC/src/services/backupReadStatus.js
- D:/AI WorkShop/Codex/BetterNotePC/src/services/backupRecovery.worker.js
- D:/AI WorkShop/Codex/BetterNotePC/src/services/backupRecoveryCore.js
- D:/AI WorkShop/Codex/BetterNotePC/src/services/backupRecoveryService.js
- D:/AI WorkShop/Codex/BetterNotePC/src/services/db.js
- D:/AI WorkShop/Codex/BetterNotePC/src/services/fileSystemService.js
- D:/AI WorkShop/Codex/BetterNotePC/src/services/i18n.js
- D:/AI WorkShop/Codex/BetterNotePC/src/services/notebookHistoryService.js
- D:/AI WorkShop/Codex/BetterNotePC/tests/backup-controller.test.js
- D:/AI WorkShop/Codex/BetterNotePC/tests/backup-discovery.browser.cjs
- D:/AI WorkShop/Codex/BetterNotePC/tests/backup-reader-client.test.cjs
- D:/AI WorkShop/Codex/BetterNotePC/tests/backup-reader-large.test.cjs
- D:/AI WorkShop/Codex/BetterNotePC/tests/backup-reader.test.cjs
- D:/AI WorkShop/Codex/BetterNotePC/tests/backup-recovery.browser.cjs
- D:/AI WorkShop/Codex/BetterNotePC/tests/backup-recovery.test.js
- D:/AI WorkShop/Codex/BetterNotePC/tests/backup-status.browser.cjs
- D:/AI WorkShop/Codex/BetterNotePC/tests/backup-writer.test.cjs
- D:/AI WorkShop/Codex/BetterNotePC/tests/helpers/recovery-worker.cjs
- D:/AI WorkShop/Codex/BetterNotePC/tests/local-persistence.browser.cjs
- D:/AI WorkShop/Codex/BetterNotePC/tests/notebook-history.test.js
