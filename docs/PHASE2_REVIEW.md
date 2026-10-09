# ผลตรวจเฟส 2 ก่อนเฟส 3

วันที่ 7 ตุลาคม 2026 — branch sol-work

## ผลสรุป

ปิดเฟส 2 ในขอบเขตการสำรองและ Google Drive for desktop ได้แล้ว ผู้ใช้ยืนยันว่าชุดทดสอบขึ้นเว็บ Drive ครบ การเชื่อม Google โดยตรงยังเป็น Coming soon ไม่มีบริการสาธารณะถูกเปิดใช้งาน เฟส 3 ยังไม่เริ่ม และงานยังไม่ได้ commit/push

## สิ่งที่เสร็จ

- หน้าสำรองเดียว มี Local และ Google Drive แยกชัดเจน ขยายพื้นที่ แสดงชื่อไฟล์ จำนวน ขนาด เวลา และสถานะแต่ละปลายทาง รองรับ 4 ภาษา
- Local ที่เลือกใช้แทนโฟลเดอร์เริ่มต้น ไม่เขียนสองโฟลเดอร์ Local โดยไม่จำเป็น; ถ้า Local และ Drive ชี้โฟลเดอร์เดียวกันจะเขียนครั้งเดียว
- Drive Desktop เป็นตัวเลือกแรกพร้อม Recommended คำแนะนำ ลิงก์ดาวน์โหลด Google และปุ่มเปิดแอป การเปิดแอป/เขียนลงโฟลเดอร์ไม่ถูกใช้ยืนยันการขึ้นคลาวด์
- รอเซฟลง IndexedDB ก่อนสำรอง อ่านสมุดและหน้าด้วย transaction เดียว และไม่โหลดข้อมูลหน้าทั้งหมดเพื่อแสดงสถานะ
- ใช้ notebook ID แยกสมุดชื่อซ้ำ เขียนไฟล์ชั่วคราว ตรวจอ่านกลับ เก็บรุ่นก่อนสูงสุด 3 รุ่น และตรวจไฟล์เดิมอีกครั้งก่อนแทนที่
- ไฟล์ใหม่กว่าหรือข้อมูลขัดแย้งถูกเก็บไว้ แสดงชื่อสมุดและเวลา ไม่หยุดสมุดอื่นทั้งหมด; full snapshot เดิมไม่ถูกแทนด้วยชุดไม่ครบ
- สำรองข้อมูลแก้ไขได้และ snapshot ก่อนทำ PDF แจ้ง PDF pending/error แยกจากข้อมูลกู้คืน ไม่สร้าง PDF ของสมุดเดิมซ้ำโดยไม่จำเป็น
- งานดิสก์/JSON หลักอยู่ใน Node worker ใช้ I/O แบบ async และมี timeout; PDF มีคิวหยุดพักเมื่อกำลังเขียนและแคชมีขอบเขต

## จุดที่พบและแก้เพิ่มในการตรวจรอบนี้

ไฟล์ src/services/backupController.js: คิวหลังเลือกโฟลเดอร์ตรวจเพียงว่า Local current หรือไม่ เมื่อ Local ครบและ Drive ใหม่ว่างจึงไม่เริ่มสำรอง Drive โดยอัตโนมัติ แก้เงื่อนไขให้ตรวจ allDestinationsCurrent และตอนเริ่มแอปและการตรวจประจำรอบตรวจทุกปลายทาง/ข้อมูล PDF ด้วย

ทดสอบกับ writer จริงด้วยข้อมูลจำลอง: ก่อนแก้ Drive ยังไม่ถูกสำรอง หลังแก้มีสมุด/PDF/snapshot ครบโดยไม่ต้องแก้โน้ตหรือกดสำรองเพิ่ม เพิ่มอีก 2 กรณีใช้เวลาจำลองตรวจตอนเปิดแอปและรอบตรวจประจำเมื่อ snapshot ใน Drive หายแต่ PDF ยังครบ; รอบตรวจประจำล้มเหลวก่อนแก้และผ่านหลังแก้

## ขอบเขตการอ่านโค้ด

| ส่วน | ไฟล์หลัก | สิ่งที่ตรวจ |
| --- | --- | --- |
| การสำรองลงดิสก์ | electron/backupWriter.cjs | atomic replace, readback/hash, history, conflict, reuse, prune, timeout |
| งานเบื้องหลังและ IPC | electron/backup.worker.cjs, electron/backupWorkerClient.cjs, electron/main.cjs, electron/preload.cjs | คิว worker, progress, ปิด/restart worker และตัวเชื่อมหน้าจอ |
| คิวและสถานะ | src/services/backupController.js, src/services/autoBackupService.js | การเซฟก่อนสำรอง, revision, เปลี่ยนปลายทาง, error, deferred PDF |
| PDF | src/utils/backupPdf.js | รูปเสีย/รูปหาย, ทุกหน้า, พัก/ทำต่อ, ขอบเขตแคช |
| หน้าจอ | BackupStatusModal.jsx, BackupStatusIndicator.jsx, BackupFilesTable.jsx, GoogleDrivePanel.jsx, GoogleDriveModal.jsx | สถานะตามจริง, retry, เส้นทางไฟล์, ปิด direct, คำแนะนำ Desktop |
| ตัวเรียก/รูปแบบ | App.jsx, LibraryView.jsx, SettingsModal.jsx, src/services/i18n.js, src/index.css | หน้าต่างเดียว, แท็บ, ภาษา, responsive, keyboard/light theme |
| เปิดแอป Drive | electron/driveDesktop.cjs | executable ในตำแหน่งติดตั้ง, timeout, กดซ้ำ, trusted sender |
| โค้ด direct ที่พักไว้ | googleDriveService.js, googleDesktopAuth.cjs, googleTokenExchange.cjs, googleOAuthConfig.cjs, googleConfig.js, server/ | state/PKCE, cancellation, token handling, secret separation, ไม่มี public endpoint |
| จุดเชื่อมเฟส 3 | scanAndLoadBackups ใน electron/main.cjs, restoreFullBackup ใน fileSystemService.js, LibraryView restore callback | ระบุความเสี่ยงและลำดับการแก้ ยังไม่เปลี่ยนระบบ restore |

