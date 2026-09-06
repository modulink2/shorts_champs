// The IceDream brand mark (public/images/logo-mark.png), rendered as-is at
// its own aspect ratio (wide wordmark, not a square icon).
export default function Logo({ size }: { size: number }) {
  return (
    <img
      src="/images/logo-mark.png"
      alt="IceDream"
      style={{ height: size, width: 'auto' }}
      className="object-contain"
    />
  );
}
