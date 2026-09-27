import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bliss Web Solution — Launch Reel",
  description: "30-second showreel for Bliss Web Solution.",
};

export default function ReelPage() {
  return (
    <main className="min-h-screen bg-[#05060F] text-[#F5F7FF] flex flex-col items-center justify-center gap-8 p-4 sm:p-10">
      <h1 className="font-[family-name:var(--font-geist-mono)] text-xs sm:text-sm tracking-[0.4em] text-[#8A93B8]">
        BLISS WEB SOLUTION · LAUNCH REEL
      </h1>
      <video
        className="w-full max-w-5xl aspect-video rounded-2xl shadow-[0_0_80px_rgba(123,97,255,0.35)]"
        src="/reel/bliss-launch-reel-1920x1080.mp4"
        controls
        playsInline
        preload="metadata"
      />
      <div className="flex gap-6 text-sm font-[family-name:var(--font-geist-mono)]">
        <a className="underline hover:text-[#22D3EE]" href="/reel/bliss-launch-reel-1920x1080.mp4" download>
          Download 16:9
        </a>
        <a className="underline hover:text-[#22D3EE]" href="/reel/bliss-launch-reel-1080x1920.mp4" download>
          Download 9:16 (Reels / Shorts)
        </a>
      </div>
    </main>
  );
}
