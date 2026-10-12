import { useRef, useState, type RefObject } from 'react';
import { exportCanvas } from '../lib/export';
import type { KState, FitMode, WrapMode, Quality } from '../hooks/useKaleidoscope';

interface SidebarProps {
  kState: KState;
  canvasRef: RefObject<HTMLCanvasElement | null>;
}

// ── Primitive controls ────────────────────────────────────────────────────────

function Param({
  label, value, min, max, step = 1, decimals = 0, unit = '',
  onChange,
}: {
  label: string; value: number; min: number; max: number; step?: number;
  decimals?: number; unit?: string; onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6b6b7a' }}>
          {label}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#b0b0c0', minWidth: 40, textAlign: 'right' }}>
          {value.toFixed(decimals)}{unit}
        </span>
      </div>
      <div style={{ position: 'relative', height: 2 }}>
        <div style={{ position: 'absolute', inset: 0, background: '#1e1e28', borderRadius: 1 }} />
        <div
          style={{
            position: 'absolute', top: 0, left: 0, height: '100%',
            width: `${pct}%`, background: '#7c3aed', borderRadius: 1, transition: 'width 0ms',
          }}
        />
        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ position: 'absolute', inset: 0, width: '100%', opacity: 0, cursor: 'pointer', height: 2, margin: 0 }}
        />
      </div>
    </div>
  );
}

function Toggle({
  label, value, onChange,
}: {
  label: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6b6b7a' }}>
        {label}
      </span>
      <button
        onClick={() => onChange(!value)}
        style={{
          width: 32, height: 16, borderRadius: 8, border: 'none', cursor: 'pointer',
          background: value ? '#7c3aed' : '#1e1e28',
          position: 'relative', transition: 'background 0.15s', padding: 0,
        }}
      >
        <div
          style={{
            position: 'absolute', top: 2, width: 12, height: 12, borderRadius: '50%',
            background: 'white', transition: 'left 0.15s',
            left: value ? 18 : 2,
          }}
        />
      </button>
    </div>
  );
}

