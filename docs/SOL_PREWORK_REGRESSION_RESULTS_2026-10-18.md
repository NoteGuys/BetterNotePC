# ผลตรวจ sol-prework — 18 ตุลาคม 2026

สถานะ: ตรวจและทดสอบรอบนี้เสร็จแล้ว พบข้อบกพร่องรับมือ Worker messageerror 1 จุดที่ควรแก้ก่อนปล่อย ส่วนการทดสอบอุปกรณ์/บริการจริงที่ยังไม่ได้ทำระบุไว้แยกชัดเจน

## โค้ดและวิธีตรวจ

- HEAD: `4797c9a` บน `sol-prework`; รวม working tree ภาษา/Settings และไฟล์ใหม่ทั้งหมด เทียบฐาน `origin/main` / `bc8a30b`
- ใช้ข้อมูลจำลอง โปรไฟล์แยก origin/เครื่อง A-B และโฟลเดอร์ใต้ `scratch/sol-audit-20261018/` ไม่ใช้ฐานข้อมูลงานจริงหรือ Drive จริง
- หลักฐาน source hash อยู่ใน `snapshot-before.json` และ `snapshot-after-core.json`; diff อยู่ใน `changes.diff`
- ตรวจ hash source/tests/package 238 ไฟล์หลังรันแล้วไม่พบการเปลี่ยนระหว่างทดสอบ (`source-integrity.json`); production files ที่ต่างจากฐาน main รวม 74 ไฟล์ รวมไฟล์ภาษาใหม่ ไม่ใช่จำนวนที่แก้ในรอบทดสอบนี้
- อ่าน diff production และจุดเชื่อม save/DB/queue/worker/backup/PDF/ภาษา พร้อมตรวจ syntax ทั้ง 150 ไฟล์ใน src และ electron ผ่าน ไม่อ้างว่า semantic audit ครบทุกบรรทัดของ repository
- ไม่แก้ production code ไม่สร้าง Appx/EXE ไม่ commit/push/merge

## บั๊กที่ทำซ้ำได้

### P1 — .bnote import ไม่คืนคิวเมื่อเกิด Worker messageerror

ตำแหน่ง: `src/services/bnoteService.js:3` ถึง `:13`

เงื่อนไข: เริ่ม import `.bnote` แล้ว worker ส่ง `messageerror` (ไม่ใช่ `error`) ก่อนส่ง terminal result

ผลที่คาดหวัง: แสดงความล้มเหลว/สถานะผลที่ยังยืนยันไม่ได้ ทำ cleanup และให้คำสั่งถัดไปออกจากคิวได้อย่างปลอดภัย

ผลจริงที่ทำซ้ำด้วย fault injection บน Worker จริง: ไม่มี `onmessageerror`; promise ไม่ resolve/reject, `hasForegroundJobs()` ค้าง true และงาน `runHeavyJob` ถัดไปไม่เริ่ม เนื่องจาก import ไม่มี timeout แบบ validation งานจึงไม่มีเส้นทางจบจาก event นี้

นี่เป็นกรณีรับมือข้อผิดพลาดที่จำลองขึ้น ไม่ใช่การนำเข้าไฟล์ปกติล้มเหลว และไม่ได้ยืนยันว่าเป็นสาเหตุ crash ของผู้ใช้หรือ Microsoft Store

การขาด handler มีอยู่ใน service เดิมก่อน Optimize; การเพิ่ม shared heavy lane ทำให้ผลกระทบขยายไปยัง export/import/restore ที่ต้องเข้าคิวเดียวกัน ไม่พบข้อมูลหายจาก probe ซึ่งไม่เขียนข้อมูลสมุดจริง

หลักฐาน: `bnote-messageerror-finding.json`, `bnote-messageerror.log`, สคริปต์ทำซ้ำ `bnote-messageerror-probe.cjs`

แนวแก้ที่ควรทำแยกหลังตรวจ: รองรับ terminal `messageerror` และ malformed responses พร้อม cleanup; ต้องพิจารณาจังหวะก่อน/หลัง atomic import commit เพื่อไม่รายงานผิดหรือทำให้ Retry สร้างซ้ำ หากผล commit ไม่ทราบต้องตรวจยืนยันผลก่อน ไม่เพิ่ม timeout ที่ฆ่าการเขียน DB กลางทางอย่างเดียว

เกณฑ์ตรวจหลังแก้: validation/import ทั้ง success, postMessage throw, error, messageerror, late response และล้มเหลวใกล้ transaction commit; คิวต้องกลับทำงานและข้อมูลสมุดเดิมไม่เปลี่ยน

## ผลชุดทดสอบรอบนี้

