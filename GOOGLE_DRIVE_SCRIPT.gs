// Pegar este código en https://script.google.com desde la cuenta flotaambulz@gmail.com
// y publicar como: Implementar -> Nueva implementación -> Aplicación web
// Ejecutar como: Yo (flotaambulz@gmail.com) | Quién tiene acceso: Cualquier usuario

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var rootName = 'Ambu-lzflota';
    var rootFolders = DriveApp.getFoldersByName(rootName);
    var rootFolder = rootFolders.hasNext()
      ? rootFolders.next()
      : DriveApp.createFolder(rootName);

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
      })
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({ ok: false, error: String(err) })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}
