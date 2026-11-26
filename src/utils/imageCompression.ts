/**
 * Utilidad centralizada para comprimir imágenes y documentos escaneados antes de guardarlos
 * en LocalStorage, evitando superar el límite de ~5MB del navegador.
 */
export const compressImageFile = (
  file: File,
  maxDim = 640,
  quality = 0.62
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const resultStr = ev.target?.result as string;
      if (!file.type.startsWith('image/')) {
        // Si es un PDF pequeño (< 250KB) lo permitimos, si no guardamos solo referencia
        if (file.size <= 250 * 1024) {
          resolve(resultStr);
        } else {
          reject(
            new Error(
              'El archivo PDF supera 250 KB. Para adjuntar documentos en modo offline usa una foto o captura que se comprimirá automáticamente.'
            )
          );
        }
        return;
      }

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        } else {
          resolve(resultStr);
        }
      };
      img.onerror = reject;
      img.src = resultStr;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};
