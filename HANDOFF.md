# BetterNote Pro Studio — HANDOFF รุ่น 1.3.0.0

เอกสารส่งมอบงานตามโค้ดที่รวมเข้า `main` เมื่อ 2026-10-09 ใช้สำหรับพัฒนาต่อและเตรียมส่ง Microsoft Store ไม่ใช่ผลรับรองจาก Microsoft

สถานะปัจจุบัน: merge commit `f1793b1f82f98e8c49b36c3e54950b777f8fd794` ถูก push แล้ว ไฟล์ทุกไฟล์ตรงกับ `sol-work` ที่ commit `403680dc49f96deac0c9bac8e1f43999fc5c8877` ก่อนแก้เอกสารนี้ ผู้ใช้ยืนยันการใช้งานชุดล่าสุดผ่านแล้ว การตรวจรอบย้ายระบบไม่ได้เปิดแอปหรือแตะข้อมูลโน้ตจริง

## 1. แอปนี้คืออะไร และความสามารถของรุ่นนี้

BetterNote เป็นแอปจดโน้ตด้วยปากกา วาดรูปทรง จัดสมุดและโฟลเดอร์ และเขียนบน PDF สำหรับ Windows/Surface ข้อมูลหลักอยู่ใน IndexedDB ของเครื่อง ใช้เขียนได้ออฟไลน์ ส่วนสำรองไป Google Drive และการตรวจอัปเดตเป็นงานแยก

- ปากกา Fountain/Ballpoint/Brush, Highlighter, สีและความหนา, แรงกดและหัวท้ายเส้นเรียว
- ยางลบ, ขยี้ลบ, QuickShape, รูปทรง, Lasso, ข้อความ, ภาพ/ครอป, Clipboard และ Snip
- กระดาษและเทมเพลตหลายแบบ เพิ่ม/ลบ/จัดหน้า, ภาพย่อ, ค้นหา, Favorites, Trash และแท็บสมุดสูงสุด 5 แท็บ
- Whiteboard, การเลื่อนและซูมด้วยนิ้ว, Palm Rejection และโหมดปากกา
- นำเข้า PDF/.bnote; ส่งออก PDF หน้าเดียว/ทั้งเล่ม, .bnote และ PNG/JPEG
- สำรองข้อมูลที่แก้ไข แยกชุดตามเครื่อง; Restore เมื่อผู้ใช้เลือกเครื่องและกดเอง
- ตรวจอัปเดตวันละครั้ง แจ้งเตือนเล็กที่หน้าหลักประมาณ 5 วินาทีเฉพาะเมื่อพบอัปเดต
- คู่มือออฟไลน์ใต้ Favorites: 10 หมวด 55 บท ภาพประกอบ 44 ไฟล์; คู่มือไทย/อังกฤษ
- UI รองรับ English, Thai, Simplified Chinese และ Russian

การแก้ไขสำคัญจาก `sol-work`:

1. รอ transaction บันทึกสำเร็จก่อนแสดงว่าบันทึกแล้ว มี retry และตัวกั้นการปิดแอปเมื่อยังมีงานค้าง
2. เก็บ Undo/Redo แยกสมุดตลอด session; จำแท็บและตำแหน่งหน้า; อัปเดตปกจากเนื้อหาปัจจุบัน
3. ปรับ Surface: การแตะปุ่มด้วยปากกา, แถบเครื่องมือแถวเดียวพร้อม overflow, ปลดสถานะปากกาค้าง, เลื่อน/ซูมและตำแหน่งคำแนะนำ Whiteboard
4. ปรับรูปทรงให้มุมคม, จานสี/ไฮไลท์และ Lasso; แยกงานเรนเดอร์/แคชภาพย่อและหน้า PDF เพื่อลดภาระขณะเขียน
5. ส่งออก PDF ทั้งเล่มได้โดยไม่ต้องส่งออกหน้าแรกก่อน แยกเรนเดอร์/ประกอบไฟล์เป็นช่วงงาน มี progress และเก็บ PDF ต้นฉบับ
6. แก้ .bnote ถูกตัดระหว่างส่งออก: ตรวจข้อมูลและเขียนผ่าน native worker เป็นชิ้น; นำเข้าตรวจครบก่อนบันทึก
7. แยก Backup ออกจาก Restore: ไม่มี Restore อัตโนมัติเมื่อเปิดแอปหรือพบ Drive และไม่มีแบนเนอร์ชวน Restore ซ้ำในเส้นทางปัจจุบัน
8. สำรองเฉพาะสมุดที่เปลี่ยน; PDF ทำภายหลังช่วงว่างและใช้แคชรายหน้า; แยกสถานะข้อมูลกู้คืนจาก PDF ที่ยังเตรียมอยู่
9. สำรองแต่ละเครื่องใต้ `Devices/<device-id>` จึงไม่ทับกัน; เก็บล่าสุดและย้อนหลัง 3 ชุดที่สำรองข้อมูลสำเร็จ
10. แก้ Restore ชุดใหญ่ด้วย worker, progress, timeout ตามกิจกรรม, snapshot ที่ตรวจ hash และการยกเลิกก่อนเริ่มเขียน
11. เลือก device เพื่อ Restore ซ้ำได้ และอัปเดตสมุดเดิมที่ไม่ได้แก้ในเครื่องนี้โดยไม่สร้าง “Copy from this device” เกินจำเป็น; หากเนื้อหาแก้ชนกันยังรักษาสำเนาไว้
12. เก็บข้อมูลโฟลเดอร์/การลบและโครงสร้าง parent ให้ถูกต้อง ป้องกันรายการลบแล้วกลับมาในชุดปัจจุบัน
13. ใช้ไอคอน BetterNote ในหน้าต่าง/Taskbar/แพ็กเกจและหน้าต่างช่วยส่งออก PDF; แพ็ก `app-icon.ico` ใน ASAR
14. หน้าตั้งค่า/คู่มือแสดง 1.3.0.0; fallback ของหน้าต่างอัปเดตใช้เวอร์ชันปัจจุบันและไม่เดาเลขเวอร์ชันล่าสุด

## 2. เวอร์ชันและเทคโนโลยี

