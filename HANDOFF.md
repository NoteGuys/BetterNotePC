# 📘 BetterNote Pro Studio — Project Handoff Documentation (HANDOFF.md)

เอกสารส่งมอบงานสำหรับวิศวกรซอฟต์แวร์หรือ AI ตัวถัดไป เพื่อให้เข้าใจสถาปัตยกรรม โค้ด โครงสร้างข้อมูล และข้อควรระวังของโปรเจกต์ **BetterNote Pro Studio** ทั้งหมดโดยไม่ต้องคาดเดา

---

## 1. แอปนี้คืออะไร ทำอะไรได้ (สำหรับผู้ที่ไม่เคยเห็นโปรเจกต์นี้มาก่อน)

**BetterNote Pro Studio** คือแอปพลิเคชันสำหรับจดบันทึกด้วยลายมือดิจิทัล (Digital Inking), จัดการสมุดโน้ต, วาดเขียนด้วยปากกา Stylus (ออกแบบมาเพื่อ Windows 10/11 และ Microsoft Surface โดยเฉพาะ) และตรวจแก้/ไฮไลท์เอกสาร PDF

### ความสามารถหลักของแอป:
1. **การเขียนลายมือความหน่วงต่ำระดับฮาร์ดแวร์ (120Hz Low-Latency Inking)**:
   - ใช้สถาปัตยกรรม Canvas 3 ชั้นแบบแยกส่วน (Decoupled Canvas) ทำงานร่วมกับ Pointer Events (`e.pointerType === 'pen'`) และ Coalesced Events (`e.getCoalescedEvents()`) ทำให้เส้นปากกาตามติดหัวปากกาได้ลื่นไหล ไม่แล็ก
   - มีหัวปากกาให้เลือก 3 ชนิด: ปากกาคอแร้ง (Fountain Pen), ปากกาลูกลื่น (Ballpoint Pen), พู่กัน (Brush) และปากกาไฮไลท์กึ่งโปร่งใส (Highlighter แบบ `multiply` blend mode)
   - ปรับความหนาเส้น, ความไวต่อแรงกด (Pressure Sensitivity), และการทำหัวท้ายเส้นเรียวคม (Tapering)
2. **ระบบตรวจจับท่าทางสัมผัสและ Palm Rejection**:
   - **Scribble-to-Erase (ขยี้ลบ)**: ขีดขยี้ปากกาไปมา 2-3 ครั้งเหนือเส้นหรือข้อความเพื่อลบออกทันที โดยมีระบบป้องกันไม่ให้เผลอลบเมื่อวาดรูปทรงเรขาคณิตแบบปิด
   - **Two-Finger Double Tap Undo**: แตะ 2 นิ้วสองครั้งเร็วๆ เพื่อสั่งเลิกทำ (Undo)
   - **Pinch-to-Zoom & Pan**: ใช้ 2 นิ้วหนีบ/กางเพื่อซูม และลากเพื่อเลื่อนหน้ากระดาษอย่างอิสระ
   - **Hardware Palm Rejection & Screen Lock**: ระบบล็อกหน้าจอขณะวางสันมือเขียน ป้องกันหน้าจอเลื่อนหนีโดยไม่ได้ตั้งใจ พร้อมตัวกรองขนาดสัมผัสของฝ่ามือ
3. **ระบบสมุดโน้ตและหน้ากระดาษหลายขนาด**:
   - รองรับขนาดกระดาษ A4, A3, และ A2
   - รองรับเทมเพลตกระดาษหลากหลาย: เส้นบรรทัด (Ruled), เส้นแคบ, เส้นกว้าง, ลายจุด (Dotted), ตารางกราฟ (Grid), กระดาษเปล่า (Blank), และกระดาษคอร์เนลล์ (Cornell Notes)
   - เพิ่ม ลบ สลับลำดับหน้า และดูตัวอย่างหน้าขนาดย่อ (Thumbnail Sidebar)
4. **การนำเข้าและขีดเขียนบน PDF (PDF Annotation & Export)**:
   - นำเข้าไฟล์ PDF หลายหน้าเพื่อเขียนทับ ไฮไลท์ และจดบันทึก
   - ส่งออกโน้ตและมาร์กอัปทั้งหมดกลับเป็นไฟล์ PDF คุณภาพสูง (Vector/High-DPI)
5. **การแทรกรูปภาพ ครอปตัด และสติกเกอร์ (Snip & Image Paste)**:
   - รองรับการวางภาพจาก Clipboard โดยตรง (`Ctrl+V` หรือคลิกขวา "วาง") จาก Windows Snipping Tool (`Win + Shift + S`)
   - เครื่องมือ Snip ตัดแปะส่วนใดก็ได้บนหน้ากระดาษมาทำเป็นสติกเกอร์
   - เครื่องมือ Lasso เลือกวัตถุ ย้าย ย่อ/ขยาย และเปลี่ยนสี
6. **แท็บทำงานหลายเอกสารพร้อมกัน (Multi-Document Top Tab Bar)**:
   - เปิดสลับสมุดโน้ตได้สูงสุด 5 แท็บพร้อมกัน
   - จดจำหน้าที่เปิดค้างไว้ล่าสุดของแต่ละสมุดโน้ตอย่างแม่นยำ (Exact Page Retention)
7. **ทำงานแบบออฟไลน์ 100% พร้อมระบบสำรองข้อมูลอัตโนมัติ (Zero-Lag Auto Backup)**:
   - บันทึกข้อมูลทั้งหมดลงใน IndexedDB ภายในเครื่องทันที ไม่ต้องสมัครสมาชิกหรือพึ่งพาเซิร์ฟเวอร์
   - แบ็กกราวด์เอเจนต์ช่วยสำรองข้อมูลเป็นไฟล์ `.bnote`, `.pdf`, และ `BetterNote_Latest_Backup.json` ไปยังโฟลเดอร์ Google Drive หรือโฟลเดอร์ที่ผู้ใช้เลือก โดยไม่ทำให้หน้าจอเขียนกระตุก
8. **ระบบหลายภาษา (4 Languages)**:
   - รองรับภาษาอังกฤษ (English - ค่าเริ่มต้น), ไทย (Thai), จีนตัวย่อ (Simplified Chinese), และรัสเซีย (Russian) พร้อมสลับภาษาได้ทันทีแบบ Reactive

---

## 2. เทคโนโลยีที่ใช้ พร้อมเวอร์ชันจริง

ข้อมูลดึงจาก `package.json` และ `package-lock.json`:

| หมวดหมู่ | ไลบรารี / เครื่องมือ | เวอร์ชันจริง | หน้าที่ในระบบ |
| :--- | :--- | :--- | :--- |
| **Desktop Runtime** | `electron` | `44.2.0` | เฟรมเวิร์กเดสก์ท็อปสำหรับ Windows จัดการหน้าต่าง, IPC, ฮาร์ดแวร์ และไฟล์ระบบ |
| **Packaging & Installer** | `electron-builder` | `26.15.3` | เครื่องมือบิลด์ตัวติดตั้ง `.appx` (Microsoft Store), `.exe` (NSIS), และ `.zip` |
| **UI Framework** | `react` | `18.3.1` | ควบคุม State, Lifecycle ของคอมโพเนนต์ และแท็บเอกสาร |
| **UI DOM** | `react-dom` | `18.3.1` | เรนเดอร์ Virtual DOM ลงใน Electron Renderer |
| **Bundler & Dev Server** | `vite` | `6.2.0` (Runtime `6.4.3`) | บิลด์โค้ดฝั่ง Client แบบ ESM และทำ HMR อย่างรวดเร็ว |
| **Vite React Plugin** | `@vitejs/plugin-react` | `4.3.4` | ปลั๊กอินแปลง JSX/Fast Refresh สำหรับ Vite |
| **Local Database** | `idb` | `8.0.2` | Promise wrapper สำหรับ HTML5 IndexedDB จัดเก็บข้อมูลโน้ตและหน้ากระดาษ |
| **PDF Rendering** | `pdfjs-dist` | `4.10.38` | ตัวแยกวิเคราะห์และเรนเดอร์หน้า PDF ลงบนแคนวาส |
| **PDF Generation** | `jspdf` | `2.5.2` | ตัวประกอบและส่งออกเอกสาร PDF หลายหน้า |
| **Icons** | `lucide-react` | `1.16.0` | ไอคอนเวกเตอร์สไตล์โมเดิร์นทั่วทั้งแอปพลิเคชัน |
| **Effects** | `canvas-confetti` | `1.9.4` | เอฟเฟกต์แอนิเมชันเฉลิมฉลองเมื่อทำภารกิจสำเร็จ |
| **Styling** | Vanilla CSS (`src/index.css`) | - | ระบบธีม Glassmorphism บริสุทธิ์ ไม่มี Tailwind หรือ CSS-in-JS |

---

## 3. วิธีติดตั้ง รัน build และ test (เฉพาะคำสั่งที่รันแล้วผ่านจริง)

### ⚠️ หมายเหตุสำคัญเกี่ยวกับสคริปต์ทดสอบ (Test Scripts Limitation):
จากการตรวจสอบด้วย `git ls-files` และ `.gitignore` พบว่า **โฟลเดอร์ `scratch/` ถูกระบุไว้ใน `.gitignore` และไม่ได้ถูกจัดเก็บใน GitHub**
- ดังนั้น สคริปต์ทดสอบตรรกะทั้งหมด (`scratch/test_*.mjs`, `scratch/verify_*.py`) **จึงมีอยู่เฉพาะบนเครื่องเดิมนี้เท่านั้น**
- หากโคลนโปรเจกต์จาก GitHub ไปยังเครื่องใหม่ **จะไม่พบโฟลเดอร์ `scratch/` และจะไม่สามารถรันคำสั่งทดสอบเหล่านี้เพื่อยืนยันผลซ้ำบนเครื่องใหม่ได้โดยตรง** จนกว่าผู้พัฒนาจะทำการคัดลอกโฟลเดอร์ `scratch/` ไปด้วยตนเอง หรือย้ายสคริปต์ทดสอบเข้ามาผูกใน `scripts` ของ `package.json`

