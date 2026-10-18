import { arabicLessons } from './guideArabic.js';
import { spanishLessons } from './guideSpanish.js';
import { germanLessons } from './guideGerman.js';
const localeCodes=['ar','es','de'];
const parseRows=rows=>rows.trim().split('\n').map(line=>line.split('|'));
export const guideLocales=Object.fromEntries(localeCodes.map((code,index)=>[code,{
 lessons:Object.fromEntries(parseRows([arabicLessons,spanishLessons,germanLessons][index]).map(([id,title,intro,steps,note])=>[id,{title,intro,steps:steps.split('~').map(step=>step.replace(': ','|')),note:note||''}]))
}]));
const ui=`
title|دليل الاستخدام|Guía de uso|Anleitung
subtitle|تعرّف على الأدوات واستخدمها بطريقتك.|Conoce tus herramientas. Hazlas tuyas.|Lerne deine Werkzeuge kennen.
search|ابحث عن مهمة: نسخ، أشكال، PDF…|Buscar: copias, formas, PDF…|Aufgabe suchen: Sicherung, Formen, PDF…
all|كل المواضيع|Todos los temas|Alle Themen
browse|ماذا تريد أن تفعل؟|¿Qué quieres hacer?|Was möchtest du tun?
intro|من أول دفتر إلى نقل العمل بين الكمبيوتر وSurface.|Desde tu primer cuaderno hasta cambiar entre PC y Surface.|Vom ersten Notizbuch bis zum Wechsel zwischen PC und Surface.
popular|مواضيع مفيدة للبدء|Un buen punto de partida|Ein guter Einstieg
contents|المحتويات|Contenido|Inhalt
steps|خطوة بخطوة|Paso a paso|Schritt für Schritt
note|من المفيد معرفته|Conviene saber|Gut zu wissen
related|اقرأ أيضًا|Sigue leyendo|Weiterlesen
back|العودة للدليل|Volver a la guía|Zurück zur Anleitung
previous|الدرس السابق|Tema anterior|Vorherige Anleitung
next|الدرس التالي|Tema siguiente|Nächste Anleitung
enlarge|تكبير الصورة|Ampliar imagen|Bild vergrößern
close|إغلاق الصورة|Cerrar imagen|Bild schließen
empty|لا توجد دروس مطابقة|No hay temas que coincidan|Keine passenden Anleitungen
emptyHelp|جرّب كلمات أقصر مثل قلم أو PDF أو استعادة.|Prueba con PDF, lápiz o restaurar.|Versuche PDF, Stift oder Wiederherstellen.
clear|مسح البحث|Limpiar búsqueda|Suche löschen
screenshot|صورة من BetterNote • أزرار الصورة بالإنجليزية|Captura de BetterNote • Interfaz de la imagen en inglés|Aufnahme aus BetterNote • Englische Oberfläche im Bild
language|لغة الدليل|Idioma de la guía|Sprache der Anleitung
lessons|درسًا|temas|Anleitungen
home|الرئيسية|Inicio|Start
read|قراءة الدرس|Leer tema|Anleitung lesen
offline|متاح بلا إنترنت|Disponible sin conexión|Offline verfügbar
showContents|عرض المحتويات|Mostrar contenido|Inhalt anzeigen
hideContents|إخفاء المحتويات|Ocultar contenido|Inhalt ausblenden
figure|الأدوات المذكورة في الدرس|Controles de este tema|Werkzeuge dieser Anleitung
topics|فئات|categorías|Kategorien
featuredTitle|تابع عملك على جهاز آخر|Continúa en otro dispositivo|Auf einem anderen Gerät weiterarbeiten
featuredDescription|انسخ عملك واختر المصدر واستعد المجموعة المناسبة.|Crea una copia, elige el origen y restaura el conjunto correcto.|Sichere die Arbeit, wähle die Quelle und stelle den richtigen Stand wieder her.
restoreImageAlt|اختيار مصدر الاستعادة|Selector de origen de restauración|Auswahl der Wiederherstellungsquelle
`;
for(const [key,...values]of parseRows(ui))localeCodes.forEach((code,i)=>{(guideLocales[code].words??={})[key]=values[i];});
const categoryRows=`
start|البدء|دفترك الأول ومساحة العمل|Primeros pasos|Tu primer cuaderno y espacio de trabajo|Erste Schritte|Dein erstes Notizbuch und der Arbeitsbereich
library|تنظيم المكتبة|مجلدات وبحث ومفضلة ومهملات|Organizar la biblioteca|Carpetas, búsqueda, favoritos y papelera|Bibliothek organisieren|Ordner, Suche, Favoriten und Papierkorb
drawing|الكتابة والتظليل|الأقلام والألوان والسماكات والممحاة|Escribir y resaltar|Lápices, colores, grosores y borradores|Schreiben & Markieren|Stifte, Farben, Stärken und Radierer
shapes|الأشكال والتحديد|هندسة وتحديد حر|Formas y selección|Geometría y selección con lazo|Formen & Auswahl|Geometrie und Lasso
media|النص والصور|نص وصور وقص والتقاط|Texto e imágenes|Texto, imágenes, recortes y capturas|Text & Bilder|Text, Bilder, Zuschnitte und Aufnahmen
pages|الورق والصفحات|معاينات وإجراءات الصفحات والورق|Papel y páginas|Miniaturas, acciones y papel|Papier & Seiten|Vorschauen, Seitenaktionen und Papier
surface|Surface واللوحة البيضاء|القلم واللمس والتحريك والتكبير|Surface y pizarra|Lápiz, tacto, movimiento y zoom|Surface & Whiteboard|Stift, Touch, Verschieben und Zoom
export|الاستيراد والتصدير|PDF وملفات قابلة للتعديل وصور|Importar y exportar|PDF, notas editables e imágenes|Import & Export|PDF, bearbeitbare Notizen und Bilder
backup|الحفظ والنسخ والاستعادة|حماية العمل وتغيير الأجهزة|Guardar, copiar y restaurar|Proteger el trabajo y cambiar de equipo|Speichern, Sichern & Wiederherstellen|Arbeit schützen und Geräte wechseln
settings|الإعدادات وحل المشكلات|المظهر والتحديثات والحالة|Ajustes y ayuda|Apariencia, actualizaciones y estado|Einstellungen & Hilfe|Darstellung, Updates und Status
`;
export function localizeGuide(categories,lessons,words){
 for(const [id,...values]of parseRows(categoryRows)){const category=categories.find(c=>c.id===id);localeCodes.forEach((code,i)=>{category[code]=values[i*2];category['description'+code]=values[i*2+1];});}
 for(const code of localeCodes){words[code]=guideLocales[code].words;for(const lesson of lessons){const data=guideLocales[code].lessons[lesson.id];if(!data)throw Error('Missing guide translation: '+code+'/'+lesson.id);for(const field of ['title','intro','steps','note'])lesson[field][code]=data[field];}}
}
const markRows=`
Create or import|إنشاء أو استيراد|Crear o importar|Erstellen oder importieren
Search documents|البحث في المستندات|Buscar documentos|Dokumente suchen
Rename|تغيير الاسم|Cambiar nombre|Umbenennen
Duplicate|تكرار|Duplicar|Duplizieren
Export PDF|تصدير PDF|Exportar PDF|PDF exportieren
Trash|سلة المهملات|Papelera|Papierkorb
Notebook name|اسم الدفتر|Nombre del cuaderno|Notizbuchname
Paper size|حجم الورق|Tamaño de papel|Papiergröße
Paper template|قالب الورق|Plantilla de papel|Papiervorlage
Create notebook|إنشاء دفتر|Crear cuaderno|Notizbuch erstellen
Folder name|اسم المجلد|Nombre de carpeta|Ordnername
Create folder|إنشاء مجلد|Crear carpeta|Ordner erstellen
Select all|تحديد الكل|Seleccionar todo|Alles auswählen
Move selected|نقل المحدد|Mover selección|Auswahl verschieben
Choose starred documents or pages|اختيار مستندات أو صفحات مفضلة|Elegir documentos o páginas favoritos|Markierte Dokumente oder Seiten wählen
Recover|استعادة|Restaurar|Wiederherstellen
Delete permanently|حذف نهائي|Eliminar definitivamente|Endgültig löschen
Search by name|البحث بالاسم|Buscar por nombre|Nach Name suchen
Settings tabs|تبويبات الإعدادات|Pestañas de ajustes|Einstellungstabs
Light theme|المظهر الفاتح|Tema claro|Helles Design
App language|لغة التطبيق|Idioma de la app|App-Sprache
Installed version|الإصدار المثبّت|Versión instalada|Installierte Version
Check for updates|التحقق من التحديثات|Buscar actualizaciones|Nach Updates suchen
Download a full backup|تنزيل نسخة كاملة|Descargar copia completa|Vollständige Sicherung herunterladen
Choose a JSON recovery file|اختيار ملف استعادة JSON|Elegir archivo JSON de recuperación|JSON-Wiederherstellungsdatei wählen
Clear rendering caches|مسح ذاكرة العرض المؤقتة|Vaciar caché de renderizado|Anzeigecaches leeren
Palm rejection|منع لمس راحة اليد|Rechazo de palma|Handballenerkennung
Undo|تراجع|Deshacer|Rückgängig
Zoom and reset|تكبير وإعادة الضبط|Zoom y restablecer|Zoom und Zurücksetzen
More controls|أدوات إضافية|Más controles|Weitere Werkzeuge
Current color|اللون الحالي|Color actual|Aktuelle Farbe
Color picker|اختيار اللون|Selector de color|Farbauswahl
Choose a nib|اختيار رأس القلم|Elegir punta|Spitze wählen
Stroke options|خيارات الخط|Opciones del trazo|Strichoptionen
Adjust width|ضبط السمك|Ajustar grosor|Stärke anpassen
Round tip|رأس دائري|Punta redonda|Runde Spitze
Square tip|رأس مربع|Punta cuadrada|Eckige Spitze
Precision eraser|ممحاة دقيقة|Borrador preciso|Präzisionsradierer
Whole stroke|الخط كاملًا|Trazo completo|Ganzer Strich
Choose geometry|اختيار الشكل|Elegir forma|Geometrie wählen
Arrow|سهم|Flecha|Pfeil
Add page|إضافة صفحة|Añadir página|Seite hinzufügen
Capture page|التقاط الصفحة|Capturar página|Seite erfassen
Tap to open this page|اضغط لفتح الصفحة|Pulsa para abrir esta página|Tippen, um diese Seite zu öffnen
Current page PDF|PDF الصفحة الحالية|PDF de página actual|PDF der aktuellen Seite
Entire notebook PDF|PDF الدفتر كاملًا|PDF del cuaderno completo|PDF des ganzen Notizbuchs
Editable notebook|دفتر قابل للتعديل|Cuaderno editable|Bearbeitbares Notizbuch
Recommended resolution|الدقة الموصى بها|Resolución recomendada|Empfohlene Auflösung
Download image|تنزيل الصورة|Descargar imagen|Bild herunterladen
Example of clean geometric lines and corners|مثال لخطوط وزوايا هندسية واضحة|Ejemplo de líneas y esquinas geométricas limpias|Beispiel sauberer geometrischer Linien und Ecken
Recolor|تغيير اللون|Cambiar color|Umfärben
Delete selection|حذف التحديد|Eliminar selección|Auswahl löschen
Shared quick palette|لوحة الألوان السريعة المشتركة|Paleta rápida compartida|Gemeinsame Schnellpalette
Choose another color|اختيار لون آخر|Elegir otro color|Andere Farbe wählen
Edit text|تعديل النص|Editar texto|Text bearbeiten
Show all content|عرض كل المحتوى|Mostrar todo el contenido|Alle Inhalte anzeigen
Image layering|طبقات الصورة|Capas de imagen|Bildebenen
Lock image|قفل الصورة|Bloquear imagen|Bild sperren
Crop|قص|Recortar|Zuschneiden
Apply crop|تطبيق القص|Aplicar recorte|Zuschnitt anwenden
Choose a destination|اختيار وجهة|Elegir destino|Ziel wählen
Open the folder|فتح المجلد|Abrir carpeta|Ordner öffnen
Recovery-data readiness|جاهزية بيانات الاستعادة|Disponibilidad de datos de recuperación|Bereitschaft der Wiederherstellungsdaten
PDF-copy status|حالة نسخ PDF|Estado de copias PDF|Status der PDF-Kopien
Back up with one press|النسخ بضغطة واحدة|Crear copia con una pulsación|Mit einem Klick sichern
Search filenames|البحث بأسماء الملفات|Buscar nombres de archivo|Dateinamen suchen
Verify files|التحقق من الملفات|Verificar archivos|Dateien prüfen
Show file|عرض الملف|Mostrar archivo|Datei anzeigen
Choose the synced folder|اختيار مجلد المزامنة|Elegir carpeta sincronizada|Synchronisierten Ordner wählen
Choose a recovery set|اختيار مجموعة استعادة|Elegir conjunto de recuperación|Wiederherstellungsstand wählen
Choose device and saved date|اختيار الجهاز وتاريخ الحفظ|Elegir dispositivo y fecha|Gerät und Speicherdatum wählen
Check the source device|التحقق من الجهاز المصدر|Comprobar equipo de origen|Quellgerät prüfen
Backup status beside local saving|حالة النسخ بجانب الحفظ المحلي|Estado de copia junto al guardado local|Sicherungsstatus neben lokalem Speichern
Choose one or more PDFs|اختيار ملف PDF أو أكثر|Elegir uno o varios PDF|Eine oder mehrere PDFs wählen
Start import after selecting files|بدء الاستيراد بعد اختيار الملفات|Iniciar importación tras elegir archivos|Import nach Dateiauswahl starten
Follow the stage and counts|متابعة المرحلة والأعداد|Seguir la etapa y las cantidades|Schritt und Anzahl verfolgen
Folder color tab|تبويب لون المجلد|Pestaña de color de carpeta|Ordnerfarbtab
Folder icon tab|تبويب أيقونة المجلد|Pestaña de icono de carpeta|Ordnersymboltab
Place the image into the notebook|وضع الصورة في الدفتر|Colocar imagen en el cuaderno|Bild im Notizbuch platzieren
Cancel before importing|الإلغاء قبل الاستيراد|Cancelar antes de importar|Vor dem Import abbrechen
Editable .bnote files for the source device|ملفات .bnote القابلة للتعديل للجهاز المصدر|Archivos .bnote editables del equipo de origen|Bearbeitbare .bnote-Dateien des Quellgeräts
`;
const marks=Object.fromEntries(parseRows(markRows).map(([en,...values])=>[en,Object.fromEntries(localeCodes.map((code,i)=>[code,values[i]]))]));
export function localizeFigures(figures){for(const figure of Object.values(figures)){for(const mark of figure.marks){const data=marks[mark.label.en];if(!data)throw Error('Missing figure translation: '+mark.label.en);Object.assign(mark.label,data);}for(const code of localeCodes)figure.alt[code]=figure.marks.map(m=>m.label[code]).join(' • ');}}
