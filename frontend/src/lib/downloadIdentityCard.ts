import { toPng } from 'html-to-image';

async function waitForImages(root: HTMLElement): Promise<void> {
  const images = Array.from(root.querySelectorAll('img'));
  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) {
            resolve();
            return;
          }
          const done = () => resolve();
          img.addEventListener('load', done, { once: true });
          img.addEventListener('error', done, { once: true });
        }),
    ),
  );
}

export async function downloadIdentityCard(element: HTMLElement, filename: string): Promise<void> {
  await waitForImages(element);

  const dataUrl = await toPng(element, {
    cacheBust: true,
    pixelRatio: 2,
    skipFonts: true,
    backgroundColor: '#c5e8f7',
  });

  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  link.click();
}
