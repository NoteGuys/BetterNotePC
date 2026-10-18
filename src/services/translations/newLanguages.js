// UI copy only. Column order: key | Arabic | Spanish | German.
// Shared keys keep the three catalogs in sync; no network or translation runtime.
const rows = `
externalOpenFailed|تعذر فتح الرابط. تحقق من المتصفح وحاول مجددًا.|No se pudo abrir el enlace. Revisa el navegador e inténtalo de nuevo.|Der Link lässt sich nicht öffnen. Prüfe den Browser und versuche es erneut.
backupFolderOpenTimeout|المجلد يستغرق وقتًا طويلًا للرد. تحقق من توفر محرك الأقراص وحاول مجددًا.|La carpeta tarda en responder. Comprueba que la unidad esté disponible y reintenta.|Der Ordner antwortet zu langsam. Prüfe das Laufwerk und versuche es erneut.
updateOpenReleases|فتح التنزيلات|Abrir descargas|Downloads öffnen
updateOpenFailed|تعذر فتح صفحة التحديث. تحقق من المتصفح وحاول مجددًا.|No se pudo abrir la página de actualización. Revisa el navegador y reintenta.|Die Update-Seite lässt sich nicht öffnen. Prüfe den Browser und versuche es erneut.
exportDialogPdfRestart|أغلق BetterNote وافتحه لتفعيل تصدير PDF المحدّث، ثم حاول مجددًا.|Cierra y vuelve a abrir BetterNote para activar el exportador PDF actualizado y reintenta.|Starte BetterNote neu, um den aktualisierten PDF-Export zu aktivieren, und versuche es erneut.
exportDialogPdfPrintFailed|تعذر إنشاء PDF لهذه الصفحات. لم يتغير دفتر ملاحظاتك.|No se pudo crear el PDF de estas páginas. Tu cuaderno no ha cambiado.|Für diese Seiten konnte keine PDF erstellt werden. Dein Notizbuch bleibt unverändert.
exportDialogPdfLoadFailed|تعذر فتح الصفحات لإنشاء PDF.|No se pudieron abrir las páginas para crear el PDF.|Die Seiten konnten nicht zur PDF-Erstellung geöffnet werden.
exportDialogPdfBatchTimeout|تصدير هذه الصفحات استغرق وقتًا طويلًا. أغلق التطبيقات الثقيلة وحاول مجددًا.|Estas páginas tardaron demasiado en exportarse. Cierra otras aplicaciones pesadas y reintenta.|Der Export dieser Seiten hat zu lange gedauert. Schließe andere aufwendige Apps und versuche es erneut.
exportDialogPdfTempFailed|تعذر كتابة الملف المؤقت. تحقق من المساحة المتاحة وصلاحية الوصول للمجلد.|No se pudo escribir el archivo temporal. Revisa el espacio libre y el acceso a la carpeta.|Die temporäre Datei konnte nicht geschrieben werden. Prüfe freien Speicherplatz und Ordnerzugriff.
exportDialogPdfCountFailed|عدد صفحات PDF غير مطابق. لم يتم تنزيل ملف ناقص.|El número de páginas no coincide. No se descargó ningún archivo incompleto.|Die PDF-Seitenzahl stimmt nicht überein. Es wurde keine unvollständige Datei heruntergeladen.
exportDialogPdfMergeFailed|تعذر دمج صفحات PDF. لم يتم تنزيل ملف ناقص.|No se pudieron combinar las páginas PDF. No se descargó ningún archivo incompleto.|Die PDF-Seiten konnten nicht zusammengefügt werden. Es wurde keine unvollständige Datei heruntergeladen.
exportDialogPdfPageFailed|تعذر تجهيز صفحة أو صورة. لم يتغير دفتر ملاحظاتك.|No se pudo preparar una página o imagen. Tu cuaderno no ha cambiado.|Eine Seite oder ein Bild konnte nicht vorbereitet werden. Dein Notizbuch bleibt unverändert.
exportDialogPdfExpired|انتهت جلسة التصدير. حاول مجددًا.|La sesión de exportación terminó. Inténtalo de nuevo.|Die Exportsitzung ist abgelaufen. Versuche es erneut.
exportDialogPdfBusy|يجري تصدير PDF آخر. انتظر حتى ينتهي.|Hay otra exportación PDF en curso. Espera a que termine.|Ein anderer PDF-Export läuft bereits. Warte, bis er fertig ist.
exportDialogPdfRange|الصفحات {first}–{last}.|Páginas {first}–{last}.|Seiten {first}–{last}.
exportDialogPdfPrinting|إنشاء PDF — اكتملت {page} من {total} صفحة…|Creando PDF — {page} de {total} páginas listas…|PDF wird erstellt — {page} von {total} Seiten fertig…
exportDialogPdfMerging|دمج ملف PDF والتحقق منه…|Combinando y comprobando el PDF…|PDF wird zusammengefügt und geprüft…
exportDialogPdfSaving|تجهيز تنزيل PDF…|Preparando la descarga del PDF…|PDF-Download wird vorbereitet…
driveSyncChecking|التحقق من التحديثات في Drive…|Buscando cambios en Drive…|Änderungen in Drive werden geprüft…
driveSyncReceiving|استقبال تحديثات الدفاتر…|Recibiendo cambios de los cuadernos…|Notizbuchänderungen werden empfangen…
driveSyncWaiting|توجد تحديثات بانتظارك. ارجع إلى المستندات بعد حفظ عملك.|Hay cambios pendientes. Vuelve a Documentos después de guardar.|Änderungen warten. Kehre nach dem Speichern zu Dokumente zurück.
driveSyncRestart|أعد تشغيل BetterNote لتفعيل تحديثات Drive الآمنة. النسخ الاحتياطي المحلي متاح.|Reinicia BetterNote para activar las actualizaciones seguras de Drive. La copia local sigue disponible.|Starte BetterNote für sichere Drive-Updates neu. Lokale Sicherungen bleiben verfügbar.
driveSyncPending|بانتظار نسخة Drive كاملة وقابلة للقراءة. ملاحظاتك المحلية محفوظة.|Esperando una copia de Drive completa y legible. Tus notas locales se conservan.|Warten auf eine vollständige, lesbare Drive-Sicherung. Deine lokalen Notizen bleiben erhalten.
driveSyncReceived|تم تحديث {count} دفتر من Drive.|Se actualizaron {count} cuadernos desde Drive.|{count} Notizbücher aus Drive aktualisiert.
driveSyncConflicts|تم الاحتفاظ بنسختَي {count} دفتر. تظهر نسخ هذا الجهاز في المستندات.|Se conservaron ambas versiones de {count} cuadernos. Las copias de este dispositivo aparecen en Documentos.|Beide Versionen von {count} Notizbüchern wurden behalten. Kopien dieses Geräts findest du unter Dokumente.
driveSyncLegacy|للنسخ القديمة، استعد النسخة أولًا ثم اختر مجلد Drive جديدًا وفارغًا لتفعيل التحديثات التلقائية.|Para una copia antigua, restáurala primero y elige una carpeta de Drive nueva y vacía para activar los cambios automáticos.|Stelle eine ältere Sicherung zuerst wieder her. Wähle dann einen neuen, leeren Drive-Ordner für automatische Updates.
driveSyncCopyLabel|نسخة من هذا الجهاز|Copia de este dispositivo|Kopie von diesem Gerät
backupRecoveryRetiredEntries|تمت استعادة النسخة الحالية وتخطي {count} إدخال قديم غير موجود في أحدث نسخة.|Se restauró la copia actual. Se omitieron {count} entradas antiguas que ya no figuran en la última copia.|Aktuelle Sicherung wiederhergestellt. {count} veraltete Einträge fehlen in der neuesten Sicherung und wurden übersprungen.
backupRecoveryMissingFolders|تمت استعادة {count} دفتر إلى المستندات لأن مجلداتها السابقة لم تعد موجودة. تم الاحتفاظ بكل المحتوى.|Se restauraron {count} cuadernos en Documentos porque sus carpetas ya no existen. Se conservó todo su contenido.|{count} Notizbücher wurden unter Dokumente wiederhergestellt, da ihre alten Ordner fehlen. Alle Inhalte wurden behalten.
backupRecoveryUnconfirmed|تعذر تأكيد الاستعادة. أعد فتح BetterNote وتحقق من الدفاتر قبل المحاولة مجددًا.|No se pudo confirmar la restauración. Reabre BetterNote y revisa los cuadernos antes de reintentar.|Die Wiederherstellung konnte nicht bestätigt werden. Öffne BetterNote erneut und prüfe die Notizbücher vor einem neuen Versuch.
backupRecoveryWaiting|إكمال الحفظ المحلي قبل الاستعادة…|Terminando el guardado local antes de restaurar…|Lokales Speichern vor der Wiederherstellung wird abgeschlossen…
backupRecoveryChecking|التحقق من النسخة الاحتياطية الكاملة…|Comprobando la copia completa…|Vollständige Sicherung wird geprüft…
backupRecoveryWriting|استعادة الدفاتر بأمان…|Restaurando los cuadernos de forma segura…|Notizbücher werden sicher wiederhergestellt…
backupRecoveryRefreshing|تحديث قائمة دفاترك…|Actualizando la lista de cuadernos…|Notizbuchliste wird aktualisiert…
backupRestoreValidating|التحقق من بنية النسخة الاحتياطية…|Comprobando la estructura de la copia…|Struktur der Sicherung wird geprüft…
backupRestoreOpening|بانتظار فتح ملف النسخة المحدد…|Esperando a que se abra la copia seleccionada…|Warten auf das Öffnen der gewählten Sicherungsdatei…
backupRestoreReading|قراءة النسخة: {done} / {size} MB|Leyendo copia: {done} / {size} MB|Sicherung wird gelesen: {done} / {size} MB
backupRestoreChecking|التحقق من الدفاتر: {current} / {total}|Comprobando cuadernos: {current} / {total}|Notizbücher werden geprüft: {current} / {total}
backupRestorePlanning|تجهيز الدفاتر: {current} / {total}|Preparando cuadernos: {current} / {total}|Notizbücher werden vorbereitet: {current} / {total}
backupRecoveryKeepOpen|أبقِ BetterNote مفتوحًا حتى تنتهي الاستعادة.|Mantén BetterNote abierto hasta que termine la restauración.|Lass BetterNote geöffnet, bis die Wiederherstellung fertig ist.
backupRecoveryBusy|الاستعادة جارية بالفعل. انتظر حتى تنتهي.|Ya hay una restauración en curso. Espera a que termine.|Eine Wiederherstellung läuft bereits. Warte, bis sie fertig ist.
backupRecoveryEditorOpen|ارجع إلى المستندات قبل استعادة نسخة احتياطية.|Vuelve a Documentos antes de restaurar una copia.|Kehre vor der Wiederherstellung zu Dokumente zurück.
backupRecoveryUnsaved|تعذر حفظ بعض التغييرات المحلية. حاول حفظها قبل الاستعادة. لم يتم استيراد شيء.|No se guardaron algunos cambios locales. Reintenta guardarlos antes de restaurar. No se importó nada.|Einige lokale Änderungen konnten nicht gespeichert werden. Speichere erneut, bevor du wiederherstellst. Es wurde nichts importiert.
backupRecoveryWriteFailed|تعذر إكمال الاستعادة. تم الاحتفاظ ببياناتك المحلية السابقة. تحقق من المساحة وحاول مجددًا.|No se pudo completar la restauración. Se conservaron tus datos locales anteriores. Revisa el espacio libre y reintenta.|Die Wiederherstellung konnte nicht abgeschlossen werden. Deine bisherigen lokalen Daten bleiben erhalten. Prüfe freien Speicherplatz und versuche es erneut.
backupRecoveryIdConflict|معرّف صفحة يخص دفترًا آخر. لم يتم استيراد شيء؛ احتفظ بالنسخة للمراجعة.|Un ID de página pertenece a otro cuaderno. No se importó nada; conserva la copia para revisarla.|Eine Seiten-ID gehört zu einem anderen Notizbuch. Es wurde nichts importiert. Bewahre die Sicherung zur Prüfung auf.
backupRecoveryRefreshFailed|تمت استعادة الدفاتر لكن تعذر تحديث القائمة. أعد فتح BetterNote لعرضها.|Los cuadernos se restauraron, pero la lista no se actualizó. Reabre BetterNote para verlos.|Die Notizbücher wurden wiederhergestellt, die Liste konnte aber nicht aktualisiert werden. Öffne BetterNote erneut.
backupReadNotFound|لم يتم العثور على بيانات استعادة في المجلد المحدد.|No se encontraron datos de recuperación en esa carpeta.|Im gewählten Ordner wurden keine Wiederherstellungsdaten gefunden.
backupReadIncomplete|ملفات النسخة ناقصة أو غير متطابقة بعد. انتظر اكتمال النسخ أو مزامنة المجلد ثم حاول مجددًا. لم يتم استيراد شيء.|Faltan archivos o aún no coinciden. Espera a que termine la copia o la sincronización y reintenta. No se importó nada.|Sicherungsdateien fehlen oder passen noch nicht zusammen. Warte auf das Ende der Sicherung oder Ordnersynchronisierung. Es wurde nichts importiert.
backupReadConflict|توجد نسخ احتياطية متعارضة. احتفظ بالملفات للمراجعة؛ لم يتم استيراد شيء.|Hay versiones en conflicto. Conserva los archivos para revisarlos; no se importó nada.|Sicherungsversionen stehen im Konflikt. Bewahre die Dateien zur Prüfung auf. Es wurde nichts importiert.
backupReadChanged|تغيرت النسخة أثناء التحقق. انتظر اكتمال المزامنة وحاول مجددًا.|La copia cambió durante la comprobación. Espera a que termine la sincronización y reintenta.|Die Sicherung hat sich während der Prüfung geändert. Warte auf das Ende der Synchronisierung und versuche es erneut.
backupReadTimeout|لم يستجب مجلد النسخ في الوقت المحدد. تحقق من فتح ملفاته؛ في Google Drive اجعلها متاحة بلا إنترنت ثم حاول مجددًا.|La carpeta no respondió a tiempo. Comprueba que sus archivos se abran; en Google Drive, hazlos disponibles sin conexión y reintenta.|Der Sicherungsordner hat nicht rechtzeitig geantwortet. Prüfe, ob sich die Dateien öffnen lassen. Mache Drive-Dateien offline verfügbar und versuche es erneut.
backupReadChooseFolder|تم العثور على عدة مجلدات نسخ. اختر مجلد الاستعادة في النسخ والمزامنة.|Se encontraron varias carpetas de copias. Elige cuál restaurar en Copias y sincronización.|Mehrere Sicherungsordner gefunden. Wähle den gewünschten Ordner unter Sicherung & Synchronisierung.
backupReadTooLarge|تتجاوز هذه النسخة حد القراءة الآمن. لم يتم استيراد شيء.|Esta copia supera el límite de lectura segura. No se importó nada.|Diese Sicherung überschreitet die sichere Lesegrenze. Es wurde nichts importiert.
backupReadBusy|يجري التحقق من نسخة أخرى. انتظر قليلًا وحاول مجددًا.|Se está comprobando otra copia. Espera un momento y reintenta.|Eine andere Sicherung wird gerade geprüft. Warte kurz und versuche es erneut.
backupReadInvalid|بيانات النسخة غير صالحة أو تالفة. احتفظ بالملفات الأصلية؛ لم يتم استيراد شيء.|La copia no es válida o está dañada. Conserva los originales; no se importó nada.|Die Sicherung ist ungültig oder beschädigt. Bewahre die Originaldateien auf. Es wurde nichts importiert.
backupReadUnavailable|تعذر قراءة مجلد النسخ المحدد. تحقق من موقعه وإمكانية الوصول ثم حاول مجددًا.|No se pudo leer la carpeta elegida. Revisa su ubicación y acceso y reintenta.|Der gewählte Sicherungsordner konnte nicht gelesen werden. Prüfe Ort und Zugriff und versuche es erneut.
backupReadRestoring|التحقق من ملفات النسخة قبل الاستعادة…|Comprobando los archivos antes de restaurar…|Sicherungsdateien werden vor der Wiederherstellung geprüft…
backupReadRestored|تمت استعادة {count} دفتر.|Se restauraron {count} cuadernos.|{count} Notizbücher wiederhergestellt.
backupRestorePreviousConfirm|أحدث نسخة غير جاهزة. توجد نسخة سابقة تم التحقق منها بتاريخ {date}. هل تريد استعادتها؟ سيتم الاحتفاظ بالكتابة المحلية المختلفة في نسخة منفصلة.|La última copia no está lista. Hay una copia anterior verificada del {date}. ¿Restaurarla? Los trazos locales distintos se conservarán en una copia aparte.|Die neueste Sicherung ist nicht bereit. Eine geprüfte frühere Sicherung vom {date} ist verfügbar. Wiederherstellen? Abweichende lokale Notizen bleiben als separate Kopie erhalten.
backupRestoreCancelled|أُلغيت الاستعادة. لم يتم استيراد شيء.|Restauración cancelada. No se importó nada.|Wiederherstellung abgebrochen. Es wurde nichts importiert.
cloudRestoreFailed|تعذرت الاستعادة: {reason}|No se pudo restaurar: {reason}|Wiederherstellung fehlgeschlagen: {reason}
cloudRestoreError|تعذرت الاستعادة: {error}|No se pudo restaurar: {error}|Wiederherstellung fehlgeschlagen: {error}
backupFolderNewer|تحتوي النسخة على معلومات مجلدات أحدث. استعدها قبل التجهيز مجددًا. تم الاحتفاظ بالملفات الحالية.|La copia tiene información de carpetas más reciente. Restáurala antes de prepararla de nuevo. Se conservaron los archivos.|Die Sicherung enthält neuere Ordnerdaten. Stelle sie vor dem erneuten Vorbereiten wieder her. Vorhandene Dateien wurden behalten.
backupConflictPdfBlocked|بانتظار مراجعة الدفتر|Esperando revisión del cuaderno|Warten auf Notizbuchprüfung
backupConflictTitle|دفاتر تحتاج إلى مراجعة|Cuadernos que necesitan revisión|Notizbücher zur Prüfung
backupConflictNewer|توجد نسخة أحدث بالفعل. تم الاحتفاظ بالملف الحالي.|Ya existe una copia más reciente. Se conservó el archivo existente.|Es gibt bereits eine neuere Sicherung. Die vorhandene Datei wurde behalten.
backupConflictEqual|وقت التعديل متطابق لكن المحتوى مختلف. تم الاحتفاظ بالنسخة الحالية.|Las fechas de edición coinciden, pero el contenido difiere. Se conservó la copia existente.|Die Änderungszeiten stimmen überein, die Inhalte unterscheiden sich. Die vorhandene Sicherung wurde behalten.
backupConflictHereTime|آخر تعديل على هذا الجهاز|Última edición en este dispositivo|Letzte Änderung auf diesem Gerät
backupConflictFolderTime|آخر تعديل في النسخة|Última edición en la copia|Letzte Änderung in der Sicherung
backupConflictHelp|لنسخ هذا الجهاز بشكل منفصل، اختر مجلدًا جديدًا وفارغًا. احتفظ بالمجلد الحالي حتى تقرر أي نسخة تستخدم.|Para guardar este dispositivo por separado, elige una carpeta nueva y vacía. Conserva la actual hasta decidir qué versión usar.|Wähle einen neuen, leeren Ordner, um dieses Gerät separat zu sichern. Behalte den aktuellen Ordner, bis du dich für eine Version entschieden hast.
backupConflictFile|تم الاحتفاظ بالنسخة الحالية|Copia existente conservada|Vorhandene Sicherung behalten
backupConflictNotice|بعض الدفاتر تحتاج إلى مراجعة. راجع التفاصيل أدناه؛ تم الاحتفاظ بالنسخ المتعارضة.|Algunos cuadernos necesitan revisión. Mira los detalles; se conservaron las copias en conflicto.|Einige Notizbücher müssen geprüft werden. Details stehen unten. Sicherungen mit Konflikten wurden behalten.
backupHubTitle|النسخ والمزامنة|Copias y sincronización|Sicherung & Synchronisierung
driveDesktopConnectAction|ربط Google Drive|Conectar Google Drive|Google Drive verbinden
driveDesktopOpening|فتح Drive…|Abriendo Drive…|Drive wird geöffnet…
driveDesktopOpened|Google Drive مفتوح. سجّل الدخول أو اختر حسابك هناك، ثم ارجع لاختيار مجلد المزامنة. إذا كان متصلًا بالفعل، استخدم اختيار مجلد Drive.|Google Drive está abierto. Inicia sesión o elige tu cuenta allí y vuelve para elegir la carpeta de sincronización. Si ya está conectado, usa Elegir carpeta de Drive.|Google Drive ist geöffnet. Melde dich dort an oder wähle dein Konto. Kehre dann zur Ordnerauswahl zurück. Bei bestehender Verbindung nutze Drive-Ordner wählen.
driveRecommended|موصى به|Recomendado|Empfohlen
driveComingSoon|قريبًا|Próximamente|Demnächst
driveDirectUnavailable|الربط المباشر غير متاح بعد. استخدم Google Drive للكمبيوتر.|La conexión directa aún no está disponible. Usa Google Drive para ordenadores.|Die direkte Verbindung ist noch nicht verfügbar. Nutze Google Drive für den Desktop.
driveSetupInstall|ثبّت Google Drive للكمبيوتر وسجّل الدخول. افتحه إذا كان مثبتًا.|Instala Google Drive para ordenadores e inicia sesión. Si ya está instalado, ábrelo.|Installiere Google Drive für den Desktop und melde dich an. Öffne es, falls es schon installiert ist.
driveSetupFolder|اختر مجلدًا يزامنه تطبيق Drive.|Elige una carpeta que sincronice la aplicación Drive.|Wähle einen Ordner, den die Drive-App synchronisiert.
driveSetupVerify|جهّز الملفات ثم تحقق من تقدم الرفع في تطبيق Drive.|Prepara los archivos y revisa la subida en Drive.|Bereite die Dateien vor und prüfe den Upload in Drive.
driveDownloadOfficial|تنزيل من Google|Descargar de Google|Bei Google herunterladen
driveDesktopMissing|لم يتم العثور على Google Drive للكمبيوتر. ثبّته من رابط التنزيل الرسمي أعلاه.|No se encontró Google Drive para ordenadores. Instálalo desde el enlace oficial de arriba.|Google Drive für den Desktop wurde nicht gefunden. Installiere es über den offiziellen Link oben.
driveDesktopOpenFailed|تعذر فتح Google Drive. افتحه من قائمة ابدأ في Windows ثم ارجع لاختيار مجلده.|No se pudo abrir Google Drive. Ábrelo desde Inicio de Windows y vuelve para elegir su carpeta.|Google Drive konnte nicht geöffnet werden. Öffne es im Windows-Startmenü und kehre zur Ordnerauswahl zurück.
driveDirectSetupNeeded|لم يتم إعداد الربط المباشر بـ Google Drive لهذا الإصدار. يمكنك استخدام Google Drive للكمبيوتر.|La conexión directa con Google Drive aún no está configurada en esta versión. Puedes usar Google Drive para ordenadores.|Die direkte Google-Drive-Verbindung ist in dieser Version noch nicht eingerichtet. Google Drive für den Desktop ist verfügbar.
driveConnectionCancelled|أُلغي الربط بـ Google. يمكنك المحاولة مجددًا.|Se canceló la conexión con Google. Puedes reintentar.|Google-Verbindung abgebrochen. Du kannst es erneut versuchen.
driveConnectionTimedOut|لم يكتمل تسجيل الدخول في الوقت المحدد. أغلق علامة التبويب القديمة وحاول مجددًا.|El inicio de sesión tardó demasiado. Cierra la pestaña anterior y reintenta.|Die Google-Anmeldung hat zu lange gedauert. Schließe den alten Anmeldetab und versuche es erneut.
backupHubSubtitle|إدارة النسخ على جهازك وGoogle Drive في مكان واحد.|Gestiona las copias de tu dispositivo y Google Drive en un solo lugar.|Verwalte Gerätesicherungen und Google Drive an einem Ort.
backupLocalTab|نسخة محلية|Copia local|Lokale Sicherung
backupDriveTab|Google Drive|Google Drive|Google Drive
backupLocalCurrent|تم نسخ الملاحظات المحفوظة|Notas guardadas con copia|Gespeicherte Notizen gesichert
backupRecoveryData|بيانات الاستعادة|Datos de recuperación|Wiederherstellungsdaten
backupPdfCopies|نسخ PDF|Copias PDF|PDF-Kopien
backupLocalFolder|مجلد النسخ المحلي|Carpeta de copias local|Lokaler Sicherungsordner
backupChooseFolder|تغيير المجلد|Cambiar carpeta|Ordner ändern
backupLocalFolderHelp|استخدم مجلد نسخ محليًا واحدًا. تبقى النسخ السابقة عند تغييره.|Usa una carpeta local para las copias. Al cambiarla, las copias anteriores se conservan.|Verwende einen lokalen Sicherungsordner. Beim Wechsel bleiben frühere Sicherungen erhalten.
backupShowPath|عرض مسار المجلد|Mostrar ruta de la carpeta|Ordnerpfad anzeigen
backupTotalSize|حجم النسخة|Tamaño de la copia|Sicherungsgröße
backupSavedNotebooks|الدفاتر على هذا الجهاز|Cuadernos en este dispositivo|Notizbücher auf diesem Gerät
backupStoredFiles|ملفات النسخ|Archivos de copia|Sicherungsdateien
backupLastDataBackup|آخر نسخة بيانات مكتملة|Última copia de datos completa|Letzte vollständige Datensicherung
backupCompletionTimeUnknown|وقت الإكمال غير مسجل|Hora de finalización no registrada|Abschlusszeit nicht erfasst
backupNowAction|نسخ احتياطي الآن|Crear copia ahora|Jetzt sichern
backupVerifyAction|التحقق من ملفات النسخة|Verificar archivos de copia|Sicherungsdateien prüfen
backupViewOlder|تضمين النسخ السابقة|Incluir copias anteriores|Frühere Sicherungen anzeigen
backupRefreshAction|تحديث قائمة الملفات|Actualizar lista de archivos|Dateiliste aktualisieren
backupRetryPdf|إعادة محاولة PDF|Reintentar PDF|PDF erneut versuchen
backupFilesTitle|الملفات في هذه النسخة|Archivos de esta copia|Dateien in dieser Sicherung
backupFileType|النوع|Tipo|Typ
backupFileEditable|دفتر قابل للتعديل|Cuaderno editable|Bearbeitbares Notizbuch
backupFilePdf|نسخة PDF|Copia PDF|PDF-Kopie
backupFileFull|نسخة كاملة للمكتبة|Copia de toda la biblioteca|Sicherung der ganzen Bibliothek
backupFileName|دفتر / ملف|Cuaderno / archivo|Notizbuch / Datei
backupFileSize|الحجم|Tamaño|Größe
backupFileTime|وقت النسخ|Fecha de copia|Gesichert am
backupFileState|الحالة|Estado|Status
backupFileOpen|عرض الملف|Mostrar archivo|Datei anzeigen
backupFileCurrent|الإصدار الحالي|Versión actual|Aktuelle Version
backupFileStored|نسخة محفوظة|Copia guardada|Gespeicherte Sicherung
backupFileOld|نسخة سابقة|Copia anterior|Frühere Sicherung
backupProgressWaitingSave|بانتظار إكمال الحفظ المحلي…|Esperando a que termine el guardado local…|Warten auf lokales Speichern…
backupProgressChecking|التحقق من النسخ الموجودة…|Comprobando copias existentes…|Vorhandene Sicherungen werden geprüft…
backupProgressSavingData|نسخ بيانات الاستعادة…|Guardando datos de recuperación…|Wiederherstellungsdaten werden gesichert…
backupProgressSavingFull|حفظ نسخة المكتبة الكاملة…|Guardando la copia de toda la biblioteca…|Vollständige Bibliothekssicherung wird gespeichert…
backupProgressVerifying|التحقق من الملف المكتوب…|Verificando el archivo guardado…|Geschriebene Datei wird geprüft…
backupProgressKeepingVersion|الاحتفاظ بالإصدار السابق…|Conservando la versión anterior…|Vorherige Version wird behalten…
backupProgressCount|{done} من {total} دفتر|{done} de {total} cuadernos|{done} von {total} Notizbüchern
backupPdfProgress|{name} · صفحة {page}/{totalPages}|{name} · página {page}/{totalPages}|{name} · Seite {page}/{totalPages}
backupPdfBackground|تجهيز نسخ PDF…|Preparando copias PDF…|PDF-Kopien werden vorbereitet…
backupPdfReuseProgress|إعادة استخدام {reused} صفحة · إنشاء {rendered} صفحة|{reused} páginas reutilizadas · {rendered} creadas|{reused} Seiten wiederverwendet · {rendered} erstellt
backupChooseRecoverySource|اختر نسخة لاستعادتها|Elige una copia para restaurar|Sicherung zum Wiederherstellen wählen
backupMigrationHint|توجد نسخ هنا. افتح النسخ والمزامنة لاختيار الجهاز والنسخة التي تريد استعادتها.|Hay copias aquí. Abre Copias y sincronización para elegir el equipo y la copia a restaurar.|Hier sind Sicherungen verfügbar. Öffne Sicherung & Synchronisierung, um Computer und Sicherung auszuwählen.
backupPerDeviceHelp|لكل كمبيوتر نسخته الخاصة هنا. تتم الاستعادة فقط عندما تختارها.|Cada equipo guarda su propia copia aquí. Solo se restaura cuando lo eliges.|Jeder Computer speichert hier seine eigene Sicherung. Wiederhergestellt wird nur auf deine Auswahl hin.
backupThisDevice|هذا الكمبيوتر|Este equipo|Dieser Computer
backupLegacySource|نسخة مشتركة سابقة|Copia compartida anterior|Frühere gemeinsame Sicherung
backupRestoreManualHelp|اختر الكمبيوتر وتاريخ الحفظ. يتم الاحتفاظ بالعمل الحالي إذا كان مختلفًا. لا يُستورد شيء حتى تضغط استعادة.|Elige el equipo y la fecha. Se conserva el trabajo existente si es diferente. No se importa nada hasta pulsar Restaurar.|Wähle Computer und Speicherdatum. Abweichende vorhandene Arbeit bleibt erhalten. Erst mit Wiederherstellen wird importiert.
backupAccessDenied|تعذر الوصول لمجلد النسخ. تحقق من الصلاحيات أو اختر مجلدًا آخر.|No se puede acceder a la carpeta. Revisa sus permisos o elige otra.|Kein Zugriff auf den Sicherungsordner. Prüfe die Berechtigungen oder wähle einen anderen.
backupDiskFull|محرك النسخ ممتلئ. أفرغ مساحة أو اختر مجلدًا آخر.|La unidad de copias está llena. Libera espacio o elige otra carpeta.|Das Sicherungslaufwerk ist voll. Schaffe Platz oder wähle einen anderen Ordner.
backupDestinationMissing|موقع النسخ غير متاح. أعد توصيل المحرك أو اختر مجلدًا آخر.|El destino no está disponible. Reconecta la unidad o elige otra carpeta.|Der Sicherungsort ist nicht verfügbar. Verbinde das Laufwerk erneut oder wähle einen anderen Ordner.
backupPdfWaiting|PDF قيد الانتظار|PDF pendiente|PDF ausstehend
backupPdfFailed|PDF يحتاج إلى مراجعة|PDF requiere atención|PDF muss geprüft werden
backupPdfProblemImage|تعذر قراءة صورة لهذا PDF. ما زالت نسخة الدفتر القابلة للتعديل محفوظة.|No se pudo leer una imagen para este PDF. El cuaderno editable sí tiene copia.|Ein Bild für diese PDF konnte nicht gelesen werden. Das bearbeitbare Notizbuch ist weiterhin gesichert.
backupPdfProblemGeneric|لم يكتمل هذا PDF. أعد المحاولة لهذا الدفتر.|Este PDF no se completó. Reintenta este cuaderno.|Diese PDF wurde nicht fertig. Versuche es für dieses Notizbuch erneut.
backupDataCompletePdfPending|تم نسخ بيانات الاستعادة. تُجهّز نسخ PDF بشكل منفصل.|Los datos de recuperación están copiados. Los PDF se preparan por separado.|Wiederherstellungsdaten sind gesichert. PDF-Kopien werden separat vorbereitet.
backupFolderChangeSuccess|تم تحديث مجلد النسخ. تم الاحتفاظ بالملفات السابقة.|Carpeta actualizada. Se conservaron los archivos anteriores.|Sicherungsordner aktualisiert. Frühere Dateien wurden behalten.
backupActionFailed|تعذر إكمال العملية. تحقق من المجلد وحاول مجددًا.|No se pudo completar la acción. Revisa la carpeta y reintenta.|Die Aktion konnte nicht abgeschlossen werden. Prüfe den Ordner und versuche es erneut.
backupNoFiles|لا توجد ملفات نسخ في القائمة بعد.|Aún no hay archivos de copia en la lista.|Noch keine Sicherungsdateien aufgelistet.
backupInspecting|التحقق من الملفات…|Comprobando archivos…|Dateien werden geprüft…
driveMethod|طريقة الربط|Método de conexión|Verbindungsmethode
driveMethodDirect|حساب Google|Cuenta de Google|Google-Konto
driveMethodDesktop|Google Drive للكمبيوتر|Google Drive para ordenadores|Google Drive für den Desktop
driveMethodDirectHelp|اربط حساب Google. تظهر النسخة السحابية فقط عندما تؤكدها Google.|Conecta tu cuenta de Google. La copia en la nube solo se muestra cuando Google la confirma.|Verbinde dein Google-Konto. Cloud-Sicherungen werden erst nach Googles Bestätigung angezeigt.
driveMethodDesktopHelp|اختر المجلد الذي يزامنه Drive. تجهيز المجلد والرفع للسحابة لهما حالتان منفصلتان.|Elige la carpeta que sincroniza Drive. La preparación y la subida a la nube tienen estados separados.|Wähle den von Drive synchronisierten Ordner. Ordnervorbereitung und Cloud-Upload haben getrennte Statusanzeigen.
driveAccount|حساب Google|Cuenta de Google|Google-Konto
driveNotConnected|غير متصل|Sin conectar|Nicht verbunden
driveConnectedAccount|تم تأكيد اتصال الحساب|Conexión de cuenta confirmada|Kontoverbindung bestätigt
driveConnectAction|ربط عبر Google|Conectar con Google|Mit Google verbinden
driveDisconnectAction|فصل الحساب|Desconectar cuenta|Konto trennen
driveConnectionFailed|تعذر تأكيد اتصال Google. حاول مجددًا أو استخدم Drive للكمبيوتر.|No se pudo confirmar la conexión. Reintenta o usa Drive para ordenadores.|Google-Verbindung konnte nicht bestätigt werden. Versuche es erneut oder nutze Drive für den Desktop.
driveFolderNotSelected|لم يتم اختيار مجلد Drive|No hay carpeta de Drive seleccionada|Kein Drive-Ordner ausgewählt
driveDesktopChooseFolder|اختيار مجلد مزامنة Drive|Elegir carpeta de Drive|Drive-Ordner wählen
driveDesktopWriteAction|تجهيز الملفات لـ Drive|Preparar archivos para Drive|Dateien für Drive vorbereiten
driveCloudUnconfirmed|لم يؤكد BetterNote الرفع إلى السحابة.|BetterNote no ha confirmado la subida a la nube.|BetterNote hat den Cloud-Upload nicht bestätigt.
driveNoConfirmedUploads|لا توجد عمليات رفع سحابية مؤكدة بعد.|Aún no hay subidas a la nube confirmadas.|Noch keine bestätigten Cloud-Uploads.
driveOpenWeb|فتح Google Drive|Abrir Google Drive|Google Drive öffnen
driveDesktopPreparationTitle|الملفات المجهّزة لتطبيق Drive|Archivos preparados para Drive|Für Drive vorbereitete Dateien
driveUploadedTitle|نسخ سحابية مؤكدة|Copias en la nube confirmadas|Bestätigte Cloud-Sicherungen
driveCloudLastConfirmed|آخر رفع سحابي مؤكد|Última subida confirmada|Letzter bestätigter Cloud-Upload
driveFolderPath|مجلد مزامنة Drive|Carpeta de sincronización de Drive|Drive-Synchronisierungsordner
driveFolderSelected|تم اختيار مجلد Drive|Carpeta de Drive seleccionada|Drive-Ordner ausgewählt
driveConnecting|تأكيد اتصال Google…|Confirmando conexión con Google…|Google-Verbindung wird bestätigt…
drivePreparationHint|يتحقق BetterNote من الملفات في هذا المجلد. تحقق من المزامنة السحابية في تطبيق Drive.|BetterNote verifica los archivos de esta carpeta. Revisa la sincronización con la nube en Drive.|BetterNote prüft die Dateien in diesem Ordner. Prüfe die Cloud-Synchronisierung in der Drive-App.
backupFullLabel|لقطة كاملة للمكتبة|Copia completa de la biblioteca|Vollständiger Bibliotheksstand
backupStateUnknown|لم يتم فحص النسخ|Copia sin comprobar|Sicherung nicht geprüft
backupStatePending|نسخ قيد الانتظار|Copia pendiente|Sicherung ausstehend
backupStateWorking|جارٍ النسخ…|Creando copia…|Sicherung läuft…
backupStatePartial|نسخة غير مكتملة|Copia incompleta|Sicherung unvollständig
backupStateError|النسخ يحتاج إلى مراجعة|La copia requiere atención|Sicherung muss geprüft werden
backupStateEmpty|لا توجد ملاحظات لنسخها|No hay notas para copiar|Keine Notizen zum Sichern
backupDriveFolderCurrent|مجلد Drive محدّث|Carpeta de Drive actualizada|Drive-Ordner aktuell
backupFolderCurrent|نسخة المجلد محدّثة|Copia de carpeta actualizada|Ordnersicherung aktuell
backupStatusHint|الحفظ المحلي ونسخ المجلد لهما حالتان منفصلتان. اضغط لعرض الوجهات المؤكدة وأحدث النسخ.|El guardado local y la copia tienen estados distintos. Pulsa para ver destinos confirmados y últimas versiones.|Lokales Speichern und Ordnersicherung haben getrennte Statusanzeigen. Klicke für bestätigte Ziele und neueste Versionen.
backupOpenDetails|عرض تفاصيل النسخ|Ver detalles de la copia|Sicherungsdetails anzeigen
backupFolderOnlyHint|تؤكد هذه النتائج كتابة الملفات في المجلدات. لا يتحقق BetterNote من رفعها إلى السحابة.|Estos resultados confirman archivos guardados en carpetas. BetterNote no verifica la subida a la nube.|Diese Ergebnisse bestätigen Dateien in Ordnern. BetterNote prüft den Cloud-Upload nicht.
backupDestinations|وجهات النسخ|Destinos de copia|Sicherungsziele
backupTargetLocal|مجلد النسخ المحلي|Carpeta de copia local|Lokaler Sicherungsordner
backupTargetDrive|مجلد Google Drive|Carpeta de Google Drive|Google-Drive-Ordner
backupTargetSelected|مجلد النسخ المحدد|Carpeta de copia elegida|Gewählter Sicherungsordner
backupEditableLabel|ملاحظات قابلة للتعديل|Notas editables|Bearbeitbare Notizen
backupPdfLabel|مستندات PDF|Documentos PDF|PDF-Dokumente
backupLastCompleted|آخر نسخة مكتملة|Última copia completa|Letzte vollständige Sicherung
backupNever|لا توجد نسخة مؤكدة بعد|Aún no hay copia confirmada|Noch keine bestätigte Sicherung
backupVersionCurrent|أحدث عمل تم نسخه|Últimos cambios con copia|Neueste Arbeit gesichert
backupProblemDestination|تعذرت الكتابة في المجلد. تحقق من الاتصال والمساحة والصلاحيات ثم حاول مجددًا.|No se pudo escribir en la carpeta. Revisa conexión, espacio y permisos y reintenta.|In den Ordner konnte nicht geschrieben werden. Prüfe Verbindung, Speicherplatz und Berechtigungen und versuche es erneut.
backupProblemNewer|الوجهة تحتوي على بيانات أحدث أو متعارضة. تم الاحتفاظ بنسختها الحالية.|El destino tiene datos más recientes o en conflicto. Se conservó su copia existente.|Das Ziel enthält neuere oder widersprüchliche Daten. Die vorhandene Sicherung wurde behalten.
backupProblemDamaged|تعذر التحقق من النسخة الحالية وتم الاحتفاظ بها. اختر مجلدًا آخر لإنشاء نسخة جديدة.|No se pudo verificar la copia existente y se conservó. Elige otra carpeta para crear una nueva.|Die vorhandene Sicherung konnte nicht geprüft werden und wurde behalten. Wähle für eine neue Sicherung einen anderen Ordner.
backupProblemGeneric|لم يكتمل النسخ. حاول مجددًا أو اختر مجلدًا آخر.|La copia no se completó. Reintenta o elige otra carpeta.|Die Sicherung wurde nicht abgeschlossen. Versuche es erneut oder wähle einen anderen Ordner.
backupPartialNotice|بعض ملفات النسخ ما زالت قيد الانتظار. افتح نتائج الوجهات أدناه للتفاصيل.|Quedan archivos pendientes. Abre los resultados de los destinos para ver detalles.|Einige Sicherungsdateien stehen noch aus. Öffne die Zielergebnisse unten für Details.
backupRetry|إعادة محاولة النسخ|Reintentar copia|Sicherung erneut versuchen
coverThumbnail|صورة مصغرة|Miniatura|Vorschaubild
coverThumbnailDescription|معاينة الصفحة الأولى · الافتراضي|Vista de la primera página · por defecto|Vorschau der ersten Seite · Standard
coverThumbnailAlt|الصفحة الأولى من {name}|Primera página de {name}|Erste Seite von {name}
notebookCopySuffix|نسخة|Copia|Kopie
shareAction|مشاركة…|Compartir…|Teilen…
copyLinkAction|نسخ الرابط|Copiar enlace|Link kopieren
duplicateNotebookNotFound|لم يتم العثور على الدفتر المطلوب تكراره.|No se encontró el cuaderno que quieres duplicar.|Das zu duplizierende Notizbuch wurde nicht gefunden.
localSaveSaved|محفوظ على هذا الجهاز|Guardado en este dispositivo|Auf diesem Gerät gespeichert
localSaveSaving|جارٍ الحفظ…|Guardando…|Wird gespeichert…
localSaveFailed|لم يُحفظ بعد|Aún sin guardar|Noch nicht gespeichert
localSaveDeviceHint|حالة الحفظ المحلي. لنسخ Google Drive حالة منفصلة.|Estado del guardado local. La copia de Google Drive tiene su propio estado.|Lokaler Speicherstatus. Die Google-Drive-Sicherung hat einen eigenen Status.
localSaveFailedHint|آخر تعديلاتك موجودة في التطبيق المفتوح. أعد محاولة الحفظ قبل إغلاقه.|Tus últimos cambios siguen en esta aplicación abierta. Reintenta guardar antes de cerrarla.|Deine letzten Änderungen bleiben in der geöffneten App. Speichere erneut, bevor du sie schließt.
localSaveRetry|إعادة محاولة الحفظ|Reintentar guardado|Speichern wiederholen
localSaveClosing|حفظ عملك قبل الإغلاق…|Guardando antes de cerrar…|Deine Arbeit wird vor dem Schließen gespeichert…
localSaveCloseFailed|لم يكتمل الحفظ. سيبقى BetterNote مفتوحًا لحماية عملك.|El guardado no ha terminado. BetterNote seguirá abierto para proteger tu trabajo.|Das Speichern ist noch nicht fertig. BetterNote bleibt zum Schutz deiner Arbeit geöffnet.
localSaveKeepOpen|إبقاء التطبيق مفتوحًا|Mantener abierto|Geöffnet lassen
localSavePageChangeFailed|تعذر تغيير الصفحات. تم الاحتفاظ بصفحاتك الحالية. أعد محاولة الحفظ ثم حاول مجددًا.|No se pudieron cambiar las páginas. Se conservaron las existentes. Reintenta guardar y vuelve a intentarlo.|Die Seiten konnten nicht geändert werden. Vorhandene Seiten bleiben erhalten. Speichere erneut und versuche es noch einmal.
localSaveFolderDeleteFailed|تعذر حذف المجلد. تم الاحتفاظ بمحتوياته.|No se pudo eliminar la carpeta. Se conservó su contenido.|Der Ordner konnte nicht entfernt werden. Sein Inhalt bleibt erhalten.
localLoadFailed|تعذر فتح الدفتر. لم يتم استبدال بياناتك المحفوظة.|No se pudo abrir el cuaderno. Tus datos guardados no se reemplazaron.|Das Notizbuch konnte nicht geöffnet werden. Deine gespeicherten Daten wurden nicht ersetzt.
localLoadRetry|محاولة الفتح مجددًا|Reintentar apertura|Erneut öffnen
exportDialogTitle|تصدير المستند|Exportar documento|Dokument exportieren
exportDialogCurrentPdfTitle|PDF — الصفحة الحالية {page}|PDF — página actual {page}|PDF — aktuelle Seite {page}
exportDialogCurrentPdfDesc|صدّر هذه الصفحة بكتابة ونص واضحين مع الحفاظ على أبعادها.|Exporta esta página con trazos y texto nítidos, conservando sus proporciones.|Exportiere diese Seite mit scharfer Schrift und unveränderten Proportionen.
exportDialogDownloadCurrentPdf|تنزيل الصفحة (.pdf)|Descargar página (.pdf)|Seite herunterladen (.pdf)
exportDialogAllPdfTitle|PDF — الدفتر كاملًا|PDF — cuaderno completo|PDF — ganzes Notizbuch
exportDialogAllPdfDesc|صدّر كل الصفحات بكتاباتها وتظليلها وصورها مع الحفاظ على أبعادها الأصلية.|Exporta todas las páginas con trazos, resaltados e imágenes y sus proporciones originales.|Exportiere alle Seiten mit Handschrift, Markierungen und Bildern in ihren ursprünglichen Proportionen.
exportDialogDownloadAllPdf|تنزيل الدفتر (.pdf)|Descargar cuaderno (.pdf)|Notizbuch herunterladen (.pdf)
exportDialogEditableTitle|ملف BetterNote قابل للتعديل|Archivo BetterNote editable|Bearbeitbare BetterNote-Datei
exportDialogEditableDesc|يحفظ الكتابة المتجهية والنصوص كاملة. عند تنزيله أو فتحه مجددًا،|Conserva todos los trazos vectoriales y el texto. Al descargarlo o volver a abrirlo,|Behält alle Vektorstriche und Texte. Nach dem Herunterladen oder erneuten Öffnen
exportDialogEditableEmphasis|يمكنك التعديل أو المسح أو متابعة الكتابة (قابل للتعديل بالكامل).|puedes editar, borrar o seguir escribiendo (totalmente editable).|kannst du bearbeiten, radieren oder weiterschreiben (vollständig bearbeitbar).
exportDialogDownloadEditable|تنزيل .bnote|Descargar .bnote|.bnote herunterladen
exportDialogImageTitle|صورة الصفحة الحالية|Imagen de la página actual|Bild der aktuellen Seite
exportDialogImageDesc|صفحة {page} · PNG للكتابة والنص · JPEG للصور|Página {page} · PNG para trazos y texto · JPEG para fotos|Seite {page} · PNG für Schrift und Text · JPEG für Fotos
exportDialogImageFormat|صيغة الصورة|Formato de imagen|Bildformat
exportDialogImageFormatLabel|صيغة الصورة المصدّرة|Formato de imagen exportada|Format des exportierten Bildes
exportDialogResolution|الدقة · يُنصح بـ 300 DPI|Resolución · se recomiendan 300 DPI|Auflösung · 300 DPI empfohlen
exportDialogResolutionLabel|دقة الصورة المصدّرة|Resolución de la imagen exportada|Auflösung des exportierten Bildes
exportDialogPngHint|صورة واضحة بلا فقدان جودة للكتابة والنص|Imagen nítida sin pérdida para trazos y texto|Scharfe, verlustfreie Ausgabe für Schrift und Text
exportDialogJpegHint|ملفات أصغر للصور|Archivos más pequeños para fotos|Kleinere Dateien für Fotos
exportDialogDpi150Hint|ملف أصغر|Archivo más pequeño|Kleinere Datei
exportDialogDpi300Hint|صورة واضحة (موصى به)|Imagen nítida (recomendado)|Scharfe Ausgabe (empfohlen)
exportDialogDpi600Hint|تفاصيل أكثر|Más detalle|Mehr Details
exportDialogDownloadImage|تنزيل الصورة|Descargar imagen|Bild herunterladen
exportDialogPngFileType|صورة PNG|Imagen PNG|PNG-Bild
exportDialogJpegFileType|صورة JPEG|Imagen JPEG|JPEG-Bild
exportDialogPreparingPdf|تجهيز الصفحات وإنشاء PDF بجودة عالية…|Preparando páginas y creando PDF de alta calidad…|Seiten werden vorbereitet und eine hochwertige PDF erstellt…
exportDialogPdfProgress|إنشاء الصفحة {page} من {total}…|Creando página {page} de {total}…|Seite {page} von {total} wird erstellt…
exportDialogPdfSuccess|تم تصدير PDF!|¡PDF exportado!|PDF exportiert!
exportDialogPdfError|تعذر تصدير PDF: |No se pudo exportar el PDF: |PDF-Export fehlgeschlagen: 
exportDialogPreparingPagePdf|تجهيز صفحة PDF رقم {page}…|Preparando la página PDF {page}…|PDF-Seite {page} wird vorbereitet…
exportDialogPagePdfSuccess|تم تصدير الصفحة {page} إلى PDF!|¡Página {page} exportada a PDF!|Seite {page} als PDF exportiert!
exportDialogPreparingEditable|تجهيز الكتابة ومحتوى الدفتر…|Preparando los trazos y el contenido del cuaderno…|Handschrift und Notizbuchinhalt werden vorbereitet…
exportDialogEditableSuccess|تم تصدير BetterNote (.bnote)! افتحه مجددًا لمتابعة التعديل.|¡BetterNote (.bnote) exportado! Ábrelo para seguir editando.|BetterNote (.bnote) exportiert! Öffne die Datei, um weiterzubearbeiten.
exportDialogEditableError|تعذر تصدير .bnote: |No se pudo exportar .bnote: |.bnote-Export fehlgeschlagen: 
exportDialogPreparingImage|حفظ صورة الصفحة الحالية…|Guardando la imagen de la página actual…|Bild der aktuellen Seite wird gespeichert…
exportDialogImageSuccess|تم تصدير {format} · {width} × {height} بكسل|{format} exportado · {width} × {height} píxeles|{format} exportiert · {width} × {height} Pixel
exportDialogImageSuccessLimited|تم تصدير {format} · {width} × {height} بكسل (عُدّلت الدقة للمحتوى الكبير)|{format} exportado · {width} × {height} píxeles (resolución ajustada al contenido grande)|{format} exportiert · {width} × {height} Pixel (Auflösung für große Inhalte angepasst)
exportDialogImageCancelled|أُلغي تصدير الصورة|Exportación de imagen cancelada|Bildexport abgebrochen
exportDialogImageError|تعذر تصدير الصورة: |No se pudo exportar la imagen: |Bildexport fehlgeschlagen: 
exportDialogEmptyNotebook|لا توجد صفحات لتصديرها في الدفتر.|El cuaderno no tiene páginas para exportar.|Das Notizbuch enthält keine Seiten zum Exportieren.
exportDialogMissingPage|لم يتم العثور على الصفحة المطلوبة.|No se encontró la página a exportar.|Die zu exportierende Seite wurde nicht gefunden.
exportDialogOfflineImageError|الصورة غير جاهزة للتصدير بلا إنترنت.|Esta imagen aún no está lista para exportar sin conexión.|Dieses Bild ist noch nicht für den Offline-Export bereit.
exportDialogInvalidImageSize|أبعاد الصورة غير صالحة.|Las dimensiones de la imagen no son válidas.|Die Bildabmessungen sind ungültig.
exportDialogInvalidPosition|تحتوي الصفحة على موضع تصدير غير صالح.|La página contiene una posición de exportación no válida.|Die Seite enthält eine ungültige Exportposition.
exportDialogImageLoadError|تعذر تحميل الصورة للتصدير.|No se pudo cargar la imagen para exportar.|Das Bild konnte nicht für den Export geladen werden.
exportDialogImageCreateError|تعذر إنشاء ملف الصورة.|No se pudo crear el archivo de imagen.|Die Bilddatei konnte nicht erstellt werden.
exportDialogImageOptionsError|خيارات تصدير الصورة غير صالحة.|Las opciones de exportación de imagen no son válidas.|Die Bildexportoptionen sind ungültig.
exportDialogImageCanvasError|تعذر تجهيز صورة التصدير.|No se pudo preparar la imagen para exportar.|Das Exportbild konnte nicht vorbereitet werden.
exportDialogPdfStartError|تعذر بدء تصدير PDF.|No se pudo iniciar la exportación PDF.|Der PDF-Export konnte nicht gestartet werden.
exportDialogPdfTimeoutError|استغرق تصدير PDF وقتًا طويلًا. جرّب تصدير صفحة واحدة كل مرة.|La exportación tardó demasiado. Prueba a exportar una página cada vez.|Der PDF-Export hat zu lange gedauert. Versuche, einzelne Seiten zu exportieren.
exportDialogPdfCreateError|تعذر إنشاء PDF. جرّب تصدير صفحة واحدة كل مرة.|No se pudo crear el PDF. Prueba a exportar una página cada vez.|Die PDF konnte nicht erstellt werden. Versuche, einzelne Seiten zu exportieren.
exportDialogUnknownError|فشل التصدير. حاول مجددًا.|La exportación falló. Inténtalo de nuevo.|Export fehlgeschlagen. Versuche es erneut.
template_whiteboard|لوحة بيضاء|Pizarra|Whiteboard
template_desc_whiteboard|اكتب بحرية في كل الاتجاهات بلا حدود للصفحة.|Escribe libremente en cualquier dirección, sin bordes de página.|Schreibe frei in alle Richtungen, ohne Seitenränder.
whiteboardUnlimited|مساحة كتابة بلا حدود|Espacio de escritura ilimitado|Unbegrenzte Schreibfläche
whiteboardCreateHelp|حرّك في أي اتجاه. يجمع تصدير PDF كل المحتوى في صفحة واحدة بهامش مرتب.|Desplázate en cualquier dirección. El PDF ajusta todo el contenido a una página con margen.|Verschiebe die Ansicht in jede Richtung. Der PDF-Export passt alle Inhalte mit Rand auf eine Seite.
whiteboardPanHint|إصبع للتحريك؛ إصبعان للتكبير|Un dedo para mover; dos para ampliar|Ein Finger zum Verschieben, zwei zum Zoomen
whiteboardFit|عرض كل المحتوى|Mostrar todo el contenido|Alle Inhalte anzeigen
paperGalleryHelp|اختر نمط الورق. تُظهر المعاينة الكبيرة النمط بوضوح.|Elige el papel. La vista grande muestra claramente el patrón.|Wähle einen Papierstil. Die große Vorschau zeigt das Muster deutlich.
paperSelectionReady|الورق جاهز للإنشاء|Tu papel está listo|Dein Papier ist bereit
insertImage|إدراج صورة من الكمبيوتر|Insertar imagen del equipo|Bild vom Computer einfügen
supportedImages|كل الصور المدعومة|Todas las imágenes compatibles|Alle unterstützten Bilder
imageImportError|تعذر فتح الصورة. اختر ملف صورة مدعومًا.|No se pudo abrir la imagen. Elige un formato compatible.|Dieses Bild konnte nicht geöffnet werden. Wähle eine unterstützte Bilddatei.
addMoreFiles|إضافة ملفات أخرى|Añadir más archivos|Weitere Dateien hinzufügen
addNewPageSub|اختر حجم الورق A2/A3/A4 ونمطه|Elige tamaño A2/A3/A4 y patrón|Papiergröße A2/A3/A4 und Muster wählen
addNewPageTitle|إضافة صفحة جديدة|Añadir página|Neue Seite hinzufügen
addPage|إضافة صفحة جديدة|Añadir página|Neue Seite hinzufügen
addPageBtn|إضافة صفحة|Añadir página|Seite hinzufügen
addPageShort|إضافة صفحة|Añadir página|Seite hinzufügen
addToFavorites|إضافة للمفضلة|Añadir a favoritos|Zu Favoriten hinzufügen
adjustWidth|ضبط سمك الخط|Ajustar grosor del trazo|Strichstärke anpassen
allFilesFilter|الكل|Todos|Alle
allNotebooks|كل الدفاتر|Todos los cuadernos|Alle Notizbücher
allTab|الكل|Todo|Alle
appName|BetterNote Pro Studio|BetterNote Pro Studio|BetterNote Pro Studio
applySubCrop|تطبيق القص|Aplicar recorte|Zuschnitt anwenden
arrow|سهم|Flecha|Pfeil
author|المؤلف|Autor|Autor
autoShapeToast|تم التعرف على الشكل: {shape} 📐|Forma reconocida: {shape} 📐|Form erkannt: {shape} 📐
back|رجوع|Atrás|Zurück
backToDocs|العودة للمستندات|Volver a Documentos|Zurück zu Dokumente
backToDocuments|العودة للمستندات|Volver a Documentos|Zurück zu Dokumente
backToLibrary|العودة للمكتبة|Volver a la biblioteca|Zurück zur Bibliothek
backedUpFilesLabel|الملفات المنسوخة احتياطيًا|Archivos con copia|Gesicherte Dateien
backupAutoHint|نسخ تلقائي في الخلفية باستهلاك ذاكرة منخفض|Copias automáticas en segundo plano con bajo uso de memoria|Automatische Hintergrundsicherung mit geringem Speicherbedarf
backupAutoSyncNotice|مزامنة تلقائية عند كل تعديل|Sincronización automática con cada cambio|Automatische Synchronisierung bei jeder Änderung
backupBackgroundHint|يعمل تلقائيًا في الخلفية باستهلاك ذاكرة منخفض|Funciona en segundo plano con bajo uso de memoria|Läuft automatisch im Hintergrund mit geringem Speicherbedarf
backupChangeFolder|تغيير المجلد|Cambiar carpeta|Ordner ändern
backupClearCacheBtn|مسح الذاكرة المؤقتة|Vaciar caché|Cache leeren
backupClearCacheTooltip|مسح ذاكرة العرض المؤقتة لتحرير RAM|Vaciar la caché de renderizado para liberar RAM|Temporären Anzeigecache leeren, um RAM freizugeben
backupClearSearch|مسح البحث|Limpiar búsqueda|Suche löschen
backupCloseDialog|إغلاق النافذة|Cerrar ventana|Fenster schließen
backupColAction|موقع الملف|Ubicación del archivo|Dateispeicherort
backupColFolder|موقع المجلد|Ubicación de la carpeta|Ordnerspeicherort
backupColName|اسم الدفتر / الملف|Cuaderno / archivo|Notizbuch / Dateiname
backupColSize|حجم الملف|Tamaño del archivo|Dateigröße
backupColStatus|الحالة|Estado|Status
backupColTime|آخر وقت نسخ|Última copia|Letzte Sicherung
backupFilterAll|الكل ({count})|Todos ({count})|Alle ({count})
backupFilterBnote|دفاتر (.bnote) ({count})|Cuadernos (.bnote) ({count})|Notizbücher (.bnote) ({count})
backupFilterPdf|مستندات PDF ({count})|Documentos PDF ({count})|PDF-Dokumente ({count})
backupFilterSystem|JSON النظام ({count})|JSON del sistema ({count})|System-JSON ({count})
backupFolderChanged|✓ تم تغيير مجلد النسخ|✓ Carpeta de copia actualizada|✓ Sicherungsordner aktualisiert
backupHint|ينسخ النظام الدفاتر تلقائيًا كل ساعة وعند الإغلاق (PDF و.bnote)|El sistema copia los cuadernos cada hora y al cerrar (PDF y .bnote)|Das System sichert Notizbücher stündlich und beim Schließen (PDF und .bnote)
backupLastSyncTime|آخر وقت نسخ|Última copia|Letzte Sicherung
backupNoDataYet|لا توجد بيانات بعد|Aún no hay datos|Noch keine Daten
backupNotFound|لا توجد نسخ تطابق البحث|No hay copias que coincidan|Keine passenden Sicherungsdateien gefunden
backupNotFoundHint|اضغط «نسخ احتياطي الآن» أدناه للبدء|Pulsa «Crear copia ahora» abajo para empezar|Klicke unten auf „Jetzt sichern“, um zu beginnen
backupNoticeBackingUp|نسخ البيانات وملفات PDF إلى القرص وGoogle Drive…|Copiando datos y PDF al disco y a Google Drive…|Daten und PDF-Dateien werden auf das Laufwerk und in Google Drive gesichert…
backupNoticeCacheCleared|تم مسح ذاكرة العرض المؤقتة وتحرير RAM 🧹|Caché de renderizado vaciada (RAM liberada 🧹)|Temporärer Anzeigecache geleert (RAM freigegeben 🧹)
backupNoticeError|خطأ أثناء النسخ: {error}|Error al crear la copia: {error}|Fehler beim Sichern: {error}
backupNoticeOpenFolderError|تعذر فتح المجلد: {error}|No se pudo abrir la carpeta: {error}|Ordner konnte nicht geöffnet werden: {error}
backupNoticeOpenedFolder|تم فتح مجلد النسخ في مستكشف Windows 📂|Carpeta abierta en el Explorador de Windows 📂|Sicherungsordner im Windows-Explorer geöffnet 📂
backupNoticeRevealError|تعذر عرض الملف: {error}|No se pudo mostrar el archivo: {error}|Datei konnte nicht angezeigt werden: {error}
backupNoticeRevealedFile|تم عرض {name} في مستكشف Windows 📂|Se mostró {name} en el Explorador de Windows 📂|{name} im Windows-Explorer angezeigt 📂
backupNoticeSuccess|تم نسخ كل الدفاتر وملفات PDF! 🚀|¡Se copiaron todos los cuadernos y PDF! 🚀|Alle Notizbücher und PDF-Dateien gesichert! 🚀
backupNowBtn|نسخ احتياطي الآن|Crear copia ahora|Jetzt sichern
backupNowInProgress|جارٍ النسخ…|Creando copia…|Sicherung läuft…
backupOpenLocalFolder|فتح المجلد المحلي|Abrir carpeta local|Lokalen Ordner öffnen
backupPathLabel|مجلد النسخ الحالي:|Carpeta de copias actual:|Aktueller Sicherungsordner:
backupPathPlaceholder|مثل H:\\My Drive\\BetterNote.AppPC أو C:\\Users\\...|p. ej. H:\\My Drive\\BetterNote.AppPC o C:\\Users\\...|z. B. H:\\My Drive\\BetterNote.AppPC oder C:\\Users\\...
backupReadyToRestore|جاهز للاستعادة عند تغيير الجهاز|Listo para restaurar al cambiar de equipo|Bereit zur Wiederherstellung beim Gerätewechsel
backupRestoreConfirm|هل تريد فحص الدفاتر واستعادتها من مجلد النسخ هذا؟|¿Quieres buscar y restaurar cuadernos desde esta carpeta?|Möchtest du diesen Sicherungsordner prüfen und Notizbücher wiederherstellen?
backupRestoreFromFolder|استعادة من مجلد|Restaurar desde carpeta|Aus Ordner wiederherstellen
backupRevealAction|عرض الملف|Mostrar archivo|Datei anzeigen
backupRevealTooltip|عرض {name} في مستكشف Windows|Mostrar {name} en el Explorador de Windows|{name} im Windows-Explorer anzeigen
backupScanning|فحص ملفات النسخ في {targetDir}…|Buscando copias en {targetDir}…|Sicherungsdateien in {targetDir} werden gesucht…
backupSearchPlaceholder|ابحث باسم الملف أو الدفتر…|Buscar archivo o cuaderno…|Datei oder Notizbuch suchen…
backupSettings|النسخ وحماية البيانات|Copias y protección de datos|Sicherung & Datenschutz
backupStatFiles|{bnoteCount} دفتر (.bnote) • {pdfCount} ملف (.pdf)|{bnoteCount} cuadernos (.bnote) • {pdfCount} archivos (.pdf)|{bnoteCount} Notizbücher (.bnote) • {pdfCount} Dateien (.pdf)
backupStatHint|تم العثور على {count} دفتر في التطبيق ({total} ملف نسخ إجمالًا)|{count} cuadernos en la app ({total} archivos de copia en total)|{count} Notizbücher in der App ({total} Sicherungsdateien insgesamt)
backupStatus|حالة النسخ التلقائي|Estado de copia automática|Status der automatischen Sicherung
backupStatusHeader|فحص حالة النسخ|Revisar estado de la copia|Sicherungsstatus prüfen
backupStatusSubtext|عرض الدفاتر المنسوخة والأوقات ومجلدات الوجهة|Consulta cuadernos copiados, fechas y carpetas de destino|Gesicherte Notizbücher, Zeitangaben und Zielordner anzeigen
backupStatusSubtitle|متابعة الدفاتر المنسوخة وأوقات المزامنة ومجلد التخزين|Revisa cuadernos copiados, fechas de sincronización y carpeta|Gesicherte Notizbücher, Synchronisierungszeiten und Speicherordner prüfen
backupStatusTitle|متابعة حالة النسخ|Estado de las copias|Sicherungsstatus
backupSynced|تمت المزامنة|Sincronizado|Synchronisiert
backupSyncedBadge|تم النسخ ✅|Con copia ✅|Gesichert ✅
backupTab|النسخ والسحابة|Copias y nube|Sicherung & Cloud
backupTargetFolder|مجلد الوجهة|Carpeta de destino|Zielordner
backupTargetFolderHelpDesc|مجلد على جهازك يحفظ فيه BetterNote نسخ الدفاتر (.bnote) وPDF تلقائيًا. إذا كان داخل Google Drive أو OneDrive، يتولى تطبيق المزامنة رفع الملفات في الخلفية.|Carpeta donde BetterNote guarda automáticamente cuadernos (.bnote) y PDF. Si está en Google Drive o OneDrive, su aplicación sincroniza los archivos con la nube.|Ordner für automatische Notizbuch- (.bnote) und PDF-Kopien. Liegt er in Google Drive oder OneDrive, synchronisiert deren App die Dateien im Hintergrund mit der Cloud.
backupTargetFolderHelpTitle|مجلد وجهة النسخ|Carpeta de destino de copias|Zielordner für Sicherungen
backupTotalFiles|الملفات المنسوخة|Archivos con copia|Gesicherte Dateien
ballpointNib|قلم جاف|Bolígrafo|Kugelschreiber
batchDelete|حذف|Eliminar|Löschen
batchDeletePermanent|حذف نهائي|Eliminar definitivamente|Endgültig löschen
batchDone|تم|Listo|Fertig
batchDuplicate|تكرار ({count})|Duplicar ({count})|Duplizieren ({count})
batchExportPdf|تصدير PDF ({count})|Exportar PDF ({count})|PDF exportieren ({count})
batchMove|نقل|Mover|Verschieben
blankPageIndicator|صفحة فارغة|Página en blanco|Leere Seite
bnoteFilter|دفاتر (.bnote)|Cuadernos (.bnote)|Notizbücher (.bnote)
bold|عريض|Negrita|Fett
bringAboveInk|وضع فوق الكتابة|Colocar sobre los trazos|Über die Schrift legen
bringInFrontOfInk|وضع أمام الكتابة|Colocar delante de los trazos|Vor die Schrift legen
browseFolder|اختيار مجلد محلي / Google Drive…|Elegir carpeta local / Google Drive…|Lokalen / Google-Drive-Ordner wählen…
brushNib|فرشاة|Pincel|Pinsel
cacheCleared|✓ تم مسح ذاكرة النظام المؤقتة|✓ Caché del sistema vaciada|✓ Systemcache geleert
cacheClearedRAM|✓ تم مسح الذاكرة المؤقتة وتحرير RAM 🚀|✓ Caché vaciada (RAM liberada 🚀)|✓ Cache geleert (RAM freigegeben 🚀)
cancel|إلغاء|Cancelar|Abbrechen
cancelSelectModeTooltip|الخروج من التحديد المتعدد|Salir de selección múltiple|Mehrfachauswahl beenden
cannotBeUndone|لا يمكن التراجع عن هذا الإجراء.|Esta acción no se puede deshacer.|Diese Aktion kann nicht rückgängig gemacht werden.
cannotDuplicate|تعذر التكرار|No se puede duplicar|Duplizieren nicht möglich
cannotMove|تعذر نقل الملف|No se puede mover el archivo|Datei kann nicht verschoben werden
chooseFileToRestore|اختيار ملف للاستعادة|Elegir archivo para restaurar|Datei zum Wiederherstellen wählen
circle|دائرة / شكل بيضاوي|Círculo / elipse|Kreis / Ellipse
clearAllCacheBtn|مسح كل الذاكرة المؤقتة|Vaciar toda la caché|Gesamten Cache leeren
clearAllFiles|مسح الكل|Quitar todo|Alles entfernen
clearCacheBtn|مسح ذاكرة النظام المؤقتة|Vaciar caché del sistema|Systemcache leeren
clearCacheDesc|تحسين الأداء وتحرير الذاكرة بمسح ذاكرة عرض PDF وسجل الخطوط المؤقت|Mejora el rendimiento y libera memoria al vaciar las cachés de PDF y trazos|Leere PDF-Anzeigecaches und den Strichverlauf, um Speicher freizugeben
clearCacheRAMDesc|مسح ذاكرة العرض المؤقتة والمعاينات لتحرير RAM دون التأثير على دفاترك|Vacía cachés y vistas previas para liberar RAM sin afectar tus cuadernos|Leere temporäre Anzeigecaches und Vorschauen, um RAM freizugeben. Deine Notizbücher bleiben erhalten
clearCacheRAMTitle|مسح ذاكرة التطبيق المؤقتة وRAM|Vaciar caché y liberar RAM|App-Cache leeren & RAM freigeben
clearCacheTitle|مسح ذاكرة العرض المؤقتة|Vaciar caché de renderizado|Anzeigecache leeren
clearPage|مسح الصفحة كاملة|Vaciar toda la página|Ganze Seite leeren
clearText|مسح|Limpiar|Leeren
clickToToggleTheme|اضغط لتغيير المظهر|Pulsa para cambiar el tema|Klicken, um das Design zu wechseln
close|إغلاق|Cerrar|Schließen
closeSidebar|إغلاق الشريط الجانبي|Cerrar barra lateral|Seitenleiste schließen
closeTab|إغلاق علامة التبويب|Cerrar pestaña|Tab schließen
cloudBackupDetectedBody|تم العثور على {count} دفتر منسوخ. هل تريد استعادتها كلها إلى هذا الجهاز الآن؟|Se encontraron {count} cuadernos con copia. ¿Restaurarlos todos en este dispositivo ahora?|{count} gesicherte Notizbücher gefunden. Jetzt alle auf diesem Gerät wiederherstellen?
cloudBackupDetectedTitle|☁️ تم العثور على نسخة في Google Drive ({folder})|☁️ Copia encontrada en Google Drive ({folder})|☁️ Sicherung in Google Drive gefunden ({folder})
cloudBackupRestoreNow|استعادة الكل الآن|Restaurar todo ahora|Jetzt alles wiederherstellen
cloudBackupRestoring|استعادة البيانات…|Restaurando datos…|Daten werden wiederhergestellt…
cloudRestoreDetectedDesc|تم العثور على {count} دفتر منسوخ. هل تريد استعادتها إلى هذا الجهاز الآن؟|Se encontraron {count} cuadernos con copia. ¿Restaurarlos en este dispositivo ahora?|{count} gesicherte Notizbücher gefunden. Jetzt auf diesem Gerät wiederherstellen?
cloudRestoreDetectedTitle|☁️ تم العثور على نسخة في Google Drive|☁️ Copia encontrada en Google Drive|☁️ Sicherung in Google Drive gefunden
cloudRestoreNowBtn|استعادة كل البيانات الآن|Restaurar todos los datos ahora|Jetzt alle Daten wiederherstellen
cloudRestoring|استعادة البيانات…|Restaurando datos…|Daten werden wiederhergestellt…
color|اللون|Color|Farbe
confirm|تأكيد|Confirmar|Bestätigen
confirmAndPlaceImage|تأكيد ووضع الصورة|Confirmar y colocar|Bestätigen & platzieren
confirmCrop|تأكيد القص|Confirmar recorte|Zuschnitt bestätigen
confirmPermanentDeleteBatch|هل تريد حذف هذه العناصر وعددها {count} نهائيًا؟ لا يمكن التراجع.|¿Eliminar definitivamente estos {count} elementos? No se puede deshacer.|Diese {count} Elemente endgültig löschen? Das kann nicht rückgängig gemacht werden.
connected|متصل|Conectado|Verbunden
copied|تم النسخ للحافظة|Copiado al portapapeles|In die Zwischenablage kopiert
copySuccess|تم النسخ|Copiado|Kopiert
coverStyleLabel|نمط الغلاف|Estilo de portada|Coverstil
createFolderBtn|إنشاء مجلد|Crear carpeta|Ordner erstellen
createNotebookBtn|إنشاء دفتر|Crear cuaderno|Notizbuch erstellen
cropImage|قص الصورة|Recortar imagen|Bild zuschneiden
cropImageHint|اسحب لتحديد الجزء المراد قصّه|Arrastra para elegir el área a recortar|Ziehe, um den Zuschnitt auszuwählen
cropImageModalTitle|قص الصورة|Recortar imagen|Bild zuschneiden
cropMore|قص إضافي|Recortar más|Weiter zuschneiden
cropPresetFull|الصورة كاملة|Imagen completa|Ganzes Bild
currentLocation|الموقع الحالي|Ubicación actual|Aktueller Ort
dangerZone|إجراءات حساسة|Acciones delicadas|Kritische Aktionen
defaultsTab|إعدادات الورق|Papel predeterminado|Papierstandard
delete|حذف|Eliminar|Löschen
deleteConfirm|هل تريد الحذف النهائي لـ|¿Quieres eliminar definitivamente|Möchtest du endgültig löschen:
deleteImage|حذف الصورة|Eliminar imagen|Bild löschen
deletePage|حذف هذه الصفحة|Eliminar esta página|Diese Seite löschen
deselect|إلغاء التحديد|Quitar selección|Auswahl aufheben
deselectAll|إلغاء تحديد الكل|Deseleccionar todo|Alles abwählen
done|تم|Listo|Fertig
downloadBackupBtn|تنزيل ملف النسخة الاحتياطية|Descargar archivo de copia|Sicherungsdatei herunterladen
driveConnectBtn|ربط Google Drive|Conectar Google Drive|Google Drive verbinden
driveConnected|متصل بالمزامنة السحابية|Conectado a la sincronización en la nube|Mit Cloud-Synchronisierung verbunden
driveDisconnectBtn|فصل الاتصال|Desconectar|Trennen
driveFolder|مجلد النسخ السحابي|Carpeta de copias en la nube|Cloud-Sicherungsordner
driveLastSync|آخر مزامنة|Última sincronización|Zuletzt synchronisiert
driveSyncNow|مزامنة الآن|Sincronizar ahora|Jetzt synchronisieren
driveSyncing|جارٍ المزامنة…|Sincronizando…|Synchronisierung läuft…
duplicate|تكرار|Duplicar|Duplizieren
duplicatePage|تكرار الصفحة|Duplicar página|Seite duplizieren
duplicateSuccess|تم التكرار!|¡Duplicado!|Dupliziert!
emptyFavDesc|اضغط النجمة على المجلدات أو الدفاتر أو الصفحات لإضافتها هنا|Pulsa la estrella de carpetas, cuadernos o páginas para añadirlos aquí|Tippe auf den Stern an Ordnern, Notizbüchern oder Seiten, um sie hier hinzuzufügen
emptyFavTitle|لا توجد مفضلة بعد|Aún no hay favoritos|Noch keine Favoriten
emptyFolderDesc|اضغط «+ جديد» أعلاه لإنشاء دفاتر أو مجلدات|Pulsa «+ Nuevo» arriba para crear cuadernos o carpetas|Klicke oben auf „+ Neu“, um Notizbücher oder Ordner zu erstellen
emptyFolderSubtitle|اضغط «+ جديد» أعلاه لإنشاء دفتر أو مجلد|Pulsa «+ Nuevo» arriba para crear un cuaderno o carpeta|Klicke oben auf „+ Neu“, um ein Notizbuch oder einen Ordner zu erstellen
emptyFolderTitle|هذا المجلد فارغ|Esta carpeta está vacía|Dieser Ordner ist leer
emptyPageDesc|صفحة فارغة|Página en blanco|Leere Seite
emptySearchTitle|لم يتم العثور على مستندات|No se encontraron documentos|Keine Dokumente gefunden
emptyTrash|إفراغ سلة المهملات|Vaciar papelera|Papierkorb leeren
emptyTrashDesc|لا توجد مستندات أو مجلدات محذوفة|No hay documentos ni carpetas eliminados|Keine gelöschten Dokumente oder Ordner
emptyTrashSubtitle|لا توجد مستندات أو مجلدات محذوفة|No hay documentos ni carpetas eliminados|Keine gelöschten Dokumente oder Ordner
emptyTrashTitle|سلة المهملات فارغة|La papelera está vacía|Der Papierkorb ist leer
enterNamePlaceholder|أدخل الاسم…|Escribe un nombre…|Name eingeben…
eraser|ممحاة|Borrador|Radierer
eraserMode|وضع الممحاة|Modo de borrado|Radiermodus
eraserPrecision|ممحاة دقيقة|Borrado preciso|Präzisionsradierer
eraserStroke|مسح الخط كاملًا|Borrar trazo completo|Ganzen Strich radieren
error|خطأ|Error|Fehler
exitCrop|الخروج من القص|Salir del recorte|Zuschnitt beenden
export|تصدير|Exportar|Exportieren
exportBackup|تصدير نسخة كاملة (.json / .bnote)|Exportar copia completa (.json / .bnote)|Vollständige Sicherung exportieren (.json / .bnote)
exportBackupDesc|نسخ كل الدفاتر والصفحات والطبقات في ملف واحد|Copia todos los cuadernos, páginas y capas en un archivo|Alle Notizbücher, Seiten und Ebenen in einer Datei sichern
exportJsonBackupDesc|تنزيل كل الدفاتر والمجلدات والخطوط في ملف .json على جهازك|Descarga cuadernos, carpetas y trazos como archivo .json en tu equipo|Alle Notizbücher, Ordner und Strichdaten als .json-Datei herunterladen
exportJsonBackupTitle|تصدير نسخة للطوارئ (.json)|Exportar copia de emergencia (.json)|Notfallsicherung exportieren (.json)
exportPdf|تصدير إلى PDF|Exportar a PDF|Als PDF exportieren
exportPdfError|خطأ في تصدير PDF|Error al exportar PDF|Fehler beim PDF-Export
exportPdfSuccess|تم تصدير PDF! 📄|¡PDF exportado! 📄|PDF exportiert! 📄
exportingPdf|تصدير PDF…|Exportando PDF…|PDF wird exportiert…
favBookmarkedPages|صفحات مفضلة ({count})|Páginas favoritas ({count})|Markierte Seiten ({count})
favDocsAndFolders|ملفات ومجلدات مفضلة ({count})|Archivos y carpetas favoritos ({count})|Datei- und Ordnerfavoriten ({count})
favFilesSection|ملفات ومجلدات مفضلة ({count})|Archivos y carpetas favoritos ({count})|Datei- und Ordnerfavoriten ({count})
favPagesSection|صفحات مفضلة ({count} صفحة)|Páginas favoritas ({count} páginas)|Markierte Seiten ({count} Seiten)
favTabAll|الكل|Todo|Alle
favTabFiles|ملفات ومجلدات|Archivos y carpetas|Dateien & Ordner
favTabPages|صفحات|Páginas|Seiten
favorites|المفضلة|Favoritos|Favoriten
filesAndFoldersTab|ملفات ومجلدات|Archivos y carpetas|Dateien & Ordner
fine|رفيع|Fino|Fein
firstPage|الصفحة الأولى|Primera página|Erste Seite
floatingPaste|لصق|Pegar|Einfügen
folder|مجلد|Carpeta|Ordner
folderColorLabel|لون المجلد|Color de carpeta|Ordnerfarbe
folderNameLabel|اسم المجلد|Nombre de carpeta|Ordnername
folderNamePlaceholder|مثل الفصل الأول، مشاريع البحث، شخصي|p. ej. Semestre 1, Proyectos, Personal|z. B. Semester 1, Forschung, Privat
folderOptions|خيارات المجلد|Opciones de carpeta|Ordneroptionen
folderTab|مجلد|Carpeta|Ordner
fountainNib|قلم حبر|Pluma|Füller
fullPageSnipError|خطأ في التقاط الصفحة: {error}|Error al capturar la página: {error}|Fehler beim Erfassen der Seite: {error}
fullPageSnipSuccess|تم التقاط الصفحة كاملة! اضغط لصق صورة أو Ctrl+V للصقها هنا أو في صفحة أخرى|¡Página capturada! Usa Pegar imagen o Ctrl+V para pegarla aquí o en otra página|Ganze Seite erfasst! Mit Bild einfügen oder Strg+V hier oder auf einer anderen Seite einfügen
gdriveActiveStatus|Google Drive نشط|Google Drive activo|Google Drive ist aktiv
gdriveAdvancedClientId|متقدم: معرّف عميل Google Cloud مخصص|Avanzado: ID de cliente de Google Cloud|Erweitert: Eigene Google-Cloud-Client-ID
gdriveAlreadyActiveDesc|يزامن BetterNote دفاترك تلقائيًا مع Google Drive في {path} دون تسجيل دخول منفصل.|BetterNote ya sincroniza tus cuadernos con Google Drive en {path} sin iniciar sesión aparte.|BetterNote synchronisiert deine Notizbücher bereits unter {path} mit Google Drive, ohne separate Anmeldung.
gdriveAlreadyActiveTitle|Google Drive نشط على هذا الكمبيوتر|Google Drive está activo en este equipo|Google Drive ist auf diesem PC aktiv
gdriveAutoSyncRunning|تُنسخ دفاترك وتُزامن مع Google Drive تلقائيًا في الخلفية.|Los cuadernos se copian y sincronizan con Google Drive en segundo plano.|Notizbücher werden automatisch im Hintergrund gesichert und mit Google Drive synchronisiert.
gdriveBackupError|خطأ في النسخ: {error}|Error de copia: {error}|Sicherungsfehler: {error}
gdriveBackupNow|نسخ إلى Drive الآن|Crear copia en Drive|Jetzt in Drive sichern
gdriveBackupSuccess|اكتمل النسخ! الملف: {name}|¡Copia completada! Archivo: {name}|Sicherung abgeschlossen! Datei: {name}
gdriveChangeFolderBtn|تغيير المجلد…|Cambiar carpeta…|Ordner ändern…
gdriveChooseLocalDriveBtn|اختيار مجلد Google Drive المحلي|Elegir carpeta local de Google Drive|Lokalen Google-Drive-Ordner wählen
gdriveClientIdHint|من Google Cloud Console (فعّل Google Drive API وأضف المصدر: http://localhost:3000)|Desde Google Cloud Console (activa Google Drive API y añade el origen http://localhost:3000)|Aus der Google Cloud Console (Google Drive API aktivieren und http://localhost:3000 als Ursprung hinzufügen)
gdriveClientIdLabel|معرّف عميل Google OAuth 2.0:|ID de cliente Google OAuth 2.0:|Google OAuth 2.0 Client-ID:
gdriveConnectBtn|ربط|Conectar|Verbinden
gdriveConnectButtonLabel|ربط Google Drive (تسجيل الدخول)|Conectar Google Drive (iniciar sesión)|Google Drive verbinden (anmelden)
gdriveConnectError|تعذر الربط. تحقق من معرّف العميل وإعدادات المصدر|No se pudo conectar. Revisa el ID de cliente y los orígenes|Verbindung fehlgeschlagen. Prüfe Client-ID und Ursprungseinstellungen
gdriveConnectSuccess|تم الربط بـ Google Drive! ({email})|¡Conectado a Google Drive! ({email})|Mit Google Drive verbunden! ({email})
gdriveConnected|متصل ({email})|Conectado ({email})|Verbunden ({email})
gdriveConnectingMsg|الاتصال بحسابات Google…|Conectando con Google…|Verbindung zu Google-Konten wird hergestellt…
gdriveCurrentFolder|مجلد النسخ الحالي:|Carpeta de copias actual:|Aktueller Sicherungsordner:
gdriveDesktopDesc|ثبّت Google Drive لمزامنة الدفاتر تلقائيًا في الخلفية عند حفظها في مجلده.|Instala Google Drive para sincronizar los cuadernos en segundo plano al guardarlos en su carpeta.|Installiere Google Drive, um Notizbücher in seinem Ordner automatisch im Hintergrund zu synchronisieren.
gdriveDesktopRecommendationDesc|إذا كان Google Drive للكمبيوتر أو OneDrive مثبتًا، يمكن مزامنة دفاتر .bnote وPDF في مجلده تلقائيًا دون معرّف عميل API.|Con Google Drive para ordenadores o OneDrive, los archivos .bnote y PDF de su carpeta se sincronizan sin ID de cliente API.|Mit Google Drive für den Desktop oder OneDrive werden .bnote- und PDF-Dateien im jeweiligen Ordner ohne API-Client-ID synchronisiert.
gdriveDesktopRecommendationTitle|موصى به: الحفظ في مجلد Google Drive للكمبيوتر|Recomendado: guardar en Google Drive para ordenadores|Empfohlen: Direkt in Google Drive für den Desktop speichern
gdriveDesktopTitle|Google Drive للكمبيوتر (موصى به لـ Windows ⭐)|Google Drive para ordenadores (recomendado en Windows ⭐)|Google Drive für den Desktop (für Windows empfohlen ⭐)
gdriveDisconnect|فصل الاتصال|Desconectar|Trennen
gdriveDisconnectMsg|تم فصل Google Drive|Google Drive desconectado|Google Drive getrennt
gdriveDownloadDesktopBtn|تنزيل Google Drive للكمبيوتر|Descargar Google Drive para ordenadores|Google Drive für den Desktop herunterladen
gdriveEnterClientIdError|أدخل معرّف عميل Google OAuth قبل الربط|Introduce un ID de cliente Google OAuth antes de conectar|Gib vor dem Verbinden eine Google OAuth Client-ID ein
gdriveFolderAutoCreated|✓ تم إعداد مجلد النسخ في Google Drive|✓ Carpeta de copias creada en Google Drive|✓ Sicherungsordner in Google Drive eingerichtet
gdriveLastSync|آخر مزامنة: {time}|Última sincronización: {time}|Zuletzt synchronisiert: {time}
gdriveModalSubtitle|نسخ الدفاتر وملفات PDF إلى السحابة للوصول إليها من أجهزة أخرى|Copia cuadernos y PDF en la nube para acceder desde otros equipos|Notizbücher und PDF-Dateien in der Cloud sichern und von anderen Geräten nutzen
gdriveModalTitle|ربط Google Drive والمزامنة السحابية|Conectar Google Drive y sincronización|Google Drive & Cloud-Synchronisierung verbinden
gdriveNotConnected|غير متصل بـ Google Drive|Sin conectar a Google Drive|Nicht mit Google Drive verbunden
gdriveOpenFolderBtn|فتح مجلد Drive|Abrir carpeta de Drive|Drive-Ordner öffnen
gdriveOpenGoogleConsole|فتح Google Cloud Console للحصول على معرّف عميل|Abrir Google Cloud Console para obtener el ID de cliente|Google Cloud Console für die Client-ID öffnen
gdriveOpenWebBtn|فتح Google Drive (الويب)|Abrir Google Drive (web)|Google Drive im Web öffnen
gdriveOpenWebTitle|فتح مجلد النسخ في موقع Google Drive|Abrir la carpeta de copias en la web de Google Drive|Sicherungsordner in Google Drive im Browser öffnen
gdriveReadyToBackup|جاهز للنسخ (اضغط مزامنة الآن أدناه)|Listo para copiar (pulsa Sincronizar ahora)|Bereit zum Sichern (unten Jetzt synchronisieren wählen)
gdriveRestoreBtn|استعادة من Drive|Restaurar desde Drive|Aus Drive wiederherstellen
gdriveRestoreSuccess|✓ تمت استعادة {count} دفتر من Drive|✓ Se restauraron {count} cuadernos desde Drive|✓ {count} Notizbücher aus Drive wiederhergestellt
gdriveRestoreTooltip|تنزيل كل الدفاتر من Google Drive واستعادتها لهذا الجهاز|Descargar y restaurar todos los cuadernos de Google Drive en este dispositivo|Alle Notizbücher aus Google Drive auf dieses Gerät laden und wiederherstellen
gdriveRestoringMsg|فحص دفاتر Google Drive واستعادتها…|Buscando y restaurando cuadernos desde Google Drive…|Notizbücher aus Google Drive werden geprüft und wiederhergestellt…
gdriveSetupHelpDesc|يتطلب الربط عبر Cloud API معرّف عميل Google OAuth وفق متطلبات Google.|La conexión mediante Cloud API requiere un ID de cliente Google OAuth.|Die Verbindung über die Cloud API benötigt gemäß Google-Anforderungen eine Google OAuth Client-ID.
gdriveSetupHelpTitle|تسجيل الدخول بـ Google (معرّف عميل Google Cloud)|Iniciar sesión con Google (ID de cliente Google Cloud)|Mit Google anmelden (Google-Cloud-Client-ID)
gdriveSignInBtn|تسجيل الدخول بـ Google (Gmail)|Iniciar sesión con Google (Gmail)|Mit Google anmelden (Gmail)
gdriveSignInDesc|سجّل الدخول بـ Google لربط Drive أو إنشاء مجلد نسخ تلقائيًا.|Inicia sesión con Google para conectar Drive o crear una carpeta de copias.|Melde dich mit Google an, um Drive zu verbinden oder einen Sicherungsordner anzulegen.
gdriveSignInGoogle|تسجيل الدخول بـ Google (Gmail)|Iniciar sesión con Google (Gmail)|Mit Google anmelden (Gmail)
gdriveSignInTitle|تسجيل الدخول إلى Google Drive|Iniciar sesión en Google Drive|Bei Google Drive anmelden
gdriveSyncing|جارٍ المزامنة…|Sincronizando…|Synchronisierung läuft…
gdriveTargetFolderLabel|مجلد نسخ Drive:|Carpeta de copias de Drive:|Drive-Sicherungsordner:
gdriveUseDesktopInstead|استخدم Drive للكمبيوتر (موصى به، لا يحتاج معرّف عميل)|Usar Drive para ordenadores (recomendado, sin ID de cliente)|Drive für den Desktop verwenden (empfohlen, keine Client-ID nötig)
gdriveVerifiedBackupStats|نسخ تم التحقق منها: {count} دفتر ({size}) • آخر مزامنة: {time}|Copias verificadas: {count} cuadernos ({size}) • Última sincronización: {time}|Geprüfte Sicherungen: {count} Notizbücher ({size}) • Letzte Synchronisierung: {time}
gdriveVerifiedFiles|ملفات النسخ المتحقق منها في Google Drive:|Archivos de copia verificados en Google Drive:|Geprüfte Sicherungsdateien in Google Drive:
goToPage|الانتقال لصفحة|Ir a la página|Zur Seite gehen
googleDriveSync|نسخ Google Drive التلقائي|Copia automática en Google Drive|Automatische Google-Drive-Sicherung
hand|أداة التحريك|Mano para mover|Hand zum Verschieben
hasStrokesDesc|تحتوي على كتابة ({count} خط)|Tiene notas ({count} trazos)|Enthält Notizen ({count} Striche)
highlighter|قلم تظليل|Resaltador|Textmarker
highlighterSettings|إعدادات رأس قلم التظليل|Punta del resaltador|Textmarkerspitze einstellen
highlighterTipRound|رأس دائري|Punta redonda|Runde Spitze
highlighterTipSquare|رأس مربع|Punta cuadrada|Eckige Spitze
highlighterHoldHint|ارسم خطًا وثبّت رأس القلم ليصبح مستقيمًا.|Dibuja una línea y mantén la punta quieta para enderezarla.|Zeichne eine Linie und halte die Spitze still, um sie zu begradigen.
highlighterStraightToast|تم تسوية التظليل|Resaltado enderezado|Markierung begradigt
chooseColorWheel|اختيار لون من دائرة الألوان|Elegir color de la rueda|Farbe aus dem Farbkreis wählen
home|الرئيسية|Inicio|Start
homeAllDocs|الرئيسية (كل المستندات)|Inicio (todos los documentos)|Start (alle Dokumente)
icon|أيقونة|Icono|Symbol
imageLockedHint|موضع الصورة مقفل (افتح القفل لتحريكها)|Posición bloqueada (desbloquea para mover)|Bildposition gesperrt (zum Verschieben entsperren)
imageTool|أداة الصورة (تحريك، حجم، طبقة)|Imagen (mover, tamaño, capa)|Bildwerkzeug (Verschieben, Größe, Ebene)
importBackup|استعادة بيانات من نسخة|Restaurar datos de una copia|Daten aus Sicherung wiederherstellen
importBackupDesc|استيراد نسخة محفوظة سابقًا إلى BetterNote|Importa una copia guardada en BetterNote|Eine zuvor gespeicherte Sicherung in BetterNote importieren
importBnoteMenu|استيراد ملف .bnote…|Importar archivo .bnote…|.bnote-Datei importieren…
importBnoteTab|استيراد ملف .bnote…|Importar archivo .bnote…|.bnote-Datei importieren…
importPdf|استيراد مستند PDF|Importar documento PDF|PDF-Dokument importieren
importPdfMenu|استيراد ملف PDF…|Importar archivo PDF…|PDF-Datei importieren…
importPdfTab|استيراد مستند PDF…|Importar documento PDF…|PDF-Dokument importieren…
importingPage|صفحة {current} من {total}|Página {current} de {total}|Seite {current} von {total}
importingPdfFile|استيراد الملف {current} من {total}|Importando archivo {current} de {total}|Datei {current} von {total} wird importiert
inUse|✓ مستخدم|✓ Activo|✓ Aktiv
insertAfterCurrent|بعد الحالية (صفحة {page})|Después de la actual (página {page})|Nach der aktuellen (Seite {page})
insertAtEnd|في النهاية (صفحة {page})|Al final (página {page})|Am Ende (Seite {page})
insertPageAfter|إدراج صفحة بعدها|Insertar página después|Seite danach einfügen
inspectBackupMenu|فحص حالة النسخ (الملفات والأوقات)…|Revisar copias (archivos y fechas)…|Sicherungsstatus prüfen (Dateien & Zeiten)…
inspectBackupTooltip|فحص النسخ: الملفات والأوقات والموقع|Revisar archivos, fechas y ubicación de copias|Sicherungsdateien, Zeiten und Speicherort prüfen
justNow|الآن|Ahora mismo|Gerade eben
landscape|أفقي|Horizontal|Querformat
langChinese|简体中文 (الصينية)|简体中文 (chino)|简体中文 (Chinesisch)
langChineseDesc|واجهة وأدوات باللغة الصينية المبسطة|Interfaz y herramientas en chino simplificado|Oberfläche und Werkzeuge auf vereinfachtem Chinesisch
langEnglish|English (الإنجليزية)|English (inglés)|English (Englisch)
langEnglishDesc|واجهة وتلميحات وأدوات باللغة الإنجليزية|Interfaz, ayudas y herramientas en inglés|Oberfläche, Hinweise und Werkzeuge auf Englisch
langRussian|Русский (الروسية)|Русский (ruso)|Русский (Russisch)
langRussianDesc|واجهة وأدوات تدوين باللغة الروسية|Interfaz y herramientas de notas en ruso|Oberfläche und Notizwerkzeuge auf Russisch
langThai|ภาษาไทย (التايلاندية)|ภาษาไทย (tailandés)|ภาษาไทย (Thailändisch)
langThaiDesc|واجهة وأدوات وتلميحات باللغة التايلاندية|Interfaz, herramientas y ayudas en tailandés|Oberfläche, Werkzeuge und Hinweise auf Thailändisch
language|اللغة|Idioma|Sprache
languageChoice|اختيار لغة التطبيق|Elegir idioma de la aplicación|App-Sprache wählen
languageTab|اللغة|Idioma|Sprache
lasso|تحديد حر|Selección con lazo|Lasso-Auswahl
lassoHint|أحط الخطوط أو النص أو الصور لتحريكها أو تغيير حجمها ولونها أو نسخها أو حذفها|Rodea trazos, texto o imágenes para mover, cambiar tamaño o color, copiar o eliminar|Umkreise Striche, Text oder Bilder zum Verschieben, Skalieren, Umfärben, Kopieren oder Löschen
lassoSuffix|تم تحديد {count} عنصر بالأداة الحرة 🔗|{count} elementos seleccionados con el lazo 🔗|{count} Elemente mit dem Lasso ausgewählt 🔗
lastBackupTimeLabel|آخر وقت نسخ|Última copia|Letzte Sicherung
lastPage|الصفحة الأخيرة|Última página|Letzte Seite
layer|الطبقات|Capas|Ebenen
layerAboveInk|فوق الكتابة|Sobre los trazos|Über der Schrift
layerUnderInk|تحت الكتابة (اكتب فوق الصورة)|Bajo los trazos (escribir sobre la imagen)|Unter der Schrift (auf dem Bild schreiben)
library|مكتبة الدفاتر|Biblioteca de cuadernos|Notizbuchbibliothek
libraryBackupBtnTooltip|فحص النسخ: الملفات والأوقات والمسارات|Revisar copias: archivos, fechas y rutas|Sicherungen prüfen: Dateien, Zeiten und Pfade
libraryBatchDelete|حذف|Eliminar|Löschen
libraryBatchDeletePermanently|حذف نهائي|Eliminar definitivamente|Endgültig löschen
libraryBatchDone|تم|Listo|Fertig
libraryBatchDuplicate|تكرار ({count})|Duplicar ({count})|Duplizieren ({count})
libraryBatchDuplicateTooltip|تكرار الدفاتر المحددة|Duplicar cuadernos seleccionados|Ausgewählte Notizbücher duplizieren
libraryBatchExportPdf|تصدير PDF ({count})|Exportar PDF ({count})|PDF exportieren ({count})
libraryBatchExportPdfTooltip|تصدير الدفاتر المحددة إلى PDF|Exportar cuadernos seleccionados a PDF|Ausgewählte Notizbücher als PDF exportieren
libraryBatchMove|نقل|Mover|Verschieben
libraryBatchMoveTooltip|نقل العناصر المحددة لمجلد آخر|Mover los elementos a otra carpeta|Ausgewählte Elemente in einen anderen Ordner verschieben
libraryCheckBackupMenu|فحص حالة النسخ (الملفات والوقت)…|Revisar copias (archivos y fecha)…|Sicherungsstatus prüfen (Dateien & Zeit)…
libraryCloudSyncPill|مزامنة Drive|Sincronización Drive|Drive-Synchronisierung
libraryDeselectAll|إلغاء تحديد الكل|Deseleccionar todo|Alles abwählen
libraryDocuments|المستندات|Documentos|Dokumente
libraryDriveMergedProtected|محمي|Protegido|Geschützt
libraryDriveMergedSynced|مزامنة Drive|Sincronización Drive|Drive-Synchronisierung
libraryDriveMergedSyncing|جارٍ المزامنة…|Sincronizando…|Synchronisierung läuft…
libraryDriveMergedTooltip|Google Drive وحماية النسخ (اضغط لفحص الحالة والملفات)|Google Drive y copias (pulsa para revisar estado y archivos)|Google Drive & Sicherung (zum Prüfen von Status und Dateien klicken)
libraryDriveStatusBtn|Drive|Drive|Drive
libraryDriveSyncing|جارٍ المزامنة…|Sincronizando…|Synchronisierung läuft…
libraryDriveTooltip|Google Drive: H:\\My Drive\\BetterNote.AppPC (اضغط لعرض حالة النسخ والملفات)|Google Drive: H:\\My Drive\\BetterNote.AppPC (pulsa para ver copias y archivos)|Google Drive: H:\\My Drive\\BetterNote.AppPC (für Sicherungsstatus und Dateien klicken)
libraryFavorites|المفضلة|Favoritos|Favoriten
libraryImportBnoteMenu|استيراد ملف .bnote…|Importar archivo .bnote…|.bnote-Datei importieren…
libraryImportPdfMenu|استيراد مستند PDF…|Importar documento PDF…|PDF-Dokument importieren…
libraryMarketplace|المتجر|Tienda|Marktplatz
libraryMoreOptionsTooltip|خيارات إضافية|Más opciones|Weitere Optionen
libraryNewBtn|جديد|Nuevo|Neu
libraryNewBtnTooltip|إنشاء دفتر (اختيار نمط الورق وحجمه)|Crear cuaderno (elegir papel y tamaño)|Notizbuch erstellen (Papiermuster und Größe wählen)
libraryNewFolderMenu|مجلد جديد…|Nueva carpeta…|Neuer Ordner…
libraryNewNotebookMenu|دفتر جديد…|Nuevo cuaderno…|Neues Notizbuch…
libraryPullDriveMenu|استعادة من Google Drive…|Restaurar desde Google Drive…|Aus Google Drive wiederherstellen…
librarySearchInput|البحث في المستندات…|Buscar documentos…|Dokumente suchen…
librarySearchTooltip|البحث في المستندات والدفاتر والمجلدات (Ctrl+K)|Buscar documentos, cuadernos o carpetas (Ctrl+K)|Dokumente, Notizbücher oder Ordner suchen (Strg+K)
librarySelectAll|تحديد الكل|Seleccionar todo|Alles auswählen
librarySelectModeCancel|إلغاء وضع التحديد|Salir del modo de selección|Auswahlmodus beenden
librarySelectModeToggle|تحديد عدة عناصر للحذف أو النسخ أو التصدير أو النقل|Selecciona varios elementos para eliminar, copiar, exportar o mover|Mehrere Elemente zum Löschen, Kopieren, Exportieren oder Verschieben auswählen
librarySelectedCount|تم تحديد {count} عنصر|{count} elementos seleccionados|{count} Elemente ausgewählt
librarySettingsBtnTooltip|الإعدادات والنسخ (Google Drive، استعادة، افتراضيات)|Ajustes y copias (Google Drive, restauración, valores predeterminados)|Einstellungen & Sicherung (Google Drive, Wiederherstellung, Standards)
libraryShared|مشترك|Compartido|Geteilt
librarySortTooltip|ترتيب المستندات (الاسم، الرقم، التاريخ)|Ordenar documentos (nombre, número, fecha)|Dokumente sortieren (Name, Nummer, Datum)
libraryTooltip|مكتبة كل المستندات|Biblioteca de documentos|Bibliothek aller Dokumente
libraryTrash|سلة المهملات|Papelera|Papierkorb
line|خط مستقيم|Línea recta|Gerade Linie
linkCopied|تم نسخ الرابط 🔗|Enlace copiado 🔗|Link kopiert 🔗
loading|جارٍ التحميل…|Cargando…|Wird geladen…
loadingApp|بدء BetterNote Pro Studio…|Iniciando BetterNote Pro Studio…|BetterNote Pro Studio wird gestartet…
localBackupDirHint|اختر مجلدًا محليًا لنسخ الملاحظات والملفات والتعديلات تلقائيًا (PDF و.bnote ونسخ النظام)|Elige una carpeta local para copiar notas, archivos y cambios (PDF, .bnote y copias del sistema)|Wähle einen lokalen Ordner für automatische Kopien deiner Notizen, Dateien und Änderungen (PDF, .bnote und Systemsicherungen)
localBackupDirTitle|مسار مجلد النسخ المحلي|Ruta de la carpeta de copias local|Pfad des lokalen Sicherungsordners
lockImage|قفل موضع الصورة|Bloquear posición de imagen|Bildposition sperren
lockRatio|تثبيت نسبة الأبعاد|Bloquear proporciones|Seitenverhältnis sperren
marketplaceDesc|اكتشف أكثر من 500 قالب ورق ومخطط وملصق وغلاف دفتر|Descubre más de 500 plantillas, agendas, pegatinas y portadas|Entdecke über 500 Papiervorlagen, Planer, Sticker und Notizbuchcover
marketplaceTitle|متجر BetterNote|Tienda BetterNote|BetterNote-Marktplatz
medium|متوسط|Medio|Mittel
migrationDesc|عند تثبيت BetterNote على جهاز جديد أو ربط Drive، استخدم هذا الخيار لاستعادة دفاترك.|Al instalar BetterNote en otro equipo o conectar Drive, usa esta opción para restaurar tus cuadernos.|Nutze diese Option nach der Installation auf einem neuen Gerät oder dem Verbinden von Drive, um Notizbücher wiederherzustellen.
migrationHelpGotIt|فهمت|Entendido|Verstanden
migrationHelpStep1Desc|اجعل مجلد النسخ داخل Google Drive للكمبيوتر، أو انسخ مجلد BetterNote.AppPC إلى وحدة USB.|Guarda las copias en Google Drive para ordenadores o copia BetterNote.AppPC a una unidad USB.|Lege den Sicherungsordner in Google Drive für den Desktop oder kopiere BetterNote.AppPC auf einen USB-Stick.
migrationHelpStep1Title|1. على الكمبيوتر القديم|1. En el equipo anterior|1. Auf dem alten PC
migrationHelpStep2Desc|ثبّت BetterNote من Microsoft Store وافتح الإعدادات واختر مجلد Drive أو النسخ نفسه.|Instala BetterNote desde Microsoft Store, abre Ajustes y selecciona la misma carpeta de Drive o copias.|Installiere BetterNote aus dem Microsoft Store, öffne Einstellungen und wähle denselben Drive- oder Sicherungsordner.
migrationHelpStep2Title|2. على الكمبيوتر الجديد|2. En el equipo nuevo|2. Auf dem neuen PC
migrationHelpStep3Desc|اضغط جلب واستعادة كل الدفاتر. سيستورد BetterNote الدفاتر والصفحات والكتابة والصور إلى الكمبيوتر الجديد.|Pulsa Obtener y restaurar cuadernos. BetterNote importará cuadernos, páginas, trazos e imágenes al equipo nuevo.|Klicke auf Alle Notizbücher abrufen und wiederherstellen. BetterNote importiert Notizbücher, Seiten, Handschrift und Bilder auf den neuen PC.
migrationHelpStep3Title|3. اضغط استعادة|3. Pulsa Restaurar|3. Wiederherstellen wählen
migrationHelpTitle|دليل نقل الدفاتر إلى كمبيوتر جديد|Guía para restaurar cuadernos en otro equipo|Notizbücher auf einem neuen PC wiederherstellen
migrationTitle|استعادة على جهاز جديد|Restaurar en otro equipo|Auf neuem Gerät wiederherstellen
moreFiles|ملفات أخرى|archivos más|weitere Dateien
moreOptions|خيارات إضافية|Más opciones|Weitere Optionen
move|نقل|Mover|Verschieben
moveHere|نقل هنا|Mover aquí|Hierher verschieben
moveToRootDesc|نقل إلى المجلد الرئيسي|Mover a la carpeta principal|In den Hauptordner verschieben
moveToTrash|نقل إلى سلة المهملات|Mover a la papelera|In den Papierkorb
multiSelectTooltip|تحديد عدة عناصر للحذف أو النسخ أو التصدير أو النقل|Seleccionar varios para eliminar, copiar, exportar o mover|Mehrere Elemente zum Löschen, Kopieren, Exportieren oder Verschieben auswählen
newButton|جديد|Nuevo|Neu
newFolder|مجلد جديد|Nueva carpeta|Neuer Ordner
newFolderMenu|مجلد جديد…|Nueva carpeta…|Neuer Ordner…
newFolderSub|نظّم مستنداتك بمجلدات ملوّنة|Organiza documentos con carpetas de colores|Ordne deine Dokumente mit farbigen Ordnern
newFolderTitle|مجلد جديد|Nueva carpeta|Neuer Ordner
newName|الاسم الجديد|Nuevo nombre|Neuer Name
newNotebook|دفتر جديد|Nuevo cuaderno|Neues Notizbuch
newNotebookMenu|دفتر جديد…|Nuevo cuaderno…|Neues Notizbuch…
newNotebookPrompt|إنشاء دفتر (اختيار الورق والحجم)|Crear cuaderno (elegir papel y tamaño)|Notizbuch erstellen (Papier und Größe wählen)
newNotebookSub|اختر حجم الورق واتجاهه ونمطه|Elige tamaño, orientación y patrón del papel|Papiergröße, Ausrichtung und Muster wählen
newNotebookTitle|دفتر جديد|Nuevo cuaderno|Neues Notizbuch
nextPage|الصفحة التالية|Página siguiente|Nächste Seite
nibType|نوع رأس القلم|Tipo de punta|Stiftspitze
noFavoriteDocsDesc|اضغط النجمة على مجلد أو دفتر لإضافته هنا|Pulsa la estrella de carpetas o cuadernos para añadirlos aquí|Klicke auf den Stern an Ordnern oder Notizbüchern, um sie hier hinzuzufügen
noFavoriteDocsTitle|لا توجد ملفات أو مجلدات مفضلة|No hay archivos ni carpetas favoritos|Keine Datei- oder Ordnerfavoriten
noFavoritePagesDesc|اضغط النجمة ⭐ في شريط الأدوات أثناء الكتابة لإضافة صفحة هنا|Pulsa la estrella ⭐ de la barra al escribir para marcar páginas|Klicke beim Schreiben auf den Stern ⭐ in der Werkzeugleiste, um Seiten zu markieren
noFavoritePagesTitle|لا توجد صفحات مفضلة|No hay páginas favoritas|Keine markierten Seiten
noFavorites|لا توجد مفضلة بعد|Aún no hay favoritos|Noch keine Favoriten
noFavoritesDesc|اضغط النجمة على مجلد أو دفتر أو صفحة لتثبيتها هنا|Pulsa la estrella de carpetas, cuadernos o páginas para fijarlos aquí|Klicke auf den Stern an Ordnern, Notizbüchern oder Seiten, um sie hier anzuheften
noFavoritesTitle|لا توجد مفضلة بعد|Aún no hay favoritos|Noch keine Favoriten
noImageInClipboard|لا توجد صورة في الحافظة (انسخ صورة أو استخدم Win+Shift+S ثم الصق)|No hay imagen en el portapapeles (copia una imagen o usa Win+Shift+S y luego pega)|Kein Bild in der Zwischenablage (kopiere ein Bild oder nutze Win+Umschalt+S und füge es dann ein)
noPagesInNotebook|لا توجد صفحات في هذا الدفتر بعد|Este cuaderno aún no tiene páginas|Dieses Notizbuch hat noch keine Seiten
noTrash|سلة المهملات فارغة|La papelera está vacía|Der Papierkorb ist leer
notFound|لم يتم العثور على العنصر|Elemento no encontrado|Element nicht gefunden
notebook|دفتر|Cuaderno|Notizbuch
notebookNameLabel|اسم الدفتر|Nombre del cuaderno|Notizbuchname
notebookNamePlaceholder|مثل ملاحظات الأحياء، مخطط السنة|p. ej. Apuntes de biología, Agenda anual|z. B. Biologie Kapitel 1, Jahresplaner
notebookOptions|خيارات الدفتر|Opciones del cuaderno|Notizbuchoptionen
notebookTab|الدفتر والورق|Cuaderno y papel|Notizbuch & Papier
of|من|de|von
openLocalFolderBtn|فتح المجلد|Abrir carpeta|Ordner öffnen
openPageTooltip|اضغط لفتح «{title}» صفحة {page}|Abrir «{title}», página {page}|„{title}“, Seite {page} öffnen
openedOnPage|الصفحة الحالية|Página actual|Aktuelle Seite
orientationLabel|الاتجاه|Orientación|Ausrichtung
orientationStep|2. اتجاه الورق|2. Orientación del papel|2. Papierausrichtung
page|صفحة|Página|Seite
pageNumber|صفحة {page}|Página {page}|Seite {page}
pageOf|صفحة {current} / {total}|Página {current} / {total}|Seite {current} / {total}
pageOfSimple|صفحة {current} من {total}|Página {current} de {total}|Seite {current} von {total}
pageOverview|نظرة عامة على الصفحات|Vista de páginas|Seitenübersicht
pagesTab|صفحات|Páginas|Seiten
palmRejection|منع لمس راحة اليد على Surface (القلم فقط)|Rechazo de palma en Surface (solo lápiz)|Handballenerkennung für Surface (nur Stift)
palmRejectionOff|غير نشط: يمكن الرسم بالإصبع|Inactivo: permite dibujar con el dedo|Inaktiv: Zeichnen mit dem Finger erlaubt
palmRejectionOn|نشط: قلم Surface فقط (يمنع لمس راحة اليد أثناء الكتابة)|Activo: solo Surface Pen (evita toques de palma al escribir)|Aktiv: Nur Surface Pen (verhindert Handballeneingaben beim Schreiben)
palmRejectionSetting|منع لمس راحة اليد|Rechazo de palma|Handballenerkennung
palmRejectionSettingDesc|اعتماد رأس القلم فقط لمنع لمسات راحة اليد غير المقصودة|Reconoce solo la punta del lápiz para evitar toques accidentales|Nur die Stiftspitze erkennen, um versehentliche Handballeneingaben zu vermeiden
paperSizeLabel|حجم الورق|Tamaño de papel|Papiergröße
paperSizeStep|1. اختيار حجم الورق|1. Elegir tamaño de papel|1. Papiergröße wählen
paperSizes|أحجام الورق القياسية|Tamaños estándar de papel|Standardpapiergrößen
paperTemplateLabel|قالب الورق|Plantilla de papel|Papiervorlage
paper_size_A2|A2 (ملصق / مخطط)|A2 (póster / plano)|A2 (Poster / Bauplan)
paper_size_A3|A3 (حجم كبير)|A3 (doble tamaño)|A3 (doppelte Größe)
paper_size_A4|A4 (قياسي)|A4 (estándar)|A4 (Standard)
paper_size_desc_A2|420 × 594 مم — للمخططات والملصقات والرسوم الكبيرة|420 × 594 mm — para planos, pósteres y bocetos grandes|420 × 594 mm — für Baupläne, Poster und große Skizzen
paper_size_desc_A3|297 × 420 مم — مساحة أوسع للمخططات والملخصات والخرائط الذهنية|297 × 420 mm — para diagramas, resúmenes y mapas mentales|297 × 420 mm — für Diagramme, Zusammenfassungen und Mindmaps
paper_size_desc_A4|210 × 297 مم — حجم قياسي للملاحظات والطباعة|210 × 297 mm — tamaño estándar para notas e impresión|210 × 297 mm — Standardgröße für Notizen und Druck
paste|لصق صورة من الحافظة|Pegar imagen del portapapeles|Bild aus Zwischenablage einfügen
pathSavedSuccess|✓ تم الحفظ|✓ Guardado|✓ Gespeichert
patternStep|3. نمط الورق (خطوط / ملمس)|3. Patrón del papel (líneas / textura)|3. Papiermuster (Linien / Struktur)
pdfAddMore|إضافة ملفات أخرى|Añadir más archivos|Weitere Dateien hinzufügen
pdfClearAll|مسح الكل|Quitar todo|Alles entfernen
pdfDragDropHint|اسحب ملفات PDF هنا أو اضغط لاختيارها|Arrastra archivos PDF aquí o pulsa para elegir|PDF-Dateien hierher ziehen oder zum Auswählen klicken
pdfDropSubhint|يدعم اختيار عدة ملفات .pdf وعرضها بدقة عالية|Permite varios archivos .pdf con alta resolución|Mehrere .pdf-Dateien mit scharfer Hi-DPI-Darstellung
pdfDropzoneSub|يدعم اختيار عدة ملفات .pdf وعرضها بدقة عالية|Permite varios archivos .pdf con alta resolución|Mehrere .pdf-Dateien mit scharfer Hi-DPI-Darstellung
pdfDropzoneText|اسحب ملفات PDF هنا أو اضغط لاختيارها|Arrastra archivos PDF aquí o pulsa para elegir|PDF-Dateien hierher ziehen oder zum Auswählen klicken
pdfErrorCorrupt|قد يكون الملف تالفًا أو غير مدعوم|El archivo puede estar dañado o no ser compatible|Die Datei ist möglicherweise beschädigt oder nicht unterstützt
pdfErrorGeneric|خطأ في استيراد PDF: {error}|Error al importar PDF: {error}|Fehler beim PDF-Import: {error}
pdfErrorInvalid|اختر ملفات .pdf فقط|Elige solo archivos .pdf|Wähle nur .pdf-Dateien
pdfFilter|مستندات (.pdf)|Documentos (.pdf)|Dokumente (.pdf)
pdfImportSub|تحويل صفحات PDF إلى دفاتر مع استيراد عدة ملفات|Convierte páginas PDF en cuadernos e importa varios archivos|PDF-Seiten in Notizbücher umwandeln und mehrere Dateien importieren
pdfImportSubtitle|تحويل صفحات PDF إلى دفاتر. يدعم اختيار واستيراد عدة ملفات.|Convierte páginas PDF en cuadernos. Admite seleccionar e importar varios archivos.|PDF-Seiten in Notizbücher umwandeln. Mehrere Dateien können gemeinsam ausgewählt und importiert werden.
pdfImportTitle|استيراد مستندات PDF|Importar documentos PDF|PDF-Dokumente importieren
pdfImportingBtn|استيراد {current}/{total}…|Importando {current}/{total}…|Import {current}/{total}…
pdfImportingItem|استيراد الملف {current} من {total}|Importando archivo {current} de {total}|Datei {current} von {total} wird importiert
pdfPageProgress|صفحة {current} من {total}|Página {current} de {total}|Seite {current} von {total}
pdfRemoveFile|إزالة هذا الملف|Quitar este archivo|Diese Datei entfernen
pdfSelectedCount|تم اختيار {count} ملف ({size} MB)|{count} archivos seleccionados ({size} MB)|{count} Dateien ausgewählt ({size} MB)
pdfSelectedFiles|تم اختيار {count} ملف ({size} MB)|{count} archivos seleccionados ({size} MB)|{count} Dateien ausgewählt ({size} MB)
pdfStartImport|بدء استيراد PDF|Importar PDF|PDF-Import starten
pdfStartImportCount|بدء استيراد PDF ({count} ملف)|Importar PDF ({count} archivos)|PDF-Import starten ({count} Dateien)
pen|قلم|Lápiz|Stift
penBallpoint|قلم جاف|Bolígrafo|Kugelschreiber
penBrush|فرشاة رسم|Pincel artístico|Künstlerpinsel
penFountain|قلم حبر|Pluma|Füller
penPressure|حساسية ضغط قلم Surface|Sensibilidad a presión de Surface Pen|Druckempfindlichkeit des Surface Pen
penSettings|رأس القلم والضغط|Punta y presión del lápiz|Stiftspitze & Druck
penSettingsHeader|قلم Surface وتجربة الكتابة|Surface Pen y escritura|Surface Pen & Schreibgefühl
permanentDelete|حذف نهائي|Eliminar definitivamente|Endgültig löschen
permanentDeleteAction|حذف نهائي|Eliminar definitivamente|Endgültig löschen
portrait|عمودي|Vertical|Hochformat
positionStep|4. موضع الصفحة|4. Posición de página|4. Seitenposition
presetShortcuts|مجلدات مقترحة (اضغط للاختيار):|Carpetas sugeridas (pulsa para elegir):|Empfohlene Ordner (zum Auswählen klicken):
pressureHigh|قوي|Firme|Fest
pressureLow|خفيف|Suave|Leicht
pressureMedium|متوسط|Medio|Mittel
pressureSensitivity|حساسية الضغط|Sensibilidad a la presión|Druckempfindlichkeit
pressureSetting|تأثير الضغط|Respuesta a la presión|Druckdynamik
pressureSettingDesc|سمك متغير حسب ضغط الكتابة لخط طبيعي|Grosor según la presión para una escritura natural|Dynamische Stärke je nach Schreibdruck für natürliche Kalligrafie
prevPage|الصفحة السابقة|Página anterior|Vorherige Seite
recommendedPatterns|أنماط ورق مقترحة|Patrones de papel sugeridos|Empfohlene Papiermuster
rectangle|مستطيل|Rectángulo|Rechteck
redo|إعادة|Rehacer|Wiederholen
removeFile|إزالة الملف|Quitar archivo|Datei entfernen
removeFromFavorites|إزالة من المفضلة|Quitar de favoritos|Aus Favoriten entfernen
removeStarTooltip|إزالة الصفحة من المفضلة|Quitar esta página de favoritos|Seitenmarkierung entfernen
rename|تغيير الاسم|Cambiar nombre|Umbenennen
renameFolderTitle|تغيير اسم المجلد|Cambiar nombre de carpeta|Ordner umbenennen
renameNotebookPrompt|اضغط لتغيير اسم الدفتر|Pulsa para cambiar el nombre|Klicken, um das Notizbuch umzubenennen
renameNotebookTitle|تغيير اسم الدفتر|Cambiar nombre del cuaderno|Notizbuch umbenennen
renameSub|أدخل الاسم الجديد واضغط حفظ|Escribe el nuevo nombre y guarda|Neuen Namen eingeben und speichern
resetApp|إعادة ضبط كل البيانات|Restablecer todos los datos|Alle Daten zurücksetzen
resetAppDesc|حذف كل الدفاتر والإعدادات نهائيًا. لا يمكن التراجع|Elimina todos los cuadernos y ajustes. No se puede deshacer|Alle Notizbücher und Einstellungen endgültig löschen. Nicht rückgängig zu machen
resetConfirm|هل تريد إعادة ضبط كل البيانات؟ لا يمكن التراجع!|¿Restablecer todos los datos? ¡No se puede deshacer!|Alle Daten zurücksetzen? Das kann nicht rückgängig gemacht werden!
resetImageSize|استعادة الحجم الأصلي|Restablecer tamaño original|Originalgröße wiederherstellen
resetOriginalImage|استعادة الأصل|Restablecer original|Original wiederherstellen
resetSuccess|تمت إعادة ضبط بيانات التطبيق!|¡Datos de la aplicación restablecidos!|App-Daten zurückgesetzt!
restore|استعادة|Restaurar|Wiederherstellen
restoreAction|استعادة|Restaurar|Wiederherstellen
restoreAllDataBtn|جلب واستعادة كل الدفاتر|Obtener y restaurar todos los cuadernos|Alle Notizbücher abrufen und wiederherstellen
restoreBackupFileDesc|استيراد نسخة محفوظة لاستعادة كل دفاترك|Importa una copia guardada para restaurar tus cuadernos|Gespeicherte Sicherung importieren, um deine Notizbücher wiederherzustellen
restoreBackupFileTitle|استعادة ملف نسخة (.json أو .bnote)|Restaurar archivo de copia (.json o .bnote)|Sicherungsdatei wiederherstellen (.json oder .bnote)
restoreBtn|استعادة الدفاتر إلى التطبيق|Restaurar cuadernos en la app|Notizbücher in der App wiederherstellen
restoreDesc|استيراد كل الدفاتر من مجلد النسخ إلى التطبيق|Importa los cuadernos de la carpeta de copias a la aplicación|Alle Notizbücher aus deinem Sicherungsordner in die App importieren
restoreError|خطأ في استعادة البيانات|Error al restaurar datos|Fehler beim Wiederherstellen
restoreSuccess|تمت استعادة البيانات!|¡Datos restaurados!|Daten wiederhergestellt!
restoreTitle|استعادة نسخة من مجلد|Restaurar copia desde carpeta|Sicherung aus Ordner wiederherstellen
save|حفظ|Guardar|Speichern
saveLocation|موقع الحفظ|Ubicación de guardado|Speicherort
saveName|حفظ الاسم|Guardar nombre|Namen speichern
scribbleErasedToast|تم مسح {count} خط بالخربشة! 🪄|¡Se borraron {count} trazos con garabatos! 🪄|{count} Striche durch Durchkritzeln gelöscht! 🪄
scribbleToErase|الخربشة للمسح|Garabatear para borrar|Durchkritzeln zum Radieren
scrollHorizontal|تقليب الصفحات أفقيًا|Pasar páginas horizontalmente|Horizontal blättern
scrollVertical|تمرير عمودي متواصل|Desplazamiento vertical continuo|Fortlaufend vertikal scrollen
searchAllPlaceholder|ابحث في الدفاتر والمستندات والمجلدات (Ctrl+K)|Buscar cuadernos, documentos o carpetas (Ctrl+K)|Notizbücher, Dokumente oder Ordner suchen (Strg+K)
searchBackupFilesPlaceholder|ابحث باسم الملف أو الدفتر…|Buscar archivos o cuadernos…|Dateien oder Notizbücher suchen…
searchFoldersSection|مجلدات ({count})|Carpetas ({count})|Ordner ({count})
searchModalPlaceholder|البحث في كل المستندات والدفاتر والمجلدات…|Buscar en documentos, cuadernos y carpetas…|Alle Dokumente, Notizbücher oder Ordner durchsuchen…
searchNotFoundDesc|جرّب كلمات أو أسماء مجلدات أخرى|Prueba otras palabras o nombres de carpeta|Versuche andere Suchbegriffe oder Ordnernamen
searchNotFoundTitle|لا توجد مستندات تطابق بحثك|No hay documentos que coincidan|Keine passenden Dokumente gefunden
searchNotebooksSection|دفاتر وPDF ({count})|Cuadernos y PDF ({count})|Notizbücher & PDF ({count})
searchPlaceholder|البحث عن دفتر أو مجلد…|Buscar cuadernos o carpetas…|Notizbücher oder Ordner suchen…
searchRecentSection|مستندات فُتحت مؤخرًا|Documentos recientes|Zuletzt geöffnete Dokumente
searchShortPlaceholder|البحث في المستندات…|Buscar documentos…|Dokumente suchen…
selectAll|تحديد الكل|Seleccionar todo|Alles auswählen
selectDestinationFolder|اختيار مجلد الوجهة|Elegir carpeta de destino|Zielordner wählen
selectFolder|اختيار هذا المجلد|Elegir esta carpeta|Diesen Ordner wählen
selectNotebook|اختيار هذا الدفتر|Elegir este cuaderno|Dieses Notizbuch wählen
selectedCount|تم تحديد {count}|{count} seleccionados|{count} ausgewählt
sendBehindInk|وضع خلف الكتابة|Colocar detrás de los trazos|Hinter die Schrift legen
settings|الإعدادات|Ajustes|Einstellungen
settingsTitle|إعدادات BetterNote Studio|Ajustes de BetterNote Studio|BetterNote Studio – Einstellungen
settingsTooltip|الإعدادات والنسخ (Google Drive، الاستعادة، الورق)|Ajustes y copias (Google Drive, restauración, papel)|Einstellungen & Sicherung (Google Drive, Wiederherstellung, Papier)
shape|أشكال هندسية|Formas geométricas|Geometrische Formen
sharedDocumentsDesc|لا توجد مستندات مشتركة بعد. يمكنك مشاركة الدفاتر أو تصدير PDF.|Aún no hay documentos compartidos. Puedes compartir cuadernos o exportar a PDF.|Noch keine geteilten Dokumente. Du kannst Notizbücher teilen oder als PDF exportieren.
sharedDocumentsTitle|مستندات مشتركة|Documentos compartidos|Geteilte Dokumente
sharedViewDesc|لا توجد مستندات مشتركة بعد. يمكنك مشاركة الدفاتر أو تصدير PDF.|Aún no hay documentos compartidos. Puedes compartir cuadernos o exportar a PDF.|Noch keine geteilten Dokumente. Du kannst Notizbücher teilen oder als PDF exportieren.
sharedViewTitle|مستندات مشتركة|Documentos compartidos|Geteilte Dokumente
sidebarDocuments|المستندات|Documentos|Dokumente
sidebarMarketplace|المتجر|Tienda|Marktplatz
sidebarMarketplaceSub|أكثر من 500 عنصر لك|Más de 500 artículos|Über 500 Artikel für dich
sidebarShared|مشترك|Compartido|Geteilt
slotSaved|تم الحفظ في الخانة|Guardado en el ajuste|Im Platz gespeichert
snip|أداة القص المرئي|Herramienta de recortes|Ausschnittwerkzeug
snipModalHint|راجع أو عدّل أو قص قبل الوضع|Revisa, ajusta o recorta antes de colocar|Vor dem Platzieren prüfen, anpassen oder zuschneiden
snipModalTitle|صورة أداة القص|Imagen del recorte|Bild aus dem Ausschnittwerkzeug
sortByDate|التاريخ (الأحدث)|Fecha (más reciente)|Datum (neueste)
sortByDateAsc|التعديل (الأقدم أولًا)|Modificación (más antiguo)|Geändert (älteste zuerst)
sortByDateDesc|التعديل (الأحدث أولًا)|Modificación (más reciente)|Geändert (neueste zuerst)
sortByName|الاسم (تصاعدي)|Nombre (A–Z)|Name (A–Z)
sortByNameAsc|الاسم (تصاعدي)|Nombre (A–Z)|Name (A–Z)
sortByNameDesc|الاسم (تنازلي)|Nombre (Z–A)|Name (Z–A)
sortByNumAsc|الرقم (1–9)|Número (1–9)|Nummer (1–9)
sortByNumDesc|الرقم (9–1)|Número (9–1)|Nummer (9–1)
sortByNumber|الرقم (1–9)|Número (1–9)|Nummer (1–9)
sortByNumberDesc|الرقم (9–1)|Número (9–1)|Nummer (9–1)
sortDateAscLabel|التعديل (الأقدم أولًا)|Modificación (más antiguo)|Geändert (älteste zuerst)
sortDateDescLabel|التعديل (الأحدث أولًا)|Modificación (más reciente)|Geändert (neueste zuerst)
sortLabelDateAsc|التاريخ (الأقدم)|Fecha (más antiguo)|Datum (älteste)
sortLabelDateDesc|التاريخ (الأحدث)|Fecha (más reciente)|Datum (neueste)
sortLabelNameAsc|الاسم (تصاعدي)|Nombre (A–Z)|Name (A–Z)
sortLabelNameDesc|الاسم (تنازلي)|Nombre (Z–A)|Name (Z–A)
sortLabelNumAsc|الرقم (1–9)|Número (1–9)|Nummer (1–9)
sortLabelNumDesc|الرقم (9–1)|Número (9–1)|Nummer (9–1)
sortNameAscLabel|الاسم (تصاعدي)|Nombre (A–Z)|Name (A–Z)
sortNameDescLabel|الاسم (تنازلي)|Nombre (Z–A)|Name (Z–A)
sortNumAscLabel|الرقم (تصاعدي)|Número (ascendente)|Nummer (aufsteigend)
sortNumDescLabel|الرقم (تنازلي)|Número (descendente)|Nummer (absteigend)
sortSectionDate|ترتيب حسب تاريخ التعديل|Ordenar por modificación|Nach Änderungsdatum sortieren
sortSectionName|ترتيب حسب الاسم|Ordenar por nombre|Nach Name sortieren
sortSectionNum|ترتيب حسب الرقم|Ordenar por número|Nach Nummer sortieren
sortSectionNumber|ترتيب حسب الرقم|Ordenar por número|Nach Nummer sortieren
sortTooltip|ترتيب المستندات (اسم، رقم، تاريخ)|Ordenar documentos (nombre, número, fecha)|Dokumente sortieren (Name, Nummer, Datum)
starPage|إضافة الصفحة للمفضلة|Marcar esta página|Diese Seite markieren
startImportPdf|بدء استيراد PDF|Importar PDF|PDF-Import starten
strokeWidth|سمك الخط|Grosor del trazo|Strichstärke
success|تم بنجاح|Completado|Erfolgreich
syncGoogleDriveMenu|استعادة نسخة من Google Drive…|Restaurar copia de Google Drive…|Sicherung aus Google Drive wiederherstellen…
syncNow|مزامنة ونسخ الآن|Sincronizar y copiar ahora|Jetzt synchronisieren & sichern
syncedBadge|تمت المزامنة|Sincronizado|Synchronisiert
syncing|مزامنة البيانات…|Sincronizando datos…|Daten werden synchronisiert…
systemFilter|النظام (.json)|Sistema (.json)|System (.json)
taperedLine|تدرّج أطراف الخط|Afinar extremos del trazo|Verjüngte Strichenden
targetFolderLabel|مجلد الوجهة|Carpeta de destino|Zielordner
template_badge_comfort|مريح|Cómodo|Angenehm
template_badge_extra_wide|واسع جدًا|Extra ancho|Extra breit
template_badge_fine|دقيق|Fino|Fein
template_badge_giant|كبير جدًا|Gigante|Riesig
template_badge_popular|شائع|Popular|Beliebt
template_blank|فارغ|En blanco|Leer
template_cornell|ملاحظات كورنيل|Notas Cornell|Cornell-Notizen
template_dark_dotted|داكن منقّط|Puntos oscuros|Dunkel gepunktet
template_desc_blank|ورق فارغ للرسم الحر والخرائط الذهنية|Papel sin líneas para bocetos y mapas mentales|Leeres Papier für Skizzen und Mindmaps
template_desc_cornell|تخطيط كورنيل بعمود للكلمات المفتاحية ومربع للملخص|Diseño Cornell con columna de pistas y recuadro de resumen|Cornell-Layout mit Stichwortspalte und Zusammenfassung
template_desc_dark_dotted|ورق داكن يبرز الحبر الأبيض والنيون|Papel oscuro que destaca la tinta blanca y neón|Dunkles Papier, das weiße und Neonfarben hervorhebt
template_desc_dotted|نقاط لتخطيط الصفحات والرسم والمذكرات|Puntos para diarios, diseños y bocetos|Punkte für Bullet Journals, Layouts und Skizzen
template_desc_grid|شبكة هندسية 5 مم للرياضيات والمخططات والإحصاء|Cuadrícula de 5 mm para matemáticas, diagramas y estadísticas|5-mm-Raster für Mathematik, Diagramme und Statistik
template_desc_narrow_ruled|تباعد 22 بكسل لملاحظات مكثفة ومفصلة|Líneas de 22 px para notas densas y detalladas|22 px Linienabstand für dichte, detaillierte Notizen
template_desc_ruled|تباعد قياسي 30 بكسل للمحاضرات والملاحظات اليومية|Líneas estándar de 30 px para clases y notas diarias|30 px Standardlinienabstand für Vorlesungen und tägliche Notizen
template_desc_standard_ruled|تباعد قياسي 30 بكسل للمحاضرات والملاحظات اليومية|Líneas estándar de 30 px para clases y notas diarias|30 px Standardlinienabstand für Vorlesungen und tägliche Notizen
template_desc_wide_ruled|تباعد 38 بكسل للكتابة الكبيرة والعناوين والتدريب|Líneas de 38 px para letra grande, títulos y práctica|38 px Linienabstand für große Schrift, Überschriften und Schreibübungen
template_dotted|منقّط|Puntos|Gepunktet
template_grid|شبكة|Cuadrícula|Raster
template_narrow_ruled|سطور ضيقة|Rayado estrecho|Eng liniert
template_ruled|سطور قياسية|Rayado estándar|Standard liniert
template_standard_ruled|سطور قياسية|Rayado estándar|Standard liniert
template_wide_ruled|سطور واسعة|Rayado ancho|Weit liniert
text|مربع نص|Cuadro de texto|Textfeld
theme|المظهر|Tema y apariencia|Design & Darstellung
themeChoice|اختيار مظهر التطبيق|Elegir tema de la aplicación|App-Design wählen
themeDark|الوضع الداكن|Modo oscuro|Dunkelmodus
themeDarkDesc|مريح في الإضاءة المنخفضة وقد يوفر البطارية|Cómodo con poca luz y puede ahorrar batería|Angenehm bei wenig Licht, kann Akku sparen
themeLight|الوضع الفاتح|Modo claro|Hellmodus
themeLightDesc|مظهر واضح للقراءة والكتابة نهارًا|Tema nítido para leer y escribir de día|Klare Darstellung zum Lesen und Schreiben bei Tageslicht
themeMidnight|منتصف الليل (أسود)|Medianoche (negro)|Mitternacht (Schwarz)
themeSepia|بني دافئ (ورق)|Sepia (papel cálido)|Sepia (warmes Papier)
themeTab|المظهر واللغة|Tema e idioma|Design & Sprache
thumbnails|معاينات الصفحات|Miniaturas de páginas|Seitenvorschauen
toastAddedToFavorites|أُضيف للمفضلة ⭐|Añadido a favoritos ⭐|Zu Favoriten hinzugefügt ⭐
toastBatchDeleteError|خطأ في حذف العناصر|Error al eliminar elementos|Fehler beim Löschen der Elemente
toastBatchDeletePermanentSuccess|تم حذف {count} عنصر نهائيًا|{count} elementos eliminados definitivamente|{count} Elemente endgültig gelöscht
toastBatchDeleteTrashSuccess|تم نقل {count} عنصر للمهملات 🗑️|{count} elementos movidos a la papelera 🗑️|{count} Elemente in den Papierkorb verschoben 🗑️
toastBatchMoveError|خطأ في نقل العناصر|Error al mover elementos|Fehler beim Verschieben
toastBatchMoveSuccess|تم نقل {count} عنصر! 📁|¡{count} elementos movidos! 📁|{count} Elemente verschoben! 📁
toastDuplicateError|خطأ في تكرار العناصر|Error al duplicar elementos|Fehler beim Duplizieren
toastDuplicateNotebookOnly|التكرار متاح للدفاتر فقط|Solo se pueden duplicar cuadernos|Nur Notizbücher können dupliziert werden
toastDuplicateSuccess|تم تكرار {count} دفتر ✨|{count} cuadernos duplicados ✨|{count} Notizbücher dupliziert ✨
toastExportPdfError|خطأ في تصدير PDF|Error al exportar PDF|Fehler beim PDF-Export
toastExportPdfNotebookOnly|تصدير PDF متاح للدفاتر فقط|Solo se pueden exportar cuadernos a PDF|Nur Notizbücher können als PDF exportiert werden
toastExportPdfStarting|تصدير {count} دفتر إلى PDF…|Exportando {count} cuadernos a PDF…|{count} Notizbücher werden als PDF exportiert…
toastExportPdfSuccess|تم تصدير {count} دفتر إلى PDF! 📄|¡{count} cuadernos exportados a PDF! 📄|{count} Notizbücher als PDF exportiert! 📄
toastImportBnoteSuccess|تم استيراد الدفتر «{name}»! 📘|¡Cuaderno «{name}» importado! 📘|Notizbuch „{name}“ importiert! 📘
toastImportingBnote|استيراد ملف .bnote…|Importando archivo .bnote…|.bnote-Datei wird importiert…
toastLinkCopied|تم نسخ الرابط 🔗|Enlace copiado 🔗|Link kopiert 🔗
toastLinkCopiedItem|تم نسخ رابط «{name}» للحافظة 🔗|Enlace de «{name}» copiado 🔗|Link für „{name}“ kopiert 🔗
toastMoveSuccess|تم النقل!|¡Movido!|Verschoben!
toastMovedFolderToTrash|تم نقل المجلد للمهملات 🗑️|Carpeta movida a la papelera 🗑️|Ordner in den Papierkorb verschoben 🗑️
toastMovedNotebookToTrash|تم نقل الدفتر للمهملات 🗑️|Cuaderno movido a la papelera 🗑️|Notizbuch in den Papierkorb verschoben 🗑️
toastPageAddedToFavorites|أُضيفت الصفحة للمفضلة ⭐|Página añadida a favoritos ⭐|Seite zu Favoriten hinzugefügt ⭐
toastPageRemovedFromFavorites|أُزيلت الصفحة من المفضلة|Página quitada de favoritos|Seite aus Favoriten entfernt
toastReadyToShare|جاهز لمشاركة «{name}»|Listo para compartir «{name}»|„{name}“ kann geteilt werden
toastRemovedFromFavorites|أُزيل من المفضلة|Quitado de favoritos|Aus Favoriten entfernt
toastRenameSuccess|تم تغيير الاسم!|¡Nombre cambiado!|Umbenannt!
toastRestoredFolder|تمت استعادة المجلد ✨|Carpeta restaurada ✨|Ordner wiederhergestellt ✨
toastRestoredNotebook|تمت استعادة الدفتر ✨|Cuaderno restaurado ✨|Notizbuch wiederhergestellt ✨
toastSortedBy|الترتيب حسب: {label}|Ordenado por: {label}|Sortiert nach: {label}
trash|سلة المهملات|Papelera|Papierkorb
triangle|مثلث|Triángulo|Dreieck
twoFingerUndoToast|تراجع (نقرتان بإصبعين) ↶|Deshacer (doble toque con dos dedos) ↶|Rückgängig (zweimal mit zwei Fingern tippen) ↶
typeTextHere|اكتب النص هنا…|Escribe aquí…|Text hier eingeben…
undo|تراجع|Deshacer|Rückgängig
unlockImage|فتح قفل الصورة|Desbloquear imagen|Bild entsperren
unlockRatio|تحرير نسبة الأبعاد|Proporciones libres|Freies Seitenverhältnis
unstarPage|إزالة من المفضلة|Quitar marcador|Markierung entfernen
untitled|بلا عنوان|Sin título|Ohne Titel
untitledFolder|مجلد بلا عنوان|Carpeta sin título|Unbenannter Ordner
updateAvailableBadge|Microsoft Store|Microsoft Store|Microsoft Store
updateBugFixesTitle|إصلاحات الأخطاء|Correcciones|Fehlerbehebungen
updateCheckNow|التحقق من التحديثات الآن|Buscar actualizaciones|Jetzt nach Updates suchen
updateChecking|التحقق من التحديثات…|Buscando actualizaciones…|Updates werden gesucht…
updateCurrentVersion|الإصدار الحالي:|Versión actual:|Aktuelle Version:
bnoteEmpty|الملف فارغ. صدّر الدفتر مجددًا.|El archivo está vacío. Exporta el cuaderno de nuevo.|Die Datei ist leer. Exportiere das Notizbuch erneut.
bnoteInvalid|الملف ناقص أو ليس مستند BetterNote صالحًا. لم يتم استيراد شيء.|El archivo está incompleto o no es un documento BetterNote válido. No se importó nada.|Die Datei ist unvollständig oder kein gültiges BetterNote-Dokument. Es wurde nichts importiert.
bnoteIncomplete|بعض الصفحات أو PDF الأصلي مفقود. صدّر الدفتر كاملًا مجددًا.|Faltan páginas o el PDF original. Exporta el cuaderno completo de nuevo.|Einige Seiten oder die Original-PDF fehlen. Exportiere das vollständige Notizbuch erneut.
bnoteTooLarge|يتجاوز الملف حد الاستيراد البالغ 272 MB.|El archivo supera el límite de importación de 272 MB.|Die Datei überschreitet die Importgrenze von 272 MB.
bnoteTimeout|استغرق فحص الملف وقتًا طويلًا. حاول مجددًا.|La comprobación tardó demasiado. Reintenta.|Die Dateiprüfung hat zu lange gedauert. Versuche es erneut.
bnoteSaveFailed|تعذر حفظ الملف والتحقق منه. اختر مجلدًا محليًا وحاول مجددًا.|No se pudo guardar y verificar el archivo. Elige una carpeta local y reintenta.|Die Datei konnte nicht gespeichert und geprüft werden. Wähle einen lokalen Ordner und versuche es erneut.
bnoteRestartRequired|أغلق BetterNote وافتحه لتفعيل حفظ الملفات المتحقق منه.|Reabre BetterNote para activar el guardado verificado.|Starte BetterNote neu, um geprüftes Speichern zu aktivieren.
bnoteImportFailed|تعذر استيراد الدفتر. لم يتم الاحتفاظ بدفتر ناقص.|No se pudo importar el cuaderno. No se conservó ningún cuaderno incompleto.|Das Notizbuch konnte nicht importiert werden. Es wurde kein unvollständiges Notizbuch behalten.
bnoteFolderMissing|المجلد المحدد لم يعد موجودًا. اختر مجلدًا آخر.|La carpeta elegida ya no existe. Elige otra.|Der gewählte Ordner existiert nicht mehr. Wähle einen anderen.
updateStoreEdition|إصدار Microsoft Store|Edición Microsoft Store|Microsoft-Store-Version
updateInstallerEdition|إصدار المثبّت|Edición con instalador|Installer-Version
updateToastAvailable|يتوفر تحديث لـ BetterNote|Hay una actualización de BetterNote|Ein BetterNote-Update ist verfügbar
updateToastSettings|راجع الإعدادات ← التحديثات والإصدار|Ve a Ajustes → Actualizaciones y versión|Öffne Einstellungen → Updates & Version
updateStoreNotice|يتحقق من Microsoft Store مرة يوميًا. يظهر إشعار قصير في الرئيسية عند توفر تحديث.|Busca en Microsoft Store una vez al día. Si hay una actualización, muestra un aviso breve en Inicio.|Prüft Microsoft Store einmal täglich. Bei einem Update erscheint ein kurzer Hinweis auf der Startseite.
updateStoreCheck|التحقق في Microsoft Store|Buscar en Microsoft Store|Im Microsoft Store prüfen
updateStoreOpened|صفحة BetterNote مفتوحة في Microsoft Store. استخدم تحديث إذا كان متاحًا.|Se abrió BetterNote en Microsoft Store. Pulsa Actualizar si está disponible.|Die BetterNote-Seite ist im Microsoft Store geöffnet. Nutze Aktualisieren, falls verfügbar.
updateFeedUnavailable|لم تُنشر معلومات الإصدار بعد. يمكنك مراجعة صفحة BetterNote في Microsoft Store.|Aún no se publicó información de versión. Puedes revisar BetterNote en Microsoft Store.|Noch keine Versionsinformationen veröffentlicht. Prüfe die BetterNote-Seite im Microsoft Store.
updateDailyCheckNotice|يتحقق من الإصدارات الجديدة في الخلفية مرة يوميًا. أنت تختار وقت التحديث.|Busca versiones nuevas en segundo plano una vez al día. Tú eliges cuándo actualizar.|Sucht einmal täglich im Hintergrund nach neuen Versionen. Du entscheidest, wann du aktualisierst.
updateFeaturesTitle|ميزات وتحسينات جديدة|Novedades y mejoras|Neue Funktionen & Verbesserungen
updateIsLatest|BetterNote محدّث (v{version})|BetterNote está al día (v{version})|BetterNote ist aktuell (v{version})
updateNewVersion|الإصدار الجديد:|Nueva versión:|Neue Version:
updateOnMicrosoftStore|التحديث عبر Microsoft Store|Actualizar en Microsoft Store|Im Microsoft Store aktualisieren
updateRemindLater|ذكّرني لاحقًا|Recordar más tarde|Später erinnern
updateSafeNotice|احفظ عملك واحتفظ بنسخة احتياطية قبل تثبيت التحديث.|Guarda tu trabajo y conserva una copia antes de actualizar.|Speichere deine Arbeit und behalte eine Sicherung, bevor du das Update installierst.
updateSectionTitle|الإصدار والتحديثات|Versión y actualizaciones|Version & Updates
updateTabAll|الكل|Todo|Alle
updateTabBugFixes|إصلاحات|Correcciones|Fehlerbehebungen
updateTabFeatures|الجديد|Novedades|Neuigkeiten
updateTitleNewVersion|يتوفر تحديث جديد!|¡Nueva actualización disponible!|Neues Update verfügbar!
widthSlot|خانة السمك|Ajuste de grosor|Stärkenplatz
writtenIndicator|تحتوي على كتابة ({count} خط)|Contiene escritura ({count} trazos)|Enthält Handschrift ({count} Striche)
zoomIn|تكبير|Ampliar|Vergrößern
zoomOut|تصغير|Reducir|Verkleinern
zoomReset|إعادة ضبط التكبير (100%)|Restablecer zoom (100%)|Zoom zurücksetzen (100 %)
cannotDeleteOnlyPage|لا يمكن حذف الصفحة الوحيدة المتبقية في الدفتر|No se puede eliminar la única página del cuaderno|Die einzige verbleibende Seite kann nicht gelöscht werden
captureEntirePageTooltip|التقاط الصفحة كاملة|Capturar toda la página|Ganze Seite erfassen
chooseCustomColor|اختيار لون مخصص (يحدّث الخانة تلقائيًا)|Elegir color personalizado (actualiza el ajuste)|Eigene Farbe wählen (aktualisiert den Farbplatz)
colorSlotTitle|خانة اللون #{slot}: {color}|Color #{slot}: {color}|Farbplatz #{slot}: {color}
confirmDeletePageNum|هل تريد حذف الصفحة {page}؟|¿Eliminar la página {page}?|Seite {page} löschen?
cropHelpText|اسحب الإطار أو المقابض لاختيار منطقة القص|Arrastra el marco o los controles para recortar|Rahmen oder Griffe ziehen, um den Zuschnitt auszuwählen
exportAllPages|تصدير كل الصفحات / الخيارات…|Exportar todas las páginas / opciones…|Alle Seiten exportieren / Optionen…
exportCurrentPage|تصدير الصفحة الحالية (.pdf)|Exportar página actual (.pdf)|Aktuelle Seite exportieren (.pdf)
exportPdfTooltip|تصدير PDF بجودة عالية (اختيار صفحة أو المستند كاملًا)|Exportar PDF de alta calidad (una página o todo el documento)|Hochwertige PDF exportieren (Seite oder ganzes Dokument wählen)
managePageTooltip|إدارة الصفحة (تكرار، حذف، إدراج بعدها)|Gestionar página (duplicar, eliminar, insertar después)|Seite verwalten (duplizieren, löschen, danach einfügen)
pasteImageTooltip|لصق صورة من الحافظة / لقطة شاشة [Ctrl+V]|Pegar imagen o captura del portapapeles [Ctrl+V]|Bild / Screenshot aus Zwischenablage einfügen [Strg+V]
resetOriginalTooltip|استعادة الصورة الملتقطة الأصلية|Volver a la captura original|Zum Originalbild zurückkehren
widthSlotTitle|خانة #{slot}: {val}px (اضغط مجددًا للضبط)|Ajuste #{slot}: {val}px (pulsa de nuevo para ajustar)|Platz #{slot}: {val}px (erneut tippen zum Anpassen)
penNibTapAgain|اضغط مجددًا لإعدادات الرأس|Pulsa de nuevo para ajustar la punta|Erneut tippen für Spitzeneinstellungen
taperOnDesc|مفعّل: أطراف متدرجة للخط|Activo: extremos afinados para caligrafía|Ein: Verjüngte Spitzen für Kalligrafie
taperOffDesc|معطّل: خط دائري ثابت|Inactivo: trazo redondo uniforme|Aus: Gleichmäßiger runder Strich
pressureOnDesc|مفعّل: سمك يتغير مع ضغط Surface Pen|Activo: grosor según la presión de Surface Pen|Ein: Dynamische Stärke durch Surface-Pen-Druck
pressureOffDesc|معطّل: سمك ثابت|Inactivo: grosor uniforme|Aus: Gleichmäßige Strichstärke
scribbleOnDesc|مفعّل: خربش ذهابًا وإيابًا بسرعة للمسح|Activo: garabatea de un lado a otro para borrar|Ein: Schnell hin und her kritzeln zum Radieren
scribbleOffDesc|معطّل: المسح بالخربشة متوقف|Inactivo: borrado con garabatos desactivado|Aus: Radieren durch Durchkritzeln deaktiviert
eraserTapAgain|اضغط مجددًا لتغيير الوضع|Pulsa de nuevo para cambiar modo|Erneut tippen, um den Modus zu wechseln
updateTab|التحديثات والإصدار|Actualizaciones y versión|Updates & Version
updateConnectError|تعذر الاتصال بخادم التحديث|No se pudo conectar al servidor de actualizaciones|Keine Verbindung zum Update-Server
updatePreviewDialog|معاينة نافذة التحديث|Vista previa del aviso de actualización|Update-Dialog ansehen
updateGoToStore|فتح Microsoft Store|Ir a Microsoft Store|Zum Microsoft Store
updateChangelog1|تقليل نسخ البيانات المؤقتة أثناء النسخ وتصدير .bnote لتقليل الذاكرة مع الحفاظ على الملاحظات القابلة للتعديل والصور الأصلية.|Menos copias temporales al crear copias y exportar .bnote para reducir memoria, conservando notas editables e imágenes originales.|Weniger temporäre Datenkopien beim Sichern und .bnote-Export sparen Speicher. Bearbeitbare Notizen und Originalbilder bleiben erhalten.
updateChangelog2|تحسين معاينة الخطوط الطويلة وعرض اللوحة البيضاء؛ تنتظر نسخ PDF التلقائية وقتًا هادئًا بعد الكتابة.|Mejoras en trazos largos y pizarra; las copias PDF automáticas esperan un momento de inactividad tras escribir.|Vorschau langer Striche und Whiteboard verbessert. Automatische PDF-Sicherungen warten nach dem Schreiben auf eine ruhige Phase.
updateChangelog3|المهام الثقيلة تستخدم طابورًا مشتركًا، ونسخ PDF يعالج الصفحات منفردة ويعيد استخدام الصفحات دون تغييرات.|Las tareas pesadas comparten una cola; la copia PDF procesa cada página y reutiliza las que no cambiaron.|Aufwendige Aufgaben teilen eine Warteschlange. Die PDF-Sicherung verarbeitet Seiten einzeln und nutzt unveränderte Seiten erneut.
updateChangelog4|تُحمّل الصور على دفعات في الخلفية؛ يمكن حفظ تقرير تشخيص يدويًا من هذا التبويب عند الإبلاغ عن مشكلة.|Las imágenes se cargan por bloques en segundo plano. Puedes guardar un informe de diagnóstico desde esta pestaña al reportar un problema.|Bilder werden in Blöcken im Hintergrund geladen. Beim Melden eines Problems kannst du hier manuell einen Diagnosebericht speichern.
updateFix1|إصلاح التشققات بين أجزاء الكتابة المصدّرة عند عرض PDF في Microsoft Edge.|Corregidas las grietas entre segmentos de escritura en PDF vistos en Microsoft Edge.|Risse zwischen exportierten Strichsegmenten in Microsoft Edge behoben.
updateFix2|إصلاح تعليق الإغلاق عند تصغير النافذة أو إخفائها؛ يكتمل الحفظ المحلي قبل الإغلاق.|Corregido el bloqueo al cerrar una ventana minimizada u oculta; el guardado local termina antes de cerrar.|Hängenbleiben beim Schließen minimierter oder versteckter Fenster behoben. Lokales Speichern wird vorher abgeschlossen.
updateFix3|إصلاح خطأ «Object has been destroyed» عند إغلاق التطبيق.|Corregido el error «Object has been destroyed» al cerrar.|Fehler „Object has been destroyed“ beim Schließen behoben.
updateFix4|إصلاح استمرار مهام الخلفية البطيئة بعد إلغائها أو انتهاء المهلة.|Corregidas las tareas de inicio lento que seguían tras cancelar o agotar el tiempo.|Langsam startende Hintergrundaufgaben laufen nach Abbruch oder Zeitüberschreitung nicht mehr weiter.
updateFix5|إصلاح تعطل مهام الخلفية الذي يترك الطابور منتظرًا؛ تحرر المهام الفاشلة مواردها.|Corregidos fallos que dejaban tareas pesadas esperando; las operaciones fallidas liberan sus recursos.|Fehler blockieren nachfolgende Aufgaben nicht mehr in der Warteschlange. Fehlgeschlagene Vorgänge geben Ressourcen frei.
updateFix6|تحسين تنظيف استيراد وتصدير PDF الملغى حتى لا تعاود مهمة قديمة العمل.|Mejorada la limpieza al cancelar importaciones y exportaciones PDF para que una tarea antigua no se reanude.|Bereinigung abgebrochener PDF-Importe und -Exporte verbessert, damit alte Aufgaben nicht weiterlaufen.
updateFeat1|إشعارات تحديث Microsoft Store مرة يوميًا عند فتح التطبيق|Avisos de actualización de Microsoft Store una vez al día al abrir|Tägliche Microsoft-Store-Updatehinweise beim App-Start
updateFeat2|نافذة واضحة للتغييرات والإصلاحات والميزات|Resumen claro de cambios, correcciones y funciones|Übersichtlicher Änderungsdialog mit Fehlerbehebungen und Funktionen
updateFeat3|تحسين سرعة الحفظ والنسخ مع تقليل نسخ البيانات|Guardado y copias más ágiles con menos duplicación de datos|Schnelleres Speichern und Sichern durch weniger Datenkopien
updateFeat4|حذف جماعي ذري في قاعدة البيانات ونظام الملفات|Eliminación por lotes atómica en base de datos y archivos|Atomare Stapellöschung in Datenbank und Dateisystem
saveFolderFailed|تعذر حفظ مجلد النسخ: |No se pudo guardar la carpeta de copias: |Sicherungsordner konnte nicht gespeichert werden: 
setLocalBackupFolderPrompt|حدد مسار مجلد النسخ المحلي (مثل H:\\My Drive\\BetterNote.AppPC أو C:\\Users\\...):|Ruta de la carpeta local de copias (p. ej. H:\\My Drive\\BetterNote.AppPC o C:\\Users\\...):|Pfad des lokalen Sicherungsordners (z. B. H:\\My Drive\\BetterNote.AppPC oder C:\\Users\\...):
`;
export const additionalTranslations = Object.fromEntries(['ar', 'es', 'de'].map((locale, index) => [locale,
  Object.fromEntries(rows.trim().split('\n').map(row => { const cells = row.split('|'); return [cells[0], cells[index + 1]]; }))
]));
