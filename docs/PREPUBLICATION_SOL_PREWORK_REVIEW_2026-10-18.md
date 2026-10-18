# ตรวจทาน sol-prework ก่อนเผยแพร่ — 18 ตุลาคม 2026

## ผลตัดสิน

**ยังไม่พร้อม Publish ทันที** พบข้อบกพร่องที่ทำซ้ำได้ 2 จุดใน App เดิม และเลขเวอร์ชันยังเท่ารุ่นที่เผยแพร่ไปแล้ว งาน Optimize/PDF ที่เปลี่ยนในสาขานี้ผ่านชุดตรวจหลัก แต่ผลนี้ไม่ใช่คำรับประกันว่าไม่มีบั๊กทุกอุปกรณ์

รอบนี้เป็นการตรวจสอบ: ไม่แก้ production code, ไม่เปลี่ยนเลขเวอร์ชัน ไม่ commit/push/merge เข้า main ไม่สร้างตัวติดตั้ง และไม่ส่งข้อมูลไป Partner Center ใช้โปรไฟล์/ฐานข้อมูล/ไฟล์จำลองใน scratch; ไม่เปิดฐานข้อมูลงานจริงหรือเขียนไป Drive จริง

## ขอบเขตที่ตรวจ

- สาขาจริง: sol-prework (ผู้ใช้เรียก ISO pre-working)
- ฐานเทียบ: main / bc8a30b88f79b7bb8c4185fc7886f3fee8fd836e (v1.3.0 / 1.3.0.0)
- HEAD: 0f94558738c13f5225ca807b4eeb555293f98d91
- ตรวจทั้ง commit Optimize ชุดแรก และ working tree ล่าสุดที่ยังไม่ได้ commit รวมไฟล์ใหม่ที่ git diff ปกติไม่แสดง
- ก่อนเพิ่มรายงานนี้ มีไฟล์ต่างจาก main รวม 57 ไฟล์: production 43 ไฟล์ ที่เหลือเป็นเอกสาร/ทดสอบ ไม่ได้หมายความว่าแก้ 57 ไฟล์ในรอบตรวจนี้
- อ่าน diff production ที่เปลี่ยนทั้งหมด พร้อมผู้เรียกใช้งานและขอบเขต worker/DB/IPC; ตรวจ parsing ทุกไฟล์ JS/JSX/CJS ใน src และ electron 142 ไฟล์ผ่าน
- รายการไฟล์และ SHA-256 ณ เวลาตรวจ: ../scratch/prepublish-audit-20261018/reviewed-files.json

## ทบทวนงานและคำสั่งที่ทำมาแล้ว

