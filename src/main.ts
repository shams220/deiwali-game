import "./styles.css";
import { AdsterraBanner } from "./components/AdsterraBanner";
import { GiftAudio } from "./lib/audio";
import { createGiftImage, createGiftUrl, normalizeSenderName } from "./lib/share";

function getAppRoot(): HTMLElement {
  const root = document.querySelector<HTMLElement>(".gift-app");
  if (!root) throw new Error("The Diwali gift app root is missing.");
  return root;
}

const app = getAppRoot();

const audio = new GiftAudio();
let game: import("phaser").Game | null = null;
let shareUrl = "";
let shareImageUrl = "";
let shareFile: File | null = null;
let senderName: string | null = null;
let invalidSender = false;

function resetScreen(screenName: string): HTMLElement {
  app.className = `gift-app gift-screen-${screenName}`;
  app.replaceChildren();
  return app;
}

function createPanel(eyebrow: string): HTMLElement {
  const panel = document.createElement("section");
  panel.className = "gift-panel";
  panel.setAttribute("aria-live", "polite");
  const label = document.createElement("p");
  label.className = "gift-eyebrow";
  label.textContent = eyebrow;
  panel.append(label);
  return panel;
}

function createButton(
  label: string,
  style: "primary" | "secondary",
  onClick: () => void,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.className = `gift-button gift-button-${style}`;
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

function showLanding(): void {
  const root = resetScreen(senderName ? "invitation" : "intro");
  const panel = createPanel(senderName ? "A Diwali surprise, sent with love" : "A little light, a lot of joy");
  const mark = document.createElement("div");
  mark.className = "gift-mark";
  mark.setAttribute("aria-hidden", "true");
  mark.textContent = "✦";
  panel.append(mark);

  const heading = document.createElement("h1");
  if (senderName) {
    heading.textContent = "You have received a Diwali gift!";
  } else {
    heading.textContent = "Diwali Rocket Challenge";
  }
  panel.append(heading);

  const copy = document.createElement("p");
  copy.className = "gift-copy";
  if (senderName) {
    copy.append(document.createTextNode("Your friend "));
    const sender = document.createElement("strong");
    sender.className = "gift-sender";
    sender.textContent = senderName;
    copy.append(sender, document.createTextNode(" shared this Diwali gift with you!"));
  } else {
    copy.textContent = "Light the fuse. Launch the celebration!";
  }
  panel.append(copy);

  if (senderName) {
    const detail = document.createElement("p");
    detail.className = "gift-copy gift-copy-small";
    detail.textContent = "Something special is waiting for you. Move your burning phuljhari to the rocket's fuse to reveal your gift!";
    panel.append(detail);
  } else {
    const detail = document.createElement("p");
    detail.className = "gift-copy gift-copy-small";
    detail.textContent = "Move your burning phuljhari towards the rocket's fuse to reveal your Diwali gift!";
    panel.append(detail);
  }

  if (!senderName && invalidSender) {
    const note = document.createElement("p");
    note.className = "gift-note";
    note.textContent = "This link had an invalid sender name. You can still enjoy the celebration and create a fresh gift.";
    panel.append(note);
  }

  const start = createButton(
    senderName ? "REVEAL YOUR GIFT" : "START GAME",
    "primary",
    () => void startGame(),
  );
  panel.append(start);
  if (!senderName) {
    const footnote = document.createElement("p");
    footnote.className = "gift-footnote";
    footnote.textContent = "Sound begins only after you start.";
    panel.append(footnote);
  }
  root.append(panel);
}

function showGame(): HTMLElement {
  game?.destroy(true);
  game = null;
  const root = resetScreen("game");
  const mount = document.createElement("div");
  mount.className = "gift-game";
  mount.setAttribute("aria-label", "Diwali rocket game area");

  const controls = document.createElement("div");
  controls.className = "gift-game-ui";
  const instruction = document.createElement("div");
  instruction.className = "gift-game-instruction";
  instruction.innerHTML = '<span class="gift-live-dot" aria-hidden="true"></span><span>Move your burning phuljhari towards the rocket’s fuse to reveal your Diwali gift!</span>';
  controls.append(instruction);

  const waitMessage = document.createElement("p");
  waitMessage.className = "gift-wait-until-end";
  waitMessage.textContent = "WAIT TILL THE END";
  controls.append(waitMessage);

  const mute = document.createElement("button");
  mute.className = "gift-icon-button";
  mute.type = "button";
  const updateMuteLabel = () => {
    mute.textContent = audio.isMuted ? "Sound off" : "Sound on";
    mute.setAttribute("aria-pressed", String(audio.isMuted));
    mute.setAttribute("aria-label", audio.isMuted ? "Turn sound on" : "Mute sound");
  };
  updateMuteLabel();
  mute.addEventListener("click", () => {
    audio.setMuted(!audio.isMuted);
    updateMuteLabel();
  });
  controls.append(mute);

  const loading = document.createElement("section");
  loading.className = "gift-loading-screen";
  loading.setAttribute("role", "status");
  loading.setAttribute("aria-live", "polite");
  const loadingTitle = document.createElement("p");
  loadingTitle.className = "gift-loading-title";
  loadingTitle.textContent = "Preparing your Diwali surprise...";
  const hint = document.createElement("p");
  hint.className = "gift-loading-hint";
  hint.textContent = "DRAG YOUR PHULJHARI AND DON'T LIFT YOUR FINGER UNTIL THE ROCKET IS LIT!";
  const progressTrack = document.createElement("div");
  progressTrack.className = "gift-loading-track";
  progressTrack.setAttribute("role", "progressbar");
  progressTrack.setAttribute("aria-label", "Loading game resources");
  progressTrack.setAttribute("aria-valuemin", "0");
  progressTrack.setAttribute("aria-valuemax", "100");
  progressTrack.setAttribute("aria-valuenow", "0");
  const progressFill = document.createElement("div");
  progressFill.className = "gift-loading-progress";
  progressTrack.append(progressFill);
  const progressLabel = document.createElement("p");
  progressLabel.className = "gift-loading-percentage";
  progressLabel.textContent = "LOADING 0%";
  loading.append(loadingTitle, hint, progressTrack, progressLabel);
  mount.append(controls, loading);
  root.append(mount);

  void mountGame(mount, controls, loading, progressTrack, progressFill, progressLabel);
  return controls;
}

async function mountGame(
  mount: HTMLElement,
  controls: HTMLElement,
  loading: HTMLElement,
  progressTrack: HTMLElement,
  progressFill: HTMLElement,
  progressLabel: HTMLElement,
): Promise<void> {
  try {
    const [Phaser, SceneModule] = await Promise.all([
      import("phaser"),
      import("./game/DiwaliScene"),
    ]);
    if (!mount.isConnected) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    const lowPower =
      window.matchMedia("(max-width: 390px)").matches ||
      (typeof deviceMemory === "number" && deviceMemory <= 4);

    const scene = new SceneModule.DiwaliScene({
      audio,
      reducedMotion,
      lowPower,
      onReady: () => {
        const canvas = mount.querySelector("canvas");
        if (canvas) {
          canvas.style.touchAction = "none";
          canvas.tabIndex = 0;
          canvas.setAttribute("aria-label", "Diwali game. Move the sparkler to the rocket fuse. Arrow keys move it; hold Space to spark.");
        }
        updateLoadingProgress(1, progressTrack, progressFill, progressLabel);
        loading.remove();
      },
      onLoadProgress: (progress) => updateLoadingProgress(
        progress,
        progressTrack,
        progressFill,
        progressLabel,
      ),
      onLoadError: (resource) => {
        const name = resource.split(/[\\/]/).pop() || "game resource";
        showLoadingError(loading, `The game could not load ${name}. Check your connection and try again.`);
      },
      onFireworksStart: () => controls.classList.add("gift-fireworks-visible"),
      onGreeting: () => {
        controls.classList.add("gift-showing-greeting");
        const finalMessage = document.createElement("div");
        finalMessage.className = "gift-final-message";
        const greeting = document.createElement("p");
        greeting.className = "gift-greeting";
        greeting.setAttribute("aria-live", "polite");
        const greetingLead = document.createElement("span");
        greetingLead.className = "gift-greeting-lead";
        greetingLead.textContent = senderName ? `${senderName} wishes you` : "Wishing you";
        const greetingMain = document.createElement("span");
        greetingMain.className = "gift-greeting-main";
        greetingMain.textContent = "HAPPY DIWALI!";
        greeting.append(greetingLead, greetingMain);
        const openNameEntry = () => {
          game?.destroy(true);
          game = null;
          showNameEntry();
        };
        const share = createButton("Write your name and share", "primary", openNameEntry);
        const shareText = createButton("share", "secondary", openNameEntry);
        share.classList.add("gift-final-share");
        shareText.classList.add("gift-final-share");
        finalMessage.append(greeting, share, shareText);
        controls.append(finalMessage);
      },
      onFade: () => controls.classList.add("gift-is-fading"),
    });

    game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: mount,
      width: mount.clientWidth || window.innerWidth,
      height: mount.clientHeight || window.innerHeight,
      backgroundColor: "#0a102d",
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      render: {
        antialias: true,
        roundPixels: true,
        powerPreference: "low-power",
      },
      fps: { target: 45, forceSetTimeOut: lowPower },
      input: { activePointers: 1 },
      scene,
    });
  } catch (error) {
    console.error("The Diwali game could not start.", error);
    showLoadingError(
      loading,
      error instanceof Error ? error.message : "The Diwali game could not start.",
    );
  }
}