function Chips<T extends string>({
  label, value, options, onChange,
}: {
  label?: string; value: T; options: { v: T; label: string }[]; onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && (
        <span style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6b6b7a' }}>
          {label}
        </span>
      )}
      <div style={{ display: 'flex', gap: 4 }}>
        {options.map((o) => (
          <button
            key={o.v}
            onClick={() => onChange(o.v)}
            style={{
              flex: 1, fontSize: 10, padding: '4px 0', borderRadius: 4, border: 'none', cursor: 'pointer',
              background: value === o.v ? '#7c3aed' : '#1e1e28',
              color: value === o.v ? '#fff' : '#6b6b7a',
              transition: 'background 0.12s',
            }}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({
  title, children, defaultOpen = true,
}: {
  title: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderBottom: '1px solid #16161c' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          width: '100%', padding: '10px 16px', background: 'none', border: 'none',
          cursor: 'pointer', color: '#9090a0',
        }}
      >
        <span style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600 }}>
          {title}
        </span>
        <span style={{ fontSize: 8, transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.15s' }}>
          ▾
        </span>
      </button>
      {open && (
        <div style={{ padding: '0 16px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ── Main Sidebar ──────────────────────────────────────────────────────────────

export function Sidebar({ kState, canvasRef }: SidebarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) kState.loadFile(file);
    e.target.value = '';
  };

  const applyPreset = (
    preset: Partial<{ segments: number; rotation: number; mirror: boolean; reverse: boolean; radialWrap: boolean; radialScale: number; sourceZoom: number }>
  ) => {
    if (preset.segments !== undefined) kState.setSegments(preset.segments);
    if (preset.rotation !== undefined) kState.setRotation(preset.rotation);
    if (preset.mirror !== undefined) kState.setMirror(preset.mirror);
    if (preset.reverse !== undefined) kState.setReverse(preset.reverse);
    if (preset.radialWrap !== undefined) kState.setRadialWrap(preset.radialWrap);
    if (preset.radialScale !== undefined) kState.setRadialScale(preset.radialScale);
    if (preset.sourceZoom !== undefined) kState.setSourceZoom(preset.sourceZoom);
  };

  const presets = [
    { label: 'Crystal', seg: 6, mirror: true, radial: false, rs: 50 },
    { label: 'Star', seg: 8, mirror: true, radial: false, rs: 50 },
    { label: 'Mandala', seg: 12, mirror: true, radial: true, rs: 45 },
    { label: 'Tunnel', seg: 16, mirror: true, radial: true, rs: 25 },
    { label: 'Prism', seg: 3, mirror: true, radial: false, rs: 50 },
    { label: 'Burst', seg: 24, mirror: false, radial: true, rs: 35 },
  ];

  return (
    <div
      style={{
        width: 264, minWidth: 264, height: '100%', background: '#0e0e12',
        borderLeft: '1px solid #16161c', display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '14px 16px 12px', borderBottom: '1px solid #16161c',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}
      >
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#e8e8f0', letterSpacing: '0.05em' }}>
            KALEI·SCOPE
          </div>
          <div style={{ fontSize: 9, color: '#3d3d50', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 1 }}>
            GPU · WebGL2
          </div>
        </div>
        <button
          onClick={kState.reset}
          style={{
            fontSize: 9, padding: '4px 8px', borderRadius: 4, border: '1px solid #1e1e28',
            background: 'none', color: '#6b6b7a', cursor: 'pointer', letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          Reset
        </button>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>

        {/* SOURCE */}
        <Section title="Source">
          {/* Dropzone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.type.startsWith('image/')) kState.loadFile(f); }}
            onDragOver={(e) => e.preventDefault()}
            style={{
              border: '1.5px dashed #1e1e28', borderRadius: 6, padding: '12px 10px',
              textAlign: 'center', cursor: 'pointer', transition: 'border-color 0.15s',
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.borderColor = '#7c3aed')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.borderColor = '#1e1e28')}
          >
            {kState.sourceImage ? (
              <div>
                <div style={{ fontSize: 10, color: '#b0b0c0' }}>
                  {kState.sourceImage.naturalWidth} × {kState.sourceImage.naturalHeight}
                </div>
                <div style={{ fontSize: 9, color: '#4b4b60', marginTop: 2 }}>Click to change</div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 18, marginBottom: 4 }}>⊕</div>
                <div style={{ fontSize: 10, color: '#4b4b60' }}>Drop or click to open</div>
              </div>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileInput} />

          {kState.sourceImage && (
            <button
              onClick={kState.clearSource}
              style={{
                width: '100%', fontSize: 9, padding: '5px 0', borderRadius: 4,
                border: '1px solid #1e1e28', background: 'none', color: '#6b6b7a',
                cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.08em',
              }}
            >
              Clear Image
            </button>
          )}

          <Chips<FitMode>
            label="Fit"
            value={kState.fitMode}
            options={[
              { v: 'cover', label: 'Cover' },
              { v: 'contain', label: 'Contain' },
              { v: 'stretch', label: 'Stretch' },
            ]}
            onChange={kState.setFitMode}
          />

          <Chips<WrapMode>
            label="Wrap"
            value={kState.wrapMode}
            options={[
              { v: 'clamp', label: 'Clamp' },
              { v: 'repeat', label: 'Repeat' },
              { v: 'mirror', label: 'Mirror' },
            ]}
            onChange={kState.setWrapMode}
          />
        </Section>

        {/* KALEIDOSCOPE */}
        <Section title="Kaleidoscope">
          <Param
            label="Segments" value={kState.segments} min={2} max={64} step={1}
            onChange={kState.setSegments}
          />
          <Param
            label="Rotation" value={kState.rotation} min={0} max={360} step={0.5} unit="°"
            onChange={kState.setRotation}
          />
          <Toggle label="Mirror" value={kState.mirror} onChange={kState.setMirror} />
          <Toggle label="Reverse" value={kState.reverse} onChange={kState.setReverse} />
        </Section>

        {/* CENTER */}
        <Section title="Center">
          <Param
            label="X" value={Math.round(kState.centerX)} min={0} max={100} step={0.5} unit="%"
            onChange={kState.setCenterX}
          />
          <Param
            label="Y" value={Math.round(kState.centerY)} min={0} max={100} step={0.5} unit="%"
            onChange={kState.setCenterY}
          />
          <div style={{ fontSize: 9, color: '#3d3d50', letterSpacing: '0.05em' }}>
            Click canvas to reposition · Alt+drag to pan source
          </div>
        </Section>

        {/* SOURCE TRANSFORM */}
        <Section title="Source Transform">
          <Param
            label="Zoom" value={Math.round(kState.sourceZoom)} min={10} max={500} step={1} unit="%"
            onChange={(v) => kState.setSourceZoom(v)}
          />
          <Param
            label="Offset X" value={Math.round(kState.sourceOffsetX)} min={-100} max={100} step={0.5} unit="%"
            onChange={kState.setSourceOffsetX}
          />
          <Param
            label="Offset Y" value={Math.round(kState.sourceOffsetY)} min={-100} max={100} step={0.5} unit="%"
            onChange={kState.setSourceOffsetY}
          />
          <Param
            label="Rotation" value={Math.round(kState.sourceRotation)} min={0} max={360} step={0.5} unit="°"
            onChange={kState.setSourceRotation}
          />
          <div style={{ fontSize: 9, color: '#3d3d50' }}>Scroll on canvas to zoom</div>
        </Section>

        {/* ADVANCED */}
        <Section title="Advanced" defaultOpen={false}>
          <Toggle label="Radial Wrap" value={kState.radialWrap} onChange={kState.setRadialWrap} />
          {kState.radialWrap && (
            <Param
              label="Radial Scale" value={kState.radialScale} min={5} max={200} step={1} unit="%"
              onChange={kState.setRadialScale}
            />
          )}

          <Chips<string>
            label="Aspect Ratio"
            value={kState.outputAspect}
            options={[
              { v: '16:9', label: '16:9' },
              { v: '1:1', label: '1:1' },
              { v: '4:3', label: '4:3' },
              { v: '9:16', label: '9:16' },
            ]}
            onChange={kState.setOutputAspect}
          />

          <Chips<Quality>
            label="Quality"
            value={kState.quality}
            options={[
              { v: 'draft', label: 'Draft' },
              { v: 'high', label: 'High' },
            ]}
            onChange={kState.setQuality}
          />
        </Section>

        {/* PRESETS */}
        <Section title="Presets" defaultOpen={false}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {presets.map((p) => (
              <button
                key={p.label}
                onClick={() =>
                  applyPreset({
                    segments: p.seg, mirror: p.mirror, radialWrap: p.radial, radialScale: p.rs,
                  })
                }
                style={{
                  fontSize: 10, padding: '7px 0', borderRadius: 4,
                  border: '1px solid #1e1e28', background: '#0a0a10',
                  color: '#9090a8', cursor: 'pointer', letterSpacing: '0.04em',
                  transition: 'background 0.12s, color 0.12s',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = '#1a1a28';
                  (e.currentTarget as HTMLElement).style.color = '#c0c0d8';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = '#0a0a10';
                  (e.currentTarget as HTMLElement).style.color = '#9090a8';
                }}
              >
                {p.label}
                <div style={{ fontSize: 8, color: '#3d3d50', marginTop: 2 }}>
                  {p.seg}-fold
                </div>
              </button>
            ))}
          </div>
        </Section>

        {/* EXPORT */}
        <Section title="Export">
          <div style={{ display: 'flex', gap: 6 }}>
            {(['png', 'jpg'] as const).map((fmt) => (
              <button
                key={fmt}
                onClick={() => {
                  const canvas = canvasRef.current;
                  if (canvas) exportCanvas(canvas, fmt);
                }}
                style={{
                  flex: 1, padding: '8px 0', borderRadius: 4,
                  border: '1px solid #7c3aed', background: 'none',
                  color: '#9b7de8', cursor: 'pointer', fontSize: 11,
                  fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = '#1a0e2e')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'none')}
              >
                {fmt.toUpperCase()}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 9, color: '#3d3d50', letterSpacing: '0.04em' }}>
            Exports at canvas render resolution ({kState.quality === 'high' ? '2×' : '1×'} DPR)
          </div>
        </Section>
      </div>
    </div>
  );
}