| งานที่ผู้ใช้ต้องการ | สิ่งที่ทำแล้ว | หลักฐาน/ขอบเขต |
|---|---|---|
| เขียนลื่นขึ้นโดยเก็บลายเส้นเดิม | Preview เส้นยาววาดส่วนต้นที่คงที่ครั้งเดียว วาดซ้ำเฉพาะปลาย; ใช้ renderer เดิมหลังยกปากกา | ปากกา 84 checks ผ่าน; ชุดภาพ 24 แบบผ่านใน unit/browser test |
| Whiteboard ไม่วาด/แปลงวัตถุเดิมซ้ำเกินจำเป็น | Memoize การมองเห็นและพิกัดวัตถุใน viewport | navigation 40 checks ผ่าน รวมซ้าย/ขวาห่างจากบริเวณเขียน |
| ลดแรงกดดัน RAM จากงานหนักพร้อมกัน | คิวงานหนักสำหรับ import/export/snapshot/Restore และให้ optional PDF backup หลบงานผู้ใช้ | ตรวจการปล่อยคิวเมื่อ error และหลีกเลี่ยง deadlock ตอน Restore รอ backup |
| PDF อัตโนมัติไม่แย่งจังหวะเขียน | รอไม่มี input 15 วินาที ไม่มี pointer และ local save เสร็จ; manual backup ไม่รอ idle 15 วินาที | ยังยอมให้งานที่เริ่มแล้วทำถึงขอบเขตหน้าที่ตรวจพักได้ |
| Backup เฉพาะงานที่แก้ | รักษา changed-only notebook backup และ content-hash cache ของหน้า PDF; โหลดหน้าจริงทีละหน้าแทนสมุดหนักทั้งชุด | 91 หน้า: แก้ 1 render 1/reuse 90; ไม่แก้ render 0/reuse 91 |
| ลดสำเนาข้อมูลตอนสร้าง .bnote/full backup | ใช้ cursor ใน transaction อ่าน snapshot เดียวกัน ประกอบ Blob ทีละหน้าใน worker; .bnote ส่ง Blob ไปบันทึกเป็น chunk | .bnote 91 หน้า roundtrip 7 checks ผ่าน; รูปแบบข้อมูลยังอ่านคืนได้ |
| ไม่บังคับจำกัดรูป 128 MiB | ยกเลิก policy 128 MiB; อ่านเป็น chunk ผ่าน worker แทน main thread | ยังมีขีดจำกัด string ของ runtime และหน่วยความจำจริง; ไม่อ้างว่านำเข้าได้ไม่จำกัด |
| ไม่ค้างเพราะรูปจาก virtual drive | asynchronous file read พร้อม inactivity progress/timeout และตรวจไฟล์เปลี่ยนระหว่างอ่าน | native tests ผ่าน รวม short partial reads และ retry |
| แก้ปิดแอปแล้ว Object has been destroyed | เก็บ WebContents ก่อน native window ถูกทำลาย; ถอด listener ผ่าน reference เดิม | close guard unit tests ผ่าน; มีบั๊กการปิดเมื่อซ่อนหน้าต่างแยกอีกจุดด้านล่าง |
| รวบรวมข้อมูล crash อย่างเป็นส่วนตัว | local diagnostics มี allowlist, bounded rotation และปุ่ม export ด้วยตนเอง | privacy/rotation tests ผ่าน; ไม่ส่งข้อความโน้ต/raw errors/path ไป telemetry |
| Capture/ภาพไม่ใช้ canvas ใหญ่ไร้ขอบเขต | ใช้ budget 16 ล้าน pixels/8192 edge พร้อมตรวจรูปเสีย | ความละเอียดภาพอาจถูกลดตาม budget; ไม่เปลี่ยนข้อมูลรูปต้นฉบับ |
| แก้ worker cancellation/timeout | ปิด worker เก่าที่เริ่มช้า, ป้องกัน continuation เก่าทำงานหลัง cancel, cleanup เมื่อ postMessage/worker ล้มเหลว | unit และ PDF integration รวม failure/cancellation ผ่าน |
| PDF ส่งออกแตกลายงาใน Edge | เพิ่ม filled round caps ให้ pressure segments แบบ opaque hex color; รวม endpoint ซ้ำและใช้ cubic quarters ลดขนาด | ทำซ้ำรอยแตกเดิมได้ใน Edge; PDF ใหม่ที่ทดสอบไม่มีรอยแตกเป็นปล้อง |
| คง Backup/Restore ที่ทดสอบผ่าน | ไม่ย้าย schema, ไม่ย้อนกลับไป auto inbound restore/shared writer และไม่เปลี่ยน merge rules | atomic recovery, large restore, native two-device tests ผ่าน |
| เปิด .bnote ให้ทันทีหลัง import | **ยังไม่เสร็จ** เคยอธิบายบั๊กไว้ และตรวจรอบนี้ยังเกิด | เปิดเองจาก Library ใช้ได้ ข้อมูลครบ |
| เตรียมแพ็กเกจ Store รอบใหม่ | **ยังไม่ทำในรอบนี้** เลขเวอร์ชันเดิมและยังไม่มีแพ็กเกจของ working tree ล่าสุด | อย่าใช้ Appx 1.3.0.0 เก่าแทนโค้ดรอบนี้ |

## ข้อบกพร่องที่ยืนยันได้

### 1. ปิดแอปขณะย่อ/ซ่อนหน้าต่างไม่สำเร็จ — ควรแก้ก่อนปล่อย

ตำแหน่ง: src/App.jsx:163 ใน onCloseSaveRequest

ขั้นตอน: เปิดแอปจริงด้วยโปรไฟล์ว่าง ย่อหน้าต่างให้ document.hidden=true แล้วเรียกปิดหน้าต่างตามปกติ เปรียบเทียบกับหน้าต่างที่แสดงอยู่

