import { useRef, useState } from 'react';

/**
 * Circular crop/pan/zoom editor shown after picking a file, before it's
 * uploaded — lets the user choose what part of the photo actually shows in
 * the circle, rather than trusting object-fit: cover to guess the right
 * center. Built on a plain canvas rather than a cropper library: a fixed
 * circular output with drag-to-pan and a zoom slider doesn't need one.
 */
const VIEWPORT = 260; // on-screen crop circle, px
const OUTPUT = 400; // exported square image, px
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

export default function AvatarCropModal({ src, onCancel, onConfirm }) {
  const imgRef = useRef(null);
  const dragRef = useRef(null);
  const [baseScale, setBaseScale] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  const scale = baseScale * zoom;

  function clamp(next, s) {
    const img = imgRef.current;
    if (!img) return next;
    const w = img.naturalWidth * s;
    const h = img.naturalHeight * s;
    const maxX = Math.max(0, (w - VIEWPORT) / 2);
    const maxY = Math.max(0, (h - VIEWPORT) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, next.x)),
      y: Math.min(maxY, Math.max(-maxY, next.y)),
    };
  }

  function onImgLoad() {
    const img = imgRef.current;
    // Smallest scale that still covers the circle with no gaps at the edges.
    const cover = Math.max(VIEWPORT / img.naturalWidth, VIEWPORT / img.naturalHeight);
    setBaseScale(cover);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }

  function onPointerDown(e) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, origin: offset };
    setDragging(true);
  }

  function onPointerMove(e) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setOffset(clamp({ x: dragRef.current.origin.x + dx, y: dragRef.current.origin.y + dy }, scale));
  }

  function endDrag() {
    dragRef.current = null;
    setDragging(false);
  }

  function onZoomChange(e) {
    const next = Number(e.target.value);
    setZoom(next);
    setOffset((o) => clamp(o, baseScale * next));
  }

  function onWheel(e) {
    e.preventDefault();
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom - e.deltaY * 0.002));
    setZoom(next);
    setOffset((o) => clamp(o, baseScale * next));
  }

  function confirm() {
    const img = imgRef.current;
    const ratio = OUTPUT / VIEWPORT;
    const drawW = img.naturalWidth * scale;
    const drawH = img.naturalHeight * scale;
    const drawX = VIEWPORT / 2 + offset.x - drawW / 2;
    const drawY = VIEWPORT / 2 + offset.y - drawH / 2;

    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT;
    canvas.height = OUTPUT;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, drawX * ratio, drawY * ratio, drawW * ratio, drawH * ratio);
    onConfirm(canvas.toDataURL('image/jpeg', 0.92));
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm p-6 text-center"
        style={{
          background: 'var(--darbi-surface-solid)',
          border: '1px solid var(--darbi-border)',
          borderRadius: 'var(--darbi-radius)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-white font-bold mb-1">Adjust your photo</h2>
        <p className="text-xs text-gray-400 mb-4">Drag to reposition, use the slider to zoom.</p>

        <div
          className="mx-auto rounded-full overflow-hidden relative touch-none select-none"
          style={{
            width: VIEWPORT,
            height: VIEWPORT,
            background: '#000',
            cursor: dragging ? 'grabbing' : 'grab',
            boxShadow: '0 0 0 2px var(--darbi-border)',
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerLeave={endDrag}
          onWheel={onWheel}
        >
          <img
            ref={imgRef}
            src={src}
            alt=""
            onLoad={onImgLoad}
            draggable={false}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              maxWidth: 'none',
              transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
              transformOrigin: 'center',
            }}
          />
        </div>

        <input
          type="range"
          min={MIN_ZOOM}
          max={MAX_ZOOM}
          step={0.01}
          value={zoom}
          onChange={onZoomChange}
          className="w-full mt-4"
          aria-label="Zoom"
        />

        <div className="flex items-center justify-center gap-3 mt-5">
          <button
            type="button"
            onClick={onCancel}
            className="text-xs font-semibold text-gray-400 hover:text-gray-200 px-4 py-2"
          >
            Cancel
          </button>
          <button type="button" onClick={confirm} className="darbi-btn text-sm px-6">
            Use this photo
          </button>
        </div>
      </div>
    </div>
  );
}
