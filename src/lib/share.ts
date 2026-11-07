export function normalizeSenderName(value: string): string | null {
  const name = value.normalize("NFC").trim().replace(/\s+/gu, " ");
  const length = Array.from(name).length;

  if (
    length < 1 ||
    length > 30 ||
    !/^[\p{L}\p{M}][\p{L}\p{M} .'-]*$/u.test(name)
  ) {
    return null;
  }

  return name;
}

export function createGiftUrl(name: string): string {
  const url = new URL("/", window.location.origin);
  url.searchParams.set("from", name);
  return url.href;
}

function drawFirework(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
) {
  const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, "#fff8d8");
  gradient.addColorStop(0.12, color);
  gradient.addColorStop(1, "transparent");
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = `${color}99`;
  context.lineWidth = 2;
  for (let ray = 0; ray < 20; ray += 1) {
    const angle = (ray / 20) * Math.PI * 2;
    context.beginPath();
    context.moveTo(x + Math.cos(angle) * radius * 0.18, y + Math.sin(angle) * radius * 0.18);
    context.lineTo(x + Math.cos(angle) * radius * 0.8, y + Math.sin(angle) * radius * 0.8);
    context.stroke();
  }
}

export async function createGiftImage(name: string): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 630;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Your browser could not prepare the gift image.");

  const sky = context.createLinearGradient(0, 0, 1200, 630);
  sky.addColorStop(0, "#080d28");
  sky.addColorStop(0.55, "#291247");
  sky.addColorStop(1, "#641b42");
  context.fillStyle = sky;
  context.fillRect(0, 0, canvas.width, canvas.height);

  drawFirework(context, 180, 155, 110, "#ffbd4a");
  drawFirework(context, 1010, 145, 128, "#ff5988");
  drawFirework(context, 790, 520, 98, "#55e2bf");

  context.strokeStyle = "#f4c76d";
  context.lineWidth = 3;
  context.strokeRect(28, 28, 1144, 574);
  context.strokeStyle = "rgba(244, 199, 109, .4)";
  context.lineWidth = 1;
  context.strokeRect(40, 40, 1120, 550);

  context.textAlign = "center";
  context.fillStyle = "#ffe6a1";
  context.font = "700 30px Georgia, serif";
  context.fillText("HAPPY DIWALI", 600, 174);

  context.fillStyle = "#fffaf0";
  let fontSize = 62;
  context.font = `600 ${fontSize}px Georgia, serif`;
  while (context.measureText(name).width > 840 && fontSize > 34) {
    fontSize -= 2;
    context.font = `600 ${fontSize}px Georgia, serif`;
  }
  context.fillText(name, 600, 294, 840);

  context.fillStyle = "#f4d8c0";
  context.font = "400 30px Arial, sans-serif";
  context.fillText("has a little Diwali surprise waiting for you", 600, 360);

  context.fillStyle = "#ffd773";
  context.font = "700 25px Arial, sans-serif";
  context.fillText("Tap the link to reveal your gift", 600, 493);

  for (const x of [112, 1088]) {
    context.fillStyle = "#cf6b35";
    context.beginPath();
    context.ellipse(x, 548, 40, 13, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#ffd96c";
    context.beginPath();
    context.ellipse(x, 528, 7, 17, 0, 0, Math.PI * 2);
    context.fill();
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Your browser could not export the gift image."));
    }, "image/png");
  });
}