ผลจริง: hidden QA ล้มเหลวซ้ำ 2 รอบด้วยข้อความ App QA normal close did not exit; minimized visible-window probe ยืนยัน isMinimized=true และ document.hidden=true แล้วไม่จบใน 22 วินาที ส่วนหน้าต่างที่มองเห็นปิดได้ exit 0

สาเหตุ: ก่อน flush การบันทึก โค้ด await requestAnimationFrame(resolve) ซึ่งไม่มีหลักประกันว่าจะเรียก callback ขณะหน้าต่างซ่อน/ย่ออยู่ การรอนี้จึงขวางการส่ง acknowledgment ของ close guard; guard อาจแสดงคำเตือนให้เปิดหน้าต่างไว้แทนที่จะปิด ไม่พบหลักฐานข้อมูลเสียจากการทดสอบนี้ และไม่ได้ปิด guard เพื่อให้เทสผ่าน

การแก้ที่ควรทำ: ให้ขั้นตอนรอ commit ของ UI จบได้ใน hidden window เช่นข้าม frame เมื่อ document.hidden หรือใช้ frame พร้อม bounded fallback และ cleanup; หลังจากนั้นยังต้อง await recovery/local saves ก่อนอนุญาตปิด คงข้อความ error และการป้องกัน failed saves

Regression ที่ต้องผ่านหลังแก้: visible/hidden/minimized close, พิมพ์ textbox แล้วปิดทันที, local save ล้มเหลว/Retry, Restore กำลังเขียน, ปิดเปิดแล้วตรวจข้อมูล

หลักฐาน: unit.log, close-recheck.log, visible-close-9yquxY/, minimized-close-Sily8q/ ในโฟลเดอร์ QA ข้างล่าง

### 2. นำเข้า .bnote สำเร็จแต่ไม่เปิดสมุดอัตโนมัติ — ควรแก้ก่อนปล่อย

ตำแหน่ง: src/App.jsx:277–279 และ :485–487

ขั้นตอน: ใช้หน้า Library ของ production bundle ภายใต้ Electron/preload/CSP จริง นำเข้า .bnote จำลองที่เพิ่งบันทึกผ่าน native API

ผลจริง: สมุดเข้าฐานข้อมูลและปรากฏใน Library แต่ editor ไม่เปิด (AUTO_OPEN_PROBE autoOpened=false) กด card เองแล้ว editor เปิดได้ (MANUAL_OPEN_PROBE success) ไม่มี renderer error

สาเหตุ: setNotebooks อัปเดต state รอบหน้า แต่ handleOpenNotebook ที่เรียกถัดมาค้น notebook ใน array เก่าของ closure จึงหา ID ใหม่ไม่เจอแล้ว return

การแก้ที่ควรทำ: ให้การเปิดสมุดที่เพิ่งบันทึกใช้ notebook object ที่บันทึกสำเร็จแล้วโดยตรง หรือเปิดหลัง state มี ID นั้นอย่างชัดเจน ตรวจทุกผู้เรียกสร้าง/import ที่ใช้รูปแบบเดียวกัน โดยรักษา tab cap 9, unique names และการจำหน้าเดิม

ข้อจำกัดการยืนยัน: ทำซ้ำผ่าน UI จริงสำหรับ .bnote แล้ว; create notebook, single/batch PDF และอีกช่องทางนำเข้า .bnote มี pattern เดียวกันใน source แต่ไม่ได้ยืนยันแต่ละเส้นทางผ่าน UI จริงในรอบนี้

หลักฐาน: import-open-probe.log, phase6-app-tkdR8r/ ใน QA

ทั้งสองบั๊กมีโค้ดเดียวกันใน main ก่อน Optimize (src/App.jsx ไม่มี diff จาก main) จึงแยกว่าเป็นบั๊กเดิมที่ยังต้องแก้ ไม่กล่าวอ้างว่า Optimize สร้างมันขึ้นมา

## สิ่งที่ต้องเตรียมสำหรับอัปเดต