| ชุด | ผล | หลักฐานใต้โฟลเดอร์ QA |
|---|---|---|
| Build production | ผ่าน | build.log |
| Unit/native/browser-backed tests ทั้งหมด | รอบล่าสุด 500/500, ไม่มี skipped | unit.log, core-results.json |
| ปิดแอปปกติ/ซ่อน/ย่อ รันแยก | 3/3 | close-retry.log |
| Syntax production | 150/150 | parse-source.json |
| Local persistence/Editor/Undo/Redo/close | 164/164 | local-persistence.log |
| Backup preparation worker | 11/11 | backup-preparation.log |
| Atomic recovery | 16/16 | backup-recovery.log |
| .bnote roundtrip | 7/7 | bnote-roundtrip.log |
| Large restore | ผ่าน 3 กลุ่ม | restore-large.log |
| Native A/B-device migration + เปิด profile เดิมใหม่ | 6/6 | backup-migration-native.log |
| Notebook/Whiteboard/touch/navigation | 40/40 | navigation-input.log |
| React Canvas pen/coalesced events/palm/commit | 84/84 | ink-input.log |
| PDF import/raster/export/error/cancel | 32/32 | pdf-import.log |
| Native PDF ink fidelity | ผ่านกลุ่ม pressure/nibs/taper/shapes/dots/highlighter และ 22,000 points | pdf-ink-fidelity.log |
| Native print 91 หน้า + forced first-batch failure + CSP | ผ่าน ลำดับ/จำนวน/ภาพ/ขนาดหน้าและ cleanup | pdf-print-native.log |
| Microsoft Edge PDF viewer จริง | ตรวจภาพทั้ง fit และ URL zoom=300 ไม่พบรอยแตกเป็นปล้องในส่วนที่แสดง | edge-fixed-pdf.png, edge-fixed-pdf-zoom300.png, edge-pdf-results.json |
| Backup sync UI | 12/12 | backup-sync.log |
| Backup status UI ตามพฤติกรรมปัจจุบัน | 41/41 ใน adapted harness; original harness ไม่ผ่าน | backup-status-current-final.log, backup-status-current-probe.cjs |
| ภาษา/คู่มือ/RTL/geometry/preferences | 16/16 กลุ่ม รวมเปิดบทแปลใหม่ 165 บท | languages.log |
| คู่มือเดิม | 8/8 | user-guide.log |
| Settings/Updates | 21/21 | phase6-updates.log |
| Daily update | 11/11 | daily-update.log |
| Production Electron main/preload/CSP/assets/save | ผ่านกลุ่มตรวจ | phase6-app.log |
| เพิ่ม concurrent snapshots/worker/queue | 6/6 กลุ่ม; snapshot สมุด 25 รอบและทั้งคลัง 12 รอบ | extra-checks.log, extra-results.json |
| PDF cache mutations | 10/10 | cache-mutations.log, cache-mutations-results.json |
| Native image read >128 MiB + Chromium decode | ผ่าน ไฟล์ PNG จริง 144,028,033 bytes ขนาด 6000×6000 hash ตรง | large-image-results.json |
| Snapshot memory A/B 3 รอบต่อวิธี | ผ่านด้านความเท่ากันของ bytes/hash | snapshot-memory-results.json |
| ใช้ production UI ต่อเนื่อง 30 นาที | ผ่าน 451 รอบ, 99,220 pen moves, ไม่มี renderer error/alert, ปิดปกติ exit 0 | live-soak.log, live-soak-latest.json |
| เปิด profile เดิมหลัง soak เทียบข้อมูลครบทุกหน้า | ผ่าน 6 หน้า พิกัด/style/text/รูปและ geometry ตรงต้นฉบับ, ปิดปกติ exit 0 | soak-reopen.log, soak-reopen-results.json |

ผลหลายชุดทับซ้อนกัน จึงไม่รวมเป็นจำนวนฟังก์ชันหรืออัตราครอบคลุมทั้งแอป ชื่อ check เดิมใน phase6-app ที่มีคำว่า packaged/ASAR เป็นชื่อของ harness รอบนี้ใช้ repository Electron + dist + preload/CSP จริง ไม่ได้สร้าง installer/ASAR ใหม่ มี 404 หนึ่งรายการจาก negative security check ที่คาดไว้

### ผลที่ไม่ผ่านและการแยกสาเหตุ

