// Pegar este código en https://script.google.com desde la cuenta flotaambulz@gmail.com
// IMPORTANTE: Cambia 'CAMBIAR_POR_TU_TOKEN_SECRETO' por una clave privada tuya
// y pon esa misma clave en Ambu-lzflota -> Backup -> Token Secreto Drive/Email.
// Luego: Implementar -> Gestionar implementaciones -> Editar (lápiz) -> Nueva versión -> Implementar

var SECRET_TOKEN = 'CAMBIAR_POR_TU_TOKEN_SECRETO';

function getOrCreateRootFolder() {
  var rootName = 'Ambu-lzflota';
  var rootFolders = DriveApp.getFoldersByName(rootName);
  return rootFolders.hasNext()
    ? rootFolders.next()
    : DriveApp.createFolder(rootName);
}

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    if (!payload.token || payload.token !== SECRET_TOKEN) {
      return ContentService.createTextOutput(
        JSON.stringify({ ok: false, error: 'Token secreto inválido o no configurado.' })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    var rootFolder = getOrCreateRootFolder();

    // 1. Envío de correo electrónico directo desde flotaambulz@gmail.com
    if (payload.action === 'send_email') {
      if (!payload.to || !payload.subject || !payload.body) {
        return ContentService.createTextOutput(
          JSON.stringify({ ok: false, error: 'Faltan campos de correo (to, subject, body).' })
        ).setMimeType(ContentService.MimeType.JSON);
      }

      MailApp.sendEmail({
        to: payload.to,
        subject: payload.subject,
        body: payload.body,
        htmlBody: payload.htmlBody || undefined,
        name: 'Ambu-lzflota (Flota)',
      });

      return ContentService.createTextOutput(
        JSON.stringify({
          ok: true,
          sentFrom: Session.getEffectiveUser().getEmail() || 'flotaambulz@gmail.com',
          rootFolderUrl: rootFolder.getUrl(),
        })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    // 2. Obtener enlace directo de la carpeta Ambu-lzflota en Drive
    if (payload.action === 'get_folder') {
      return ContentService.createTextOutput(
        JSON.stringify({
          ok: true,
          rootFolderUrl: rootFolder.getUrl(),
        })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    // 2b. Registrar parte cerrado en Google Sheets (Base_Datos_Partes_Cerrados)
    if (payload.action === 'append_closed_report' && payload.record) {
      var sheetFileName = 'Base_Datos_Partes_Cerrados';
      var files = rootFolder.getFilesByName(sheetFileName);
      var ss;
      if (files.hasNext()) {
        ss = SpreadsheetApp.open(files.next());
      } else {
        ss = SpreadsheetApp.create(sheetFileName);
        var createdFile = DriveApp.getFileById(ss.getId());
        rootFolder.addFile(createdFile);
        DriveApp.getRootFolder().removeFile(createdFile);
        var initSheet = ss.getSheets()[0];
        initSheet.setName('Partes Cerrados');
        initSheet.appendRow([
          'ID',
          'Fecha Cierre',
          'Fecha Parte',
          'Unidad',
          'Matrícula',
          'Km',
          'Urgencia',
          'Reportado por',
          'Cerrado por',
          'Tipo Cierre',
          'Orden Taller',
          'Taller',
          'Resumen / Avería',
          'Anomalías',
          'Resolución',
        ]);
        initSheet.getRange(1, 1, 1, 15).setFontWeight('bold');
      }

      var r = payload.record;
      var sheet = ss.getSheetByName('Partes Cerrados') || ss.getSheets()[0];
      sheet.appendRow([
        r.id || '',
        r.closedAt || '',
        r.reportDate || '',
        r.ambulanceCode || '',
        r.plate || '',
        r.mileage || 0,
        r.urgency || '',
        r.reporterName || '',
        r.closedBy || '',
        r.closureType || '',
        r.linkedWorkOrderCode || '',
        r.workshopName || '',
        r.summary || '',
        Array.isArray(r.anomalies) ? r.anomalies.join(' | ') : '',
        r.resolution || '',
      ]);

      return ContentService.createTextOutput(
        JSON.stringify({
          ok: true,
          sheetUrl: ss.getUrl(),
          rootFolderUrl: rootFolder.getUrl(),
        })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    // 2c. Respaldo gratuito de Partes Rápidos por Unidad (cuando Firestore agota cuota o falla)
    if (payload.action === 'submit_unit_report' && payload.report) {
      var repSheetName = 'Partes_Rapidos_Pendientes';
      var repFiles = rootFolder.getFilesByName(repSheetName);
      var repSs;
      if (repFiles.hasNext()) {
        repSs = SpreadsheetApp.open(repFiles.next());
      } else {
        repSs = SpreadsheetApp.create(repSheetName);
        var repCreated = DriveApp.getFileById(repSs.getId());
        rootFolder.addFile(repCreated);
        DriveApp.getRootFolder().removeFile(repCreated);
        var repInit = repSs.getSheets()[0];
        repInit.setName('Pendientes');
        repInit.appendRow([
          'ID',
          'Status',
          'Fecha',
          'CreatedAtIso',
          'AmbulanceId',
          'AmbulanceCode',
          'Matricula',
          'ReporterName',
          'Km',
          'ReportType',
          'Urgency',
          'Description',
        ]);
        repInit.getRange(1, 1, 1, 12).setFontWeight('bold');
      }
      var rep = payload.report;
      var repSheet = repSs.getSheetByName('Pendientes') || repSs.getSheets()[0];
      repSheet.appendRow([
        rep.id || '',
        'pending',
        rep.date || '',
        rep.createdAtIso || '',
        rep.ambulanceId || '',
        rep.ambulanceCode || '',
        rep.plate || '',
        rep.reporterName || '',
        rep.mileage || 0,
        rep.reportType || 'averia',
        rep.urgency || 'Prioritaria',
        rep.description || '',
      ]);
      return ContentService.createTextOutput(
        JSON.stringify({ ok: true, sheetUrl: repSs.getUrl(), rootFolderUrl: rootFolder.getUrl() })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    if (payload.action === 'get_pending_unit_reports') {
      var pendFiles = rootFolder.getFilesByName('Partes_Rapidos_Pendientes');
      if (!pendFiles.hasNext()) {
        return ContentService.createTextOutput(
          JSON.stringify({ ok: true, reports: [] })
        ).setMimeType(ContentService.MimeType.JSON);
      }
      var pendSs = SpreadsheetApp.open(pendFiles.next());
      var pendSheet = pendSs.getSheetByName('Pendientes') || pendSs.getSheets()[0];
      var values = pendSheet.getDataRange().getValues();
      var pendingList = [];
      for (var i = 1; i < values.length; i++) {
        var row = values[i];
        if (String(row[1]) === 'pending' && row[0]) {
          pendingList.push({
            id: String(row[0]),
            status: 'pending',
            date: String(row[2] || ''),
            createdAtIso: String(row[3] || ''),
            ambulanceId: row[4] ? String(row[4]) : undefined,
            ambulanceCode: row[5] ? String(row[5]) : undefined,
            plate: String(row[6] || ''),
            reporterName: String(row[7] || ''),
            mileage: Number(row[8] || 0),
            reportType: String(row[9] || 'averia'),
            urgency: String(row[10] || 'Prioritaria'),
            description: String(row[11] || ''),
            photos: [],
          });
        }
      }
      return ContentService.createTextOutput(
        JSON.stringify({ ok: true, reports: pendingList })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    if (payload.action === 'mark_unit_report_imported' && payload.reportId) {
      var markFiles = rootFolder.getFilesByName('Partes_Rapidos_Pendientes');
      if (markFiles.hasNext()) {
        var markSs = SpreadsheetApp.open(markFiles.next());
        var markSheet = markSs.getSheetByName('Pendientes') || markSs.getSheets()[0];
        var markValues = markSheet.getDataRange().getValues();
        for (var j = 1; j < markValues.length; j++) {
          if (String(markValues[j][0]) === String(payload.reportId)) {
            markSheet.getRange(j + 1, 2).setValue('imported');
            break;
          }
        }
      }
      return ContentService.createTextOutput(
        JSON.stringify({ ok: true })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    // 3. Subida de archivos/fotos/backups organizados por subcarpeta
    var targetFolder = rootFolder;
    if (payload.subfolder) {
      var subFolders = rootFolder.getFoldersByName(payload.subfolder);
      targetFolder = subFolders.hasNext()
        ? subFolders.next()
        : rootFolder.createFolder(payload.subfolder);
    }

    var decoded = Utilities.base64Decode(payload.base64);
    var blob = Utilities.newBlob(
      decoded,
      payload.mimeType || 'application/octet-stream',
      payload.fileName || 'archivo'
    );
    var file = targetFolder.createFile(blob);

    return ContentService.createTextOutput(
      JSON.stringify({
        ok: true,
        fileId: file.getId(),
        fileUrl: file.getUrl(),
        rootFolderUrl: rootFolder.getUrl(),
      })
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({ ok: false, error: String(err) })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}
