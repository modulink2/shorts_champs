import { useState } from 'react';

// The app's mark, sized to sit inside the existing gold-gradient/crystal-gradient
// square. Falls back to the plain "S" glyph until /public/images/logo-mark.png
// is added, so the app never shows a broken-image icon in the meantime.
export default function Logo({ size }: { size: number }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <span className="font-[900]" style={{ fontSize: size * 0.42 }}>S</span>;
  }
  return (
    <img
      src="/images/logo-mark.png"
      alt=""
      onError={() => setFailed(true)}
      style={{ width: size * 0.64, height: size * 0.64 }}
      className="object-contain"
    />
  );
}