| แหล่งเวอร์ชัน | ค่า |
| --- | --- |
| `package.json.version` | `1.3.0` |
| `package-lock.json.version` และ `packages[""].version` | `1.3.0` |
| `package.json.build.buildVersion` | `1.3.0.0` |
| `AppxManifest.xml` ใน repository | `1.3.0.0` |
| `src/services/updateService.js` | อ่าน version/buildVersion จาก package.json |
| `src/components/Guide/guideContent.js` | `GUIDE_VERSION = '1.3.0.0'` |

electron-builder 26.15.3 สร้าง manifest จาก template ของตัวเอง เพราะ config ไม่ได้กำหนด `customManifestPath` และไม่ได้เปิด `setBuildNumber` ดังนั้นเลข Appx มาจาก `package.json.version` ผ่าน `getVersionInWeirdWindowsForm(false)` ได้ `1.3.0.0` ไม่ได้ใช้ root `AppxManifest.xml` เป็นแหล่งเดียว ส่วน `buildVersion` ใช้กับเลขเวอร์ชัน executable

ไม่พบ `1.2.1-test` หรือเลขเวอร์ชันที่ลงท้าย `-test` ใน tracked text ตอนตรวจขั้น A

| Dependency | เวอร์ชันที่ lock ไว้ |
| --- | --- |
| electron | 44.2.0 |
| electron-builder | 26.15.3 |
| react / react-dom | 18.3.1 |
| vite | 6.4.3 |
| @vitejs/plugin-react | 4.7.0 |
| idb | 8.0.3 |
| pdfjs-dist | 4.10.38 |
| jspdf | 4.2.1 |
| pdf-lib | 1.17.1 |
| lucide-react | 1.41.0 |
| canvas-confetti | 1.9.4 |

สไตล์ใช้ Vanilla CSS; เวอร์ชันในตารางอ่านจาก lockfile ไม่ใช่ lower bound ของช่วง semver ใน package.json

## 3. ติดตั้ง Build Test และแพ็ก Appx

รอบตรวจนี้ใช้ Windows, Node.js **v24.21.0**, npm **11.19.0** ใช้ `npm ci` เท่านั้น ไม่แก้ lockfile และไม่รัน `npm install` หรือ `npm audit fix`

```powershell
$env:NODE_DISABLE_COMPILE_CACHE = '1'
$env:CORE_JS_SILENT = '1'
$env:ADBLOCK = '1'
npm ci
npm run build
```

ผลบน `main`: npm ci exit 0; build exit 0 ใช้ 28.76 วินาที ผลละเอียดในหัวข้อ 18

ชุด unit tests ปัจจุบันอยู่ใน `tests/` และเก็บใน Git รันโดยสร้าง QA directory แยกใหม่ ไม่ใช้โฟลเดอร์โน้ตหรือ Drive จริง:

```powershell
$env:NODE_DISABLE_COMPILE_CACHE = '1'
New-Item -ItemType Directory -Force -Path scratch | Out-Null
$env:BETTERNOTE_QA_TEMP = (node -e "const fs=require('fs'),path=require('path');console.log(fs.mkdtempSync(path.resolve('scratch/isolated-qa-')))")
$testFiles = @(Get-ChildItem -LiteralPath tests -File |
    Where-Object { $_.Name -match '\.test\.(js|cjs)$' } |
    ForEach-Object { $_.FullName })
node --test @testFiles
```

สร้าง `scratch/` ก่อนหากยังไม่มี ชุดทดสอบใช้ข้อมูลจำลองและ fixture ใน directory นี้ ไม่ต้องเปิด Electron app ผลตรวจ 36 ไฟล์: **449 ผ่าน, 0 fail/cancelled/skipped**

สคริปต์เก่า 6 ไฟล์ที่ HANDOFF รุ่นก่อนอ้างถึง ได้แก่ `scratch/test_tab_system_logic.mjs`, `scratch/test_device_migration_and_sync.mjs`, `scratch/verify_all_dicts.py`, `scratch/test_theme_and_updates.mjs`, `scratch/test_round2_fixes.mjs`, `scratch/verify_dist_bundle.cjs` ไม่มีอยู่ในรอบตรวจนี้ จึงไม่ได้รันและไม่ได้เขียนสคริปต์ทดแทน

### คำสั่งแพ็กเฉพาะ Appx x64 ที่ตรวจ config แล้ว (ขั้น C)

```powershell
npm ci
npm run build
npm run dist -- --win appx --x64 --publish never --config.directories.output=release/store-1.3.0.0-main --config.artifactName=BetterNotePC-1.3.0.0-x64.appx
```

- `npm run dist` เรียก electron-builder; ตัว script ไม่ได้สั่ง Vite build เอง จึงต้อง build ก่อน
- `--win appx --x64` เลือกเฉพาะ Appx สำหรับ Intel/AMD Windows และ Intel Surface ไม่ใช่ ARM64 หรือ NSIS
- ผลลัพธ์ตาม CLI: `release/store-1.3.0.0-main/BetterNotePC-1.3.0.0-x64.appx`
- Override เฉพาะชื่อ artifact/โฟลเดอร์ผลลัพธ์ ไม่เปลี่ยน `build.appx` หรือ Store identity
- `--publish never` ไม่อัปโหลดหรือเผยแพร่เอง; อย่าใช้ `npm run dist` เปล่า เพราะ config มีทั้ง appx และ nsis
- **คำสั่งแพ็กจาก main ยังรอขั้น E**; ผล help/config ยืนยันตัวเลือก แต่ไม่ใช่หลักฐานว่าแพ็ก main สำเร็จแล้ว ต้องตรวจ manifest/hash/commit ของไฟล์ใหม่หลังสร้าง
- Appx เก่าที่ `release/store-1.3.0.0-final/` เป็นหลักฐานก่อนการรวม ไม่ใช้แทน Appx จาก main
- ขนาดและ SHA-256 ของ Appx ใหม่ยังไม่ทราบจนกว่าสร้างเสร็จ ห้ามนำ hash เก่ามาอ้างเป็นของใหม่

คำสั่งอื่นสำหรับผู้พัฒนาหลังได้รับอนุญาต: `npm run dev` เปิด Vite, `npm run app` เปิด Electron, `npm run pack` แพ็ก directory ในรอบย้ายระบบนี้ไม่ได้รันคำสั่งเปิดแอป

## 4. แผนที่โค้ดและโฟลเดอร์

