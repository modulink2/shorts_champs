import { useEffect, useRef } from 'react';

// Animated short-track oval rings + drifting particles, adapted from the
// reference glassmorphism background (canvas-only, no image asset).
// Each ring is drawn as a tapering comet trail (thick/opaque head fading to
// a thin transparent tail) racing around a faint static baseline ellipse,
// tinted with the active theme's accent color.
export default function TrackBackground() {
  const trackRef = useRef<HTMLCanvasElement>(null);
  const particleRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const trackCanvas = trackRef.current!;
    const particleCanvas = particleRef.current!;
    const tCtx = trackCanvas.getContext('2d')!;
    const pCtx = particleCanvas.getContext('2d')!;
    let W = 0, H = 0;
    let raf = 0;

    // Theme accent as "r,g,b", re-read whenever the theme attribute changes.
    let accentRgb = '168,208,255';
    const readAccent = () => {
      const v = getComputedStyle(document.documentElement).getPropertyValue('--c-D4AF37-rgb').trim();
      if (v) accentRgb = v;
    };
    readAccent();
    const themeObserver = new MutationObserver(readAccent);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    // Short track speed skating always races counterclockwise, so every
    // ring/particle turns the same way (decreasing angle = CCW in canvas
    // coordinates, since y grows downward).
    const tracks = [
      { rx: 300, ry: 175, dir: -1, headAngle: 0, speed: 0.006, trail: 2.0 },
      { rx: 370, ry: 215, dir: -1, headAngle: 2, speed: 0.005, trail: 1.7 },
      { rx: 440, ry: 255, dir: -1, headAngle: 4, speed: 0.0045, trail: 1.4 },
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
      tracks.forEach(tr => {
        tCtx.save();
        tCtx.translate(cw / 2, ch / 2);

        // faint static baseline so the full oval track stays visible
        tCtx.globalAlpha = 0.08;
        tCtx.strokeStyle = `rgba(${accentRgb},1)`;
        tCtx.lineWidth = 0.6;
        tCtx.beginPath();
        tCtx.ellipse(0, 0, tr.rx, tr.ry, 0, 0, Math.PI * 2);
        tCtx.stroke();

        // comet trail: many short arcs behind the head, tapering width/alpha
        const segments = 48;
        for (let i = 0; i < segments; i++) {
          const t = i / segments; // 0 at head, 1 at tail
          const a0 = tr.headAngle - tr.dir * t * tr.trail;
          const a1 = tr.headAngle - tr.dir * (t + 1 / segments) * tr.trail;
          tCtx.globalAlpha = 0.42 * (1 - t);
          tCtx.lineWidth = Math.max(0.3, 2.2 * (1 - t));
          tCtx.strokeStyle = `rgba(${accentRgb},1)`;
          tCtx.beginPath();
          tCtx.ellipse(0, 0, tr.rx, tr.ry, 0, a0, a1, tr.dir > 0);
          tCtx.stroke();
        }
        tCtx.restore();
      });
    }

    function drawParticles() {
      const dpr = window.devicePixelRatio || 1;
      const cw = W / dpr, ch = H / dpr;
      pCtx.clearRect(0, 0, cw, ch);
      particles.forEach(p => {
        p.angle -= p.speed * 0.35;
        const x = cw / 2 + Math.cos(p.angle) * p.r;
        const y = ch / 2 + Math.sin(p.angle) * p.r * p.ryRatio;
        pCtx.beginPath();
        pCtx.fillStyle = `rgba(${accentRgb},${p.opacity})`;
        pCtx.arc(x, y, p.size, 0, Math.PI * 2);
        pCtx.fill();
      });
    }

    function loop() {
      tracks.forEach(tr => { tr.headAngle += tr.dir * tr.speed; });
      drawTracks();
      drawParticles();
      raf = requestAnimationFrame(loop);
    }
    loop();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      themeObserver.disconnect();
    };
  }, []);

  return (
    <>
      <canvas ref={trackRef} className="absolute inset-0 w-full h-full opacity-90" style={{ filter: 'blur(1.5px)' }} />
      <canvas ref={particleRef} className="absolute inset-0 w-full h-full opacity-60" />
    </>
  );
}
