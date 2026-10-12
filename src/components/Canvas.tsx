import { useEffect, useRef, useCallback, RefObject } from 'react';
import { initGL, renderFrame, loadTexture, type GLState, type RenderParams } from '../lib/webgl';
import type { KState } from '../hooks/useKaleidoscope';

interface Props {
  kState: KState;
  canvasRef: RefObject<HTMLCanvasElement | null>;
}

export function KaleidoscopeCanvas({ kState, canvasRef }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const glRef = useRef<GLState | null>(null);
  const rafRef = useRef<number>(0);
  const isDragging = useRef(false);
  const isAltDragging = useRef(false);
  const lastMousePos = useRef<{ x: number; y: number } | null>(null);

  const buildParams = useCallback(
    (time = 0): RenderParams => ({
      segments: kState.segments,
      rotation: kState.rotation * (Math.PI / 180),
      centerX: kState.centerX / 100,
      centerY: 1 - kState.centerY / 100, // screen-y=0 top → WebGL y=1 top
      outputAspect: kState.outputAspectRatio,
      sourceAspect: kState.sourceAspect,
      mirror: kState.mirror,
      reverse: kState.reverse,
      sourceCenterX: kState.sourceCenterX,
      sourceCenterY: kState.sourceCenterY,
      sourceZoom: kState.effectiveSourceZoom,
      sourceRot: kState.sourceRotation * (Math.PI / 180),
      radialWrap: kState.radialWrap,
      radialScale: kState.radialScaleValue,
      wrapMode: kState.wrapModeInt,
      hasSource: kState.sourceImage !== null,
      quality: kState.quality,
      time,
    }),
    [
      kState.segments, kState.rotation, kState.centerX, kState.centerY,
      kState.outputAspectRatio, kState.sourceAspect, kState.mirror, kState.reverse,
      kState.sourceCenterX, kState.sourceCenterY, kState.effectiveSourceZoom,
      kState.sourceRotation, kState.radialWrap, kState.radialScaleValue,
      kState.wrapModeInt, kState.sourceImage, kState.quality,
    ]
  );

  const doRender = useCallback(
    (time = 0) => {
      if (!glRef.current) return;
      renderFrame(glRef.current, buildParams(time));
    },
    [buildParams]
  );

  // Initialize WebGL once
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      glRef.current = initGL(canvas);
      doRender();
    } catch (e) {
      console.error('WebGL2 init failed:', e);
    }
    return () => { glRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Upload texture when source changes
  useEffect(() => {
    if (!glRef.current || !kState.sourceImage) return;
    loadTexture(glRef.current, kState.sourceImage);
    doRender();
  }, [kState.sourceImage, doRender]);

  // Animation loop when no source (demo)
  useEffect(() => {
    if (kState.sourceImage) {
      cancelAnimationFrame(rafRef.current);
      return;
    }
    const loop = (t: number) => {
      doRender(t / 1000);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [kState.sourceImage, doRender]);

  // Re-render on any parameter change (when source is loaded)
  useEffect(() => {
    if (!kState.sourceImage) return;
    doRender();
  }, [kState.sourceImage, doRender]);

  // Canvas resize: fit aspect ratio into container
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const aspect = kState.outputAspectRatio;

    const update = () => {
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      const pad = 24;
      let w: number, h: number;
      if ((cw - pad) / (ch - pad) >= aspect) {
        h = ch - pad;
        w = h * aspect;
      } else {
        w = cw - pad;
        h = w / aspect;
      }
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      if (glRef.current) doRender();
    };

    const ro = new ResizeObserver(update);
    ro.observe(container);
    update();
    return () => ro.disconnect();
  }, [kState.outputAspectRatio, doRender, canvasRef]);

  // Drag handlers
  const getCanvasCoords = useCallback(
    (e: MouseEvent | React.MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      return {
        x: Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)),
        y: Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100)),
      };
    },
    [canvasRef]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      if (e.altKey) {
        isAltDragging.current = true;
        lastMousePos.current = { x: e.clientX, y: e.clientY };
      } else {
        isDragging.current = true;
        const coords = getCanvasCoords(e);
        if (coords) {
          kState.setCenterX(coords.x);
          kState.setCenterY(coords.y);
        }
      }
    },
    [getCanvasCoords, kState]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isDragging.current) {
        const coords = getCanvasCoords(e);
        if (coords) {
          kState.setCenterX(coords.x);
          kState.setCenterY(coords.y);
        }
      }
      if (isAltDragging.current && lastMousePos.current) {
        const dx = (e.clientX - lastMousePos.current.x) * 0.3;
        const dy = (e.clientY - lastMousePos.current.y) * 0.3;
        kState.setSourceOffsetX(Math.max(-100, Math.min(100, kState.sourceOffsetX - dx)));
        kState.setSourceOffsetY(Math.max(-100, Math.min(100, kState.sourceOffsetY + dy)));
        lastMousePos.current = { x: e.clientX, y: e.clientY };
      }
    },
    [getCanvasCoords, kState]
  );

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    isAltDragging.current = false;
    lastMousePos.current = null;
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 1.08 : 0.92;
      kState.setSourceZoom((prev) => Math.max(10, Math.min(500, prev * factor)));
    },
    [kState]
  );

  // Drag & drop files
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) kState.loadFile(file);
    },
    [kState]
  );

  return (
    <div
      ref={containerRef}
      className="flex-1 flex items-center justify-center overflow-hidden"
      style={{ background: '#060608', cursor: 'crosshair' }}
      onMouseDown={handleMouseDown}
      onWheel={handleWheel}
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <canvas ref={canvasRef} style={{ display: 'block' }} />

        {/* Center crosshair indicator */}
        <div
          style={{
            position: 'absolute',
            left: `${kState.centerX}%`,
            top: `${kState.centerY}%`,
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
          }}
        >
          <svg width="28" height="28" viewBox="-14 -14 28 28" style={{ opacity: 0.5 }}>
            <circle cx="0" cy="0" r="4" fill="none" stroke="white" strokeWidth="1.5" />
            <line x1="-11" y1="0" x2="-6" y2="0" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="6" y1="0" x2="11" y2="0" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="0" y1="-11" x2="0" y2="-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="0" y1="6" x2="0" y2="11" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>

        {/* Drop hint overlay when no source */}
        {!kState.sourceImage && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                border: '1.5px dashed rgba(255,255,255,0.15)',
                borderRadius: 8,
                padding: '20px 32px',
                textAlign: 'center',
              }}
            >
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, fontFamily: 'inherit', margin: 0 }}>
                Drop image here
              </p>
              <p style={{ color: 'rgba(255,255,255,0.18)', fontSize: 10, fontFamily: 'inherit', margin: '4px 0 0' }}>
                PNG · JPG · WebP
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
