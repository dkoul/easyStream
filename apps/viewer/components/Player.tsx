"use client";

import { useEffect, useRef } from "react";
import Hls from "hls.js";

export function Player({
  src,
  live,
}: {
  src: string;
  live: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const shell = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video || !src) return;

    if (src.endsWith(".m3u8") || src.includes(".m3u8?")) {
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = src;
        return;
      }
      if (Hls.isSupported()) {
        const hls = new Hls({ lowLatencyMode: live });
        hls.loadSource(src);
        hls.attachMedia(video);
        return () => hls.destroy();
      }
    }
    video.src = src;
  }, [src, live]);

  function fullscreen() {
    const el = shell.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen();
  }

  return (
    <div className="video-shell" ref={shell}>
      {live ? <span className="live-pill">LIVE</span> : null}
      <video ref={ref} controls playsInline autoPlay={live} />
      <button className="fs-btn" type="button" onClick={fullscreen}>
        Full screen
      </button>
    </div>
  );
}
