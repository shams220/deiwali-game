let adsterraScriptQueue = Promise.resolve();

export function AdsterraBanner(): HTMLElement {
  const placement = document.createElement("section");
  placement.className = "gift-ad-placeholder";
  placement.setAttribute("aria-label", "Advertisement");

  const label = document.createElement("p");
  label.className = "gift-ad-label";
  label.textContent = "ADVERTISEMENT";

  const space = document.createElement("div");
  space.className = "gift-ad-space";

  placement.append(label, space);

  const resizeFrame = () => {
    const scale = Math.min(1, space.clientWidth / 300);
    const frames = space.querySelectorAll("iframe");
    frames.forEach((frame) => {
      frame.style.transform = `scale(${scale})`;
    });
  };
  const frameObserver = new MutationObserver(resizeFrame);
  frameObserver.observe(space, { childList: true });
  const observer = new ResizeObserver(() => {
    if (!space.isConnected) {
      observer.disconnect();
      frameObserver.disconnect();
      return;
    }
    resizeFrame();
  });
  observer.observe(space);

  const loadAd = () => {
    if (!space.isConnected) {
      frameObserver.disconnect();
      observer.disconnect();
      return Promise.resolve();
    }

    const optionsScript = document.createElement("script");
    optionsScript.textContent = `atOptions = {
      'key' : '9fefcc73cf92094597c78eb5aaf6eee7',
      'format' : 'iframe',
      'height' : 250,
      'width' : 300,
      'params' : {}
    };`;
    space.append(optionsScript);

    return new Promise<void>((resolve) => {
      const adScript = document.createElement("script");
      adScript.async = false;
      adScript.src = "https://bauval.org/22/9fefcc73cf92094597c78eb5aaf6eee7";
      adScript.addEventListener("load", () => {
        resizeFrame();
        resolve();
      }, { once: true });
      adScript.addEventListener("error", () => {
        frameObserver.disconnect();
        observer.disconnect();
        space.dataset.adError = "true";
        console.error("The Adsterra banner script failed to load.", adScript.src);
        space.remove();
        resolve();
      }, { once: true });
      space.append(adScript);
    });
  };
  adsterraScriptQueue = adsterraScriptQueue.then(loadAd, loadAd);

  return placement;
}