| ตำแหน่ง | หน้าที่ |
| --- | --- |
| `electron/main.cjs`, `preload.cjs`, `appSecurity.cjs` | หน้าต่าง, guarded IPC, asset protocol, native filesystem และความปลอดภัย |
| `electron/backupWriter.cjs`, `backup.worker.cjs`, `backupWorkerClient.cjs` | เขียน/ตรวจ/เผยแพร่ backup generation ใน worker |
| `electron/backupReader.cjs`, `backupReader.worker.cjs`, `backupReaderClient.cjs`, `backupDevices.cjs` | ค้น device และอ่าน/ตรวจชุดกู้คืน |
| `electron/pdfExport.cjs`, `pdfMerge.worker.cjs` | native PDF sessions/ประกอบผลลัพธ์และล้างไฟล์ชั่วคราว |
| `electron/bnoteSave.cjs`, `bnoteSave.worker.cjs`, `bnoteFormat.js` | เขียน .bnote เป็นชิ้นและตรวจรูปแบบ |
| `electron/storeUpdates.cjs`, `storeUpdateCheck.ps1` | ตรวจ Microsoft Store ผ่าน native helper |
| `src/App.jsx`, `components/Common/DocumentTabBar.jsx` | แท็บสมุด, page retention, สถานะบันทึกและอัปเดต |
| `src/components/Editor/` | NoteEditor, CanvasBoard, Toolbar, ThumbnailSidebar, เครื่องมือวาด/รูป/ข้อความ |
| `src/components/Library/` | สมุด/โฟลเดอร์/Trash/Settings/BackupStatusModal |
| `src/components/Common/GoogleDrivePanel.jsx` | เลือกโฟลเดอร์, backup และเลือก device เพื่อ Restore |
| `src/components/Guide/`, `public/user-guide/` | คู่มือออฟไลน์และภาพประกอบ |
| `src/services/db.js`, `localSaveService.js`, `localSaveCore.js` | IndexedDB และคิวบันทึกงานในเครื่อง |
| `src/services/autoBackupService.js`, `backupController.js`, `backupPreparationService.js` | คิวสำรองและเตรียมข้อมูล/PDF แบบ incremental |
| `src/services/backupRecovery*`, `backupRestorePlan.js` | ตรวจ/วางแผน/commit Restore และรับรองผลผ่าน receipt |
| `src/services/editorPagesService.js`, `notebookCoverService.js`, `backupPdfPageCache.js` | แคชหน้าสมุด ปก และ PDF รายหน้า |
| `src/services/updateService.js`, `updateCore.js`, `i18n.js` | ตรวจอัปเดตและแปลภาษา |
| `src/utils/`, `src/data/` | Inking, touch, PDF, รูปทรง, ชื่อสมุด, ปกและเทมเพลต |
| `public/fonts/` | ฟอนต์ออฟไลน์ |
| `tests/`, `docs/` | ชุดตรวจที่เก็บใน Git และรายงานแต่ละเฟส |
| `dist/`, `release/`, `scratch/` | Build, artifacts และ QA/logs; อยู่ใน .gitignore ไม่ commit |

## 5. ระบบเขียนและการแสดงผล

### 5.1 Canvas และ Inking

`CanvasBoard.jsx` / `inkingEngine.js` แยกพื้นหลัง, เส้นที่ commit แล้ว และเส้นกำลังวาด รับ Pointer Events และ coalesced events; จัดแรงกด ความหนาและปลายเส้น ประสิทธิภาพจริงขึ้นกับฮาร์ดแวร์ ไม่รับรองเฟรมเรตตายตัว

Scribble-to-Erase ตรวจการกลับทิศของเส้น และมี guard แยกจากรูปทรงปิด QuickShape อยู่ใน `shapeRecognition.js` และการวาดรูปทรงต้องรักษามุม/ปลายคมตามข้อมูล geometry

### 5.2 หน้ากระดาษ PDF และภาพย่อ

รองรับ A4/A3/A2, เทมเพลตและ Whiteboard `editorPagesService` แยกอ่านหน้าจาก UI; ภาพย่อ/ปกมี scheduler/cache และการเตรียมล่วงหน้า แคนวาสนอก viewport ไม่ต้องวาดครบพร้อมกัน ต้องรักษาภาพตัวอย่างขณะ scroll และไม่บันทึกปกว่างทับปกเดิมเมื่อเรนเดอร์ล้มเหลว

PDF pages เก็บ reference ของ PDF ต้นฉบับและภาพ cache โดยไม่จำเป็นต้องเก็บภาพเรนเดอร์เต็มทุกหน้าใน state ตลอดเวลา ส่งออกต้องใช้ต้นฉบับ/เส้น/ข้อความตาม pipeline ที่ตรวจแล้ว

### 5.3 Undo/Redo และแท็บ

`notebookHistoryService.js` เก็บประวัติแยกสมุดตลอด session ไม่ผูกกับอายุ component; เปลี่ยนแท็บไม่ทำให้ Undo ของสมุดอื่นสูญหาย Restore/import ต้องจัดการประวัติที่เกี่ยวข้องหลัง commit เท่านั้น

เปิดสูงสุด 5 แท็บและใช้ LRU เมื่อเกิน limit จดจำหน้าของแต่ละสมุดผ่านสถานะแท็บและ localStorage

### 5.4 Touch / Zoom / Whiteboard

`NoteEditor.jsx`, `src/utils/touchNavigation.js` และ input session ใน CanvasBoard แยก pen/touch/navigation รองรับ pinch, pan, Ctrl+wheel และสองนิ้วแตะสองครั้ง Undo ช่วงซูมกระดาษใน NoteEditor คือ 0.35–3.5

จุดตรึงขณะซูมต้องอยู่บนหน้าที่ผู้ใช้กำลังดู ไม่กระโดดไปหน้าเก่า และต้องเคลียร์สถานะเมื่อ pointercancel/lost capture/blur หลังเขียนต้องกลับไปเลื่อน/ซูมได้โดยไม่จำกัดฝั่งหน้าจอที่เพิ่งเขียน Whiteboard มี viewport ของตัวเอง อย่ารวมข้อจำกัดกระดาษเข้าไปโดยไม่ตรวจ

