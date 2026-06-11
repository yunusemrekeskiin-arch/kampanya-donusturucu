figma.showUI(__html__, { width: 420, height: 380, themeColors: true });

figma.ui.onmessage = async (msg) => {
  if (msg.type !== 'create-frame') return;

  try {
    const data = parsePayload(msg.payload);
    const rootFrame = data.frame || data;
    const node = await createNode(rootFrame);

    if ('x' in node) node.x = figma.viewport.center.x - node.width / 2;
    if ('y' in node) node.y = figma.viewport.center.y - node.height / 2;

    figma.currentPage.selection = [node];
    figma.viewport.scrollAndZoomIntoView([node]);
    figma.ui.postMessage({ type: 'status', ok: true, message: 'Frame olusturuldu.' });
  } catch (error) {
    figma.ui.postMessage({ type: 'status', ok: false, message: 'Hata: ' + error.message });
  }
};

function parsePayload(value) {
  const trimmed = String(value || '').trim();
  try {
    return JSON.parse(trimmed);
  } catch (_) {
    const json = decodeURIComponent(escape(atob(trimmed)));
    return JSON.parse(json);
  }
}

async function createNode(src) {
  const type = src.type || 'FRAME';
  let node;

  if (type === 'TEXT') {
    node = figma.createText();
    await setText(node, src);
  } else if (type === 'RECTANGLE') {
    node = figma.createRectangle();
  } else if (type === 'SVG') {
    node = figma.createNodeFromSvg(String(src.svg || ''));
  } else {
    node = figma.createFrame();
    node.clipsContent = false;
  }

  node.name = src.name || type;
  setGeometry(node, src);
  if (type !== 'SVG') {
    await setFills(node, src);
    setStrokes(node, src);
  }

  if (typeof src.cornerRadius === 'number' && 'cornerRadius' in node) {
    node.cornerRadius = src.cornerRadius;
  }

  if (Array.isArray(src.children) && 'appendChild' in node) {
    for (const childSrc of src.children) {
      const child = await createNode(childSrc);
      node.appendChild(child);
    }
  }

  return node;
}

function setGeometry(node, src) {
  if ('resize' in node) {
    const width = Math.max(1, Number(src.width || 100));
    const height = Math.max(1, Number(src.height || 100));
    node.resize(width, height);
  }
  if ('x' in node) node.x = Number(src.x || 0);
  if ('y' in node) node.y = Number(src.y || 0);
  if ('rotation' in node && typeof src.rotation === 'number') node.rotation = src.rotation;
}

async function setText(node, src) {
  const style = src.style || {};
  const fontName = await loadFont(style);
  node.fontName = fontName;
  node.characters = String(src.characters || '');
  node.fontSize = Number(style.fontSize || 16);
  node.textAlignHorizontal = style.textAlignHorizontal || 'LEFT';
  if ('textAlignVertical' in node) node.textAlignVertical = style.textAlignVertical || 'TOP';
  node.textAutoResize = 'NONE';
}

async function loadFont(style) {
  const family = style.fontFamily || 'Inter';
  const weight = Number(style.fontWeight || 400);
  const fontStyle = weight >= 800 ? 'Bold' : weight >= 600 ? 'Medium' : 'Regular';
  const candidates = [
    { family, style: fontStyle },
    { family, style: 'Regular' },
    { family: 'Inter', style: 'Regular' },
    { family: 'Arial', style: 'Regular' }
  ];

  for (const font of candidates) {
    try {
      await figma.loadFontAsync(font);
      return font;
    } catch (_) {}
  }

  throw new Error('Figma font yukleyemedi.');
}

async function setFills(node, src) {
  if (!('fills' in node)) return;

  if (src.imageUrl) {
    const paint = await imagePaint(src.imageUrl, src.imageScaleMode);
    if (paint) {
      node.fills = [paint];
      return;
    }
  }

  if (Array.isArray(src.fills) && src.fills.length) {
    node.fills = src.fills.map(toPaint).filter(Boolean);
  } else if (src.type !== 'TEXT') {
    node.fills = [];
  }
}

function setStrokes(node, src) {
  if (!('strokes' in node)) return;
  if (Array.isArray(src.strokes) && src.strokes.length) {
    node.strokes = src.strokes.map(toPaint).filter(Boolean);
    node.strokeWeight = Number(src.strokeWeight || 1);
  }
}

function toPaint(fill) {
  if (!fill) return null;
  if (fill.type === 'GRADIENT_LINEAR') {
    return {
      type: 'GRADIENT_LINEAR',
      gradientTransform: fill.gradientTransform || [[1, 0, 0], [0, 1, 0]],
      gradientStops: Array.isArray(fill.gradientStops) && fill.gradientStops.length ? fill.gradientStops : [
        { position: 0, color: { r: 1, g: 1, b: 1, a: 1 } },
        { position: 1, color: { r: 0, g: 0, b: 0, a: 1 } }
      ],
      opacity: typeof fill.opacity === 'number' ? fill.opacity : 1
    };
  }
  if (fill.type !== 'SOLID') return null;
  return {
    type: 'SOLID',
    color: fill.color || { r: 1, g: 1, b: 1 },
    opacity: typeof fill.opacity === 'number' ? fill.opacity : 1
  };
}

async function imagePaint(url, scaleMode) {
  try {
    const bytes = await imageBytes(url);
    const image = figma.createImage(bytes);
    const mode = ['FIT', 'FILL', 'CROP', 'TILE'].includes(scaleMode) ? scaleMode : 'FIT';
    return { type: 'IMAGE', scaleMode: mode, imageHash: image.hash };
  } catch (_) {
    return null;
  }
}

async function imageBytes(url) {
  if (url.startsWith('data:')) {
    const base64 = url.split(',')[1] || '';
    return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  }

  const response = await fetch(url);
  if (!response.ok) throw new Error('Gorsel indirilemedi.');
  return new Uint8Array(await response.arrayBuffer());
}
