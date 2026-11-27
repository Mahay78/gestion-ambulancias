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
