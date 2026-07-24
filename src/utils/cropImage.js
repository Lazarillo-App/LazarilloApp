// src/utils/cropImage.js
// Genera una imagen recortada (base64) a partir de la fuente + área de recorte + rotación.

function createImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (e) => reject(e));
    image.setAttribute('crossOrigin', 'anonymous'); // evita "tainted canvas" con URLs remotas
    image.src = url;
  });
}

function getRadianAngle(degreeValue) {
  return (degreeValue * Math.PI) / 180;
}

/**
 * @param {string} imageSrc - base64 o URL de la imagen original
 * @param {Object} pixelCrop - { x, y, width, height } del área a recortar
 * @param {number} rotation - grados (0, 90, 180, 270)
 * @returns {Promise<string>} base64 (jpeg) de la imagen recortada
 */
export async function getCroppedImg(imageSrc, pixelCrop, rotation = 0) {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const rotRad = getRadianAngle(rotation);

  // Tamaño del canvas rotado que contiene la imagen
  const bBoxWidth = Math.abs(Math.cos(rotRad) * image.width) + Math.abs(Math.sin(rotRad) * image.height);
  const bBoxHeight = Math.abs(Math.sin(rotRad) * image.width) + Math.abs(Math.cos(rotRad) * image.height);

  canvas.width = bBoxWidth;
  canvas.height = bBoxHeight;

  // Rotar alrededor del centro
  ctx.translate(bBoxWidth / 2, bBoxHeight / 2);
  ctx.rotate(rotRad);
  ctx.translate(-image.width / 2, -image.height / 2);
  ctx.drawImage(image, 0, 0);

  // Extraer el área recortada
  const data = ctx.getImageData(pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height);

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  ctx.putImageData(data, 0, 0);

  // Devolver como jpeg (más liviano que png para fotos)
  return canvas.toDataURL('image/jpeg', 0.9);
}