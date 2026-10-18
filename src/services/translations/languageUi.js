// en | th | zh | ru | ar | es | de
const rows = `
langArabic|العربية (Experimental)|العربية (รุ่นทดสอบ)|العربية（试用版）|العربية (тестовая версия)|العربية (نسخة تجريبية)|العربية (experimental)|العربية (Testversion)
langArabicDesc|Arabic. Translation and right-to-left layout are being tested.|ภาษาอาหรับ กำลังทดสอบคำแปลและการแสดงผลจากขวาไปซ้าย|阿拉伯语。翻译及从右到左的布局仍在测试中。|Арабский. Перевод и расположение справа налево проходят тестирование.|يجري اختبار الترجمة والعرض من اليمين إلى اليسار.|Árabe. Traducción y diseño de derecha a izquierda en pruebas.|Arabisch. Übersetzung und Darstellung von rechts nach links werden getestet.
langSpanish|Español (Spanish)|Español (สเปน)|Español（西班牙语）|Español (испанский)|Español (الإسبانية)|Español|Español (Spanisch)
langSpanishDesc|Spanish interface and tools|เมนูและเครื่องมือภาษาสเปน|西班牙语界面和工具|Интерфейс и инструменты на испанском|واجهة وأدوات باللغة الإسبانية|Interfaz y herramientas en español|Oberfläche und Werkzeuge auf Spanisch
langGerman|Deutsch (German)|Deutsch (เยอรมัน)|Deutsch（德语）|Deutsch (немецкий)|Deutsch (الألمانية)|Deutsch (alemán)|Deutsch
langGermanDesc|German interface and tools|เมนูและเครื่องมือภาษาเยอรมัน|德语界面和工具|Интерфейс и инструменты на немецком|واجهة وأدوات باللغة الألمانية|Interfaz y herramientas en alemán|Oberfläche und Werkzeuge auf Deutsch
communityTitle|Downloads & feedback|ดาวน์โหลดและข้อเสนอแนะ|下载与反馈|Загрузки и отзывы|التنزيلات والملاحظات|Descargas y comentarios|Downloads & Feedback
communityReleases|Prefer an earlier version? Visit our downloads on GitHub. Available versions are listed there.|ชอบเวอร์ชันก่อนหน้า? ดูรุ่นที่มีให้ดาวน์โหลดได้ที่หน้า GitHub ของเรา|更喜欢旧版本？前往 GitHub 下载页查看可用版本。|Нравится прежняя версия? Доступные версии можно найти на нашей странице загрузок в GitHub.|تفضّل إصدارًا سابقًا؟ زر صفحة التنزيلات على GitHub للاطلاع على الإصدارات المتاحة.|¿Prefieres una versión anterior? Consulta las versiones disponibles en nuestra página de descargas de GitHub.|Lieber eine ältere Version? Verfügbare Versionen findest du auf unserer GitHub-Downloadseite.
communityFeedback|Have a problem or suggestion? Open an issue or comment on an existing one. A GitHub account is needed to post.|พบปัญหาหรือมีข้อเสนอแนะ? เปิดหัวข้อใหม่หรือคอมเมนต์ในหัวข้อเดิมได้ โดยใช้บัญชี GitHub|遇到问题或有建议？可以新建问题或在已有问题下留言。发言需要 GitHub 帐号。|Есть проблема или предложение? Создай обращение или оставь комментарий. Для публикации нужен аккаунт GitHub.|لديك مشكلة أو اقتراح؟ افتح موضوعًا أو علّق على موضوع موجود. تحتاج إلى حساب GitHub للنشر.|¿Tienes un problema o sugerencia? Abre un tema o comenta uno existente. Necesitas cuenta de GitHub para publicar.|Problem oder Vorschlag? Erstelle ein Issue oder kommentiere ein vorhandenes. Zum Schreiben brauchst du ein GitHub-Konto.
communityDownloads|Downloads|ดาวน์โหลดเวอร์ชัน|下载版本|Скачать версии|التنزيلات|Descargas|Downloads
communityIssues|Problems & suggestions|แจ้งปัญหา / เสนอแนะ|问题与建议|Проблемы и предложения|مشاكل واقتراحات|Problemas y sugerencias|Probleme & Vorschläge
communityProfile|NoteGuys on GitHub|NoteGuys บน GitHub|GitHub 上的 NoteGuys|NoteGuys на GitHub|NoteGuys على GitHub|NoteGuys en GitHub|NoteGuys auf GitHub
diagnosticSave|Save diagnostic report|บันทึกรายงานเพื่อแจ้งปัญหา|保存诊断报告|Сохранить отчёт диагностики|حفظ تقرير التشخيص|Guardar informe de diagnóstico|Diagnosebericht speichern
diagnosticSaveFailed|Unable to save report. Please retry.|บันทึกรายงานไม่สำเร็จ กรุณาลองใหม่|无法保存报告，请重试。|Не удалось сохранить отчёт. Повтори попытку.|تعذر حفظ التقرير. حاول مجددًا.|No se pudo guardar el informe. Reintenta.|Bericht konnte nicht gespeichert werden. Versuche es erneut.
screenLoadingError|Screen loading error|เกิดข้อผิดพลาดในการโหลดหน้าจอ|界面加载错误|Ошибка загрузки экрана|خطأ في تحميل الشاشة|Error al cargar la pantalla|Fehler beim Laden der Ansicht
unexpectedError|An unexpected error occurred.|เกิดข้อผิดพลาดที่ไม่คาดคิด|发生了意外错误。|Произошла непредвиденная ошибка.|حدث خطأ غير متوقع.|Ocurrió un error inesperado.|Ein unerwarteter Fehler ist aufgetreten.
reloadScreen|Reload screen|โหลดหน้าจอใหม่|重新加载界面|Перезагрузить экран|إعادة تحميل الشاشة|Recargar pantalla|Ansicht neu laden
imagePasted|Image pasted!|วางรูปภาพแล้ว|已粘贴图片！|Изображение вставлено!|تم لصق الصورة!|¡Imagen pegada!|Bild eingefügt!
imageAboveToast|Image moved above handwriting|ย้ายรูปไว้เหนือรอยเขียนแล้ว|图片已移到笔迹上方|Изображение перемещено над рукописным текстом|تم وضع الصورة فوق الكتابة|Imagen colocada sobre los trazos|Bild über die Schrift gelegt
imageBehindToast|Image moved behind handwriting|ย้ายรูปไว้ใต้รอยเขียนแล้ว|图片已移到笔迹下方|Изображение перемещено под рукописный текст|تم وضع الصورة خلف الكتابة|Imagen colocada detrás de los trazos|Bild hinter die Schrift gelegt
imageLockedToast|Image position locked|ล็อกตำแหน่งรูปแล้ว|图片位置已锁定|Положение изображения заблокировано|تم قفل موضع الصورة|Posición de imagen bloqueada|Bildposition gesperrt
imageUnlockedToast|Image position unlocked|ปลดล็อกตำแหน่งรูปแล้ว|图片位置已解锁|Положение изображения разблокировано|تم فتح قفل موضع الصورة|Posición de imagen desbloqueada|Bildposition entsperrt
selectionRecolored|Selected strokes recolored|เปลี่ยนสีเส้นที่เลือกแล้ว|所选笔迹已重新着色|Цвет выбранных штрихов изменён|تم تغيير لون الخطوط المحددة|Color de trazos cambiado|Ausgewählte Striche umgefärbt
selectionDuplicated|Selection duplicated|ทำสำเนาส่วนที่เลือกแล้ว|所选内容已复制|Выделение продублировано|تم تكرار التحديد|Selección duplicada|Auswahl dupliziert
selectionDeleted|Selection deleted|ลบส่วนที่เลือกแล้ว|所选内容已删除|Выделение удалено|تم حذف التحديد|Selección eliminada|Auswahl gelöscht
recolor|Recolor|เปลี่ยนสี|更改颜色|Изменить цвет|تغيير اللون|Cambiar color|Umfärben
recolorSelected|Recolor selected strokes|เปลี่ยนสีเส้นที่เลือก|更改所选笔迹颜色|Изменить цвет выбранных штрихов|تغيير لون الخطوط المحددة|Cambiar color de los trazos|Ausgewählte Striche umfärben
changeToColor|Change to {color}|เปลี่ยนเป็นสี {color}|更改为 {color}|Изменить на {color}|تغيير إلى {color}|Cambiar a {color}|Ändern in {color}
resizeTopLeft|Resize (top left)|ปรับขนาด (บนซ้าย)|调整大小（左上）|Размер (сверху слева)|تغيير الحجم (أعلى اليسار)|Cambiar tamaño (arriba izquierda)|Größe ändern (oben links)
resizeTopRight|Resize (top right)|ปรับขนาด (บนขวา)|调整大小（右上）|Размер (сверху справа)|تغيير الحجم (أعلى اليمين)|Cambiar tamaño (arriba derecha)|Größe ändern (oben rechts)
resizeBottomLeft|Resize (bottom left)|ปรับขนาด (ล่างซ้าย)|调整大小（左下）|Размер (снизу слева)|تغيير الحجم (أسفل اليسار)|Cambiar tamaño (abajo izquierda)|Größe ändern (unten links)
resizeBottomRight|Resize (bottom right)|ปรับขนาด (ล่างขวา)|调整大小（右下）|Размер (снизу справа)|تغيير الحجم (أسفل اليمين)|Cambiar tamaño (abajo derecha)|Größe ändern (unten rechts)
imageCropped|Image cropped|ครอบตัดรูปแล้ว|图片已裁剪|Изображение обрезано|تم قص الصورة|Imagen recortada|Bild zugeschnitten
backupFolderPicker|Choose a BetterNote backup folder|เลือกโฟลเดอร์สำรองข้อมูล BetterNote|选择 BetterNote 备份文件夹|Выбери папку резервных копий BetterNote|اختيار مجلد نسخ BetterNote|Elegir carpeta de copias de BetterNote|BetterNote-Sicherungsordner wählen
importBnoteError|Unable to import .bnote: {error}|นำเข้า .bnote ไม่สำเร็จ: {error}|无法导入 .bnote：{error}|Не удалось импортировать .bnote: {error}|تعذر استيراد .bnote: {error}|No se pudo importar .bnote: {error}|.bnote konnte nicht importiert werden: {error}
itemsSelected|items|รายการ|项|элементов|عنصر|elementos|Elemente
currentTheme|Current|ปัจจุบัน|当前|Сейчас|الحالي|Actual|Aktuell
surfaceInking|Surface handwriting|การเขียนบน Surface|Surface 手写|Рукописный ввод Surface|الكتابة على Surface|Escritura en Surface|Surface-Handschrift
bulletPlanner|Bullet journal & planner|สมุดบันทึกและแพลนเนอร์|子弹笔记与计划本|Ежедневник и планер|دفتر يوميات ومخطط|Diario y agenda|Bullet Journal & Planer
backupFolderNewer|The backup has newer folder information. Restore from this folder before preparing it again. Existing files have been kept.|ข้อมูลโฟลเดอร์ในชุดสำรองใหม่กว่า กรุณากู้คืนจากโฟลเดอร์นี้ก่อนเตรียมไฟล์อีกครั้ง ไฟล์เดิมยังอยู่ครบ|备份中的文件夹信息更新。请先从此文件夹恢复，再重新准备文件。已有文件已保留。|В резервной копии более новые сведения о папках. Сначала восстанови её, затем подготовь файлы снова. Существующие файлы сохранены.|تحتوي النسخة على معلومات مجلدات أحدث. استعد النسخة من هذا المجلد قبل تجهيزها مجددًا. تم الاحتفاظ بالملفات الحالية.|La copia tiene información de carpetas más reciente. Restáurala antes de preparar archivos de nuevo. Se conservaron los archivos existentes.|Die Sicherung enthält neuere Ordnerdaten. Stelle sie zuerst wieder her, bevor du Dateien erneut vorbereitest. Vorhandene Dateien wurden behalten.
`;
export const languageUi = Object.fromEntries(['en','th','zh','ru','ar','es','de'].map((code,index)=>[code,
  Object.fromEntries(rows.trim().split('\n').map(row=>{const cells=row.split('|');return[cells[0],cells[index+1]];}))
]));
