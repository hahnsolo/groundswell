/** The Groundswell mark: a swell rising from level ground. Ground is ink, the swell is action red. */
export function LogoMark({ className = "h-5 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 30 22" className={className} aria-hidden="true">
      <path d="M1 20 H29" stroke="var(--ink)" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M3 17 C9 17 10 6 15 6 C20 6 21 13 27 13" fill="none" stroke="var(--brand)" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}
