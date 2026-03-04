import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";

const MARGIN = 20; // pts
const PAGE_W_PORTRAIT = 612;
const PAGE_H_PORTRAIT = 792;
const PAGE_W_LANDSCAPE = 792;
const PAGE_H_LANDSCAPE = 612;

/**
 * Scan upward from idealY to find the best row to break on.
 * Picks the row with the fewest non-white pixels (between cards).
 */
function findSafeBreak(
  canvas: HTMLCanvasElement,
  idealY: number,
  maxSearch: number,
): number {
  const ctx = canvas.getContext("2d")!;
  const sampleStep = Math.max(1, Math.floor(canvas.width / 60));

  let bestY = idealY;
  let bestScore = Infinity;

  for (let y = idealY; y > idealY - maxSearch && y > 0; y--) {
    const row = ctx.getImageData(0, y, canvas.width, 1).data;
    let nonWhiteCount = 0;
    let samples = 0;

    for (let px = 0; px < canvas.width; px += sampleStep) {
      const i = px * 4;
      samples++;
      if (row[i] < 240 || row[i + 1] < 240 || row[i + 2] < 240) {
        nonWhiteCount++;
      }
    }

    const score = nonWhiteCount / samples;
    if (score < 0.05) return y;
    if (score < bestScore) {
      bestScore = score;
      bestY = y;
    }
  }

  return bestY;
}

export async function exportTimelinePdf(
  element: HTMLElement,
  filename: string,
  options?: { fitOnePage?: boolean },
): Promise<void> {
  // Remove shadow temporarily to avoid canvas expansion
  const prevBoxShadow = element.style.boxShadow;
  element.style.boxShadow = "none";
  element.offsetHeight;

  let canvas: HTMLCanvasElement;
  try {
    canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
    });
  } finally {
    element.style.boxShadow = prevBoxShadow;
  }

  // Choose orientation: landscape if content would be squeezed below 75% in portrait
  const portraitContentW = PAGE_W_PORTRAIT - MARGIN * 2; // 572
  const sourceWidthInPt = (canvas.width / 2) * (72 / 96); // convert source px to pt
  const portraitScale = portraitContentW / sourceWidthInPt;

  const useLandscape = portraitScale < 0.75;
  const pageW = useLandscape ? PAGE_W_LANDSCAPE : PAGE_W_PORTRAIT;
  const pageH = useLandscape ? PAGE_H_LANDSCAPE : PAGE_H_PORTRAIT;
  const contentW = pageW - MARGIN * 2;
  const contentH = pageH - MARGIN * 2;

  const imgWidth = contentW;
  const imgHeight = (canvas.height / canvas.width) * imgWidth;

  const pdf = new jsPDF({
    orientation: useLandscape ? "landscape" : "portrait",
    unit: "pt",
    format: "letter",
  });

  if (imgHeight <= contentH || options?.fitOnePage) {
    let finalW = imgWidth;
    let finalH = imgHeight;
    if (finalH > contentH) {
      const scale = contentH / finalH;
      finalW *= scale;
      finalH = contentH;
    }
    pdf.addImage(
      canvas.toDataURL("image/jpeg", 0.92),
      "JPEG",
      MARGIN,
      MARGIN,
      finalW,
      finalH,
    );
  } else {
    const scaleFactor = canvas.width / imgWidth;
    const idealSliceHeight = Math.floor(contentH * scaleFactor);
    const maxSearch = Math.floor(250 * 2);
    let srcY = 0;
    let page = 0;

    while (srcY < canvas.height) {
      const remainingHeight = canvas.height - srcY;
      if (remainingHeight < idealSliceHeight * 0.05) break;

      let thisSliceHeight: number;
      if (remainingHeight <= idealSliceHeight) {
        thisSliceHeight = remainingHeight;
      } else {
        const idealBreak = srcY + idealSliceHeight;
        const safeBreak = findSafeBreak(canvas, idealBreak, maxSearch);
        thisSliceHeight = safeBreak - srcY;
      }

      const thisContentHeight = thisSliceHeight / scaleFactor;

      const sliceCanvas = document.createElement("canvas");
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = thisSliceHeight;
      const ctx = sliceCanvas.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
      ctx.drawImage(
        canvas,
        0,
        srcY,
        canvas.width,
        thisSliceHeight,
        0,
        0,
        canvas.width,
        thisSliceHeight,
      );

      if (page > 0) pdf.addPage();
      pdf.addImage(
        sliceCanvas.toDataURL("image/jpeg", 0.92),
        "JPEG",
        MARGIN,
        MARGIN,
        imgWidth,
        thisContentHeight,
      );

      srcY += thisSliceHeight;
      page++;
    }
  }

  pdf.save(filename);
}