### ข้อกำหนดเบื้องต้นของระบบ:
- ระบบปฏิบัติการ: Windows 10 หรือ Windows 11 (64-bit)
- สภาพแวดล้อม: Node.js v18.0.0 ขึ้นไป และ npm

### คำสั่งที่ผ่านการทดสอบจริงแล้ว 100%:

```bash
# 1. ติดตั้ง Dependencies (ทำงานได้ทั้งเครื่องเดิมและเครื่องใหม่)
npm install

# 2. บิลด์โปรเจกต์สำหรับ Production (ทำงานได้ทั้งเครื่องเดิมและเครื่องใหม่ - ผ่านใน ~16.26 วินาที)
npm run build
```

### คำสั่งทดสอบเฉพาะบนเครื่องเดิมที่มีโฟลเดอร์ scratch/:
```bash
# 3. รันการทดสอบตรรกะระบบแท็บเอกสาร (ผ่าน 8/8 การทดสอบ)
node scratch/test_tab_system_logic.mjs

# 4. รันการทดสอบความถูกต้องของการสำรองข้อมูลและการย้ายเครื่อง (ผ่าน 23/23 การทดสอบ)
node scratch/test_device_migration_and_sync.mjs

# 5. ตรวจสอบความสอดคล้องของคลังแปลภาษาทั้ง 4 ภาษา (ผ่าน 100% ครบ 674 keys)
python scratch/verify_all_dicts.py

# 6. ตรวจสอบความถูกต้องของการปรับปรุงระบบธีมและข้อความอัปเดต (ผ่าน 100%)
node scratch/test_theme_and_updates.mjs

# 7. ตรวจสอบฟิกซ์ความปลอดภัยและการทำงานของระบบซิงค์ (ผ่าน 74/74 การทดสอบ)
node scratch/test_round2_fixes.mjs

# 8. ตรวจสอบความสมบูรณ์ของ Production Dist Bundle (ผ่าน 100%)
node scratch/verify_dist_bundle.cjs
```

### คำสั่งสำหรับรันแอปพลิเคชัน:
- `npm run dev`: เริ่ม Vite Development Server สำหรับทดสอบบนเบราว์เซอร์
- `npm run app`: เปิดแอปพลิเคชันเดสก์ท็อป Electron บนเครื่อง
- `npm run pack`: แพ็กเกจแอปพลิเคชันลงโฟลเดอร์ `release/win-unpacked` โดยไม่ต้องทำตัวติดตั้ง

---

## 4. โครงสร้างโฟลเดอร์ และหน้าที่ของแต่ละส่วน

```text
BetterNote/
├── .agents/
│   └── skills/                         # คลังทักษะและคู่มือสถาปัตยกรรมสำหรับตัวแทน AI
│       ├── pc-pen-notebook-dev/        # คู่มือการพัฒนาแอปปากกา Stylus, Canvas 2D, Palm Rejection
│       └── app-performance-optimization/ # คู่มือป้องกัน UI Thread Freeze และการจัดการ Memory
├── electron/
│   ├── main.cjs                        # Electron Main Process: IPC Handlers, ฮาร์ดแวร์สวิตช์, ไดรฟ์สำรอง, Window Lifecycle
│   └── preload.cjs                     # Context Bridge: เปิดเผย window.electronAPI สู่ Renderer อย่างปลอดภัย
├── src/
│   ├── components/
│   │   ├── Common/                     # คอมโพเนนต์ส่วนกลาง
│   │   │   ├── DocumentTabBar.jsx      # แถบแท็บด้านบน (สูงสุด 5 แท็บ, LRU eviction, จดจำหน้า)
│   │   │   ├── GoogleDriveModal.jsx    # หน้าต่างจัดการเชื่อมต่อและสถานะซิงค์ Google Drive
│   │   │   ├── Navbar.jsx              # แถบนำทางด้านบนของหน้า Library
│   │   │   ├── UpdateNotificationModal.jsx # หน้าต่างแจ้งเตือนอัปเดตรุ่นใหม่ของ Microsoft Store
│   │   │   ├── ExportModal.jsx         # หน้าต่างส่งออกเอกสารเป็น PDF / .bnote
│   │   │   └── PageSelectorModal.jsx   # หน้าต่างเลือกกระดาษและเทมเพลตสำหรับเพิ่มหน้าใหม่
│   │   ├── Editor/                     # คอมโพเนนต์หน้าแก้ไขโน้ตและแคนวาส
│   │   │   ├── CanvasBoard.jsx         # หัวใจของแคนวาส 3 ชั้น, จัดการ Pointer Events และการวาด
│   │   │   ├── NoteEditor.jsx          # ตัวจัดการ State ของหน้าจดโน้ต, ซูม, ท่าทางสัมผัส, Undo/Redo
│   │   │   ├── EditorToolbar.jsx       # แถบเครื่องมือปากกา, ไฮไลท์, ยางลบ, สี, และความหนา
│   │   │   ├── ThumbnailSidebar.jsx    # แถบด้านข้างแสดงภาพตัวอย่างของแต่ละหน้า
│   │   │   ├── ShapePickerModal.jsx    # หน้าต่างเลือกรูปทรงเรขาคณิต
│   │   │   ├── SnipModal.jsx           # หน้าต่างเครื่องมือตัดแปะภาพสติกเกอร์
│   │   │   └── TextToolOverlay.jsx     # กล่องข้อความพิมพ์บนหน้ากระดาษ
│   │   └── Library/                    # คอมโพเนนต์หน้าคลังเอกสาร
│   │       ├── LibraryView.jsx         # หน้ารายการโฟลเดอร์และสมุดโน้ต, การจัดเรียง, ถังขยะ
│   │       ├── StudioSidebar.jsx       # แถบเมนูด้านข้างคลังเอกสาร (เอกสารทั้งหมด, รายการโปรด)
│   │       ├── NotebookCard.jsx        # การ์ดแสดงสมุดโน้ตแบบ 3 มิติ
│   │       ├── FolderCard.jsx          # การ์ดแสดงโฟลเดอร์
│   │       ├── SettingsModal.jsx       # หน้าต่างตั้งค่า: แท็บ "ธีมและภาษา" และการสำรองข้อมูล
│   │       └── BackupStatusModal.jsx   # หน้าต่างแสดงประวัติและสถานะไฟล์สำรองทั้งหมด
│   ├── config/
│   │   └── googleConfig.js             # การตั้งค่า Google OAuth Client ID (ปัจจุบันเป็นค่าว่างสำหรับ desktop mount)
│   ├── data/
│   │   ├── covers.js                   # ชุดสไตล์และสีหน้าปกสมุดโน้ต
│   │   └── templates.js                # ขนาดกระดาษ (A4, A3, A2) และเทมเพลตเส้นกระดาษ
│   ├── services/
│   │   ├── db.js                       # จัดการ IndexedDB 'BetterNoteDB' v1 ทั้งหมด (CRUD โฟลเดอร์, สมุด, หน้า, การตั้งค่า)
│   │   ├── autoBackupService.js        # แบ็กกราวด์เซอร์วิสสำรองข้อมูลอัตโนมัติแบบ non-blocking
│   │   ├── fileSystemService.js        # นำเข้า/ส่งออกไฟล์ `.bnote` และไฟล์กู้คืนระบบ `BetterNote_Latest_Backup.json`
│   │   ├── i18n.js                     # เครื่องมือแปลภาษา 4 ภาษา (EN, TH, ZH, RU) 674 keys
│   │   ├── updateService.js            # ตรวจสอบการอัปเดตเวอร์ชันใหม่จาก GitHub Releases
│   │   ├── userPreferences.js          # จัดการธีม (Light/Dark), การตั้งค่าปากกาเริ่มต้น
│   │   └── appCacheService.js          # LRU Cache ในหน่วยความจำเพื่อความเร็วในการแสดงผล
│   ├── utils/
│   │   ├── inkingEngine.js             # อัลกอริทึมเส้นโค้ง Quadratic Bézier, Tapering, Scribble-to-Erase
│   │   ├── pdfExportEngine.js          # เครื่องมือเรนเดอร์แคนวาสเป็นเอกสาร PDF หลายหน้า
│   │   └── shapeRecognition.js         # อัลกอริทึมจำแนกรูปทรงเรขาคณิต (QuickShape)
│   ├── App.jsx                         # คอมโพเนนต์หลัก จัดการ Routing, Multi-Document Tabs และ Modals
│   ├── main.jsx                        # จุดเริ่มต้น React DOM Entrypoint
│   └── index.css                       # ดีไซน์ซิสเต็มและสไตล์ชีท Vanilla CSS
├── dist/                               # ผลลัพธ์จากการบิลด์ (อยู่ใน .gitignore ไม่ได้เก็บใน GitHub)
├── release/                            # ไฟล์บิลด์ติดตั้ง .appx, .exe, .zip (อยู่ใน .gitignore ไม่ได้เก็บใน GitHub)
└── scratch/                            # สคริปต์ทดสอบและตรวจระบบ (อยู่ใน .gitignore อยู่เฉพาะเครื่องเดิม)
```

---

## 5. ระบบหลักของแอปพลิเคชัน