## 6. ข้อมูล IndexedDB และรูปแบบไฟล์

### 6.1 Schema เดิม ไม่มี schema migration ในรุ่นนี้

เทียบก่อนรวมกับ `sol-work`: ชื่อ **BetterNoteDB**, version **1**, stores/indexes ไม่เปลี่ยน

| Store | keyPath | Indexes |
| --- | --- | --- |
| folders | id | parentId (ไม่ unique) |
| notebooks | id | folderId, updatedAt (ไม่ unique) |
| pages | id | notebookId (ไม่ unique), notebookPage=[notebookId,pageIndex] (unique) |
| settings | key | ไม่มี |

`onupgradeneeded` ยังสร้าง stores/indexes เดิม ไม่ได้ bump DB_VERSION การเพิ่ม field/setting ใช้ stores เดิม ไม่ใช่การย้ายฐานข้อมูลใหม่

- folders: id, name, parentId, color/icon, timestamps, isDeleted รวมถึงข้อมูล retirement/permanent deletion และ restoreParentId เมื่อเกี่ยวข้อง
- notebooks: id, name, folderId, cover/template/paper, timestamps, pageCount, isPdf/isFavorite/isDeleted, lastOpenedPageIndex และ metadata ที่เครื่องมือใช้
- pages: id, notebookId, pageIndex, template/paper, strokes, textElements, imageElements/ข้อมูลภาพตามรูปแบบเก่า, drawings, thumbnail/cache และข้อมูล PDF
- PDF fields: pdfOriginalId, pdfOriginalDigest, pdfPageNumber, pdfLazyRaster/pdfNativeRaster และ pdfOriginal payload เก็บครั้งเดียวต่อ source; pdfPageImage อาจเป็น cache ไม่ใช่เนื้อหาเดียวสำหรับกู้คืน
- settings: ค่าเลือกโฟลเดอร์, backup_device_v2, backup_v2_checkpoint, backup_deleted_notebooks_v2, backup_recovery_receipt, backup_restore_receives_v1, backup_restore_folders_v1, backup_restore_content_base_v1 และ setting เดิม

`writeTransaction` resolve เมื่อ `tx.oncomplete` เท่านั้น `request.onsuccess` ยังไม่ยืนยันว่าทั้ง transaction สำเร็จ pendingWrites และคิว localSave ใช้กั้น backup/close เพื่อไม่สำรองข้อมูลที่ยังไม่ได้บันทึก

### 6.2 .bnote — ไฟล์สมุดเดี่ยวแบบพกพา

ส่งออกแบบ `format: BetterNote_Document`, `version: 1`, notebook metadata และ pages รองรับ legacy standalone notebook ที่มี pages ตรวจ JSON/ขนาด/จำนวนหน้า/ID ก่อนใช้ ไฟล์ที่ถูกตัดหรือไม่สมบูรณ์ไม่สร้างสมุดบางส่วน

การ export ผ่าน `bnoteService` / native bnoteSave worker เป็นชิ้น การ import ผ่าน worker และ `importBnoteAtomic` ใช้ ID ใหม่สำหรับการนำเข้าแบบไฟล์พกพา นี่เป็นคนละกรณีกับ Restore ที่ต้องพิจารณา ID/ต้นกำเนิดสมุดเดิม

### 6.3 Snapshot กู้คืนและ manifest สำรอง

Snapshot JSON เก็บ version/appName/exportDate, folders และ notebooks พร้อม pages รูปแบบกู้คืน version 1 ยังรองรับ ข้อมูล PDF ต้นฉบับต้องเดินทางไปกับ page records อย่าตัดออกเพียงเพราะมี PDF copy อยู่ข้างนอก

Backup ปัจจุบันใช้ manifest **version 2** ที่ `Full_System/backup_manifest.json` ชี้ไปยัง `Full_System/Backup--<sha256>.json` และไฟล์ `.bnote`/PDF ด้วย path, hash, size, revision พร้อม backupDevice, activeIds, fullRevision และ generation metadata

`BetterNote_Latest_Backup.json` เป็นชื่อชุดเก่าที่ reader รองรับ ไม่ใช่ชื่อไฟล์ที่ควรเดาใช้แทน manifest รุ่นปัจจุบัน ชื่อไฟล์ใหม่เป็น content-addressed และชื่อสมุดขึ้นก่อน hash เพื่ออ่านง่าย

### 6.4 Restore ที่ใช้จริง

1. เข้าหน้าหลักแล้วเปิด Backup & Sync เลือก Local Backup หรือ Google Drive และโฟลเดอร์ที่มีชุดสำรอง
2. Find backups/เลือก source: reader ค้น metadata ของ device แล้วให้ผู้ใช้เลือกเครื่องและวันที่
3. กด Restore from Folder เอง การค้นพบ backup หรือเปิดแอปไม่ใช่คำสั่งนำเข้า
4. ระบบ flush local saves, พักคิว backup, อ่าน snapshot ที่ commit แล้ว ตรวจ path/hash/ขนาด/โครงสร้าง และวางแผนใน worker
5. ก่อนเขียนยกเลิกได้; เมื่อเริ่ม IndexedDB transaction รอ commit/abort ให้ชัดเจน ไม่ terminate ด้วย timeout กลาง transaction
6. `restoreBackupAtomic` เขียน folders/notebooks/pages/settings ใน transaction เดียว พร้อม operation receipt ใช้ยืนยันกรณี worker ตอบกลับไม่ถึง UI
7. หลัง commit เคลียร์ประวัติสมุดที่เปลี่ยน อัปเดต Library/ปก แล้วปล่อยคิว backup กลับมาทำงาน ความล้มเหลวของ refresh ไม่ควรถูกตีความว่าข้อมูลไม่ได้ commit

Restore รักษาสมุดที่ไม่เกี่ยวข้อง ถ้าสมุด local ไม่เปลี่ยนจากฐานที่รับมาหรือ incoming รักษาเนื้อหาเดิมครบ จะอัปเดตสมุดเดิมโดยไม่สร้าง copy ส่วนเนื้อหาที่แก้ชนจริงยังเก็บสำเนา ใช้ hash/ancestry ไม่ใช้แค่ชื่อหรือเวลาเป็นหลักฐาน

## 7. Backup และ Google Drive

### 7.1 แยกหน้าที่

