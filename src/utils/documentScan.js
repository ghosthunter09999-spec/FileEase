const MAX_IMAGE_SIDE = 3000;
const ANALYSIS_SIDE = 480;

export function createPageId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

export async function decodeImage(blob) {
  if (typeof createImageBitmap === "function") return createImageBitmap(blob);
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function canvasToJpeg(canvas, quality = 0.98) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Couldn't save this scanned page as an image."))),
      "image/jpeg",
      quality,
    );
  });
}

export async function normalizeImage(blob) {
  const image = await decodeImage(blob);
  try {
    const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Your browser couldn't prepare an image canvas.");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return {
      blob: await canvasToJpeg(canvas),
      width: canvas.width,
      height: canvas.height,
    };
  } finally {
    image.close?.();
  }
}

function median(values) {
  values.sort((left, right) => left - right);
  return values[Math.floor(values.length / 2)] ?? 0;
}

function cross(origin, first, second) {
  return (first.x - origin.x) * (second.y - origin.y) - (first.y - origin.y) * (second.x - origin.x);
}

function convexHull(points) {
  if (points.length < 4) return points;
  points.sort((left, right) => left.x - right.x || left.y - right.y);
  const lower = [];
  for (const point of points) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) lower.pop();
    lower.push(point);
  }
  const upper = [];
  for (let index = points.length - 1; index >= 0; index -= 1) {
    const point = points[index];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) upper.pop();
    upper.push(point);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function quadrilateralFromHull(hull, width, height) {
  if (hull.length < 4) return null;
  let topLeft = null;
  let topRight = null;
  let bottomRight = null;
  let bottomLeft = null;
  let minSum = Infinity;
  let maxSum = -Infinity;
  let minDifference = Infinity;
  let maxDifference = -Infinity;
  for (const point of hull) {
    const sum = point.x + point.y;
    const difference = point.x - point.y;
    if (sum < minSum) { minSum = sum; topLeft = point; }
    if (sum > maxSum) { maxSum = sum; bottomRight = point; }
    if (difference > maxDifference) { maxDifference = difference; topRight = point; }
    if (difference < minDifference) { minDifference = difference; bottomLeft = point; }
  }
  const corners = [topLeft, topRight, bottomRight, bottomLeft];
  if (corners.some((point) => !point) || new Set(corners).size !== 4) return null;
  const area = Math.abs(corners.reduce((total, point, index) => {
    const next = corners[(index + 1) % corners.length];
    return total + point.x * next.y - next.x * point.y;
  }, 0)) / 2;
  if (area < width * height * 0.16 || area > width * height * 0.995) return null;
  const minEdge = Math.min(width, height) * 0.08;
  for (let index = 0; index < corners.length; index += 1) {
    const first = corners[index];
    const second = corners[(index + 1) % corners.length];
    if (Math.hypot(second.x - first.x, second.y - first.y) < minEdge) return null;
  }
  return corners;
}

