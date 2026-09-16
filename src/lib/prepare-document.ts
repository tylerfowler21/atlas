/// Turn a photo or screenshot into something that will actually arrive.
///
/// iPhone screenshots are multi-megabyte PNGs. Posted through a Function they
/// die as a dropped connection; even posted straight to Blob they are a slow
/// way to send a confirmation. JPEG at a size you can still read a booking
/// reference is the same file as far as anyone opening it is concerned.
import { resolveDocumentType } from "@/lib/trip-documents";

const MAX_EDGE = 2560;
const JPEG_QUALITY = 0.82;

function shouldCompress(type: string) {
  return type === "image/png" || type === "image/heic" || type === "image/webp" || type === "image/jpeg";
}

async function headerBytes(file: File) {
  return new Uint8Array(await file.slice(0, 16).arrayBuffer());
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that photo"));
    };
    image.src = url;
  });
}

function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (typeof canvas.toBlob === "function") {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Could not encode that photo"));
        },
        "image/jpeg",
        JPEG_QUALITY,
      );
      return;
    }
    try {
      const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
      const comma = dataUrl.indexOf(",");
      const binary = atob(dataUrl.slice(comma + 1));
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      resolve(new Blob([bytes], { type: "image/jpeg" }));
    } catch (error) {
      reject(error);
    }
  });
}

async function compressImage(file: File): Promise<File> {
  const image = await loadImage(file);
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (!width || !height) throw new Error("Could not read that photo");

  const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not encode that photo");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const blob = await canvasToJpeg(canvas);
  // Keep the original if JPEG somehow came out larger — a small photo that is
  // already a JPEG should not get worse for the sake of going through a canvas.
  if (blob.size >= file.size && file.type === "image/jpeg") return file;
  return new File([blob], file.name, { type: "image/jpeg", lastModified: file.lastModified });
}

/// The file we will actually send: typed, and if it is a photo, shrunk.
/// Returns the original (with a type filled in) when compression is not
/// possible — HEIC in a browser that cannot draw it, a PDF, a Word doc.
export async function prepareDocumentFile(file: File): Promise<File> {
  const type = resolveDocumentType({
    type: file.type,
    name: file.name,
    bytes: await headerBytes(file),
  });
  if (!type) return file;

  if (shouldCompress(type)) {
    try {
      return await compressImage(file);
    } catch {
      // Fall through: the original still goes, now with a type Blob will accept.
    }
  }

  if (type === file.type) return file;
  return new File([file], file.name, { type, lastModified: file.lastModified });
}