function updateLoadingProgress(
  progress: number,
  progressTrack: HTMLElement,
  progressFill: HTMLElement,
  progressLabel: HTMLElement,
): void {
  const percentage = Math.min(100, Math.max(0, Math.floor(progress * 100)));
  progressTrack.setAttribute("aria-valuenow", String(percentage));
  progressFill.style.width = `${percentage}%`;
  progressLabel.textContent = `LOADING ${percentage}%`;
}

function showLoadingError(loading: HTMLElement, message: string): void {
  loading.classList.add("gift-loading-error-state");
  loading.replaceChildren();
  loading.setAttribute("role", "alert");
  const error = document.createElement("p");
  error.textContent = message;
  loading.append(error, createButton("Try again", "primary", () => void startGame()));
}

function startGame(): void {
  const controls = showGame();
  if (!audio.supported) {
    showAudioNotice(controls, "Sound is not available in this browser, but the celebration will still play.");
    return;
  }
  void audio.unlock().then(() => {
    audio.setMuted(audio.isMuted);
  }).catch((error: unknown) => {
    console.error("Diwali audio could not be unlocked after the user gesture.", error);
    showAudioNotice(controls, "Sound is unavailable right now, but the celebration will still play.");
  });
}

function showAudioNotice(controls: HTMLElement, message: string): void {
  if (!controls.isConnected) return;
  const notice = document.createElement("p");
  notice.className = "gift-audio-notice";
  notice.setAttribute("role", "status");
  notice.textContent = message;
  controls.append(notice);
}

