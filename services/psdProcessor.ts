
import { PSDLayer, AtlasRegion, CoordinateSystem } from '../types';

/**
 * Packs multiple rectangles into a single atlas using a shelf-packing algorithm.
 */
export const packAtlas = (layers: PSDLayer[], padding: number = 2) => {
  // Sort by height descending for better packing
  const sortedLayers = [...layers].sort((a, b) => b.height - a.height);
  
  let currentX = padding;
  let currentY = padding;
  let shelfHeight = 0;
  let maxAtlasWidth = 1024;
  
  // Calculate required size (simplified)
  // In a real app, we'd iterate to find the optimal power-of-two size
  const totalArea = layers.reduce((acc, l) => acc + (l.width + padding * 2) * (l.height + padding * 2), 0);
  maxAtlasWidth = Math.max(Math.ceil(Math.sqrt(totalArea)), 512);
  // Snap to next power of 2
  maxAtlasWidth = Math.pow(2, Math.ceil(Math.log2(maxAtlasWidth)));

  const regions: AtlasRegion[] = [];
  let finalAtlasHeight = 0;

  for (const layer of sortedLayers) {
    if (currentX + layer.width + padding > maxAtlasWidth) {
      currentX = padding;
      currentY += shelfHeight + padding;
      shelfHeight = 0;
    }

    regions.push({
      name: layer.name,
      x: currentX,
      y: currentY,
      width: layer.width,
      height: layer.height,
      originalX: layer.left,
      originalY: layer.top,
      uv: { u1: 0, v1: 0, u2: 0, v2: 0 } // Will be calculated after height is known
    });

    currentX += layer.width + padding;
    shelfHeight = Math.max(shelfHeight, layer.height);
    finalAtlasHeight = Math.max(finalAtlasHeight, currentY + shelfHeight + padding);
  }

  // Snap final height to power of 2
  const finalAtlasWidth = maxAtlasWidth;
  const pow2Height = Math.pow(2, Math.ceil(Math.log2(finalAtlasHeight)));

  // Calculate UVs
  regions.forEach(r => {
    r.uv.u1 = r.x / finalAtlasWidth;
    r.uv.v1 = r.y / pow2Height;
    r.uv.u2 = (r.x + r.width) / finalAtlasWidth;
    r.uv.v2 = (r.y + r.height) / pow2Height;
  });

  return { regions, width: finalAtlasWidth, height: pow2Height };
};

/**
 * Creates the binary data buffer
 * Format: [Header: 4 bytes] [Version: 4 bytes] [LayerCount: 4 bytes] [LayerEntries...]
 */
export const generateBinaryData = (regions: AtlasRegion[], canvasWidth: number, canvasHeight: number, coordSystem: CoordinateSystem) => {
  const encoder = new TextEncoder();
  const header = encoder.encode('PSDB'); // PSD Binary
  
  // Calculate total size
  // For each layer: NameLen(2), Name(variable), X(4), Y(4), W(4), H(4), U1(4), V1(4), U2(4), V2(4)
  let totalSize = 12; // Header(4) + Version(4) + Count(4)
  for (const r of regions) {
    const nameBytes = encoder.encode(r.name);
    totalSize += 2 + nameBytes.length + 32; // 32 = 8 floats * 4 bytes
  }

  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);
  
  let offset = 0;
  
  // Header
  for (let i = 0; i < 4; i++) view.setUint8(offset++, header[i]);
  
  // Version
  view.setUint32(offset, 1, true); offset += 4;
  
  // Count
  view.setUint32(offset, regions.length, true); offset += 4;

  for (const r of regions) {
    const nameBytes = encoder.encode(r.name);
    view.setUint16(offset, nameBytes.length, true); offset += 2;
    for (let i = 0; i < nameBytes.length; i++) view.setUint8(offset++, nameBytes[i]);

    // Positions (Relative to Canvas)
    let finalY = r.originalY;
    if (coordSystem === CoordinateSystem.BOTTOM_LEFT) {
       // Flip Y: canvasHeight - (top + height)
       finalY = canvasHeight - (r.originalY + r.height);
    }

    view.setFloat32(offset, r.originalX, true); offset += 4;
    view.setFloat32(offset, finalY, true); offset += 4;
    view.setFloat32(offset, r.width, true); offset += 4;
    view.setFloat32(offset, r.height, true); offset += 4;

    // UVs
    view.setFloat32(offset, r.uv.u1, true); offset += 4;
    view.setFloat32(offset, r.uv.v1, true); offset += 4;
    view.setFloat32(offset, r.uv.u2, true); offset += 4;
    view.setFloat32(offset, r.uv.v2, true); offset += 4;
  }

  return buffer;
};