Local save คือ IndexedDB; Backup คือคัดข้อมูลที่บันทึกแล้วไป filesystem; Google Drive for desktop เป็นผู้ upload/download ไฟล์; Restore คือคำสั่งผู้ใช้ให้ BetterNote รับชุดสำรองเข้าฐานข้อมูล

`AutoBackupService` ใช้ outbound controller และ idle sync facade ไม่ start ตัวรับ shared-root อัตโนมัติ `backupSyncService.js`/protocol เก่าบางส่วนยังมีไว้รองรับเส้นทางเดิม/แผน reconcile ห้ามเห็นไฟล์นี้แล้วสรุปว่าระบบปัจจุบัน auto-restore

### 7.2 โฟลเดอร์และการแยกเครื่อง

- Local folder ที่เลือกแทนค่า default; default เป็น Documents ของระบบผ่าน `app.getPath('documents')` ต่อด้วย BetterNote.AppPC
- Drive target ใช้ `gdrive_backup_method = desktop` และ `gdrive_backup_path` ที่เลือกเอง แยกจาก local_backup_path
- ทั้งสอง target ชี้โฟลเดอร์เดียวกันได้ โดย writer รวมบทบาทที่ canonical path เดียวกันเพื่อไม่เขียนซ้ำ
- `Devices/<device-id>/Editable_Notes/`: สมุด .bnote ที่แก้ไขต่อได้
- `Devices/<device-id>/PDF_Documents/`: สำเนาอ่าน PDF
- `Devices/<device-id>/Full_System/`: manifest และ snapshot กู้คืน
- `Devices/<device-id>/Backup_History/`: metadata/ไฟล์รุ่นก่อนที่ระบบจัดการ

แต่ละเครื่องเก็บ backup_device_v2 ของตัวเอง การเลือก source Restore ไม่เปลี่ยน device ID ของเครื่องปัจจุบัน จึงไม่เขียนทับชุดของเครื่องต้นทาง ตัวเลือก device อ่าน metadata ก่อน; ตรวจเนื้อหาจริงเมื่อเลือก Restore

### 7.3 Incremental และ PDF ภายหลัง

`backupController` รวมคลิกซ้ำเป็นงานเดียวและขึ้นสถานะทันที รอ local saves ก่อน snapshot สมุดไม่เปลี่ยนใช้ artifact เดิม; แก้หนึ่งสมุดอ่าน/เขียนเฉพาะสมุดนั้น Full snapshot/manifest ยังต้องปรับเมื่อ membership, folder หรือเนื้อหาเปลี่ยน

ข้อมูลกู้คืน commit ก่อน PDF สำเนาอ่าน; PDF รอช่วงว่างจาก pen/touch และใช้ cache รายหน้า แก้หนึ่งหน้าไม่ต้องเรนเดอร์ทั้งเล่มใหม่ สถานะ PDF pending ไม่เท่ากับไม่มี backup กู้คืน และความเร็วไม่ควรรับรองจากตัวเลข fixture บน desktop

### 7.4 การลบและย้อนหลัง

เก็บล่าสุดและ **ย้อนหลัง 3 generation ที่ข้อมูลกู้คืน commit สำเร็จ** ไม่ใช่มีเพียง 3 ไฟล์ทั้งระบบ PDF update ของ generation เดิมไม่ควรไล่ history ข้อมูลกู้คืนออก

ลบสมุดแล้ว next generation เอาออกจาก active set แม้ลบสมุดสุดท้ายต้อง commit empty backup ที่ถูกต้อง ชุดย้อนหลังอาจยังมีสมุดนั้นสำหรับกู้คืนโดยเลือกเอง ไม่เอาสมุดเก่ากลับเข้ามาใน latest อัตโนมัติ

Permanent folder deletion เก็บ retirement/tombstone ไม่ลบทิ้งแค่แถวที่เป็นหลักฐาน ancestry การ cleanup จำกัดเฉพาะไฟล์ BetterNote ที่พิสูจน์ได้ว่าเป็นของ generation หมดอายุ ไม่แตะไฟล์ผู้ใช้หรือชุดเครื่องอื่น

### 7.5 Drive และข้อผิดพลาด

BetterNote ยืนยันได้เฉพาะความสมบูรณ์ของไฟล์ที่อ่านได้ในโฟลเดอร์ ไม่ยืนยันว่า Google upload เสร็จ หาก online-only ต้องรอดาวน์โหลด/ทำ available offline; reader รายงาน bytes/ขั้นตอน และจำกัดการรอเมื่อไม่มีความคืบหน้า การเลือก device ยังเห็นได้แม้ไฟล์ข้อมูลใหญ่ยังไม่พร้อม

Retry มี backoff และหยุดเมื่อชนข้อมูลหรือ destination ใช้งานไม่ได้ ไม่วน backup อย่างไม่สิ้นสุด การเปลี่ยน path หรือยกเลิกต้องปล่อย controller ถูกต้อง ปุ่ม Restore ไม่หายเพียงเพราะ backup ไม่สำเร็จ

## 8. การแปลภาษาและคู่มือ

`src/services/i18n.js` ส่งออก TRANSLATIONS และ useLanguage; UI ใช้ `t(key, fallback, params)` ตรวจครั้งนี้: en/th **1022 keys**, zh/ru **1021 keys** ขาด `backupFolderNewer` ใน zh/ru จึงไม่อ้างว่า parity 100% ไม่แก้ข้อความแอปในงานย้ายระบบนี้

เพิ่ม key ต้องเพิ่มทุกภาษาและตรวจ fallback/params คู่มือใน `guideContent.js` มีไทย/อังกฤษของตัวเองและรูปออฟไลน์ แยกจากคำแปล UI ภาพ 44 ไฟล์ใน public/user-guide ใช้ร่วมกันระหว่างบทได้ อย่าใช้จำนวน figure ของ lessons เป็นจำนวนไฟล์ทั้งหมด

## 9. สถานะฟีเจอร์

ผู้ใช้ยืนยันชุดล่าสุดใช้งานผ่านก่อนเริ่มย้ายระบบ รอบนี้ตรวจ schema/versions/diff, build และ unit tests ผ่าน แต่ไม่ได้ทดสอบซ้ำบน Surface หรือ cloud จริง

