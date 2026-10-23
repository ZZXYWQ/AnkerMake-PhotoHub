/* Route only oversized raster inputs directly onto the native canvas.
 * Normal images are replayed to the native importer, preserving its ICC pipeline.
 * SVG/PDF/PSD and multi-file imports are untouched. No storage/account reads. */
(() => {
  'use strict';
  if (window.__EPC_IMPORT_FILTER) return;
  const replayed = new WeakSet(), requests = new WeakMap();
  async function dimensions(file) {
    const bytes = new Uint8Array(await file.slice(0, 32).arrayBuffer());
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (bytes.length >= 24 && view.getUint32(0) === 0x89504e47 && view.getUint32(4) === 0x0d0a1a0a && view.getUint32(12) === 0x49484452) {
      return {width: view.getUint32(16), height: view.getUint32(20)};
    }
    if (bytes.length >= 30 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') {
      const kind = String.fromCharCode(...bytes.slice(12, 16));
      if (kind === 'VP8X') return {width: 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16), height: 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16)};
      if (kind === 'VP8L' && bytes[20] === 0x2f) return {width: 1 + (bytes[21] | ((bytes[22] & 0x3f) << 8)), height: 1 + ((bytes[22] >> 6) | (bytes[23] << 2) | ((bytes[24] & 0x0f) << 10))};
      if (kind === 'VP8 ' && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) return {width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff};
    }
    if (bytes[0] === 0xff && bytes[1] === 0xd8) {
      let offset = 2;
      for (let count = 0; count < 4096 && offset + 4 <= file.size; count++) {
        const chunk = new Uint8Array(await file.slice(offset, offset + 12).arrayBuffer());
        if (chunk[0] !== 0xff) return null;
        if (chunk[1] === 0xff) { offset++; continue; }
        const marker = chunk[1];
        if (marker === 0xd9 || marker === 0xda) return null;
        if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { offset += 2; continue; }
        const length = (chunk[2] << 8) | chunk[3];
        if (length < 2 || offset + 2 + length > file.size) return null;
        if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker) && length >= 8 && chunk.length >= 9) {
          return {width: (chunk[7] << 8) | chunk[8], height: (chunk[5] << 8) | chunk[6]};
        }
        offset += 2 + length;
      }
    }
    return null;
  }
  const oversized = size => !!size && size.width > 0 && size.height > 0 && (size.width > 30000 || size.height > 30000 || size.width * size.height > 163840000);
  window.__EPC_IMPORT_FILTER = {dimensions, oversized};
  function onInput(event) {
    if (replayed.has(event) || window.__EUFY_PHOTOCRAFT_LARGE_IMAGES === false || typeof window.__EPC_IMPORT_LARGE_FILE !== 'function') return;
    const target = event.target;
    if (!target || target.closest?.('#epc-panel, #epc-embedded-editor, [data-epc-editor]')) return;
    const files = event.type === 'drop' ? event.dataTransfer?.files : target.type === 'file' ? target.files : null;
    if (!files || files.length !== 1) return;
    const file = files[0];
    if (!/\.(png|jpe?g|webp)$/i.test(file.name || '') && !/^image\/(png|jpeg|webp)$/i.test(file.type || '')) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const request = {}; requests.set(target, request);
    const host = window.__EPC_HOST;
    const project = host?.project(), canvas = host?.editor()?.canvas;
    const dropPosition = {clientX: event.clientX, clientY: event.clientY, screenX: event.screenX, screenY: event.screenY, ctrlKey: event.ctrlKey, shiftKey: event.shiftKey, altKey: event.altKey, metaKey: event.metaKey};
    const replay = () => {
      if (requests.get(target) !== request) return;
      let copy;
      if (event.type === 'drop') {
        const transfer = new DataTransfer(); transfer.items.add(file);
        copy = new DragEvent('drop', {bubbles: true, cancelable: true, composed: true, dataTransfer: transfer, ...dropPosition});
      } else copy = new Event('change', {bubbles: true, cancelable: true, composed: true});
      replayed.add(copy); target.dispatchEvent(copy);
    };
    let handedOff = false;
    dimensions(file).then(async size => {
      if (requests.get(target) !== request) return;
      if (!oversized(size)) { replay(); return; }
      if (host && (host.project() !== project || host.editor()?.canvas !== canvas)) return;
      // The extension UI explicitly states that PhotoHub imports oversized images.
      handedOff = true;
      await window.__EPC_IMPORT_LARGE_FILE(file);
      if (event.type === 'change' && requests.get(target) === request) target.value = '';
    }).catch(() => {
      // Header failures preserve the original decoder and its error reporting.
      // Once handed to PhotoHub, the callback owns its user-facing errors.
      if (!handedOff) replay();
    });
  }
  window.addEventListener('change', onInput, true);
  window.addEventListener('drop', onInput, true);
})();