1. Full suite รอบแรก 499/500: minimized-close test ไม่ถึง precondition ว่าหน้าต่างย่อจริง (`Close mode was not exercised: minimized`) จึงไม่ใช่ผลทดสอบการปิดที่สำเร็จ รันแยก 3/3 และ full suite ใหม่ 500/500 ผ่าน เก็บ observation รอบแรกและ core-first-results ไว้; unit.log รอบแรกถูกเขียนทับเมื่อรันซ้ำ จึงระบุที่มาของ observation จาก tool output ตรง ๆ
2. `backup-status.browser.cjs` รุ่นเก่าไม่ผ่าน เพราะ assert หา full snapshot ที่ root แทน `Devices/<id>` และมี selector/นโยบาย Restore รุ่นเก่า ไม่แก้แอปให้กลับไปพฤติกรรมนั้น ใช้ adaptation ใน scratch แล้วผ่าน 41/41: ใช้ device path, กด Back up now ปัจจุบัน, ตรวจ failure หลังสั่ง backup และตรวจ legacy file ไม่ถูกเขียนทับพร้อมอนุญาต backup ของ device เอง ไม่บังคับ Restore และไม่คาดหวัง legacy warning เดิม เก็บ original failure และระบุ adaptation ไว้ทั้งหมด ไม่อ้างว่า original test ผ่าน
3. Worker messageerror fault probe ยืนยันบั๊กข้างต้น แยกจาก 500 tests เดิมที่ยังไม่มีกรณีนี้ จึงไม่กล่าวว่าไม่มีบั๊กเพราะ suite ผ่าน

## ผลตามสถานการณ์ S01–S20

| ID | สถานะและขอบเขต |
|---|---|
| S01 | ผ่าน save/close/reload และ native ปกติ/ซ่อน/ย่อ; มีความไม่เสถียร precondition ของ harness ในรอบแรก |
| S02 | ผ่าน aborted save, Retry และ close acknowledgment รอ commit |
| S03 | ผ่านปากกาจำลองบน React Canvas, preview pixel comparison และประวัติ; ฮาร์ดแวร์จริงยังไม่ทดสอบ |
| S04 | ผ่าน navigation/Whiteboard/pinch จำลอง; Surface pen/palm จริงยังไม่ทดสอบ |
| S05 | ผ่าน 91 หน้า: รอบแรก render 91; แก้หน้าเดียว render 1/reuse 90; รอบไม่แก้ render 0/reuse 91 |
| S06 | ผ่านข้อความ/เส้น/รูป/ขนาด/แม่แบบ/เปลี่ยนชื่อ/ย้าย/เรียง/ลบ และแก้ระหว่าง PDF generation |
| S07 | ผ่าน queue/foreground/background pause/resume และ snapshot concurrency; soak แยกปิด backup I/O |
| S08 | ไม่ผ่านกรณี .bnote Worker messageerror; เส้นทาง error/cancel ของ PDF และ recovery ที่ทดสอบผ่าน |
| S09 | ผ่าน restore plan/content base/conflict และ native A-B/reopen ในชุดจำลอง |
| S10 | ผ่าน unit/native deletion/tombstones/generations/folder reconciliation; ไม่ใช้ไฟล์จริง |
| S11 | ผ่าน large restore, missing/corrupt/mismatch/cancel และ reader inactivity; Drive online-only จริงยังไม่ทดสอบ |
| S12 | ผ่าน snapshot consistency/abort/roundtrip และเปิดข้อมูลใน profile ใหม่ |
| S13 | ผ่าน PDF fidelity/native output/Edge visual; ไม่ใช่การรับรอง PDF ทุกชนิดหรือผู้อ่านทุกตัว |
| S14 | ผ่าน export flow/error/partial cancellation/image formats และ native 91-page print; รวมผลจาก harness หลายชั้น |
| S15 | ผ่าน native bytes/hash/partial read/timeout/retry และ decode รูปจริง >128 MiB; ยังไม่ทดสอบ UI insertion ของภาพ 137 MiB นี้ |
| S16 | ผ่าน soak 30 นาที 451 รอบ รวมสลับ Library/Editor 91 รอบและปิด–เปิด process ใหม่ ตรวจข้อมูลครบทุกหน้า; ไม่มีหลักฐานรับรอง RAM 8 GB/Teams หรือการรันทั้งวัน และไม่ได้เก็บ live listener/worker counts ทุกชนิด |
| S17 | ผ่านสลับภาษา/จำภาษา/geometry/เนื้อหาสมุด และ recovery integration แยก; ไม่อ้างว่าทดสอบทุกภาษาพร้อมทุก native operation ครบทุก combination |
| S18 | ผ่าน mixed names/placeholders/RTL/window sizes ในชุดภาษา |
| S19 | ผ่านบทแปล/ภาพ/คำชี้/ค้นหา/ธีม/ลิงก์และลิงก์เปิดไม่สำเร็จ; ยังไม่มีเจ้าของภาษาอิสระ review |
| S20 | ผ่าน production dist offline/fonts/workers/main/preload/close; Store-installed upgrade และ packaged icon checks ของแพ็กเกจใหม่ยังไม่ทำ |

## หน่วยความจำและข้อจำกัด

