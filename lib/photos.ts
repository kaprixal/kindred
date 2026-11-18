"use client";

/** Downscales a photo to a small JPEG so it fits in browser storage and a search request. */
export async function resizePhoto(file: File, maxSide = 512): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Couldn't read that image"));
      i.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.8);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function dataUrlParts(dataUrl: string): { contentType: string; data: string } {
  const m = dataUrl.match(/^data:([^;]+);base64,(.*)$/);
  return m ? { contentType: m[1], data: m[2] } : { contentType: "image/jpeg", data: "" };
}