## ผลตรวจ

- 75 native/controller/worker/Drive Desktop tests ผ่าน รวมกรณีคิว Drive ที่เพิ่ม
- 40 tests ของ native auth/token exchange/server ที่พักไว้ผ่าน ใช้ provider จำลอง ไม่ใช่การรับรอง direct สำหรับเผยแพร่
- 41 browser integration checks ผ่าน รวมข้อมูลจำลองใน IndexedDB จริง + native worker: การเซฟล้มเหลว, รูปเสีย, แก้ขณะสำรอง, ไฟล์ขัดแย้ง, ภาษา, 9 แท็บ, ธีม, ขนาดหน้าจอ และไม่มี renderer exception
- รวม 156 กรณีผ่าน; production build ผ่าน 2131 modules มี warning เดิมเรื่อง static/dynamic import และ bundle ขนาดใหญ่; git diff --check ผ่าน
- ไม่พบไฟล์ลับ/ไฟล์โน้ตต้องห้ามในรายการ Git และไม่พบค่าตามรูปแบบ credential จริงที่ตรวจใน source/docs/tests การตรวจรูปแบบไม่ได้ครอบคลุมข้อมูลลับทุกชนิด
- การขึ้นคลาวด์ของชุดทดสอบก่อนหน้าได้รับการยืนยันจากผู้ใช้ รอบตรวจนี้ไม่อ่านโน้ตจริงและไม่เขียน Drive เพิ่ม

## จุดที่ต้องทำในเฟส 3 ก่อนถือว่าการย้ายเครื่องพร้อมใช้

1. ตัวอ่านเดิมเลือก full snapshot ก่อนและไม่แทนรายการ ID เดิมด้วย .bnote ที่ใหม่กว่า หาก snapshot ค้างหลัง conflict อาจกู้ข้อมูลเก่า ต้องเทียบ revision/เนื้อหาจากทุกแหล่งในโฟลเดอร์ที่เลือก และเก็บทั้งสองฉบับเมื่อขัดแย้ง
2. ตัวอ่านเดิม fallback ไปโฟลเดอร์อื่นเมื่อโฟลเดอร์ที่เลือกไม่มีข้อมูล ต้องจำกัดตามการเลือกของผู้ใช้และแจ้งสาเหตุให้ชัด แทนการนำข้อมูลจากแหล่งอื่นโดยเงียบ
3. restoreFullBackup เซฟโฟลเดอร์ สมุด และหน้าทีละรายการ หากรายการท้ายเสียอาจนำเข้าเพียงบางส่วน ต้องตรวจ schema/ID/ความสัมพันธ์/จำนวนหน้าทั้งชุดก่อน และ commit อย่างเป็นชุดหรือ rollback ได้
4. ต้องพักคิวสำรองระหว่างกู้คืน เพื่อไม่สำรองข้อมูลที่ยังนำเข้าไม่ครบไปยัง Drive และต้องรักษางานในเครื่องที่ใหม่กว่า
5. ตรวจไฟล์ Drive ที่ยังดาวน์โหลดไม่เสร็จ/หาไม่พบ/อ่านช้า ด้วยงานเบื้องหลังและ timeout จากนั้นทดสอบฐานข้อมูลเครื่องใหม่จริงแบบแยก พร้อมหน้าข้อความ รูปล็อก ไวท์บอร์ด และพื้นหลัง PDF

## ข้อจำกัดที่ยังต้องแยกจากผลเฟส 2

- การทดสอบนี้ไม่ใช่การรับประกันว่าไม่มีบั๊กทุกกรณี และยังไม่ได้ทดสอบคลังโน้ตขนาดใหญ่มากบน Surface จริง
- full snapshot ยังต้องใช้หน่วยความจำตามขนาดคลังใน worker และ PDF ยังมีบางงานบน renderer; การวัด/ลดภาระขั้นต่อไปอยู่ในเฟสประสิทธิภาพ
- การป้องกัน IPC/หน้าต่างทั้งหมดเป็นงานเฟส 6 การตรวจเฟส 2 ไม่ใช่ security audit ทั้งแอป
- ไม่ควรถือว่ากู้คืน/ย้ายเครื่องปลอดภัยครบก่อนผ่านเฟส 3