- package.json/package-lock ยัง version 1.3.0; build.buildVersion และ AppxManifest.xml ยัง 1.3.0.0
- ต้องกำหนดเลขแพ็กเกจที่สูงกว่ารุ่นเดิมก่อนส่งเป็นอัปเดต แนะนำพิจารณา 1.3.1.0 หากยังไม่มีรุ่นนั้นเผยแพร่ แต่ยังไม่ได้แก้เลขแทนผู้ใช้
- Microsoft Store ใช้แพ็กเกจหมายเลขสูงสุดที่ใช้ได้กับอุปกรณ์: https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/package-version-numbering
- หลังแก้บั๊กและกำหนดเลขรุ่น ต้อง build/ตรวจแพ็กเกจ Appx ที่สร้างจาก source ล่าสุด รวม identity/publisher, executable/icon/manifest, ASAR assets/workers, block map และทดสอบอัปเกรดด้วย Store identity จริง แพ็กเกจเก่าที่เคยผ่านไม่ได้รับรอง source ใหม่อัตโนมัติ
- รอบนี้ไม่สร้าง Appx/EXE ไม่ตรวจ WACK ของแพ็กเกจใหม่ และไม่ได้ submit/merge/push

## ผลทดสอบรอบนี้

| ชุด | ผล | Log ใน ../scratch/prepublish-audit-20261018/ |
|---|---|---|
| unit/native/browser-backed test files รวม | 477 ผ่าน / 478; ล้มเหลว 1 close hidden ซึ่งเกิดซ้ำจริง | unit.log |
| parse src+electron | 142/142 | parse.json |
| local persistence/editor/history/thumbnail/shape/UI | 162 ผ่าน | local-persistence.log |
| production backup preparation worker | 11 ผ่าน | backup-preparation.log |
| atomic recovery worker | 16 ผ่าน | backup-recovery.log |
| native .bnote roundtrip 91 หน้า | 7 ผ่าน | bnote-roundtrip.log |
| large restore 11 สมุด รวมสมุด 91 หน้า | 3 ผ่าน | restore-large.log |
| Electron navigation/touch/Whiteboard/toolbar | 40 ผ่าน | navigation-visible.log |
| Electron pen input/coalesced/commit | 84 ผ่าน | ink-input.log |
| PDF import/export/raster/cancellation | 32 ผ่าน | pdf-import.log |
| คู่มือ | 8 ผ่าน | user-guide.log |
| Updates & Version UI | 21 ผ่าน | phase6-updates.log |
| daily update service/UI | 11 ผ่าน | daily-update.log |
| daily update ผ่าน App จริง | 2 ผ่าน | daily-update-real-app.log |
| Surface Library/ปุ่ม Backup | 5 ผ่าน | surface-library.log |
| native IPC two-device migration/recovery | 6 ผ่าน | backup-migration-native.log |
| production main/preload/CSP/assets/worker/save | ผ่าน check groups; ไม่ได้นับรวมเป็นจำนวนใหม่ | phase6-app.log |

ชุด integration ที่มีจำนวนชัดเจนรวม 408 checks ผ่าน (แยกจาก 478 tests ใน suite รวม; บางส่วนทดสอบเรื่องเดียวกันคนละชั้น จึงไม่ควรนำไปอ้างว่าเป็นจำนวนฟังก์ชันไม่ซ้ำ)

ใช้ข้อมูลจำลองทั้งหมด มี expected 404 หนึ่งครั้งจาก negative security resource test ใน phase6-app; ไม่ใช่ renderer exception แม้ log เก่าใช้คำ packaged/ASAR แต่การรัน phase6-app รอบนี้เป็น repository Electron launch จาก dist ไม่ใช่ Appx ที่ติดตั้งแล้ว

QA setup ที่แก้เฉพาะการรัน: เริ่มแรก Playwright ไม่พบ bundled browser จึงใช้ Edge ที่ติดตั้งแล้ว; backup preparation ต้องตั้ง BETTERNOTE_QA_BUILT_WORKER=1; hidden navigation screenshot ค้างจึงรันด้วยหน้าต่างแสดงอยู่และผ่าน 40 ข้อ ไม่ได้แก้ production เพื่อหลบ failure การเรียก daily-update-app.browser.cjs โดยตรงไม่รันอะไรเพราะเป็น helper; ผล 2 ข้อที่รายงานได้จาก local-persistence + BETTERNOTE_QA_DAILY_UPDATE_ONLY=1 จริง

## หลักฐาน PDF/Optimize ที่ตรวจร่วมกับรอบนี้