Google Drive for desktop เป็นเส้นทางสำรองปัจจุบัน Direct Google OAuth มี client/broker scaffolding และ tests แต่ `GOOGLE_TOKEN_BROKER_URL` ยังว่าง ต้อง deploy/verify server แยกก่อนใช้จริง Client ID ที่ตรวจพบเป็น public identifier ไม่ใช่ client secret

Browser standalone ใช้ส่วนเขียน/ข้อมูลใน browser ได้บางส่วน แต่ native filesystem/Store backup ไม่รองรับ และไม่ได้มี /api/auto-backup server ทดแทน Real-time collaboration, audio recording และ handwriting OCR ไม่ใช่ฟีเจอร์ที่ยืนยันใน release นี้

## 10. ข้อจำกัดและรายการติดตาม

- Build มี 4 คำเตือน dynamic/static import ร่วมกัน: autoBackupService, pdfAssetUrls, pdfService, editorPagesService และ chunk บางไฟล์เกิน 500 KB ไม่ได้แก้ bundle structure ในงานนี้
- npm ci เตือน deprecated rimraf 2.6.3, inflight 1.0.6, glob 7.2.3, boolean 3.2.0
- npm 11.19.0 เตือน install scripts ของ core-js 3.50.0, electron-winstaller 5.4.0, esbuild 0.25.12 ยังไม่อยู่ใน allowScripts build ผ่านโดยไม่ได้เพิ่ม approval config
- Full npm audit: 12 รายการ (9 moderate, 3 high) อยู่ใน dependency ฝั่งเครื่องมือพัฒนา/build; audit --omit=dev: 0 รายการ ณ รอบตรวจ ไม่ใช่รับรองว่าปลอดช่องโหว่ทุกชนิด
- หลักฐาน release audit เดิมระบุ clipboard image-file fallback มี synchronous filesystem reads อาจหน่วงกับไฟล์ใหญ่/online-only ไม่ขยายเป็น refactor ในงานนี้
- Reader มีขอบเขตขนาดข้อมูล/จำนวนไฟล์; ห้ามเพิ่ม limit โดยไม่ประเมิน RAM และการยกเลิก ข้อมูลใหญ่/Drive ช้าไม่ได้แปลว่าไฟล์เสียเสมอ
- ชุด browser เก่าบางชุดยังคาด auto-receive/shared root หรือชื่อ backup alias เก่า ไม่ใช้เป็น release gate ของระบบ manual device Restore
- Store install/upgrade, native Store update, WACK และ Surface hardware ต้องตรวจแยกก่อนปล่อย ไม่อ้างผล unit tests แทน

## 11. เหตุผลการออกแบบที่ต้องรักษา

1. แยก active ink จากงานเรนเดอร์เก่าและงาน filesystem เพื่อให้ปากกาตอบสนอง
2. Offline-first: local save มาก่อน backup/PDF/network
3. Backup per-device และ manifest commit: ข้อมูลอีกเครื่องไม่ถูกเขียนทับเพราะเครื่องนี้มีโน้ตน้อยกว่า
4. Restore explicit/atomic: การพบ backup ไม่ให้สิทธิ์นำเข้า; ข้อมูลครบก่อน commit และยืนยันผลผ่าน receipt
5. Hash/ancestry/conflict copies: ใช้หลักฐานเนื้อหาเมื่อแทนสมุดเดิม รักษาการแก้ชนจริง
6. PDF cache และ incremental backup: ไม่ทำงานทุกสมุดทุกหน้าเมื่อแก้แค่บางส่วน
7. แยกสถานะ “บันทึกในเครื่อง”, “backup ไฟล์ครบ”, “PDF พร้อม”, “cloud upload” ไม่ใช้คำสำเร็จแทนกัน
8. เก็บแท็บไม่เกิน 5 และใช้แคช/virtualization แทน mount ทุก canvas พร้อมกัน

## 12. Environment และข้อมูลลับ

เขียนโน้ต/Local backup ไม่ต้องมี `.env` หรือ credential ใน Git `NODE_ENV`/`--dev` ใช้แยกโหมดพัฒนา Windows paths อ่านผ่าน Electron/ระบบและ settings ไม่ฝังค่า path ส่วนตัว

`BETTERNOTE_QA_TEMP` ใช้เฉพาะ fixture tests ตั้งให้เป็น directory ใหม่แยกจริง `NODE_DISABLE_COMPILE_CACHE`, CORE_JS_SILENT, ADBLOCK เป็นตัวแปร verification/build ไม่ใช่การแก้ setting ของแอปผู้ใช้

ห้าม commit .env, tokens/client secrets, โน้ต .bnote, backup JSON หรือไฟล์จาก dist/release/scratch หากเปิดบริการ OAuth ในอนาคตต้องเก็บ secret ฝั่ง server ไม่ใส่ลง renderer/main bundle

## 13. จุดที่แก้ผิดแล้วข้อมูลเสี่ยงเสียหาย

### db.js / localSave

- รักษา DB_NAME/version/stores/indexes; schema ใหม่ต้องมี migration ที่ตรวจแล้ว ไม่สร้างฐานใหม่แล้วบอกว่าข้อมูลเดิมหาย
- ห้ามถือ request success เป็น save สำเร็จก่อน transaction complete ห้ามลด guard ปิดแอป/flush backup
- Restore ต้องรวม 4 stores กับ receipt ใน transaction เดียว; ID/index conflict ต้อง abort ไม่ทำให้บางสมุดสำเร็จบางส่วน
- การลบสมุด/หน้า/โฟลเดอร์ต้องอัปเดต membership/tombstones และ PDF original owner ให้ครบ

### Backup writer/controller

- ห้ามเปิด automatic inbound จาก backupSync scaffolding กลับมาโดยไม่ได้รับอนุมัติ
- ห้ามเขียนใน device directory ของเครื่องอื่นหรือ root shared legacy แทน current per-device target
- Empty library ที่ยืนยัน local save แล้วเป็น valid latest generation; ไม่ใช้ guard เดิมที่ทำให้ backup เก่าฟื้นเอง แต่ยังต้องรอ metadata/local save โหลดเสร็จ
- Publish manifest หลัง snapshot/artifacts ตรวจ hash ครบ ไม่เผยแพร่ staging เป็น complete
- Retention ล่าสุด+ย้อนหลัง 3 ชุดต้องคุ้มครอง reference ที่ยังใช้ และ cleanup เฉพาะ managed files ที่พิสูจน์ได้ ไม่ลบไฟล์ที่ไม่รู้จัก
- แยก PDF status และจำกัด retries; cancellation/destination change ต้องหยุดผลลัพธ์เก่าไม่ให้เขียนทับงานใหม่