### 5.1 ระบบวาดลายมือ (Inking Engine)
- **ไฟล์เกี่ยวข้อง**: `src/utils/inkingEngine.js`, `src/components/Editor/CanvasBoard.jsx`
- **สถาปัตยกรรม Canvas 3 ชั้น (Decoupled Canvas)**:
  - *Layer 1 (Background)*: วาดพื้นหลังกระดาษ เส้นตาราง และรูปภาพหน้า PDF
  - *Layer 2 (Static Committed Ink)*: เก็บเส้นปากกาที่วาดเสร็จแล้ว, กล่องข้อความ และรูปภาพที่วาง จะวาดใหม่เฉพาะเมื่อมีการแก้ไข ลบ หรือขยับวัตถุ
  - *Layer 3 (Active In-Flight Stroke)*: แคนวาสโปร่งใสด้านบนสุด เรนเดอร์เฉพาะเส้นที่หัวปากกากำลังลากอยู่ ณ ปัจจุบันด้วยความเร็ว 60-120 FPS เมื่อยกปากกา (`pointerup`) เส้นจะถูกคอมมิตลง Layer 2 ทันที
- **อัลกอริทึมเส้นปากกา**:
  - ใช้ Quadratic Bézier Curve ผ่านจุดกึ่งกลาง (Midpoint Interpolation) เพื่อให้เส้นโค้งเรียบเนียน ไม่หักเป็นเหลี่ยม
  - คำนวณความหนาเส้นตามแรงกด (`pressure`) และความเร็ว มีการทำหัวท้ายเรียวคม (`calculateTaper`)
  - รองรับหัวปากกา 3 ชนิด (`fountain`, `ballpoint`, `brush`) และปากกาไฮไลท์ที่ใช้การเบลนด์แบบ `multiply` ทำให้ตัวหนังสือข้างใต้ไม่ถูกกลบ
- **Scribble-to-Erase (ขยี้ลบ)**:
  - ฟังก์ชัน `detectScribble` ใน `src/utils/inkingEngine.js` จะตรวจจับการตวัดปากกากลับไปกลับมา (Reversals ในแกน X หรือ Y อย่างน้อย 2-3 ครั้ง) ภายในพื้นที่หนาแน่น
  - รองรับการขีดฆ่ายาวสูงสุด 1,600px
  - มีตัวป้องกันความปลอดภัย (`classifyGeometricShape`): หากผู้ใช้ตั้งใจวาดรูปทรงเรขาคณิตแบบปิด เช่น วงกลม สี่เหลี่ยม สามเหลี่ยม ระบบจะไม่ตีความเป็นท่าทางขยี้ลบ

### 5.2 หน้ากระดาษ (Pages & Templates)
- **ไฟล์เกี่ยวข้อง**: `src/data/templates.js`, `src/components/Editor/NoteEditor.jsx`
- รองรับขนาดกระดาษ A4 (1200x1697), A3 (1697x2400), และ A2 (2400x3394)
- เทมเพลตกระดาษถูกวาดแบบ Vector บน Background Canvas ตามระยะห่างพิกเซล (`spacing`)
- **Viewport Virtualization**: ในโหมดเลื่อนแนวตั้ง (Vertical Scroll) ระบบใน `src/components/Editor/NoteEditor.jsx` จะ Mount แคนวาสจริงเฉพาะหน้าที่อยู่ในระยะสายตา ($\pm 2$ หน้าจากหน้าปัจจุบัน) ส่วนหน้าที่อยู่นอกระยะจะแสดงเป็น Placeholder เปล่าที่มีขนาดกว้างคูณสูงเท่าเดิม เพื่อป้องกันไม่ให้ GPU Memory (VRAM) เต็มเกิน 4GB ซึ่งอาจทำให้โปรแกรมค้าง

### 5.3 ระบบ Undo / Redo
- **ไฟล์เกี่ยวข้อง**: `src/components/Editor/NoteEditor.jsx`
- ใช้สแตก `undoStack` และ `redoStack` จัดเก็บ Snapshot ของเส้น (`strokes`), รูปวาด (`drawings`), และข้อความ (`textElements`) ของหน้าปัจจุบัน
- ทำงานผ่าน: ปุ่มบน Toolbar, คีย์ลัดแป้นพิมพ์ (`Ctrl + Z` และ `Ctrl + Y`), และท่าทางแตะสองนิ้วสองครั้ง (Two-Finger Double Tap Undo)

### 5.4 ระบบซูมและเลื่อน (Zoom & Pan)
- **ไฟล์เกี่ยวข้อง**: `src/components/Editor/NoteEditor.jsx`
- **ช่วงการซูมจริงในโค้ด**: **35% ถึง 350%** (ค่าสเกล `0.35` ถึง `3.5`)
- คำนวณจุดตรึงสายตา (Focal Point Anchoring) ขณะซูม เพื่อให้ตำแหน่งที่นิ้วแตะหรือเมาส์ชี้อยู่คงที่เดิม
- รองรับการซูมผ่าน Touchscreen (Pinch-to-zoom), Trackpad (`Ctrl + Wheel`), และปุ่มบนหน้าจอ
- **Screen Lock Palm Rejection**: ป้องกันไม่ให้สันมือที่วางบนหน้าจอทำให้หน้ากระดาษเลื่อนหลุดตำแหน่ง โดยมีกรอบเวลารักษาความปลอดภัย 1,200ms หลังยกปากกา

### 5.5 ระบบแท็บเอกสารหลายหน้า (Multi-Document Top Tab Bar)
- **ไฟล์เกี่ยวข้อง**: `src/components/Common/DocumentTabBar.jsx`, `src/App.jsx`
- จำกัดจำนวนแท็บที่เปิดพร้อมกันได้สูงสุด **5 แท็บ**
- **LRU Automatic Eviction**: หากเปิดเอกสารที่ 6 ระบบจะปิดแท็บที่ไม่ได้ใช้งานนานที่สุดออกโดยอัตโนมัติ
- **Exact Page Retention**: จดจำหน้าที่เปิดค้างไว้ล่าสุดของแต่ละแท็บ เมื่อกดสลับแท็บจะกลับไปยังหน้านั้นทันที
- บันทึกสถานะแท็บลง `localStorage` (`betternote_open_tabs` และ `betternote_notebook_page_cache`)

---

## 6. การจัดเก็บข้อมูล สคีมา IndexedDB รูปแบบไฟล์ และวิธีกู้คืน

### 6.1 สคีมาของ IndexedDB ใน `src/services/db.js`
- **ชื่อฐานข้อมูล**: `'BetterNoteDB'`
- **เวอร์ชัน**: `1`
- **Object Stores ทั้งหมด 4 ตาราง**:

1. **`folders`** (ที่เก็บโฟลเดอร์):
   - `keyPath`: `'id'`
   - Index: `'parentId'` (unique: false)
   - ฟิลด์ข้อมูล:
     ```javascript
     {
       id: "folder-xxx",
       name: "ชื่อโฟลเดอร์",
       parentId: null,        // หรือ id ของโฟลเดอร์แม่
       color: "#06b6d4",
       icon: "book",
       createdAt: 1728000000000,
       isDeleted: false       // true เมื่ออยู่ในถังขยะ
     }
     ```

2. **`notebooks`** (ที่เก็บข้อมูลเมทาดาทาของสมุดโน้ต):
   - `keyPath`: `'id'`
   - Indexes: `'folderId'` (unique: false), `'updatedAt'` (unique: false)
   - ฟิลด์ข้อมูล:
     ```javascript
     {
       id: "nb-xxx",
       name: "ชื่อสมุดโน้ต",
       folderId: "folder-xxx", // หรือ null หากอยู่หน้าแรก
       coverId: "deep-ocean",
       templateId: "ruled",
       paperSize: "A4",
       createdAt: 1728000000000,
       updatedAt: 1728000000000,
       pageCount: 5,
       isPdf: false,
       isFavorite: false,
       isDeleted: false,
       lastOpenedPageIndex: 0
     }
     ```

3. **`pages`** (ที่เก็บเนื้อหาของแต่ละหน้ากระดาษ):
   - `keyPath`: `'id'`
   - Indexes:
     - `'notebookId'` (unique: false)
     - `'notebookPage'` เป็น Compound Index: `['notebookId', 'pageIndex']` (unique: true)
   - ฟิลด์ข้อมูล:
     ```javascript
     {
       id: "nb-xxx_page_0",
       notebookId: "nb-xxx",
       pageIndex: 0,
       templateId: "ruled",
       paperColor: "#ffffff",
       strokes: [
         {
           tool: "pen",                // 'pen' | 'highlighter' | 'eraser'
           nibType: "fountain",         // 'fountain' | 'ballpoint' | 'brush'
           color: "#2563eb",
           width: 3,
           points: [ { x: 120, y: 150, pressure: 0.65, time: 1728000000 } ],
           isTapered: true,
           usePressure: true
         }
       ],
       textElements: [
         { id: "txt-1", x: 100, y: 200, text: "ข้อความ", fontSize: 18, fontFamily: "Inter", color: "#000", bold: false }
       ],
       images: [
         { id: "img-1", x: 150, y: 300, width: 400, height: 300, dataUrl: "data:image/png;base64,..." }
       ],
       drawings: [],                   // สำหรับรูปทรง QuickShape
       pdfPageImage: null,             // ภาพพื้นหลังของหน้า PDF (สำหรับหน้าของเอกสาร PDF)
       thumbnailUrl: null,
       isFavorite: false,
       updatedAt: 1728000000000
     }
     ```

4. **`settings`** (ที่เก็บการตั้งค่าและแคชระบบ):
   - `keyPath`: `'key'`
   - ฟิลด์ข้อมูล: `{ key: "gdrive_connected", value: true }`

---