function showCompletion(): void {
  const root = resetScreen("complete");
  const panel = createPanel("The sky is yours");
  const mark = document.createElement("div");
  mark.className = "gift-mark";
  mark.setAttribute("aria-hidden", "true");
  mark.textContent = "✦";
  const heading = document.createElement("h1");
  heading.textContent = "Your Diwali gift has been revealed!";
  const copy = document.createElement("p");
  copy.className = "gift-copy";
  copy.textContent = "Spread the happiness. Share this gift with someone special.";
  panel.append(mark, heading, copy);
  panel.append(createButton("Write your name and share", "primary", showNameEntry));

  const replay = document.createElement("button");
  replay.className = "gift-text-button";
  replay.type = "button";
  replay.textContent = "Play again";
  replay.addEventListener("click", () => void startGame());
  panel.append(replay);
  root.append(panel);
}

function showNameEntry(): void {
  const root = resetScreen("name");
  const panel = createPanel("Pass the light along");
  const heading = document.createElement("h1");
  heading.textContent = "Share the happiness of Diwali!";
  const copy = document.createElement("p");
  copy.className = "gift-copy";
  copy.textContent = "Let your friends experience their own little Diwali surprise.";

  const form = document.createElement("form");
  form.className = "gift-name-form";
  form.noValidate = true;
  const label = document.createElement("label");
  label.htmlFor = "gift-sender-name";
  label.textContent = "Who is sending this gift?";
  const input = document.createElement("input");
  input.id = "gift-sender-name";
  input.name = "sender";
  input.type = "text";
  input.autocomplete = "name";
  input.enterKeyHint = "done";
  input.inputMode = "text";
  input.maxLength = 60;
  input.placeholder = "Your name";
  input.required = true;

  const hint = document.createElement("p");
  hint.className = "gift-field-hint";
  hint.id = "gift-name-hint";
  const error = document.createElement("p");
  error.className = "gift-field-error";
  error.id = "gift-name-error";
  error.setAttribute("role", "alert");

  const submit = document.createElement("button");
  submit.className = "gift-button gift-button-primary";
  submit.type = "submit";
  submit.disabled = true;
  submit.textContent = "Create my gift link";

  const updateValidation = () => {
    const cleaned = normalizeSenderName(input.value);
    const invalid = Boolean(input.value.trim()) && !cleaned;
    hint.textContent = `${Array.from(input.value.trim()).length}/30 characters. Letters from all languages are welcome.`;
    error.textContent = invalid ? "Use letters and spaces only, with a maximum of 30 characters." : "";
    input.setAttribute("aria-invalid", String(invalid));
    input.setAttribute("aria-describedby", invalid ? error.id : hint.id);
    submit.disabled = !cleaned;
  };

  input.addEventListener("input", updateValidation);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const cleaned = normalizeSenderName(input.value);
    if (!cleaned) {
      updateValidation();
      return;
    }
    void createShare(cleaned);
  });
  form.append(label, input, hint, error, submit);
  panel.append(heading, copy, form, AdsterraBanner());

  const back = document.createElement("button");
  back.className = "gift-text-button";
  back.type = "button";
  back.textContent = "Back";
  back.addEventListener("click", showCompletion);
  panel.append(back);
  root.append(panel);
  input.focus({ preventScroll: true });
}