export async function detectDocumentCorners(blob) {
  const image = await decodeImage(blob);
  try {
    const scale = Math.min(1, ANALYSIS_SIDE / Math.max(image.width, image.height));
    const width = Math.max(2, Math.round(image.width * scale));
    const height = Math.max(2, Math.round(image.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Your browser couldn't analyze this image.");
    context.drawImage(image, 0, 0, width, height);
    const { data } = context.getImageData(0, 0, width, height);

    const borderSamples = [[], [], []];
    const sampleStep = Math.max(1, Math.floor(Math.min(width, height) / 90));
    const borderDepth = Math.max(2, Math.round(Math.min(width, height) * 0.035));
    for (let y = 0; y < height; y += sampleStep) {
      for (let x = 0; x < width; x += sampleStep) {
        if (x >= borderDepth && x < width - borderDepth && y >= borderDepth && y < height - borderDepth) continue;
        const offset = (y * width + x) * 4;
        for (let channel = 0; channel < 3; channel += 1) borderSamples[channel].push(data[offset + channel]);
      }
    }
    const background = borderSamples.map(median);
    const mask = new Uint8Array(width * height);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const offset = (y * width + x) * 4;
        const red = data[offset] - background[0];
        const green = data[offset + 1] - background[1];
        const blue = data[offset + 2] - background[2];
        const distance = Math.sqrt(red * red + green * green + blue * blue);
        if (distance > 42) mask[y * width + x] = 1;
      }
    }

    const queue = new Int32Array(width * height);
    let largest = null;
    for (let index = 0; index < mask.length; index += 1) {
      if (mask[index] !== 1) continue;
      let head = 0;
      let tail = 0;
      queue[tail++] = index;
      mask[index] = 2;
      while (head < tail) {
        const current = queue[head++];
        const x = current % width;
        const left = current - 1;
        const right = current + 1;
        const up = current - width;
        const down = current + width;
        if (x > 0 && mask[left] === 1) { mask[left] = 2; queue[tail++] = left; }
        if (x < width - 1 && mask[right] === 1) { mask[right] = 2; queue[tail++] = right; }
        if (up >= 0 && mask[up] === 1) { mask[up] = 2; queue[tail++] = up; }
        if (down < mask.length && mask[down] === 1) { mask[down] = 2; queue[tail++] = down; }
      }
      if (!largest || tail > largest.length) largest = queue.slice(0, tail);
    }
    if (!largest || largest.length < width * height * 0.16 || largest.length > width * height * 0.995) return null;

    const boundary = [];
    const stride = Math.max(1, Math.floor(Math.sqrt(largest.length / 4000)));
    for (let cursor = 0; cursor < largest.length; cursor += stride) {
      const index = largest[cursor];
      const x = index % width;
      const y = Math.floor(index / width);
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1
        || mask[index - 1] !== 2 || mask[index + 1] !== 2
        || mask[index - width] !== 2 || mask[index + width] !== 2) {
        boundary.push({ x, y });
      }
    }
    const hull = convexHull(boundary);
    const smallCorners = quadrilateralFromHull(hull, width, height);
    if (!smallCorners) return null;
    const padding = 0.004 * Math.min(image.width, image.height);
    return smallCorners.map((point) => ({
      x: Math.max(0, Math.min(image.width - 1, point.x / scale + (point.x < width / 2 ? -padding : padding))),
      y: Math.max(0, Math.min(image.height - 1, point.y / scale + (point.y < height / 2 ? -padding : padding))),
    }));
  } finally {
    image.close?.();
  }
}

function solveLinearSystem(matrix, values) {
  const size = values.length;
  for (let column = 0; column < size; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < size; row += 1) {
      if (Math.abs(matrix[row][column]) > Math.abs(matrix[pivot][column])) pivot = row;
    }
    if (Math.abs(matrix[pivot][column]) < 1e-10) throw new Error("Those crop corners don't form a usable page.");
    [matrix[column], matrix[pivot]] = [matrix[pivot], matrix[column]];
    [values[column], values[pivot]] = [values[pivot], values[column]];
    const divisor = matrix[column][column];
    for (let item = column; item < size; item += 1) matrix[column][item] /= divisor;
    values[column] /= divisor;
    for (let row = 0; row < size; row += 1) {
      if (row === column) continue;
      const factor = matrix[row][column];
      for (let item = column; item < size; item += 1) matrix[row][item] -= factor * matrix[column][item];
      values[row] -= factor * values[column];
    }
  }
  return values;
}

function getPerspectiveTransform(corners, outputWidth, outputHeight) {
  const destination = [
    [0, 0],
    [outputWidth - 1, 0],
    [outputWidth - 1, outputHeight - 1],
    [0, outputHeight - 1],
  ];
  const matrix = [];
  const values = [];
  for (let index = 0; index < 4; index += 1) {
    const [x, y] = destination[index];
    const { x: sourceX, y: sourceY } = corners[index];
    matrix.push([x, y, 1, 0, 0, 0, -sourceX * x, -sourceX * y]);
    values.push(sourceX);
    matrix.push([0, 0, 0, x, y, 1, -sourceY * x, -sourceY * y]);
    values.push(sourceY);
  }
  return solveLinearSystem(matrix, values);
}

function validateCorners(corners, width, height) {
  if (!corners || corners.length !== 4) throw new Error("Adjust all four page corners before cropping.");
  for (const point of corners) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)
      || point.x < 0 || point.x > width || point.y < 0 || point.y > height) {
      throw new Error("A crop corner is outside the image. Move it back onto the page.");
    }
  }
  const area = Math.abs(corners.reduce((total, point, index) => {
    const next = corners[(index + 1) % corners.length];
    return total + point.x * next.y - next.x * point.y;
  }, 0)) / 2;
  if (area < width * height * 0.025) throw new Error("The selected crop is too small. Move the corners farther apart.");
  const turns = corners.map((point, index) => {
    const next = corners[(index + 1) % corners.length];
    const after = corners[(index + 2) % corners.length];
    return cross(point, next, after);
  });
  if (turns.some((turn) => Math.abs(turn) < 1) || !turns.every((turn) => turn > 0) && !turns.every((turn) => turn < 0)) {
    throw new Error("The crop corners cross over each other. Place them clockwise around the page.");
  }
}

