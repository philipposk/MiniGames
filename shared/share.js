(function () {
  const W = 1080, H = 1080;
  function drawCard(opts) {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, opts.bg1 || '#0b1020');
    g.addColorStop(1, opts.bg2 || '#1b2454');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const r = ctx.createRadialGradient(W*0.8, H*0.2, 40, W*0.8, H*0.2, 600);
    r.addColorStop(0, (opts.accent || '#5cf2c4') + 'cc');
    r.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = r; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#f5f7ff';
    ctx.textAlign = 'left';
    ctx.font = '700 56px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText(opts.gameTitle || 'MiniGames', 80, 160);
    ctx.font = '500 32px ui-sans-serif, system-ui, sans-serif';
    ctx.fillStyle = opts.accent || '#5cf2c4';
    ctx.fillText(opts.subtitle || 'New high score', 80, 210);
    ctx.fillStyle = '#f5f7ff';
    ctx.font = '900 220px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText(String(opts.score == null ? 0 : opts.score), 80, 530);
    ctx.font = '600 48px ui-sans-serif, system-ui, sans-serif';
    ctx.fillStyle = '#cbd0ee';
    ctx.fillText(opts.name || 'Anonymous', 80, 620);
    if (opts.detail) {
      ctx.font = '500 32px ui-sans-serif, system-ui, sans-serif';
      ctx.fillStyle = '#9aa3c7';
      ctx.fillText(opts.detail, 80, 670);
    }
    ctx.font = '500 34px ui-sans-serif, system-ui, sans-serif';
    ctx.fillStyle = '#9aa3c7';
    ctx.fillText('philipposk.github.io/MiniGames', 80, H - 80);
    return c;
  }
  function canvasToPngBlob(canvas) {
    return new Promise(res => canvas.toBlob(res, 'image/png', 0.92));
  }
  function download(canvas, filename) {
    const a = document.createElement('a');
    a.download = filename || 'score.png';
    a.href = canvas.toDataURL('image/png');
    document.body.appendChild(a); a.click(); a.remove();
  }
  async function share(opts) {
    const canvas = drawCard(opts);
    const blob = await canvasToPngBlob(canvas);
    const file = new File([blob], 'score.png', { type: 'image/png' });
    const data = {
      title: opts.gameTitle || 'MiniGames',
      text: (opts.name || 'I') + ' scored ' + (opts.score || 0) + ' on ' + (opts.gameTitle || 'MiniGames') + '!',
      url: opts.url || 'https://philipposk.github.io/MiniGames/',
      files: [file]
    };
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share(data); return 'shared'; } catch (e) { if (e.name === 'AbortError') return 'cancelled'; }
    }
    if (navigator.share) {
      try { await navigator.share({ title: data.title, text: data.text, url: data.url }); return 'shared'; } catch (e) { if (e.name === 'AbortError') return 'cancelled'; }
    }
    download(canvas, (opts.gameTitle || 'score') + '.png');
    return 'downloaded';
  }
  window.MGShare = { drawCard, share, download };
})();
