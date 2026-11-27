// Pegar este código en https://script.google.com desde la cuenta flotaambulz@gmail.com
// y en: Implementar -> Gestionar implementaciones -> Editar (lápiz) -> Versión: Nueva versión -> Implementar

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