export async function perspectiveCrop(blob, corners) {
  const image = await decodeImage(blob);
  try {
    validateCorners(corners, image.width, image.height);
    const [topLeft, topRight, bottomRight, bottomLeft] = corners;
    const outputScale = Math.min(1, MAX_IMAGE_SIDE / Math.max(image.width, image.height));
    const width = Math.max(2, Math.round(Math.max(
      Math.hypot(topRight.x - topLeft.x, topRight.y - topLeft.y),
      Math.hypot(bottomRight.x - bottomLeft.x, bottomRight.y - bottomLeft.y),
    ) * outputScale));
    const height = Math.max(2, Math.round(Math.max(
      Math.hypot(bottomLeft.x - topLeft.x, bottomLeft.y - topLeft.y),
      Math.hypot(bottomRight.x - topRight.x, bottomRight.y - topRight.y),
    ) * outputScale));
    if (width * height > 12_000_000) throw new Error("This crop is too large for the browser to process safely.");
    const scale = outputScale;
    const scaledCorners = corners.map((point) => ({ x: point.x * scale, y: point.y * scale }));
    const transform = getPerspectiveTransform(scaledCorners, width, height);
    const source = document.createElement("canvas");
    source.width = Math.round(image.width * scale);
    source.height = Math.round(image.height * scale);
    const sourceContext = source.getContext("2d", { willReadFrequently: true });
    if (!sourceContext) throw new Error("Your browser couldn't prepare the crop image.");
    sourceContext.drawImage(image, 0, 0, source.width, source.height);
    const sourcePixels = sourceContext.getImageData(0, 0, source.width, source.height);
    const output = document.createElement("canvas");
    output.width = width;
    output.height = height;
    const outputContext = output.getContext("2d", { willReadFrequently: true });
    if (!outputContext) throw new Error("Your browser couldn't prepare the flattened page.");
    const outputPixels = outputContext.createImageData(width, height);
    const [a, b, c, d, e, f, g, h] = transform;
    const sourceData = sourcePixels.data;
    const destinationData = outputPixels.data;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const denominator = g * x + h * y + 1;
        const sourceX = (a * x + b * y + c) / denominator;
        const sourceY = (d * x + e * y + f) / denominator;
        const x0 = Math.floor(sourceX);
        const y0 = Math.floor(sourceY);
        const x1 = Math.min(source.width - 1, x0 + 1);
        const y1 = Math.min(source.height - 1, y0 + 1);
        const target = (y * width + x) * 4;
        if (x0 < 0 || y0 < 0 || x0 >= source.width || y0 >= source.height) {
          destinationData[target] = 255;
          destinationData[target + 1] = 255;
          destinationData[target + 2] = 255;
          destinationData[target + 3] = 255;
          continue;
        }
        const horizontal = sourceX - x0;
        const vertical = sourceY - y0;
        const top = (y0 * source.width + x0) * 4;
        const topRightIndex = (y0 * source.width + x1) * 4;
        const bottom = (y1 * source.width + x0) * 4;
        const bottomRight = (y1 * source.width + x1) * 4;
        for (let channel = 0; channel < 3; channel += 1) {
          const upper = sourceData[top + channel] * (1 - horizontal) + sourceData[topRightIndex + channel] * horizontal;
          const lower = sourceData[bottom + channel] * (1 - horizontal) + sourceData[bottomRight + channel] * horizontal;
          destinationData[target + channel] = upper * (1 - vertical) + lower * vertical;
        }
        destinationData[target + 3] = 255;
      }
    }
    outputContext.putImageData(outputPixels, 0, 0);
    return { blob: await canvasToJpeg(output), width, height };
  } finally {
    image.close?.();
  }
}

