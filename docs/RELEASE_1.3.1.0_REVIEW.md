# เตรียม BetterNote 1.3.1.0 — 18 ตุลาคม 2026

งานเดิม Optimize/PDF และรายงานตรวจทั้งหมดอยู่ใน commit `1f90391` บน `sol-prework` งานติดตามนี้แก้เฉพาะขั้นตอนปิดและข้อมูลรุ่น/ข้อความอัปเดต พร้อม regression tests ตามที่ผู้ใช้อนุมัติ

## การแก้ปิดหน้าต่าง

`src/App.jsx` เปลี่ยนการรอ `requestAnimationFrame` เป็นการ commit blur handlers ด้วย `flushSync` แล้ว yield ผ่าน `setTimeout(0)` เพื่อให้การปิดไม่ขึ้นกับ compositor ขณะซ่อนหรือย่อหน้าต่าง หลังจากนั้นยังรอ `backupRecovery.waitForPending()` และ `flushLocalSaves({retry:true})` ก่อนส่ง success ให้ native close guard หากบันทึกผิดพลาดยังส่ง failure เพื่อเก็บหน้าต่างไว้ ไม่มีการเปลี่ยน timeout หรือข้าม guard

ทดสอบใน Electron จริงทั้งหน้าต่างปกติ ซ่อนด้วย `hide()` และย่อด้วย `minimize()` ตรวจ `document.hidden` และสถานะย่อจริงก่อนเรียก normal close ทุกเคสออกด้วยรหัส 0 โดยไม่ใช้ force quit แทนผลสำเร็จ

ทดสอบเพิ่มกับ App/Editor/IndexedDB จริงในเบราว์เซอร์แยก origin: พิมพ์ชื่อสมุดไทย/อังกฤษโดยยังโฟกัสในช่อง หยุด animation frame callbacks แล้วสั่งปิด ต้องได้ success ภายใน deadline และ reload แล้วยังมีชื่อใหม่ อีกเคสหน่วง transaction completion ของ page save ต้องไม่ส่ง success จนปล่อย commit; reload แล้วยังมีลายเส้นครบ

## เวอร์ชันและรายละเอียดอัปเดต

- npm package และ root entries ของ lockfile: `1.3.1`
- Windows buildVersion/manifest, Settings และคู่มือ: `1.3.1.0`
- คู่มืออ่านเลขจาก package โดยตรง ลดการตกค้างของเลขที่เขียนซ้ำ
- Identity, Publisher, application ID และ dependencies คงเดิม
- Settings แสดงรายการปรับปรุง 4 ข้อและแก้บั๊ก 6 ข้อครบไทย อังกฤษ จีน และรัสเซีย ครอบคลุม RAM/คิวงาน/ภาพ/ลายเส้น PDF/ปิดแอป/worker cancellation ของรุ่นนี้ ไม่ใส่เปอร์เซ็นต์ประสิทธิภาพที่ยังไม่ได้วัดจากการใช้งานจริง
- ไม่แก้พฤติกรรมเปิดสมุดหลังนำเข้า ตามที่ผู้ใช้ให้พักข้อ 2

## ผลตรวจหลังแก้

| ชุดทดสอบ | ผล | หลักฐานใน `../scratch/close-release-20261018/` |
|---|---|---|
| Close guard, page save, recovery core, native app close 3 สถานะ, update core, release version | 59/59 | `targeted-tests.log` |
| Local persistence/editor/history/preview และ close regression เพิ่ม 2 เคส | 164/164 | `local-persistence.log` |
| Atomic recovery รวม close ระหว่าง Restore และ library refresh | 16/16 | `backup-recovery.log` |
| Settings/update UI สี่ภาษาและเครือข่ายจำลอง | 21/21 | `settings-updates.log` |
| คู่มือ การนำทาง รูปภาพ ธีม และไม่แก้ข้อมูลสมุด | 8/8 | `user-guide.log` |

รวม 268 checks ในชุดข้างต้น เป็นหลายชั้นที่ทดสอบซ้อนกันบางส่วน ไม่ใช่ 268 ฟังก์ชันแยกกัน

ตรวจเพิ่มกับ production bundle ผ่าน repository Electron/preload/CSP จริง: Settings แสดง Version 1.3.1.0 และ release notes 10 รายการ, native .bnote roundtrip/import, worker/native PDF merge และการปฏิเสธ URL/payload ที่ไม่อนุญาตผ่าน (`native-app.log`) ภาพหน้าจอ `phase6-app-4o3iYf/current-version.png` ตรวจแล้ว ส่วน 404 ใน log เป็น negative security check เดิม ไม่มี renderer exception

`npm run build` ผ่านใน 18.08 วินาที (`build.log`) ยังมี warning ขนาด chunk/font/mixed import ตามเดิม ไม่มี build error ชุดนี้ไม่ได้รันทุก test file ของ repository ซ้ำ เพราะทดสอบตามขอบเขตการเปลี่ยนจากรายงานตรวจครั้งก่อน

## สถานะส่งมอบ

- ยังไม่สร้าง Appx/EXE และยังไม่ตรวจ WACK หรือ Store-installed upgrade ของรุ่นนี้
- ยังไม่ได้ทดสอบ Surface RAM 8 GB พร้อม Teams และ Google Drive online-only ด้วยอุปกรณ์จริงในรอบนี้ ใช้โปรไฟล์/ไฟล์ทดสอบใต้ scratch เท่านั้น
- ยังไม่ publish, merge, push หรือ commit งานติดตามนี้
- ก่อนส่ง Store ต้องสร้างแพ็กเกจจาก source รุ่นนี้ ตรวจ identity/ไอคอน/worker assets และทดสอบอัปเกรดเมื่อผู้ใช้สั่งสร้างแพ็กเกจ
