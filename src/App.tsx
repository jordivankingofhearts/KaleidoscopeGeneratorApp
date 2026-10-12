import { useRef } from 'react';
import { useKaleidoscope } from './hooks/useKaleidoscope';
import { KaleidoscopeCanvas } from './components/Canvas';
import { Sidebar } from './components/Sidebar';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const kState = useKaleidoscope();

  return (
    <div
      style={{
        display: 'flex', height: '100dvh', overflow: 'hidden',
        fontFamily: 'var(--font-sans)', background: '#060608', color: '#e8e8f0',
      }}
    >
      <KaleidoscopeCanvas kState={kState} canvasRef={canvasRef} />
      <Sidebar kState={kState} canvasRef={canvasRef} />
    </div>
  );
}
