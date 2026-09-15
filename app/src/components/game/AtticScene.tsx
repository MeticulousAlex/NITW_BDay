import { useEffect, useRef } from 'react';
import { Engine } from '../../game/engine';

// Сцена целиком на canvas: комната, Мэй, подсказки и диалоги рисует движок.
export default function AtticScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new Engine(canvas);
    engine.start();
    return () => engine.destroy();
  }, []);

  return (
    <div className="scene-root">
      <canvas ref={canvasRef} className="scene-canvas" />
    </div>
  );
}