async function createShare(name: string): Promise<void> {
  const root = document.querySelector<HTMLElement>(".gift-app");
  const form = root?.querySelector<HTMLFormElement>(".gift-name-form");
  const submit = form?.querySelector<HTMLButtonElement>('[type="submit"]');
  const error = form?.querySelector<HTMLElement>(".gift-field-error");
  if (!root || !submit || !error) return;

  submit.disabled = true;
  submit.textContent = "Creating your gift…";
  error.textContent = "";
  try {
    const image = await createGiftImage(name);
    senderName = name;
    shareUrl = createGiftUrl(name);
    if (shareImageUrl) URL.revokeObjectURL(shareImageUrl);
    shareImageUrl = URL.createObjectURL(image);
    shareFile = typeof File === "undefined"
      ? null
      : new File([image], "diwali-gift.png", { type: "image/png" });
    showShareReady(name);
  } catch (cause) {
    console.error("The Diwali gift could not be prepared.", cause);
    error.textContent = cause instanceof Error ? cause.message : "The gift could not be prepared.";
    submit.disabled = false;
    submit.textContent = "Create my gift link";
  }
}

function showShareReady(name: string): void {
  const root = resetScreen("ready");
  const panel = createPanel("Ready to make someone smile");
  const heading = document.createElement("h1");
  heading.textContent = "Your Diwali gift is ready to share, Please Scroll Down";
  const copy = document.createElement("p");
  copy.className = "gift-copy";
  copy.append(document.createTextNode("Your friend will see an invitation from "));
  const sender = document.createElement("strong");
  sender.className = "gift-sender";
  sender.textContent = name;
  copy.append(sender, document.createTextNode("."));

  const preview = document.createElement("img");
  preview.className = "gift-share-preview";
  preview.src = shareImageUrl;
  preview.alt = `Personalized Happy Diwali gift card from ${name}`;

  const urlLabel = document.createElement("label");
  urlLabel.className = "gift-link-label";
  urlLabel.htmlFor = "gift-share-url";
  urlLabel.textContent = "Your gift link";
  const urlInput = document.createElement("input");
  urlInput.className = "gift-share-url";
  urlInput.id = "gift-share-url";
  urlInput.readOnly = true;
  urlInput.value = shareUrl;
  urlInput.addEventListener("focus", () => urlInput.select());

  const actions = document.createElement("div");
  actions.className = "gift-share-actions";
  actions.append(
    createButton("Share gift", "primary", () => void shareGift(name)),
    // createButton("Copy link", "secondary", () => void copyLink()),
  );
  // const download = document.createElement("a");
  // download.className = "gift-button gift-button-secondary";
  // download.href = shareImageUrl;
  // download.download = "diwali-gift.png";
  // download.textContent = "Download image";
  // actions.append(download);

  const status = document.createElement("p");
  status.className = "gift-status";
  status.setAttribute("role", "status");
  const shareError = document.createElement("p");
  shareError.className = "gift-field-error";
  shareError.setAttribute("role", "alert");

  const another = document.createElement("button");
  another.className = "gift-text-button";
  another.type = "button";
  another.textContent = "Make another gift";
  another.addEventListener("click", showNameEntry);
  panel.append(
    heading,
    copy,
    preview,
    AdsterraBanner(),
    urlLabel,
    urlInput,
    actions,
    status,
    shareError,
    another,
  );
  root.append(panel);

}