- Production build ล่าสุดผ่าน 17.77 วินาที: ../scratch/pdf-ink-review/build.log; ไม่มี production edits หลัง build นี้ในรอบ audit
- Native 91-page export ผ่าน ลำดับ/ขนาดหน้า/ไทย/สี/cleanup: ../scratch/pdf-ink-review/native-91.log
- Native vector fidelity + 22,000 จุดผ่าน: ../scratch/pdf-ink-review/fidelity-final.log
- Edge เปรียบเทียบเก่า/ใหม่/ไฟล์ผู้ใช้: ../scratch/pdf-ink-review/edge-compare-4VHP6q/
- รูปทรงปลายมนเพิ่มขนาด PDF: fixture 116,602 → 210,110 bytes ประมาณ 80%; ไม่ใช่อัตราที่รับประกันกับทุกสมุด ภาพ raster backup ไม่ได้เพิ่ม cap geometry
- ตัวเลขลด private RAM 36.8% จากงานก่อนหน้าเป็น snapshot fixture เท่านั้น; ไม่ใช่ RAM ทั้งแอป และไม่อ้าง performance เพิ่มเป็นเปอร์เซ็นต์เดียวกัน
- การตรวจ validator เดิมกับใหม่ 10,000 กรณี และ resource soak/ปิดเปิดข้อมูลเดิมมีบันทึกก่อนหน้าใน OPTIMIZATION_REVIEW.md และ ../scratch/OPTIMIZE_USER_TEST_REPORT.md ไม่ได้นำผลเก่ามานับเป็นการรันใหม่

## ไฟล์ลับและ dependency

- รายชื่อไฟล์ต่างจาก main/ไฟล์ใหม่ก่อนเพิ่มรายงานนี้: ไม่พบ .env/.bnote/BetterNote_Latest_Backup.json/certificate-key extensions และไม่พบ private-key PEM marker ใน production files ที่เปลี่ยน เป็นการสแกนเฉพาะรูปแบบที่ระบุ ไม่ใช่การพิสูจน์ว่าไม่มีความลับทุกชนิด
- npm audit --omit=dev วันที่ตรวจ: production dependency vulnerabilities ที่ registry รายงาน 0; ไม่มีการอัปเดต dependency/lockfile ดู npm-audit.json ขอบเขต omit-dev ไม่ใช่การรับรอง Electron runtime หรือ supply chain ทั้งหมด
- git diff --check แบบ Windows normalized/CRLF-aware ผ่าน; บังคับ autocrlf=false จะเห็น CRLF ใน test files เป็น whitespace จึงไม่เอาผลนั้นไปอ้างเป็น runtime bug

## ข้อจำกัดที่ยังค้าง

- ยังไม่ใช่ผลทดสอบ Surface จริง RAM 8 GB พร้อม Teams 30–60 นาที หรือ RAM pressure ทุก GPU
- ไม่ทดสอบ download/hydration Google Drive online-only จริงในรอบนี้; ใช้ native worker กับข้อมูลจำลอง/virtual-read regression และไม่ยืนยันว่า cloud upload สำเร็จจากการเห็นไฟล์ในโฟลเดอร์
- ยังไม่มี crash dump ของ Store 5 เหตุการณ์เดิม จึงไม่ระบุว่าแก้สาเหตุเหล่านั้นครบ
- การ decode รูปใหญ่/PDF merge/Restore JSON ทั้งชุดและ native clipboard bitmap ยังต้องใช้ RAM ตามข้อมูลจริง
- ยังไม่มีแพ็กเกจอัปเดตรอบนี้ให้ตรวจ WACK/Store upgrade/identity/ไอคอนจริง รายการไฟล์และ hash ของ source ช่วยให้ตรวจย้อนกลับได้ แต่ไม่แทน artifact validation

## ลำดับก่อน Publish ที่เสนอ

1. แก้ close ขณะ minimized/hidden พร้อม regression ของ failed saves และ Restore
2. แก้ stale-state auto-open สำหรับ notebook ที่สร้าง/import สำเร็จพร้อม regression หน้า App จริง
3. ตกลงเลขรุ่นที่สูงกว่า 1.3.0.0 และปรับทั้ง app/package/manifest/release notes ให้ตรงกัน
4. รัน targeted checks หลังแก้ แล้ว build Appx ใหม่ ตรวจ artifact และทดสอบอัปเกรด/Surface จริงก่อนเผยแพร่