function otsuThreshold(histogram, count) {
  let totalIntensity = 0;
  for (let value = 0; value < 256; value += 1) totalIntensity += value * histogram[value];
  let backgroundWeight = 0;
  let backgroundIntensity = 0;
  let bestVariance = -1;
  let threshold = 150;
  for (let value = 0; value < 256; value += 1) {
    backgroundWeight += histogram[value];
    if (!backgroundWeight) continue;
    const foregroundWeight = count - backgroundWeight;
    if (!foregroundWeight) break;
    backgroundIntensity += value * histogram[value];
    const backgroundMean = backgroundIntensity / backgroundWeight;
    const foregroundMean = (totalIntensity - backgroundIntensity) / foregroundWeight;
    const variance = backgroundWeight * foregroundWeight * (backgroundMean - foregroundMean) ** 2;
    if (variance > bestVariance) {
      bestVariance = variance;
      threshold = value;
    }
  }
  return Math.max(90, Math.min(205, threshold));
}

export async function enhanceDocument(blob, mode, settings = {}) {
  const image = await decodeImage(blob);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d", { alpha: false, willReadFrequently: true });
    if (!context) throw new Error("Your browser couldn't prepare the enhancement canvas.");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0);

    const backdrop = document.createElement("canvas");
    backdrop.width = Math.max(2, Math.round(image.width / 24));
    backdrop.height = Math.max(2, Math.round(image.height / 24));
    const backdropContext = backdrop.getContext("2d", { willReadFrequently: true });
    if (!backdropContext) throw new Error("Your browser couldn't analyze the page lighting.");
    backdropContext.filter = "blur(2px)";
    backdropContext.drawImage(image, 0, 0, backdrop.width, backdrop.height);
    backdropContext.filter = "none";
    const backdropPixels = backdropContext.getImageData(0, 0, backdrop.width, backdrop.height);

    const frame = context.getImageData(0, 0, canvas.width, canvas.height);
    const data = frame.data;
    const histogram = new Uint32Array(256);
    const pixels = canvas.width * canvas.height;
    const localThresholds = mode === "bw" ? new Uint8Array(pixels) : null;
    const contrastAmount = Number.isFinite(settings.contrast)
      ? settings.contrast
      : mode === "clean" ? 18 : mode === "enhanced" ? 12 : 0;
    const contrast = 1 + contrastAmount / 100;
    const brightness = Number.isFinite(settings.brightness) ? settings.brightness : 0;
    const quality = Number.isFinite(settings.imageQuality) ? settings.imageQuality / 100 : 0.98;
    const saturation = mode === "enhanced" ? 1.12 : mode === "clean" ? 1.04 : 1;
    for (let y = 0; y < canvas.height; y += 1) {
      const backdropY = (y / canvas.height) * (backdrop.height - 1);
      const by0 = Math.floor(backdropY);
      const by1 = Math.min(backdrop.height - 1, by0 + 1);
      const vertical = backdropY - by0;
      for (let x = 0; x < canvas.width; x += 1) {
        const target = (y * canvas.width + x) * 4;
        const backdropX = (x / canvas.width) * (backdrop.width - 1);
        const bx0 = Math.floor(backdropX);
        const bx1 = Math.min(backdrop.width - 1, bx0 + 1);
        const horizontal = backdropX - bx0;
        const baseTop = (by0 * backdrop.width + bx0) * 4;
        const baseTopRight = (by0 * backdrop.width + bx1) * 4;
        const baseBottom = (by1 * backdrop.width + bx0) * 4;
        const baseBottomRight = (by1 * backdrop.width + bx1) * 4;
        const backgroundTop = backdropPixels.data[baseTop] * (1 - horizontal) + backdropPixels.data[baseTopRight] * horizontal;
        const backgroundBottom = backdropPixels.data[baseBottom] * (1 - horizontal) + backdropPixels.data[baseBottomRight] * horizontal;
        const backgroundLight = Math.max(75, backgroundTop * (1 - vertical) + backgroundBottom * vertical);
        const gain = Math.min(mode === "clean" ? 2.35 : 2.1, (mode === "clean" ? 248 : 238) / backgroundLight);
        if (localThresholds) {
          localThresholds[y * canvas.width + x] = Math.max(95, Math.min(205, backgroundLight * 0.64));
        }
        const red = Math.max(0, Math.min(255, (data[target] * gain + brightness - 128) * contrast + 128));
        const green = Math.max(0, Math.min(255, (data[target + 1] * gain + brightness - 128) * contrast + 128));
        const blue = Math.max(0, Math.min(255, (data[target + 2] * gain + brightness - 128) * contrast + 128));
        const luminance = Math.max(0, Math.min(255, red * 0.299 + green * 0.587 + blue * 0.114));
        histogram[Math.round(luminance)] += 1;
        if (mode === "gray" || mode === "bw") {
          data[target] = luminance;
          data[target + 1] = luminance;
          data[target + 2] = luminance;
        } else {
          data[target] = Math.max(0, Math.min(255, luminance + (red - luminance) * saturation));
          data[target + 1] = Math.max(0, Math.min(255, luminance + (green - luminance) * saturation));
          data[target + 2] = Math.max(0, Math.min(255, luminance + (blue - luminance) * saturation));
        }
        data[target + 3] = 255;
      }
    }

    if (mode === "bw") {
      const globalThreshold = otsuThreshold(histogram, pixels);
      for (let index = 0, pixel = 0; index < data.length; index += 4, pixel += 1) {
        const threshold = globalThreshold * 0.65 + localThresholds[pixel] * 0.35;
        const value = data[index] >= threshold ? 255 : 0;
        data[index] = value;
        data[index + 1] = value;
        data[index + 2] = value;
      }
    }
    context.putImageData(frame, 0, 0);

    if (mode === "clean") {
      const edgeDepth = Math.max(1, Math.round(Math.min(canvas.width, canvas.height) * 0.018));
      const cleaned = context.getImageData(0, 0, canvas.width, canvas.height);
      for (let y = 0; y < canvas.height; y += 1) {
        for (let x = 0; x < canvas.width; x += 1) {
          const edgeDistance = Math.min(x, y, canvas.width - 1 - x, canvas.height - 1 - y);
          if (edgeDistance >= edgeDepth) continue;
          const offset = (y * canvas.width + x) * 4;
          const luminance = cleaned.data[offset] * 0.299
            + cleaned.data[offset + 1] * 0.587
            + cleaned.data[offset + 2] * 0.114;
          if (luminance >= 125) continue;
          const edgeWeight = (1 - edgeDistance / edgeDepth) * 0.28;
          for (let channel = 0; channel < 3; channel += 1) {
            cleaned.data[offset + channel] += (220 - cleaned.data[offset + channel]) * edgeWeight;
          }
        }
      }
      context.putImageData(cleaned, 0, 0);
    }

    if (mode !== "bw" && canvas.width > 2 && canvas.height > 2) {
      const blurCanvas = document.createElement("canvas");
      blurCanvas.width = canvas.width;
      blurCanvas.height = canvas.height;
      const blurContext = blurCanvas.getContext("2d", { willReadFrequently: true });
      if (!blurContext) throw new Error("Your browser couldn't sharpen the page.");
      blurContext.filter = "blur(1.15px)";
      blurContext.drawImage(canvas, 0, 0);
      blurContext.filter = "none";
      const blurred = blurContext.getImageData(0, 0, canvas.width, canvas.height).data;
      const sharpened = context.getImageData(0, 0, canvas.width, canvas.height);
      const amount = mode === "enhanced" ? 0.48 : 0.28;
      for (let index = 0; index < sharpened.data.length; index += 4) {
        for (let channel = 0; channel < 3; channel += 1) {
          sharpened.data[index + channel] = Math.max(0, Math.min(
            255,
            sharpened.data[index + channel] + (sharpened.data[index + channel] - blurred[index + channel]) * amount,
          ));
        }
      }
      context.putImageData(sharpened, 0, 0);
    }
    return canvasToJpeg(canvas, quality);
  } finally {
    image.close?.();
  }
}

export async function rotateImage(blob, degrees) {
  const image = await decodeImage(blob);
  try {
    const quarterTurn = Math.abs(degrees % 180) === 90;
    const canvas = document.createElement("canvas");
    canvas.width = quarterTurn ? image.height : image.width;
    canvas.height = quarterTurn ? image.width : image.height;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Your browser couldn't rotate this image.");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.translate(canvas.width / 2, canvas.height / 2);
    context.rotate((degrees * Math.PI) / 180);
    context.drawImage(image, -image.width / 2, -image.height / 2);
    return { blob: await canvasToJpeg(canvas), width: canvas.width, height: canvas.height };
  } finally {
    image.close?.();
  }
}
