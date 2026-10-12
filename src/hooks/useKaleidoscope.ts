import { useState, useMemo, useCallback } from 'react';

export type FitMode = 'cover' | 'contain' | 'stretch';
export type WrapMode = 'clamp' | 'repeat' | 'mirror';
export type Quality = 'draft' | 'high';

export interface KState {
  // Kaleidoscope
  segments: number;
  setSegments: (v: number) => void;
  rotation: number;
  setRotation: (v: number) => void;
  centerX: number;
  setCenterX: (v: number) => void;
  centerY: number;
  setCenterY: (v: number) => void;
  mirror: boolean;
  setMirror: (v: boolean) => void;
  reverse: boolean;
  setReverse: (v: boolean) => void;

  // Source transform
  sourceZoom: number;
  setSourceZoom: React.Dispatch<React.SetStateAction<number>>;
  sourceOffsetX: number;
  setSourceOffsetX: (v: number) => void;
  sourceOffsetY: number;
  setSourceOffsetY: (v: number) => void;
  sourceRotation: number;
  setSourceRotation: (v: number) => void;
  fitMode: FitMode;
  setFitMode: (v: FitMode) => void;
  wrapMode: WrapMode;
  setWrapMode: (v: WrapMode) => void;

  // Advanced
  radialWrap: boolean;
  setRadialWrap: (v: boolean) => void;
  radialScale: number;
  setRadialScale: (v: number) => void;
  outputAspect: string;
  setOutputAspect: (v: string) => void;
  customAspectW: number;
  setCustomAspectW: (v: number) => void;
  customAspectH: number;
  setCustomAspectH: (v: number) => void;
  antiAlias: boolean;
  setAntiAlias: (v: boolean) => void;
  quality: Quality;
  setQuality: (v: Quality) => void;

  // Source image
  sourceImage: HTMLImageElement | null;
  loadFile: (file: File) => void;
  loadUrl: (url: string) => void;
  clearSource: () => void;

  // Derived (read-only)
  outputAspectRatio: number;
  sourceAspect: number;
  rMax: number;
  effectiveSourceZoom: number;
  radialScaleValue: number;
  sourceCenterX: number;
  sourceCenterY: number;
  wrapModeInt: number;

  reset: () => void;
}

const DEFAULTS = {
  segments: 6,
  rotation: 0,
  centerX: 50,
  centerY: 50,
  mirror: true,
  reverse: false,
  sourceZoom: 100,
  sourceOffsetX: 0,
  sourceOffsetY: 0,
  sourceRotation: 0,
  fitMode: 'cover' as FitMode,
  wrapMode: 'mirror' as WrapMode,
  radialWrap: true,
  radialScale: 50,
  outputAspect: '16:9',
  customAspectW: 16,
  customAspectH: 9,
  antiAlias: true,
  quality: 'high' as Quality,
};

const ASPECT_MAP: Record<string, number> = {
  '16:9': 16 / 9,
  '4:3': 4 / 3,
  '1:1': 1,
  '9:16': 9 / 16,
};

