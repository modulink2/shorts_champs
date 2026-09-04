import { useEffect, useRef } from 'react';

// Animated short-track oval rings + drifting particles, adapted from the
// reference glassmorphism background (canvas-only, no image asset).
export default function TrackBackground() {
  const trackRef = useRef<HTMLCanvasElement>(null);
  const particleRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const trackCanvas = trackRef.current!;
    const particleCanvas = particleRef.current!;
    const tCtx = trackCanvas.getContext('2d')!;
    const pCtx = particleCanvas.getContext('2d')!;
    let W = 0, H = 0;
    let dashOffset = 0;
    let raf = 0;

    const tracks = [
      { rx: 340, ry: 195, dash: [18, 22], width: 1.5, color: 'rgba(168,208,255,0.35)', dir: 1 },
      { rx: 420, ry: 240, dash: [2, 28], width: 1.8, color: 'rgba(180,215,255,0.4)', dir: -1 },
    ];
    const particles = Array.from({ length: 38 }, (_, i) => ({
      angle: (i / 38) * Math.PI * 2,
      r: 380 + Math.random() * 280,
      ryRatio: 0.55 + Math.random() * 0.15,
      speed: 0.0004 + Math.random() * 0.0008,
      size: 1 + Math.random() * 2.2,
      opacity: 0.15 + Math.random() * 0.4,
    }));

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      W = trackCanvas.width = particleCanvas.width = window.innerWidth * dpr;
      H = trackCanvas.height = particleCanvas.height = window.innerHeight * dpr;
      trackCanvas.style.width = particleCanvas.style.width = window.innerWidth + 'px';
      trackCanvas.style.height = particleCanvas.style.height = window.innerHeight + 'px';
      tCtx.setTransform(1, 0, 0, 1, 0, 0);
      pCtx.setTransform(1, 0, 0, 1, 0, 0);
      tCtx.scale(dpr, dpr);
      pCtx.scale(dpr, dpr);
    }
    resize();
    window.addEventListener('resize', resize);

    function drawTracks() {
      const dpr = window.devicePixelRatio || 1;
      const cw = W / dpr, ch = H / dpr;
      tCtx.clearRect(0, 0, cw, ch);
      tracks.forEach((tr, idx) => {
        tCtx.save();
        tCtx.translate(cw / 2, ch / 2);
        tCtx.strokeStyle = tr.color;
        tCtx.lineWidth = tr.width;
        tCtx.setLineDash(tr.dash);
        tCtx.lineDashOffset = dashOffset * tr.dir * (1 + idx * 0.3);
        tCtx.beginPath();
        tCtx.ellipse(0, 0, tr.rx, tr.ry, 0, 0, Math.PI * 2);
        tCtx.stroke();
        tCtx.setLineDash([]);
        tCtx.globalAlpha = 0.1;
        tCtx.strokeStyle = '#8AB8E8';
        tCtx.lineWidth = 0.6;
        tCtx.beginPath();
        tCtx.ellipse(0, 0, tr.rx * 0.92, tr.ry * 0.92, 0, 0, Math.PI * 2);
        tCtx.stroke();
        tCtx.restore();
      });
    }

    function drawParticles() {
      const dpr = window.devicePixelRatio || 1;
      const cw = W / dpr, ch = H / dpr;
      pCtx.clearRect(0, 0, cw, ch);
      particles.forEach(p => {
        p.angle += p.speed * 0.2;
        const x = cw / 2 + Math.cos(p.angle) * p.r;
        const y = ch / 2 + Math.sin(p.angle) * p.r * p.ryRatio;
        pCtx.beginPath();
        pCtx.fillStyle = `rgba(180,210,255,${p.opacity})`;
        pCtx.arc(x, y, p.size, 0, Math.PI * 2);
        pCtx.fill();
      });
    }

    function loop() {
      dashOffset += 0.15;
      drawTracks();
      drawParticles();
      raf = requestAnimationFrame(loop);
    }
    loop();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <>
      <canvas ref={trackRef} className="absolute inset-0 w-full h-full opacity-90" style={{ filter: 'blur(1.5px)' }} />
      <canvas ref={particleRef} className="absolute inset-0 w-full h-full opacity-60" />
    </>
  );
}