### 6.2 รูปแบบไฟล์ `.bnote`
ไฟล์ `.bnote` คือไฟล์ JSON ของสมุดโน้ตเดี่ยว มีโครงสร้างมาตรฐานดังนี้:
```json
{
  "format": "BetterNote_Document",
  "version": 1,
  "exportDate": "2026-10-05T11:00:00.000Z",
  "notebook": {
    "id": "nb-1728000000",
    "name": "Soil Mechanics",
    "folderId": null,
    "coverId": "deep-ocean",
    "templateId": "ruled",
    "paperSize": "A4",
    "pageCount": 3,
    "createdAt": 1728000000000,
    "updatedAt": 1728000000000
  },
  "pages": [
    {
      "id": "page-1",
      "notebookId": "nb-1728000000",
      "pageIndex": 0,
      "templateId": "ruled",
      "strokes": [ ... ],
      "textElements": [ ... ],
      "images": [ ... ]
    }
  ]
}
```

---

### 6.3 รูปแบบไฟล์ `BetterNote_Latest_Backup.json`
ไฟล์กู้คืนทั้งระบบ (Full System Backup) มีโครงสร้างดังนี้:
```json
{
  "version": 1,
  "appName": "BetterNote",
  "exportDate": "2026-10-05T11:00:00.000Z",
  "folders": [
    { "id": "folder-1", "name": "วิชาเรียน", "parentId": null, "color": "#06b6d4", "icon": "book" }
  ],
  "notebooks": [
    {
      "id": "nb-1",
      "name": "Lecture 1",
      "folderId": "folder-1",
      "pageCount": 2,
      "pages": [
        { "id": "p-1", "notebookId": "nb-1", "pageIndex": 0, "strokes": [ ... ] }
      ]
    }
  ]
}
```
*หมายเหตุสำคัญ*: ใน `electron/main.cjs` ฟังก์ชัน `writeBackupData` มีการเรียก `sanitizeNotebookForJson` เพื่อตัดฟิลด์ `pdfBase64` ขนาดใหญ่ออกก่อนเขียนลง JSON เพื่อป้องกันไม่ให้ไฟล์สำรองบวมเกินความจำเป็น

---

### 6.4 วิธีกู้คืนจากไฟล์สำรอง (อย่างละเอียดที่สุด)

#### กรณีที่ 1: กู้คืนทั้งระบบจาก `BetterNote_Latest_Backup.json`
1. **ผ่าน UI หน้าแอป**:
   - ไปที่แถบการตั้งค่า (Settings Modal) หรือหน้าต่าง Google Drive Modal
   - กดปุ่ม **"Restore Full Backup" (กู้คืนข้อมูลทั้งหมด)** แล้วเลือกไฟล์ `BetterNote_Latest_Backup.json`
2. **การทำงานภายในโค้ด (`src/services/fileSystemService.js` ฟังก์ชัน `restoreFullBackup`)**:
   - ตรวจสอบความถูกต้องของอ็อบเจกต์ หากไม่มีฟิลด์ `notebooks` จะปฏิเสธทันที
   - วนลูปอ่านอาร์เรย์ `data.folders`: บันทึกแต่ละโฟลเดอร์ลงใน Object Store `folders` ผ่าน `saveFolder(f)`
   - วนลูปอ่านอาร์เรย์ `data.notebooks`:
     - ดึง `pages` ออกมา แล้วบันทึกเมทาดาทาของสมุดลงใน Object Store `notebooks` ผ่าน `saveNotebook(notebookMeta)`
     - วนลูปบันทึกแต่ละหน้าลงใน Object Store `pages` ผ่าน `savePage(p)`
     - หากสมุดเล่มใดไม่มีหน้าแนบมา จะสร้างหน้าเปล่าเริ่มต้น (`pageIndex: 0`) ให้อัตโนมัติ เพื่อป้องกันสมุดว่างที่เปิดไม่ได้
   - อัปเดต State บนหน้าจอ และคืนค่าจำนวนโฟลเดอร์และสมุดที่กู้คืนสำเร็จ

#### กรณีที่ 2: นำเข้าสมุดโน้ตเดี่ยวจากไฟล์ `.bnote`
1. **ผ่าน UI หน้าแอป**:
   - อยู่ที่หน้า Library View กดปุ่ม **"นำเข้า .bnote" (Import .bnote)** หรือลากไฟล์มาวาง
2. **การทำงานภายในโค้ด (`src/services/fileSystemService.js` ฟังก์ชัน `importBnoteFile`)**:
   - อ่านเนื้อหาไฟล์ JSON และตรวจสอบโครงสร้าง (รองรับทั้งฟอร์แมต `BetterNote_Document` และแบบดั้งเดิม)
   - **การป้องกันการชนกันของ ID**: ระบบจะสุ่ม ID ใหม่เสมอ (`const newNotebookId = 'nb-' + Date.now() + '-' + Math.random().toString(36)...`) เพื่อไม่ให้ทับกับสมุดโน้ตเดิมที่มีอยู่ในเครื่อง
   - ทำความสะอาดชื่อไฟล์ กำหนดโฟลเดอร์ปลายทาง แล้วบันทึกสมุดลง `notebooks`
   - วนลูปบันทึกแต่ละหน้าลง `pages` โดยผูก `notebookId` เข้ากับ ID ใหม่ และสร้าง ID ประจำหน้าใหม่ (`page-${newNotebookId}-${i + 1}`)

---

## 7. ระบบสำรองข้อมูลอัตโนมัติและการเชื่อม Google Drive

### 7.1 สิ่งที่ถูกสำรอง และโครงสร้างโฟลเดอร์สำรอง
ทุกครั้งที่ระบบทำการสำรองข้อมูล จะสร้างโครงสร้าง 3 โฟลเดอร์ย่อยในโฟลเดอร์เป้าหมายเสมอ:
1. `Editable_Notes/*.bnote`: ไฟล์สมุดโน้ตในรูปแบบเวกเตอร์ สามารถเปิดแก้ไขต่อได้
2. `PDF_Documents/*.pdf`: ไฟล์เอกสาร PDF ที่ถูกเรนเดอร์ครบทุกหน้าสำหรับเปิดอ่านหรือส่งพิมพ์
3. `Full_System/BetterNote_Latest_Backup.json`: ไฟล์รวมฐานข้อมูลทั้งหมดสำหรับกู้คืนในคลิกเดียว

### 7.2 ตำแหน่งที่จัดเก็บ และการตรวจหาโฟลเดอร์
ใน `electron/main.cjs` ฟังก์ชัน `getAllBackupTargets` จะค้นหาตามลำดับความสำคัญดังนี้:
1. **Custom Backup Path**: โฟลเดอร์ที่ผู้ใช้เลือกเองผ่านหน้าจอตั้งค่า (บันทึกลง setting `local_backup_path`)
2. **Google Drive Desktop Candidates**: ตรวจหาไดรฟ์เสมือนของโปรแกรม Google Drive for Desktop ตามลำดับ:
   - `H:\My Drive\BetterNote.AppPC`
   - `G:\My Drive\BetterNote.AppPC`
   - `I:\My Drive\BetterNote.AppPC`
   - `D:\My Drive\BetterNote.AppPC`
   *(จะหยุดที่ไดรฟ์แรกที่พบ เพื่อป้องกันปัญหาการเขียนไฟล์ซ้ำซ้อนข้ามหลายไดรฟ์เครือข่าย)*
3. **โฟลเดอร์ Documents สำรอง**: หากไม่พบไดรฟ์ Google Drive จะสำรองลง `%USERPROFILE%\Documents\BetterNote.AppPC`
4. **โฟลเดอร์โลคอลของโปรแกรม**: โฟลเดอร์ `BetterNote_Backups/` ภายในไดเรกทอรีของแอป จะถูกรวมเป็นเป้าหมายสำรองออฟไลน์เสมอ