### Restore / portable import

- `.bnote` import ต้อง validate ก่อน atomic write และสร้าง ID ใหม่ ส่วน device Restore ต้องใช้ ancestry ของสมุดเดิม ไม่บังคับ copy ทุกครั้ง
- `backup_restore_content_base_v1` และ hash ช่วยแทนสมุด local ที่ไม่ได้เปลี่ยน; same-name หรือ clock ใหม่กว่าอย่างเดียวไม่พิสูจน์ว่าแทนได้
- Preserve true local conflicts/unrelated work; รักษา parentId/retired folder map ไม่ยัดโฟลเดอร์ไปยัง folder ที่ UI เปิดอยู่
- ยกเลิก/timeout ได้ก่อน transaction; หลัง writing ต้องรอ commit/abort และอ่าน receipt ถ้าคำตอบ worker หาย
- Snapshot ที่ตรวจแล้วใช้สำหรับ Restore ขนาดใหญ่ ไม่บังคับโหลด PDF สำเนาอ่านหรือ .bnote ทุกชุดซ้ำก่อนนำเข้า

### Electron / Store / icons

- รักษา sandbox, contextIsolation, guarded IPC, path containment และ resource allowlist
- อย่าเปลี่ยน userData หรือ AppUserModelId ของ Store โดยพลการ จะกระทบ profile/identity ไอคอน helper ต้องเป็น BetterNote และไม่เปิด Taskbar เพิ่ม
- ห้ามเปลี่ยน Identity/Publisher/PublisherDisplayName/ProcessorArchitecture หรือ build.appx ที่ผูก Partner Center ในงาน release นี้

## 14. เอกสารและหลักฐานรุ่นเก่า

README, PROJECT_COMPLETION_MANIFEST และรายงานก่อนรุ่นนี้อาจกล่าวถึง 1.2.1, 674 translation keys, shared-root sync หรือ npm install ให้ใช้โค้ด/lockfileและ HANDOFF นี้สำหรับสถานะล่าสุด ไม่แก้ไฟล์อื่นในขั้น D

`docs/RELEASE_1.3.0.0_REVIEW.md` เป็นรายงานก่อน merge มีผล unit/browser/native/ASAR และ Appx เก่าแยกชัด ไม่ใช่รายงาน Appx ใหม่จาก main อย่านำ path/hash/ผล install ของชุดนั้นมาอ้างแทนขั้น E

## 15. Skills และแนวทางวิศวกรรม

`.agents/skills/pc-pen-notebook-dev/SKILL.md` ครอบคลุม pen/Pointer Events/Canvas/Palm Rejection/IndexedDB และ `.agents/skills/app-performance-optimization/SKILL.md` ครอบคลุม workers/yielding/cache/virtual drives ใช้ประกอบการตรวจ ไม่ถือเป็นหลักฐานว่าทุก pattern ในแอปตรง 100%

หลีกเลี่ยง full-library getAll ของ rich pages, JSON/file I/O บน UI และ synchronous work ระหว่างปากกา active ใช้กฎผู้ใช้ล่าสุดก่อนแนวทางทั่วไป

## 16. ย้ายเครื่องและกู้คืนงาน

1. เครื่องต้นทาง: รอ “Saved on this device” แล้ว Back up now ให้ชุดข้อมูลกู้คืนครบ PDF pending ไม่จำเป็นต้องขวาง Restore
2. รอ Google Drive for desktop อัปโหลดชุดนั้นครบ เครื่องปลายทางเชื่อมโฟลเดอร์เดียวกันและรอให้ไฟล์อ่านได้
3. เครื่องปลายทาง: เปิด Backup & Sync > Google Drive > Find backups เลือก device/วันที่ต้นทาง แล้วกด Restore from Folder
4. ตรวจสมุด หน้า รอยเขียน รูป/PDF และตำแหน่งโฟลเดอร์ จากนั้น backup เครื่องปลายทางจะเขียนใน Devices ของตัวเอง
5. ทำงานสลับสองเครื่องให้รับการแก้ล่าสุดก่อนเริ่มแก้ใหม่ เมื่อทั้งสองแก้พร้อมกันระบบยังรักษาสำเนาที่ชนกัน ไม่รับรองการ merge เส้นสองฝั่งอัตโนมัติ

Clone Git ย้ายเฉพาะโค้ด ไม่ย้าย IndexedDB/โน้ต/profile โหมด dev กับ packaged/Store อาจใช้ profile ต่างกัน ใช้ export/backup/explicit Restore เพื่อย้ายงาน ไม่คัดลอกฐานขณะ Chromium เปิดหรือเปลี่ยน path ให้ใช้ฐานจริงเพื่อทดสอบ

ในรอบย้ายระบบนี้ห้ามเปิดแอปหรือทดลองกับ Drive/โน้ตจริง ขั้นตอนข้างต้นเป็นคำแนะนำสำหรับผู้ใช้ทดสอบเองหลังได้รับ artifact ที่ถูกต้อง

## 17. งานต่อจากนี้

1. ตรวจ/อนุมัติ diff HANDOFF แล้ว commit เอกสารและ push main
2. สร้าง Appx ใหม่จาก main ที่ clean/ตรง origin/main ตรวจ generated manifest, BetterNote icon, payload, commit และ SHA-256
3. ให้ผู้ใช้ทดสอบ package ใหม่ โดยเฉพาะ upgrade จาก Store รุ่นเดิม/Surface และ Backup–Restore ด้วยข้อมูลทดสอบ
4. ติด v1.3.0/after-sol-stable หลังผู้ใช้ตอบ “ติด tag ได้”; เก็บ sol-work และ tags เดิม
5. ส่ง package เข้า Partner Center และตรวจ validation/WACK/Store identity/update/upgrade ก่อนเผยแพร่
6. แยกงานปรับ build-tool advisories, legacy test harnesses, translation parity และ chunk warnings ขออนุมัติก่อนเปลี่ยน dependency/แอป
7. ARM64 ต้องสร้างและตรวจแยก ไม่อ้างว่า Appx x64 นี้เป็น native ARM64