export function useKaleidoscope(): KState {
  const [segments, setSegments] = useState(DEFAULTS.segments);
  const [rotation, setRotation] = useState(DEFAULTS.rotation);
  const [centerX, setCenterX] = useState(DEFAULTS.centerX);
  const [centerY, setCenterY] = useState(DEFAULTS.centerY);
  const [mirror, setMirror] = useState(DEFAULTS.mirror);
  const [reverse, setReverse] = useState(DEFAULTS.reverse);

  const [sourceZoom, setSourceZoom] = useState(DEFAULTS.sourceZoom);
  const [sourceOffsetX, setSourceOffsetX] = useState(DEFAULTS.sourceOffsetX);
  const [sourceOffsetY, setSourceOffsetY] = useState(DEFAULTS.sourceOffsetY);
  const [sourceRotation, setSourceRotation] = useState(DEFAULTS.sourceRotation);
  const [fitMode, setFitMode] = useState<FitMode>(DEFAULTS.fitMode);
  const [wrapMode, setWrapMode] = useState<WrapMode>(DEFAULTS.wrapMode);

  const [radialWrap, setRadialWrap] = useState(DEFAULTS.radialWrap);
  const [radialScale, setRadialScale] = useState(DEFAULTS.radialScale);
  const [outputAspect, setOutputAspect] = useState(DEFAULTS.outputAspect);
  const [customAspectW, setCustomAspectW] = useState(DEFAULTS.customAspectW);
  const [customAspectH, setCustomAspectH] = useState(DEFAULTS.customAspectH);
  const [antiAlias, setAntiAlias] = useState(DEFAULTS.antiAlias);
  const [quality, setQuality] = useState<Quality>(DEFAULTS.quality);

  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null);

  const loadFile = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setSourceImage(img);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }, []);

  const loadUrl = useCallback((url: string) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => setSourceImage(img);
    img.src = url;
  }, []);

  const clearSource = useCallback(() => setSourceImage(null), []);

  const outputAspectRatio = useMemo(() => {
    if (outputAspect === 'custom') return customAspectW / Math.max(1, customAspectH);
    return ASPECT_MAP[outputAspect] ?? 16 / 9;
  }, [outputAspect, customAspectW, customAspectH]);

  const sourceAspect = useMemo(() => {
    if (!sourceImage) return 1;
    return sourceImage.naturalWidth / sourceImage.naturalHeight;
  }, [sourceImage]);

  // Max radius from center to farthest canvas corner in aspect-corrected space
  const rMax = useMemo(() => {
    const cx = centerX / 100;
    const cy = 1 - centerY / 100; // convert to WebGL UV (y=0 bottom)
    const A = outputAspectRatio;
    return Math.max(
      Math.hypot(cx * A, cy),
      Math.hypot((1 - cx) * A, cy),
      Math.hypot(cx * A, 1 - cy),
      Math.hypot((1 - cx) * A, 1 - cy)
    );
  }, [centerX, centerY, outputAspectRatio]);

  // Shader zoom: at 100% userZoom the source covers the output exactly (cover mode)
  const effectiveSourceZoom = useMemo(() => {
    const sa = sourceAspect;
    let base: number;
    if (fitMode === 'cover') {
      // Both UV axes must be covered: binding axis is whichever constrains zoom most
      base = 0.5 * Math.min(sa, 1.0) / Math.max(rMax, 0.001);
    } else if (fitMode === 'contain') {
      const cx = centerX / 100;
      const cy = 1 - centerY / 100;
      const A = outputAspectRatio;
      const rMin = Math.min(cx * A, (1 - cx) * A, cy, 1 - cy);
      base = 0.5 * Math.min(sa, 1.0) / Math.max(rMin, 0.001);
    } else {
      // stretch: direct 1:1 zoom
      base = 1.0;
    }
    return base * (sourceZoom / 100);
  }, [fitMode, rMax, sourceAspect, sourceZoom, centerX, centerY, outputAspectRatio]);

  // Radial scale in screen-space units (50% of rMax by default)
  const radialScaleValue = useMemo(() => {
    return rMax * (radialScale / 100);
  }, [rMax, radialScale]);

  const sourceCenterX = useMemo(() => 0.5 + sourceOffsetX / 200, [sourceOffsetX]);
  const sourceCenterY = useMemo(() => 0.5 + sourceOffsetY / 200, [sourceOffsetY]);

  const wrapModeInt = useMemo(() => {
    if (wrapMode === 'clamp') return 0;
    if (wrapMode === 'repeat') return 1;
    return 2;
  }, [wrapMode]);

  const reset = useCallback(() => {
    setSegments(DEFAULTS.segments);
    setRotation(DEFAULTS.rotation);
    setCenterX(DEFAULTS.centerX);
    setCenterY(DEFAULTS.centerY);
    setMirror(DEFAULTS.mirror);
    setReverse(DEFAULTS.reverse);
    setSourceZoom(DEFAULTS.sourceZoom);
    setSourceOffsetX(DEFAULTS.sourceOffsetX);
    setSourceOffsetY(DEFAULTS.sourceOffsetY);
    setSourceRotation(DEFAULTS.sourceRotation);
    setFitMode(DEFAULTS.fitMode);
    setWrapMode(DEFAULTS.wrapMode);
    setRadialWrap(DEFAULTS.radialWrap);
    setRadialScale(DEFAULTS.radialScale);
  }, []);

  return {
    segments, setSegments,
    rotation, setRotation,
    centerX, setCenterX,
    centerY, setCenterY,
    mirror, setMirror,
    reverse, setReverse,
    sourceZoom, setSourceZoom,
    sourceOffsetX, setSourceOffsetX,
    sourceOffsetY, setSourceOffsetY,
    sourceRotation, setSourceRotation,
    fitMode, setFitMode,
    wrapMode, setWrapMode,
    radialWrap, setRadialWrap,
    radialScale, setRadialScale,
    outputAspect, setOutputAspect,
    customAspectW, setCustomAspectW,
    customAspectH, setCustomAspectH,
    antiAlias, setAntiAlias,
    quality, setQuality,
    sourceImage, loadFile, loadUrl, clearSource,
    outputAspectRatio,
    sourceAspect,
    rMax,
    effectiveSourceZoom,
    radialScaleValue,
    sourceCenterX,
    sourceCenterY,
    wrapModeInt,
    reset,
  };
}