### 7.3 มี Path ที่ฝังตายตัวในโค้ดหรือไม่?
- **มี Candidate Paths ในโค้ดจริง**:
  - `electron/main.cjs` บรรทัดที่ 30-35 มีอาเรย์ `gDriveCandidates` ที่ระบุ `H:\`, `G:\`, `I:\`, `D:\`
  - `src/App.jsx` บรรทัดที่ 130 มีค่าตั้งต้น `driveEmail = 'G:\\My Drive'`
  - `src/components/Common/GoogleDriveModal.jsx` มี fallback display string `'G:\\My Drive\\BetterNote.AppPC'`
  - `src/components/Common/Navbar.jsx` และ `src/services/i18n.js` มีข้อความ tooltip อ้างอิง `H:\My Drive\BetterNote.AppPC`
- **แต่ระบบไม่ได้ล็อกตายตัว**: ผู้ใช้สามารถกดปุ่ม "เปลี่ยนโฟลเดอร์" ในหน้าตั้งค่าหรือหน้าต่าง Google Drive เพื่อเลือกโฟลเดอร์อื่นใดก็ได้ในเครื่องผ่าน Native Folder Picker (`dialog.showOpenDialog`)

---

## 8. ระบบแปลภาษา 674 Keys

- **ไฟล์หลัก**: `src/services/i18n.js` (ความยาว 2,982 บรรทัด)
- **ภาษาที่รองรับ**:
  - `en`: English (ภาษาเริ่มต้น / Default)
  - `th`: ภาษาไทย
  - `zh`: 简体中文 (Simplified Chinese)
  - `ru`: Русский (Russian)
- **จำนวนคีย์**: ปัจจุบันมีทั้งหมด **674 คีย์** ครบถ้วนเท่ากันทุกภาษา (100% 4-Way Parity)

### วิธีเพิ่ม Key ใหม่อย่างถูกต้อง:
1. เปิดไฟล์ `src/services/i18n.js`
2. เพิ่ม Key ใหม่ลงในอ็อบเจกต์ทั้ง 4 ภาษา:
   - `TRANSLATIONS.en`
   - `TRANSLATIONS.th`
   - `TRANSLATIONS.zh`
   - `TRANSLATIONS.ru`
3. รันคำสั่งตรวจสอบ:
   ```bash
   python scratch/verify_all_dicts.py
   ```
   *(หมายเหตุ: ต้องมีโฟลเดอร์ `scratch/` บนเครื่อง)*
4. เรียกใช้งานใน React Component:
   ```javascript
   import { useLanguage } from '../../services/i18n';

   const { t } = useLanguage();
   // ใช้งานแบบข้อความธรรมดา
   const label = t('myNewKey', 'Fallback English Text');
   // ใช้งานแบบมีพารามิเตอร์แทนที่ {name}
   const message = t('welcomeUser', 'Hello {name}!', { name: 'John' });
   ```

---

## 9. สถานะฟีเจอร์: เสร็จแล้ว / ทำค้าง / ยังไม่เริ่ม

### ✅ ฟีเจอร์ที่เสร็จสมบูรณ์แล้ว
- ระบบวาดลายมือ 120Hz พร้อมหัวปากกา 3 ชนิดและไฮไลท์: `src/utils/inkingEngine.js`, `src/components/Editor/CanvasBoard.jsx`
- ระบบลบลายเส้นด้วยการขยี้ (Scribble-to-Erase) พร้อมตัวกันลบรูปทรง: `src/utils/inkingEngine.js`
- ระบบจำแนกรูปทรงเรขาคณิตอัตโนมัติ (QuickShape): `src/utils/shapeRecognition.js`
- การวางรูปภาพจากคลิปบอร์ดและการตัดแปะสติกเกอร์ (Snip): `src/components/Editor/CanvasBoard.jsx`, `src/components/Editor/SnipModal.jsx`
- แถบแท็บเอกสารด้านบน (สูงสุด 5 แท็บ, LRU eviction, จดจำหน้า): `src/components/Common/DocumentTabBar.jsx`, `src/App.jsx`
- การนำเข้า ขีดเขียน และส่งออกไฟล์ PDF: `src/utils/pdfExportEngine.js`, `src/components/Editor/NoteEditor.jsx`
- ระบบป้องกันสันมือและการล็อกหน้าจอสัมผัส (Palm Rejection Screen Lock): `src/components/Editor/NoteEditor.jsx`
- ระบบแปลภาษา 4 ภาษา 674 คีย์: `src/services/i18n.js`
- การตั้งค่าแท็บ "Theme & Language" (ธีม และ ภาษา): `src/components/Library/SettingsModal.jsx`
- ระบบสำรองข้อมูลเบื้องหลังแบบ Non-blocking (JSON, .bnote, PDF): `src/services/autoBackupService.js`, `electron/main.cjs`
- การลบสมุดโน้ตแบบปลอดภัยและลบไฟล์ออกจากโฟลเดอร์สำรองทันที: `electron/main.cjs`
- ระบบแจ้งเตือนอัปเดตเวอร์ชันใหม่ของ Microsoft Store ภายในแอป: `src/services/updateService.js`, `src/components/Common/UpdateNotificationModal.jsx`
- การแพ็กเกจ Microsoft Store AppX และ NSIS Installer: `package.json`

### ⏳ ฟีเจอร์ที่ทำค้าง / อยู่ในระดับเตรียมพร้อม
- **Google OAuth API Direct Sync**: ใน `src/config/googleConfig.js` ฟิลด์ `DEFAULT_GOOGLE_CLIENT_ID` ยังเป็นค่าว่าง ปัจจุบันการซิงค์คลาวด์พึ่งพาการซิงค์ผ่านไดรฟ์ของโปรแกรม Google Drive for Desktop ในเครื่อง ไม่ได้ยิง REST API เข้า Google Cloud โดยตรง
- **Web Browser Standalone Mode**: เมื่อเปิดผ่านเบราว์เซอร์ธรรมดา (ไม่ใช่ Electron) เซอร์วิส `src/services/autoBackupService.js` จะพยายามเรียก `/api/auto-backup` ซึ่งปัจจุบันยังไม่มีเว็บเซิร์ฟเวอร์รองรับ API นี้

### ❌ ฟีเจอร์ที่ยังไม่เริ่ม
- บัญชีผู้ใช้งานบนคลาวด์และระบบ Real-time Multi-user Collaboration
- ระบบบันทึกเสียงบรรยายซิงค์กับลายมือ (Audio Recording Sync)
- การแปลงลายมือเป็นตัวพิมพ์ด้วย AI / OCR (Handwriting-to-Text Recognition)

---

## 10. บั๊กที่รู้ และ TODO / FIXME ที่พบในโค้ด

### ผลตรวจ TODO / FIXME:
- **ไม่พบคำว่า `TODO` หรือ `FIXME` ใดๆ** ในซอร์สโค้ด `src/` และ `electron/` (จำนวนที่พบ: 0 จุด)

### บั๊กที่รู้และพฤติกรรมขอบเขตที่ต้องระวัง (Edge Cases):
1. **Vite Dynamic Import Chunk Warning**:
   - เมื่อรัน `npm run build` จะมีการแจ้งเตือนว่า `autoBackupService.js` และ `fileSystemService.js` ถูก import แบบ dynamic ในบางไฟล์ แต่ถูก import แบบ static ใน `App.jsx` ทำให้ Rollup ไม่สามารถแยกก้อนโค้ดเป็น Chunk อิสระได้ ส่งผลให้ขนาดไฟล์ `dist/assets/index-*.js` มีขนาดประมาณ 1.48 MB (มากกว่า 500 kB)
2. **หน่วยความจำเมื่อเปิด PDF ขนาดใหญ่มาก**:
   - หากผู้ใช้นำเข้าไฟล์ PDF ที่มีจำนวนหน้าเกิน 100-200 หน้า แม้ว่าระบบจะมี Viewport Virtualization ช่วยคลายภาระแคนวาส แต่การเก็บ Data URL ภาพต้นฉบับของหน้าทั้งหมดในหน่วยความจำอาจทำให้กิน RAM สูง
3. **การชนกันของไดรฟ์เสมือน Google Drive**:
   - หากในเครื่องของผู้ใช้มีทั้งไดรฟ์ G: และ H: ติดตั้งอยู่ โค้ดใน `electron/main.cjs` จะเลือกไดรฟ์แรกที่พบ หากผู้ใช้ต้องการให้บันทึกลงอีกไดรฟ์หนึ่ง จะต้องเข้าไปเลือกไดรฟ์ด้วยตนเองผ่านเมนูตั้งค่า

---

## 11. การตัดสินใจสำคัญในการออกแบบ (Architectural Decisions) และเหตุผล

1. **การแยกชั้นแคนวาส 3 ชั้น (3-Layer Decoupled Canvas Architecture)**:
   - *เหตุผล*: หากรวมทุกอย่างไว้บนแคนวาสเดียว ทุกครั้งที่ลากปากกาจะต้องวาดเส้นเก่าทั้งหมดซ้ำ ทำให้เฟรมเรตร่วงทันทีเมื่อมีเส้นจำนวนมาก การแยกแคนวาสทำให้ Layer 3 วาดเฉพาะเส้นปัจจุบันได้ที่ 120 FPS
2. **การคงแนวทาง Offline-First ไม่พึ่งพาเซิร์ฟเวอร์**:
   - *เหตุผล*: ผู้ใช้สมุดโน้ตต้องการเปิดแอปแล้วเขียนได้ในเสี้ยววินาที ข้อมูลต้องเป็นส่วนตัว ปลอดภัย และใช้งานได้แม้อยู่บนเครื่องบินหรือไม่มีอินเทอร์เน็ต
3. **การซิงค์ Google Drive ผ่าน Local Filesystem แทนที่จะใช้ REST API**:
   - *เหตุผล*: การใช้ไดรฟ์เสมือนของ Google Drive for Desktop ทำให้ไม่ต้องจัดการ Refresh Token, OAuth Consent Screen ที่หมดอายุ, หรือปัญหาเชื่อมต่ออินเทอร์เน็ตสะดุด อีกทั้งยังทำให้ผู้ใช้มองเห็นไฟล์จริงบนคอมพิวเตอร์ของตนเองได้
4. **การเลือกใช้ Pure Vanilla CSS โดยไม่มี Tailwind หรือ CSS-in-JS**:
   - *เหตุผล*: ป้องกันภาระการประมวลผลสไตล์ชีทขณะรันไทม์ และลดเวลาการบิลด์ ให้ความเร็วในการตอบสนองสูงสุดบนหน้าจอสัมผัส
5. **การจำกัดแท็บไว้ที่สูงสุด 5 แท็บพร้อมระบบ LRU Eviction**:
   - *เหตุผล*: อุปกรณ์สัมผัส เช่น Microsoft Surface มีข้อจำกัดเรื่อง VRAM ของ GPU การเปิดสมุดหลายสิบเล่มพร้อมกันจะทำให้ Chromium GPU Process แคชล้นและแอปค้างได้

---

## 12. ตัวแปรสภาพแวดล้อมที่ต้องใช้

โปรเจกต์ BetterNote Pro Studio ถูกออกแบบมาให้ทำงานแบบ Standalone จึง**ไม่ต้องใช้ไฟล์ `.env` และไม่มีการดึง Secret ใดๆ**:
- ตัวแปรของระบบ Windows ที่โค้ดเรียกอ่าน:
  - `process.env.USERPROFILE`: อ่าน path โฟลเดอร์ผู้ใช้ Windows เพื่อหา `Documents/BetterNote.AppPC` เป็น Fallback สำหรับการสำรองข้อมูล

---

## 13. จุดอันตราย: ส่วนที่แก้ผิดแล้วข้อมูลผู้ใช้อาจเสียหายหรือแอปพัง

### ⚠️ `src/services/db.js`
- **ห้ามเปลี่ยนชื่อฐานข้อมูล `'BetterNoteDB'` หรือเลขเวอร์ชันโดยไม่มี Migration Handler ใน `onupgradeneeded`**: หากเปลี่ยนโดยไม่ระวัง เบราว์เซอร์/Electron จะสร้างฐานข้อมูลใหม่ว่างเปล่า ทำให้โน้ตเดิมทั้งหมดของผู้ใช้หายไปจากหน้าจอ
- **การลบสมุด (`deleteNotebook` / `batchDeleteNotebooks`)**: ต้องรันใน Transaction เดียวกันระหว่างตาราง `notebooks` และ `pages` เสมอ มิฉะนั้นจะมีหน้าตกค้างกลายเป็น Orphan Pages ที่กินพื้นที่ IndexedDB ตลอดไป

### ⚠️ `src/services/autoBackupService.js`
- **ห้ามเขียนทับไฟล์สำรองเมื่อข้อมูลว่างเปล่า**: หากแอปเพิ่งเปิดขึ้นมาและ IndexedDB ยังโหลดไม่เสร็จ (`notebooks.length === 0`) ห้ามสั่งเขียนทับไฟล์สำรองบน Google Drive เด็ดขาด เพราะจะทำให้ไฟล์สำรองที่มีอยู่เดิมถูกแทนที่ด้วยไฟล์เปล่า (ในโค้ดปัจจุบันมี Guard ป้องกันไว้ที่บรรทัด 78-82)
- **ห้ามเอา Cooperative Yield (`setTimeout(resolve, 30)`) ออก**: การเรนเดอร์ PDF ต้องยอมสละเวลาให้ UI Thread เสมอ หากนำลูปนี้ออกเป็นแบบ Synchronous หน้าจอของ Windows จะค้างและขึ้นข้อความ "(Not Responding)"

### ⚠️ `src/services/fileSystemService.js`
- **ห้ามใช้ ID เดิมเมื่อนำเข้าไฟล์ `.bnote`**: ฟังก์ชัน `importBnoteFile` ต้องสร้าง `newNotebookId` เสมอ หากใช้ ID เดิมที่ติดมากับไฟล์ อาจไปทับสมุดโน้ตที่มีอยู่แล้วในเครื่องของผู้ใช้
- **`restoreFullBackup`**: ฟังก์ชันนี้จะบันทึกทับข้อมูลสมุดโน้ตที่มี ID ตรงกัน การแก้ตรรกะการกู้คืนต้องมั่นใจว่าจะไม่ทำให้ข้อมูลหน้ากระดาษขาดหาย

### ⚠️ `electron/main.cjs`
- **ห้ามสร้างระบบ Prune อัตโนมัติแบบลบไฟล์ที่ไม่มีในเครื่องปัจจุบัน**: ในอดีตเคยมีบั๊กที่เมื่อเปิดแอปบนเครื่องใหม่ที่ยังไม่มีโน้ต ระบบเข้าใจผิดว่าโน้ตบน Google Drive ถูกลบ จึงไปสั่งลบไฟล์บน Google Drive จนหมด ปัจจุบันโค้ดแก้เป็น Zero-Deletion Guarantee โดยจะลบไฟล์สำรองเฉพาะเมื่อผู้ใช้กดสั่งลบสมุดโน้ตเล่มนั้นในแอปอย่างชัดเจนเท่านั้น

---

## 14. จุดที่ README.md เดิมไม่ตรงกับโค้ดจริง (ก่อนการแก้ไข)

1. **เลขเวอร์ชันและลิงก์ดาวน์โหลด**:
   - *README เดิม*: อ้างอิงเวอร์ชัน `v1.1.5` ทั้งบน Badge และลิงก์ดาวน์โหลด
   - *โค้ดจริง*: เวอร์ชันปัจจุบันใน `package.json` และ GitHub Releases คือ **`v1.2.1`**
2. **ขนาดไฟล์ดาวน์โหลด**:
   - *README เดิม*: ระบุขนาดไฟล์ `(~151 MB)`
   - *ความจริง*: ขนาดไฟล์ zip ของเวอร์ชัน v1.2.1 มีขนาดจริงประมาณ **~184 MB** (193,115,248 bytes)
3. **ระบบแปลภาษา 4 ภาษา และแท็บการตั้งค่า**:
   - *README เดิม*: ยังไม่มีการกล่าวถึงระบบ 4 ภาษา (อังกฤษ, ไทย, จีนตัวย่อ, รัสเซีย) และแท็บการตั้งค่าใหม่ "Theme & Language" (ธีม และ ภาษา)
   - *โค้ดจริง*: มีการรวมศูนย์การเลือกธีมและภาษาไว้ในแท็บเดียวกัน และมีคลังคำศัพท์ครบ 674 คีย์
4. **ตำแหน่งและระบบการสำรองข้อมูล Google Drive**:
   - *README เดิม*: ระบุเจาะจงเฉพาะพาธ `H:\My Drive\BetterNote.AppPC`
   - *โค้ดจริง*: ระบบรองรับการตรวจหาไดรฟ์ Google Drive อัตโนมัติ (`H:\`, `G:\`, `I:\`, `D:\`) และรองรับการเลือกโฟลเดอร์อื่นใดก็ได้ตามความต้องการของผู้ใช้
5. **ข้อความด้านนโยบายความเป็นส่วนตัว (Privacy Policy)**:
   - *README เดิม*: อ้างสิทธิ์ว่า "100% Offline & Local" โดยไม่ได้ระบุว่ามีระบบสำรองข้อมูล Google Drive ในเครื่อง
   - *โค้ดจริง*: ได้รับการอัปเดตเรียบร้อยแล้ว โดยระบุว่าแอปเป็นแบบ Offline-First และระบบซิงค์ Google Drive ในเครื่องเป็นตัวเลือกเสริม (Optional) ที่ผู้ใช้เลือกเปิดหรือปิดได้อิสระ

---

## 15. สรุปสาระของไฟล์ใน `.agents/skills` และ `PROJECT_COMPLETION_MANIFEST.md`

### 15.1 `.agents/skills/pc-pen-notebook-dev/SKILL.md`
- **สาระสำคัญ**: คู่มือสถาปัตยกรรมสำหรับแอปปากกา Stylus บน Windows / Surface PC ครอบคลุมการใช้ Pointer Events, Coalesced Events, Quadratic Bézier Curves, Tapering, และ Dual-Layer Canvas
- **ความตรงกับโค้ดปัจจุบัน**: **ตรงกับโค้ดปัจจุบัน 100%** โค้ดใน `src/utils/inkingEngine.js` และ `src/components/Editor/CanvasBoard.jsx` ถูกสร้างขึ้นตามแบบแผนในไฟล์นี้ทั้งหมด

### 15.2 `.agents/skills/app-performance-optimization/SKILL.md`
- **สาระสำคัญ**: คู่มือการจัดการประสิทธิภาพ ป้องกัน UI Thread Freeze ("Not Responding") บน Windows, การแบ่ง Slice เวลา (Yielding), การเลี่ยง `store.getAll()` บนตารางขนาดใหญ่, และการทำ Viewport Virtualization เพื่อเลี่ยง GPU Memory เต็ม 4GB
- **ความตรงกับโค้ดปัจจุบัน**: **ตรงกับโค้ดปัจจุบัน 100%** โค้ดใน `src/services/autoBackupService.js` มีการ yield ทุก 30-40ms และ `src/components/Editor/NoteEditor.jsx` มีการ virtualize หน้านอก viewport

### 15.3 `PROJECT_COMPLETION_MANIFEST.md`
- **สาระสำคัญ**: เอกสารสรุปการปิดงานรอบแรก (ลงวันที่ 11 กันยายน 2026) ระบุการเตรียมไฟล์ส่ง Microsoft Store รุ่น v1.0.0, ข้อมูลแพ็กเกจ AppX, ภาพ Store Logos และ Screenshots
- **ส่วนที่ยังตรงกับโค้ดปัจจุบัน**: ข้อมูล Identity ของ Microsoft Partner Center (`JustStone.3453441DD0CC3`), Publisher ID, และรายการไฟล์ภาพใน `store_logos/`
- **ส่วนที่ล้าสมัยแล้ว**: เลขเวอร์ชันระบุ 1.0.0 (ปัจจุบัน 1.2.1), ช่วงซูมระบุ (25% - 500%) ขณะที่โค้ดจริงคือ 35% - 350%, และระบุ path ไดรฟ์ H: ทางเดียว

---

## 16. การย้ายไปทำงานบนเครื่องใหม่ (New PC Migration & Disaster Recovery)

หัวข้อนี้สรุปขั้นตอน ผลการตรวจสอบโค้ด และพฤติกรรมจริงของระบบเมื่อต้องย้ายโปรเจกต์และข้อมูลโน้ตไปทำงานบนเครื่องคอมพิวเตอร์เครื่องใหม่:

### 16.1 การแยกกันระหว่าง "ซอร์สโค้ด" กับ "ข้อมูลโน้ตจริง"
- **ซอร์สโค้ด**: มาจาก `git clone` จาก GitHub และติดตั้งแพ็กเกจผ่าน `npm install`
- **ข้อมูลโน้ตจริง**: **ไม่ได้อยู่ใน Git** แต่จัดเก็บอยู่ในฐานข้อมูลภายในเครื่อง และสำรองไว้บน Google Drive (หรือโฟลเดอร์สำรองข้อมูลภายนอก)

### 16.2 ข้อมูลโน้ตอยู่ใน IndexedDB ที่ผูกกับเครื่อง (ระบุตำแหน่งจริง)
IndexedDB ของแอปพลิเคชันถูกจัดเก็บไว้ตามสภาพแวดล้อมที่รันบน Windows:
1. **เมื่อรันด้วยคำสั่ง `npm run app` (โหมดพัฒนา / Electron)**:
   - อิงตามชื่อ `"name": "betternote"` ใน `package.json`
   - จัดเก็บที่: `%APPDATA%\betternote\IndexedDB\file__0.indexeddb.leveldb\` และไฟล์บล็อบที่ `file__0.indexeddb.blob\`
2. **เมื่อติดตั้งด้วยตัวติดตั้ง NSIS (`BetterNotePC Setup.exe`)**:
   - อิงตาม `"productName": "BetterNotePC"` ใน `package.json`
   - จัดเก็บที่: `%APPDATA%\BetterNotePC\IndexedDB\file__0.indexeddb.leveldb\`
3. **เมื่อติดตั้งผ่าน Microsoft Store Package (`.appx`)**:
   - ถูกกักอยู่ใน Sandbox ของ Windows App Container
   - จัดเก็บที่: `%LOCALAPPDATA%\Packages\JustStone.3453441DD0CC3_...\LocalCache\Roaming\BetterNotePC\IndexedDB\`

> **สรุปสำคัญ**: การ Clone โค้ดลงเครื่องใหม่เพียงอย่างเดียวจะเปิดขึ้นมาเจอแอปที่ว่างเปล่าเสมอ เพราะ IndexedDB บนเครื่องใหม่ยังไม่มีข้อมูล

### 16.3 ไฟล์ที่มี Path หรือ Drive Letter ฝังในโค้ด และผลกระทบ
จากการตรวจสอบพบไฟล์ที่เกี่ยวข้องกับ Path หรือ Drive Letter ดังนี้:
1. `BetterNote App.vbs`: มี path สคริปต์เต็มของเครื่องเดิมสำหรับสั่งรัน bat แบบซ่อนหน้าต่างดำ (ต้องแก้ไขพาธหากต้องการนำ vbs นี้ไปวางบนหน้า Desktop เครื่องใหม่)
2. `Launch BetterNote & AutoSync.bat`: บรรทัดที่ 4 มีคำสั่ง `cd /d "..."` ที่ชี้ไปยังโฟลเดอร์เครื่องเดิม (หากย้ายโฟลเดอร์บนเครื่องใหม่จะไม่ทำงาน ต้องแก้เป็น `cd /d "%~dp0"`)
3. `Launch BetterNote Surface App.bat`: ใช้ `%~dp0` อยู่แล้ว จึงย้ายไปเครื่องใหม่ได้ทันที
4. `electron/main.cjs` (บรรทัดที่ 30-35): มีอาเรย์ Candidate Drive: `['H:\\My Drive\\BetterNote.AppPC', 'G:\\My Drive\\BetterNote.AppPC', 'I:\\My Drive\\BetterNote.AppPC', 'D:\\My Drive\\BetterNote.AppPC']`
5. `src/App.jsx` (บรรทัดที่ 130): มีค่าเริ่มต้น State: `driveEmail = 'G:\\My Drive'`
6. `src/components/Common/GoogleDriveModal.jsx`: มี fallback string `'G:\\My Drive\\BetterNote.AppPC'`
7. `src/components/Common/Navbar.jsx` และ `src/services/i18n.js`: มี Tooltip และ Placeholder ระบุตัวอย่าง `H:\My Drive\BetterNote.AppPC`
8. `AppxManifest.xml`: ไม่มี Drive letter ฝัง มีเฉพาะค่า `Version="1.2.0.0"`

**ผลกระทบหาก Drive Letter บนเครื่องใหม่ต่างจากเดิม (เช่น กลายเป็น F: หรือ E:)**:
- หาก Drive Letter ของ Google Drive บนเครื่องใหม่ไม่ได้อยู่ใน H, G, I, D ฟังก์ชัน `getAllBackupTargets` ใน `electron/main.cjs` จะหาโฟลเดอร์ Google Drive ไม่พบ และจะสลับไปใช้ `%USERPROFILE%\Documents\BetterNote.AppPC` ชั่วคราว
- **วิธีแก้บนเครื่องใหม่**: ให้ผู้ใช้เข้าไปที่เมนูการตั้งค่า (Settings Modal) -> แถบ "สำรองข้อมูล" -> คลิกปุ่ม "เปลี่ยนโฟลเดอร์" แล้วเลือกโฟลเดอร์ `BetterNote.AppPC` บนไดรฟ์ของเครื่องใหม่ แอปจะบันทึกพาธใหม่ลง IndexedDB ทันที

### 16.4 ขั้นตอนการกู้คืนโน้ตบนเครื่องใหม่ทีละขั้น
1. **เตรียม Google Drive**: ติดตั้งโปรแกรม Google Drive for Desktop บนเครื่องใหม่ ล็อกอินด้วยบัญชีเดียวกับเครื่องเดิม และรอให้ไดรฟ์ซิงค์โฟลเดอร์ `BetterNote.AppPC` ลงเครื่องเสร็จสมบูรณ์
2. **เตรียมซอร์สโค้ด**:
   ```bash
   git clone https://github.com/NoteGuys/BetterNotePC.git
   cd BetterNotePC
   npm install
   npm run build
   npm run app
   ```
3. **ตรวจสอบโฟลเดอร์สำรองข้อมูล**:
   - เมื่อแอปเปิดขึ้นมา หาก Google Drive เป็นไดรฟ์ H, G, I หรือ D แอปจะตรวจพบอัตโนมัติ
   - หากเป็นไดรฟ์อื่น ให้กดไอคอนฟันเฟือง (ตั้งค่า) -> "สำรองข้อมูล" -> กด "เปลี่ยนโฟลเดอร์" แล้วเลือกโฟลเดอร์ `BetterNote.AppPC`
4. **กู้คืนฐานข้อมูล**:
   - คลิกที่ปุ่มสถานะ Google Drive หรือเข้าเมนูตั้งค่า
   - กดปุ่ม **"Restore Full Backup" (กู้คืนข้อมูลทั้งหมด)**
   - เลือกไฟล์ `Full_System/BetterNote_Latest_Backup.json` จากโฟลเดอร์ Google Drive
   - รอระบบประมวลผลสักครู่ โน้ตทั้งหมด โฟลเดอร์ หน้ากระดาษ เส้นเขียน และมาร์กอัป PDF จะถูกโหลดกลับเข้าสู่ IndexedDB ของเครื่องใหม่ครบถ้วน 100%
   - *(หรือหากต้องการกู้คืนเฉพาะบางสมุด สามารถกดปุ่ม "นำเข้า .bnote" แล้วเลือกไฟล์ `.bnote` แต่ละเล่มได้)*

### 16.5 ผลตรวจ: สองเครื่องเขียนไฟล์สำรองในโฟลเดอร์เดียวกัน เครื่องที่มีโน้ตน้อยกว่าจะเขียนทับเครื่องที่มีมากกว่าหรือไม่?
- **ผลการตรวจโค้ดจริงใน `electron/main.cjs` (บรรทัด 187-207)**:
  - **คำตอบ: ไม่เขียนทับโน้ตเดิม (Safe Smart-Merge)**
  - เมื่อเครื่องใหม่ (ที่มีสมุดโน้ตน้อยกว่า เช่น มีแค่ Welcome Note 1 เล่ม) รัน Auto Backup ไปยังโฟลเดอร์เดียวกัน ตัวโค้ดจะอ่าน `BetterNote_Latest_Backup.json` เดิมขึ้นมาก่อนเสมอ
  - ระบบจะเปรียบเทียบ ID และชื่อสมุดโน้ต โดยสมุดโน้ตเดิมที่เครื่องใหม่ยังไม่มีจะถูกคัดแยกเก็บไว้ในอาร์เรย์ `preserved`
  - จากนั้นระบบจะนำสมุดโน้ตเดิมมารวมเข้ากับสมุดโน้ตใหม่ (`notebooks: [...incoming, ...preserved]`) ก่อนเขียนลงไฟล์
  - **ดังนั้น ข้อมูลของเครื่องเดิมจะไม่ถูกลบหรือถูกเขียนทับจนหายไป**
  - *ข้อยกเว้น*: หากสมุดเล่มนั้นมีชื่อและ ID ตรงกันเป๊ะ โน้ตของเครื่องที่เพิ่งสั่งบันทึกจะอัปเดตทับเล่มนั้น

### 16.6 ผลตรวจ: `sanitizeNotebookForJson` ที่ตัด `pdfBase64` ทำให้สมุด PDF กู้คืนไม่ครบหรือไม่?
- **ผลการตรวจโค้ดจริงใน `src/services/autoBackupService.js` และ `electron/main.cjs`**:
  - **คำตอบ: กู้คืนได้ครบถ้วน 100% ไม่สูญหาย**
  - สิ่งที่ถูกตัดออกคือฟิลด์ `nb.pdfBase64` ซึ่งเป็นก้อน Binary ขนาดใหญ่ของไฟล์ PDF ส่งออกทั้งเล่มที่ถูกแนบมาชั่วคราวเพื่อส่งให้ Electron เขียนเป็นไฟล์ `PDF_Documents/*.pdf`
  - ส่วนหน้ากระดาษและภาพพื้นหลังของแต่ละหน้า PDF ถูกจัดเก็บอยู่ในพร็อพเพอร์ตี `page.pdfPageImage` ภายในอาร์เรย์ `nb.pages`
  - โค้ดของ `sanitizeNotebookForJson` **ไม่ได้แตะต้องหรือตัด `page.pdfPageImage` ออกเลย**
  - จากการตรวจสอบไฟล์ `BetterNote_Latest_Backup.json` และไฟล์ `.bnote` จริง พบว่ามีข้อมูล `pdfPageImage` บันทึกอยู่ครบทุกหน้า เมื่อสั่ง Restore จึงได้หน้ากระดาษ PDF กลับมาครบถ้วน

### 16.7 ผลตรวจ: `npm run app` (โหมด Dev) ใช้ฐานข้อมูลและโฟลเดอร์สำรองเดียวกับแอปที่ติดตั้งแล้วหรือไม่?
- **ผลการตรวจโค้ดจริง**:
  1. **ฐานข้อมูล IndexedDB: คนละที่กัน**
     - `npm run app` (รันผ่าน `electron .` ซึ่งใช้ `name: "betternote"`): บันทึกที่ `%APPDATA%\betternote\IndexedDB\`
     - แอปที่ติดตั้งผ่าน NSIS Setup (ใช้ `productName: "BetterNotePC"`): บันทึกที่ `%APPDATA%\BetterNotePC\IndexedDB\`
     - แอปจาก Microsoft Store (AppX): บันทึกใน Windows App Container Sandbox
  2. **โฟลเดอร์สำรองข้อมูล: ขึ้นอยู่กับประเภทของเป้าหมาย**
     - หากเปิด Auto-Sync หรือเลือกโฟลเดอร์ Google Drive / Custom Directory: **ใช้โฟลเดอร์เดียวกัน** เพราะชี้ไปที่ Path เดียวกันบนระบบไฟล์
     - หากใช้โฟลเดอร์เริ่มต้น `BetterNote_Backups/` (ซึ่งอิงตาม `process.cwd()`): โหมด Dev จะบันทึกลงโฟลเดอร์โปรเจกต์ ส่วนแอปที่ติดตั้งแล้วจะบันทึกลงไดเรกทอรีโปรแกรมของ Windows ซึ่งอยู่คนละที่กัน

---

## 17. งานถัดไป เรียงตามความสำคัญ

1. **[สำคัญสูงสุด] การนำส่งแพ็กเกจ Microsoft Store v1.2.1**:
   - นำไฟล์ `release/BetterNotePC 1.2.1.appx` หรือ `BetterNotePC-1.2.1-MicrosoftStore-Submission.zip` อัปโหลดขึ้นสู่ Microsoft Partner Center เพื่อเผยแพร่เวอร์ชันใหม่
2. **การปรับแต่งขนาด Chunk ใน Vite Build**:
   - จัดการความสัมพันธ์ระหว่าง Dynamic Import และ Static Import ของ `autoBackupService.js` และ `fileSystemService.js` เพื่อกำจัดคำเตือน Bundle size > 500 kB
3. **การเพิ่มการเลือก Google Drive Drive Letter ในหน้า UI**:
   - สำหรับผู้ใช้ที่มีหลายไดรฟ์ Google Drive (เช่น งาน และ ส่วนตัว) เพิ่มตัวเลือก Dropdown ให้เลือกไดรฟ์ที่ต้องการได้โดยตรง
4. **แถบเครื่องมือปากกาโปรด (Pen Preset Favorites)**:
   - เพิ่มความสามารถในการบันทึกชุดสีและความหนาของปากกาที่ใช้บ่อย เพื่อสลับใช้งานได้ในคลิกเดียว
5. **การทดสอบบน Windows on ARM (Surface Pro Copilot+)**:
   - ทดสอบและบิลด์ตัวติดตั้งสำหรับสถาปัตยกรรม ARM64

---

## 18. ผล build และ test ล่าสุด พร้อมวันที่

- **วันที่ทำการทดสอบ**: 5 ตุลาคม 2026 (2026-10-05)
- **เครื่องที่ใช้ทดสอบ**: เครื่องเดิมของผู้พัฒนา (การทดสอบนี้ไม่สามารถยืนยันซ้ำบนเครื่องใหม่ที่โคลนไปได้ทันที เนื่องจากโฟลเดอร์ `scratch/` อยู่ใน `.gitignore`)
- **ผลการรันคำสั่งบิลด์ (`npm run build`)**:
  - รหัสส่งออก (Exit code): `0` (สำเร็จ)
  - ระยะเวลาที่ใช้: `16.26 วินาที`
  - ผลลัพธ์:
    - `dist/index.html` (1.39 kB)
    - `dist/assets/pdf.worker.min-*.mjs` (1,375.84 kB)
    - `dist/assets/index-*.css` (108.48 kB)
    - `dist/assets/index-*.js` (1,481.79 kB)
- **ผลการรันชุดทดสอบ (Test Suites เฉพาะบนเครื่องเดิม)**:
  - `node scratch/test_tab_system_logic.mjs`: ผ่าน 8/8 การทดสอบ (100%)
  - `node scratch/test_device_migration_and_sync.mjs`: ผ่าน 23/23 การทดสอบ (100%)
  - `python scratch/verify_all_dicts.py`: ผ่านครบ 674 คีย์ทั้ง 4 ภาษา (100% 4-Way Parity)
  - `node scratch/test_theme_and_updates.mjs`: ผ่าน 100%
  - `node scratch/test_round2_fixes.mjs`: ผ่าน 74/74 การทดสอบ (100%)
  - `node scratch/verify_dist_bundle.cjs`: ตรวจพบข้อความคีย์ 4 ภาษาใน Production Bundle ครบถ้วน (100%)

---

## 19. ผลตรวจหาค่าลับและ Path ส่วนตัวในโค้ดและประวัติ Commit

- **การตรวจหาค่าลับ (API Key, Client Secret, Token)**:
  - ตรวจค้นใน `src/` และ `electron/`: **ไม่พบค่าลับใดๆ**
  - ใน `src/config/googleConfig.js`: ตัวแปร `DEFAULT_GOOGLE_CLIENT_ID` ถูกกำหนดเป็นสตริงว่าง `''` ปลอดภัยต่อการเผยแพร่แบบสาธารณะ
- **การตรวจหา Path ส่วนตัวในโค้ดปัจจุบัน**:
  - ตรวจค้นใน `src/` และ `electron/`: **ไม่พบพาธส่วนตัว** ของผู้ใช้
- **การตรวจหาในประวัติ Git Commit ในอดีต**:
  - ตรวจพบว่าใน Commit ย้อนหลัง มีไฟล์สคริปต์ภายนอก เช่น ไฟล์ `.vbs`, `.bat`, และเอกสาร manifest ในอดีต ที่เคยบันทึก path เต็มของเครื่องเดิมไว้
  - **ข้อปฏิบัติเข้มงวด**: ในเอกสาร `HANDOFF.md` และ `README.md` นี้ จะไม่มีการระบุ path ส่วนตัวของเครื่องผู้ใช้เด็ดขาด เพื่อความปลอดภัยของ Public Repository

---

## 20. กฎการทำงานสำหรับ AI ที่มารับช่วงต่อ

- ก่อนแก้โค้ด ให้บอกแผนและรายชื่อไฟล์ที่จะแก้ แล้วรอผู้ใช้ตอบว่า "ลุย"
- ทำทีละงานเล็กๆ ห้ามปรับโครงสร้างหลายส่วนพร้อมกัน
- ห้ามเปลี่ยนรูปแบบการเก็บข้อมูลโน้ตโดยไม่ได้รับอนุญาต
- ห้ามอัปเกรดไลบรารี และห้ามแก้ไฟล์ lock เอง
- ห้ามแตะไฟล์ .env และห้ามแสดงค่าลับ
- หลังแก้ทุกครั้งให้รัน build และ test แล้วรายงานตามจริง
- ห้ามพูดว่า "เสร็จแล้ว" ถ้ายังไม่ได้ตรวจ ให้แยกระหว่าง "แก้แล้ว" กับ "ตรวจแล้ว"
- ห้ามใช้ git push --force หรือ git reset --hard โดยไม่ถามก่อน
- ถ้าไม่แน่ใจ ให้ถามผู้ใช้ ห้ามเดา

---

## ส่วนที่ฉันมั่นใจน้อย

เพื่อให้มนุษย์หรือผู้ดูแลโปรเจกต์ช่วยตรวจสอบต่อ:
1. **การคง candidate paths ใน `electron/main.cjs`**:
   - พาธ candidate `H:\My Drive\BetterNote.AppPC`, `G:\My Drive\BetterNote.AppPC` ฯลฯ ถูกฝังไว้เพื่อความสะดวกของผู้ใช้ส่วนใหญ่ที่มี Google Drive for Desktop แต่หากผู้ใช้บนเครื่องใหม่เปลี่ยนไปใช้ชื่อโฟลเดอร์อื่นหรือติดตั้งไดรฟ์อื่นที่ไม่ใช่ 4 ตัวนี้ อาจต้องเพิ่มการตั้งค่าผ่าน UI ให้ยืดหยุ่นขึ้น
2. **การทดสอบบน Surface จริงเทียบกับ Electron บน Desktop**:
   - การทดสอบ Pointer Events ความหน่วง และ Palm Rejection ได้รับการยืนยันผ่านสคริปต์จำลองและการทำงานบนเบราว์เซอร์/Electron แต่ควรให้ผู้ใช้สัมผัสเขียนบนหน้าจอ Surface จริงด้วยปากกา Surface Pen อีกครั้งเพื่อความมั่นใจในฟีลลิ่งการเขียน