## 18. ผล Build/Test ล่าสุด — 2026-10-09

| รายการ | sol-work ก่อนรวม | main หลังรวม |
| --- | --- | --- |
| Source commit | 403680d | f1793b1 |
| npm ci | exit 0 | exit 0 |
| npm run build | exit 0, 22.26 s | exit 0, 28.76 s |
| Unit tests (36 ไฟล์) | 449/449, 53.026 s | 449/449, 61.245 s |
| fail / cancelled / skipped | 0 / 0 / 0 | 0 / 0 / 0 |
| git status หลังตรวจ | clean | clean และตรง origin/main หลัง push |

ใช้ Node v24.21.0 / npm 11.19.0 ทั้งสองรอบ Git tree ก่อนแก้ HANDOFF นี้: `c043f9526c5954acc899ba881735d6c2b6417d94` เท่ากันระหว่าง main/sol-work ไม่มี conflict/การแก้แอปเพิ่มระหว่าง merge

npm ci ติดตั้ง 381 packages, audit 382 installed packages; full audit รวม transitive/optional พบ 12 vulnerability records (9 moderate/3 high) ส่วน npm audit --omit=dev exit 0 พบ 0 ทั้งสองอย่างอ่านจากผลตรวจขั้น A Warning build/ci ทั้งหมดสรุปหัวข้อ 10 ไม่มีการรัน audit fix หรือ approve install scripts

หลักฐานรอบนี้อยู่ใน ignored scratch: merge-a/merge-b npm-ci, build, tests logs และ merge-a audit JSON QA fixture directory ถูกสร้างแยกใหม่ ไม่ใช่โน้ตผู้ใช้

ไม่ได้รันสคริปต์ scratch เก่า 6 ไฟล์ที่ไม่มีอยู่ ไม่เปิด Electron/browser app ไม่แตะ Google Drive หรือข้อมูลโน้ตจริง ไม่ทดสอบ native Store install/update รอบนี้ Appx จาก main ยังไม่สร้าง ณ เวลาแก้เอกสารนี้

## 19. Privacy และขอบเขตการตรวจ

ตรวจ added lines/changed filenames ของ 277 ไฟล์ก่อนรวม ไม่พบ .env, .bnote, BetterNote_Latest_Backup.json, tracked dist/release, private-key/token patterns หรือไฟล์เปลี่ยนที่ใหญ่กว่า 5 MiB หลัง cleanup ล่าสุดไม่พบ personal paths ใน diff ที่ตรวจ

Commit `403680d` แก้ path ส่วนตัวในเอกสาร review 4 ไฟล์เป็น relative paths/QA placeholders เท่านั้น ประวัติ Git รุ่นเก่ายังอาจมีค่าเดิมอยู่ ไม่ rewrite history ตามข้อห้ามผู้ใช้ การตรวจ pattern ไม่ใช่หลักฐานว่าไม่มีค่าลับชนิดใดเลย และรอบนี้ไม่ได้ OCR รูปทุกไฟล์

HANDOFF นี้ใช้เฉพาะ repository-relative references และ placeholders ห้ามใส่ absolute path ส่วนตัวหรือเนื้อหาโน้ต/credentials

## 20. กฎสำหรับผู้รับงานต่อ

- รักษาขอบเขตงาน/จุดอนุมัติล่าสุดของผู้ใช้ ห้ามแก้ app/dependencies เพื่อให้ตรวจผ่านโดยไม่ได้รับอนุญาต
- งานย้ายระบบนี้แก้เฉพาะ HANDOFF ในขั้น D; ข้อยกเว้น version fallback/docs cleanup ก่อนรวมได้รับอนุมัติแยกแล้ว
- ใช้ npm ci; ห้าม manual lock edits, force push, hard reset, rebase, squash หรือการลบ branch/tag
- ไม่เปิดแอปหรือแตะโน้ตจริง/Drive/โฟลเดอร์ที่ผู้ใช้ห้ามในการตรวจนี้ Test fixtures ต้องอยู่ใน isolated QA
- ไม่ commit outputs/โน้ต/สำรอง/ค่าลับ แสดงเพียงชื่อไฟล์และเลขบรรทัดเมื่อพบข้อมูลส่วนตัว
- เมื่อพบ failure ที่กระทบแอปให้หยุดและถาม; รายงาน actual results/warnings และแยก synthetic tests จาก hardware/Store validation
- ขั้น D รอ “commit ได้” หลังแสดง diff; ขั้น E รอ “ติด tag ได้” หลังผู้ใช้ทดสอบ Appx; ไม่ข้ามไปติด tag/เผยแพร่

## 21. ประวัติการย้ายระบบ

| Branch / Tag / Commit | สถานะและความหมาย |
| --- | --- |
| before-sol | tag เดิมก่อนเริ่มงาน Sol; เก็บไว้ |
| sol-work | branch งานที่ผู้ใช้ทดสอบผ่าน; เก็บไว้ ไม่ลบ |
| 896d3e9 | fallback เวอร์ชันอัปเดต ใช้เลขปัจจุบันและไม่เดาเลขล่าสุด; อนุมัติแยกแล้ว |
| 403680d | cleanup path ส่วนตัวในเอกสาร review 4 ไฟล์; อนุมัติแยกแล้ว |
| before-merge-sol | สร้าง/push บน main เดิม 82da22c7563434574247a4463c97f8464b102c46 |
| main / f1793b1 | merge --no-ff sol-work ข้อความ merge: sol-work into main; push แล้ว |
| v1.3.0 | ยังไม่สร้าง รอ Appx จาก main และคำอนุมัติผู้ใช้ |
| after-sol-stable | ยังไม่สร้าง ต้องชี้ commit เดียวกับ main ที่สร้าง Appx ผ่านและผู้ใช้อนุมัติ |

Store identity ที่เทียบแล้วไม่เปลี่ยน: JustStone.3453441DD0CC3, Publisher CN=01BEC724-2F5E-47FF-BC4E-71824A714A56, PublisherDisplayName JustStone, architecture x64 ค่า Partner Center ใน build.appx คงเดิม