เครื่องทดสอบนี้มี RAM ที่ OS มองเห็นประมาณ 15.43 GiB (กลุ่มเครื่อง 16 GB) และ 12 logical CPUs ไม่ใช่ Surface 8 GB ใช้แอปอื่นร่วมในเครื่อง และมีหลายชุด QA รันซ้อนกันในช่วงต้น จึงใช้ soak เป็นหลักฐานความถูกต้อง/เสถียรภาพ ไม่ใช้เวลาหรือ RAM ช่วงนั้นเป็น benchmark แอปเดี่ยว

### Soak และตรวจหลังเปิดใหม่

- ใช้ production App/main/preload/security settings จริงกับสมุดจำลอง 6 หน้าและรูป 4096×3072 (ประมาณ 12 ล้านพิกเซล) ปิด native backup I/O เฉพาะ soak เพื่อแยกจากชุด Backup integration ที่รันจริงแยกไว้
- วนเขียน Undo/Redo ซูม และสลับ Library/Editor อย่างน้อย 30 นาที ได้ 451 รอบ/99,220 pointermove; จบรอบพร้อมพักและปิดใช้เวลาราว 1,839 วินาที ไม่มี forced GC
- ตรวจภาพก่อน/หลังไว้ใน `live-soak-iLqXXX/before.png` และ `after.png`; ไม่มี renderer exception, error alert หรือ crash events ใน diagnostics ที่ตรวจ
- private memory รวม process tree: ช่วงใช้งานซ้ำมัธยฐาน 796.4 MiB, สูงสุดที่ sampler 500 ms จับได้ 1,118.2 MiB; หลังกลับ Library และพัก 30 วินาทีล่าสุด 460.3 MiB (มัธยฐานช่วงพัก 459.8 MiB) ไม่ใช่ peak RAM ที่พิสูจน์ว่าไม่มี transient spike ระหว่าง samples และไม่ใช่ JS heap อย่างเดียว
- RAM มีการเพิ่มและลด ไม่พบแนวโน้มสะสมทางเดียวตลอดรอบนี้ แต่ผล 30 นาทีไม่สามารถรับประกันว่าไม่มี memory leak ทุกเส้นทางหรือการใช้งานยาวกว่านี้
- ปิดด้วย normal window.close ได้ exit 0 แล้วเปิด profile เดิมใหม่ เทียบ stroke points/style, ข้อความ, รูปต้นฉบับและ geometry ทุกหน้าเท่ากับ fixture หลัง normalize เฉพาะ metadata ที่เปลี่ยนตามการ import; hash เนื้อหา `30d8f3c00c903f0fbc63cc4aaa5311f9fbfae47ef12bf61f9bf0c1768420a8fe`
- รายการ finding เดิมของ soak ที่บอกนำเข้าแล้วไม่เปิดอัตโนมัติ เป็นพฤติกรรมที่ผู้ใช้ยอมรับให้อยู่ Library ต่อแล้ว ไม่จัดเป็นบั๊กต้องแก้

Microbenchmark snapshot แยก 24 หน้า/หน้า 1 MiB encoded image string (ไม่ decode ภาพ) 3 รอบต่อวิธี: bytes 25,170,013 และ SHA-256 เท่ากันทุกครั้ง Peak private memory ต่อ process tree ต่ำลงสำหรับวิธี Blob แต่เวลาแต่ละรอบไม่ได้เร็วขึ้นเสมอ นี่เทียบเฉพาะ implementation snapshot เดิมกับใหม่ใน runtime เดียว ไม่ใช่ v1.3.0 เทียบแอปใหม่ทั้งระบบ และไม่ใช่เปอร์เซ็นต์ความเร็วรวมแอป

| ค่ามัธยฐาน 3 รอบ | snapshot แบบเดิม | snapshot แบบ Blob |
|---|---:|---:|
| Peak private memory ของ process tree | 405.2 MiB | 257.5 MiB |
| ส่วนเพิ่มเหนือ baseline แต่ละรอบ | 245.9 MiB | 97.3 MiB |
| ระยะเวลา | 324.3 ms | 411.4 ms |

ค่ารอบนี้แสดง trade-off ระหว่างหน่วยความจำกับเวลาของ workload เฉพาะ และมี soak ทำงานร่วมอยู่ ไม่ใช้ยืนยันว่าทุกงานเร็วขึ้นหรือ RAM แอปลดลงเท่ากันทั้งหมด

ยังต้องทดสอบ Surface จริง RAM 8 GB/16 GB + ปากกา/Teams, Drive streaming/offline hydration จริง และแพ็กเกจ Store upgrade เมื่อถึงขั้นเตรียมปล่อย ไม่อ้างว่าผลจำลองแทนการทดสอบเหล่านี้ได้
