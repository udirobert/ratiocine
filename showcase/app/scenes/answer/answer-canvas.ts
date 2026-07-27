// Universal canvas-2D renderer for the Answer card.
// Draws the answer reveal card to a 2D canvas so the Voronoi explosion
// can use it as a THREE.CanvasTexture without drawElementImage.

export const CARD_W = 560;
export const CARD_H = 380;

const roundRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

export const drawAnswerCard = (ctx: CanvasRenderingContext2D): void => {
  // background
  ctx.fillStyle = '#0a0f2e';
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  const cx = CARD_W / 2;
  let y = 70;

  // label
  ctx.fillStyle = '#ffffff66' as string;
  ctx.font = '11px ui-monospace, "SF Mono", Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('APURINÃ TRANSLATION · QUERY #1', cx, y);
  y += 28;

  // answer box
  const boxW = 360;
  const boxX = cx - boxW / 2;
  const boxH = 92;
  ctx.fillStyle = '#ffffff0d' as string;
  roundRect(ctx, boxX, y, boxW, boxH, 12);
  ctx.fill();
  ctx.strokeStyle = '#ffffff33' as string;
  ctx.lineWidth = 1;
  roundRect(ctx, boxX, y, boxW, boxH, 12);
  ctx.stroke();

  ctx.fillStyle = '#ffffff99' as string;
  ctx.font = '15px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText('we (incl.) are eating', cx, y + 18);

  ctx.fillStyle = '#7dd3fc';
  ctx.font = 'bold 30px ui-monospace, "SF Mono", Menlo, monospace';
  ctx.fillText('kaakutaka', cx, y + 44);
  y += boxH + 22;

  // reasoning box
  const rW = 400;
  const rX = cx - rW / 2;
  const rH = 110;
  ctx.fillStyle = '#ffffff0d' as string;
  roundRect(ctx, rX, y, rW, rH, 12);
  ctx.fill();
  ctx.strokeStyle = '#ffffff1a' as string;
  roundRect(ctx, rX, y, rW, rH, 12);
  ctx.stroke();

  ctx.fillStyle = '#ffffff66' as string;
  ctx.font = '10px ui-monospace, "SF Mono", Menlo, monospace';
  ctx.textAlign = 'left';
  ctx.fillText('MODEL REASONING (COT)', rX + 16, y + 12);

  // reasoning text — drawn as colored segments
  ctx.font = '12px ui-sans-serif, system-ui, sans-serif';
  const tx = rX + 16;
  const tw = rW - 32;
  const segments: { text: string; color: string }[] = [
    { text: 'The prefix ', color: '#ffffff99' as string },
    { text: 'kaa-', color: '#a78bfa' },
    { text: " marks inclusive 'we' (example 10: ", color: '#ffffff99' as string },
    { text: 'kaapitaka', color: '#ffffffcc' as string },
    { text: " = 'we incl. are going'). The root ", color: '#ffffff99' as string },
    { text: '-kuta-', color: '#fbbf24' },
    { text: " = 'eat' (examples 4–6). The suffix ", color: '#ffffff99' as string },
    { text: '-ka', color: '#34d399' },
    { text: ' marks present progressive. Combine: ', color: '#ffffff99' as string },
    { text: 'kaa·kuta·ka', color: '#7dd3fc' },
    { text: '.', color: '#ffffff99' as string },
  ];

  // simple word-wrap across segments
  let px = tx;
  let py = y + 32;
  const lineHeight = 17;
  for (const seg of segments) {
    const words = seg.text.split(' ');
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const w = ctx.measureText(word).width;
      const spaceW = i < words.length - 1 ? ctx.measureText(' ').width : 0;
      if (px + w + spaceW > tx + tw) {
        px = tx;
        py += lineHeight;
      }
      ctx.fillStyle = seg.color;
      ctx.fillText(word, px, py);
      px += w;
      if (i < words.length - 1) px += spaceW;
    }
  }

  // hint
  ctx.fillStyle = '#ffffff4d' as string;
  ctx.font = '11px ui-sans-serif, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Click anywhere to trigger explosion', cx, CARD_H - 30);
};
