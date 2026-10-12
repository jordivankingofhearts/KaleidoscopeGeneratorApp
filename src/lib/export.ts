export async function exportCanvas(
  canvas: HTMLCanvasElement,
  format: 'png' | 'jpg'
): Promise<void> {
  return new Promise((resolve, reject) => {
    const type = format === 'png' ? 'image/png' : 'image/jpeg';
    canvas.toBlob(
      (blob) => {
        if (!blob) { reject(new Error('Export failed — canvas returned null blob')); return; }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `kaleidoscope-${Date.now()}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        resolve();
      },
      type,
      format === 'jpg' ? 0.95 : undefined
    );
  });
}