async function shareGift(name: string): Promise<void> {
  const panel = document.querySelector<HTMLElement>(".gift-panel");
  if (!shareUrl || !panel) return;
  const shareText = `Your friend ${name} shared a Diwali gift with you! Tap the link to reveal your surprise.`;
  const shareData: ShareData = { title: "A Diwali gift for you", text: shareText, url: shareUrl };
  const shareNavigator = navigator as Navigator & { canShare?: (data?: ShareData) => boolean };

  try {
    if (navigator.share && shareFile && shareNavigator.canShare?.({ files: [shareFile] })) {
      await navigator.share({ ...shareData, files: [shareFile] });
      notifyShare(panel, "Your gift image and link are ready to share.");
    } else if (navigator.share) {
      await navigator.share(shareData);
      notifyShare(panel, "Your gift link is ready to share. Download the image to attach it separately.");
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`, "_blank", "noopener,noreferrer");
      notifyShare(panel, "WhatsApp may open with your gift link. If it does not, copy the link below or download the image.");
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return;
    console.error("The Diwali gift could not be shared.", error);
    notifyShare(panel, "", "Sharing did not open. You can copy the link or download the image instead.");
  }
}

async function copyLink(): Promise<void> {
  const panel = document.querySelector<HTMLElement>(".gift-panel");
  if (!shareUrl || !panel) return;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(shareUrl);
    } else {
      const field = document.createElement("textarea");
      field.value = shareUrl;
      field.setAttribute("readonly", "");
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.append(field);
      field.select();
      const copied = document.execCommand("copy");
      field.remove();
      if (!copied) throw new Error("Clipboard access is unavailable in this browser.");
    }
    notifyShare(panel, "Gift link copied. Paste it into your favourite chat.");
  } catch (error) {
    console.error("The Diwali gift link could not be copied.", error);
    notifyShare(panel, "", "Copying is unavailable. Select and copy the gift link above.");
  }
}

function notifyShare(panel: HTMLElement, status: string, error = ""): void {
  const statusElement = panel.querySelector<HTMLElement>(".gift-status");
  const errorElement = panel.querySelector<HTMLElement>(".gift-field-error");
  if (statusElement) statusElement.textContent = status;
  if (errorElement) errorElement.textContent = error;
}

function showInitialScreen(): void {
  const rawSender = new URLSearchParams(window.location.search).get("from") ?? "";
  senderName = normalizeSenderName(rawSender);
  invalidSender = Boolean(rawSender) && !senderName;
  document.title = senderName ? `A Diwali gift from ${senderName}` : "A Diwali gift for you";
  showLanding();
}

window.addEventListener("pagehide", () => {
  game?.destroy(true);
  game = null;
  if (shareImageUrl) URL.revokeObjectURL(shareImageUrl);
  audio.destroy();
}, { once: true });

showInitialScreen();
