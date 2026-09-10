// Paper Template Background Renderer for BetterNote

export const renderPaperBackground = (ctx, width, height, template) => {
  ctx.save();

  const bg = template?.bg || '#ffffff';
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  const type = template?.type || 'blank';
  const spacing = template?.spacing || 32;

  if (type === 'ruled') {
    // Ruled lines
    ctx.strokeStyle = template.lineColor || '#e2e8f0';
    ctx.lineWidth = 1;

    for (let y = spacing * 2; y < height - spacing; y += spacing) {
      ctx.beginPath();
      ctx.moveTo(30, y);
      ctx.lineTo(width - 30, y);
      ctx.stroke();
    }

    // Optional red/pink vertical margin line
    ctx.strokeStyle = '#fda4af';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(80, 0);
    ctx.lineTo(80, height);
    ctx.stroke();

  } else if (type === 'grid') {
    // Graph grid
    ctx.strokeStyle = template.lineColor || '#e2e8f0';
    ctx.lineWidth = 0.75;

    // Vertical lines
    for (let x = spacing; x < width; x += spacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    // Horizontal lines
    for (let y = spacing; y < height; y += spacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

  } else if (type === 'dotted') {
    // Dot grid
    ctx.fillStyle = template.dotColor || '#cbd5e1';
    const dotRadius = 1.2;

    for (let x = spacing; x < width; x += spacing) {
      for (let y = spacing; y < height; y += spacing) {
        ctx.beginPath();
        ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

  } else if (type === 'cornell') {
    // Cornell notes format
    const cueWidth = template.cueWidth || 200;
    const summaryHeight = template.summaryHeight || 160;

    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.5;

    // Header line
    ctx.beginPath();
    ctx.moveTo(0, 80);
    ctx.lineTo(width, 80);
    ctx.stroke();

    // Cue column separator line
    ctx.beginPath();
    ctx.moveTo(cueWidth, 80);
    ctx.lineTo(cueWidth, height - summaryHeight);
    ctx.stroke();

    // Summary box horizontal line
    ctx.beginPath();
    ctx.moveTo(0, height - summaryHeight);
    ctx.lineTo(width, height - summaryHeight);
    ctx.stroke();

    // Lined notes inside the main area
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1;
    for (let y = 110; y < height - summaryHeight - 10; y += spacing) {
      ctx.beginPath();
      ctx.moveTo(cueWidth + 10, y);
      ctx.lineTo(width - 20, y);
      ctx.stroke();
    }

    // Text labels for Cornell
    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px Plus Jakarta Sans, sans-serif';
    ctx.fillText('CUE COLUMN / TOPICS', 24, 105);
    ctx.fillText('NOTES', cueWidth + 24, 105);
    ctx.fillText('SUMMARY', 24, height - summaryHeight + 24);
  }

  ctx.restore();
};
