# Diwali Gift Game

A standalone, mobile-first Diwali rocket greeting. All game source, build configuration, and assets live in this folder.

## Run locally

```powershell
npm install
npm run dev
```

Create a production build with `npm run build`; preview it with `npm run preview`.

## Sharing and deployment

Gift links use the current site origin and the validated sender name in the `from` query string. Native file sharing is used when supported; otherwise the page offers copy-link, WhatsApp-link, and image-download fallbacks.

The generated personalized PNG can be attached directly. `assets/share-card.svg` is the generic Open Graph fallback for static hosting. Static pages cannot produce a personalized link thumbnail for social crawlers because those crawlers do not run the app's JavaScript. For personalized link previews, deploy an edge/server route that renders sender-specific Open Graph metadata and a public HTTPS image, and set the page's absolute canonical/image URLs for that host.

The supplied folder contained images but no audio files. Sound effects and the quiet background tones are synthesized locally with Web Audio after the user taps Start/Reveal; no third-party media is loaded.

## Reference materials

`reference/rocket-fireworks-reference.mp4` and `reference/diwali-fireworks-reference-storyboard.jpg` are visual development references only. They are kept in this project folder and are not loaded or played by the app.

The in-game fireworks are rendered with Phaser particle emitters and timed bursts; the show runs for 15 seconds after the rocket detonation, followed by a 2-second fade to the persistent greeting and sharing action. Particle caps and burst counts are reduced for low-power devices and reduced-motion preferences.
