import { useCallback, useEffect, useRef, useState } from 'react';
import { Engine } from '../../game/engine';
import {
  HERO_NAME,
  INTRO_LINES,
  type DialogueLine,
  type Hotspot,
} from '../../game/data';
import { initAudio, toggleMute, playRiff } from '../../game/audio';
import DialogueBox from './DialogueBox';

interface ActiveDialogue {
  id: number;
  name: string;
  lines: DialogueLine[];
}

export default function AtticScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const [started, setStarted] = useState(false);
  const [dialogue, setDialogue] = useState<ActiveDialogue | null>(null);
  const [muted, setMuted] = useState(false);
  const [hintVisible, setHintVisible] = useState(true);

  const dialogueIdRef = useRef(0);
  const openDialogue = useCallback((lines: DialogueLine[]) => {
    engineRef.current?.setDialogueActive(true);
    setDialogue({ id: ++dialogueIdRef.current, name: HERO_NAME, lines });
  }, []);

  const closeDialogue = useCallback(() => {
    setDialogue(null);
    engineRef.current?.setDialogueActive(false);
    engineRef.current?.setMood('neutral');
    engineRef.current?.setTalking(false);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new Engine(canvas, {
      onInteract: (h: Hotspot) => {
        if (h.action === 'riff') playRiff();
        openDialogue(h.lines);
      },
      onHotspot: () => {
        // маркер рисуется на canvas; здесь можно показывать подсказку клавиши
      },
    });
    engineRef.current = engine;
    engine.start();

    // скрыть подсказку управления через некоторое время
    const hintTimer = window.setTimeout(() => setHintVisible(false), 14000);

    return () => {
      window.clearTimeout(hintTimer);
      engine.destroy();
      engineRef.current = null;
    };
  }, [openDialogue]);

  // клавиша M — звук
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'm') {
        setMuted(toggleMute());
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleStart = () => {
    initAudio();
    setStarted(true);
    // вступительный монолог
    window.setTimeout(() => openDialogue(INTRO_LINES), 600);
  };

  const handleLineChange = useCallback((line: DialogueLine) => {
    engineRef.current?.setMood(line.mood ?? 'neutral');
  }, []);

  const handleTyping = useCallback((typing: boolean) => {
    engineRef.current?.setTalking(typing);
  }, []);

  return (
    <div className="scene-root">
      <canvas ref={canvasRef} className="scene-canvas" />

      {!started && (
        <div className="scene-overlay" onClick={handleStart}>
          <div className="scene-title-block">
            <div className="scene-pre">Поссум-Спрингс · 3:12 ночи</div>
            <h1 className="scene-title">ЧЕРДАК МЭЙ</h1>
            <div className="scene-sub">нажми, чтобы начать</div>
          </div>
        </div>
      )}

      {started && hintVisible && !dialogue && (
        <div className="scene-hint">
          <span>← → / A D — ходить</span>
          <span>Space — прыжок</span>
          <span>E — осмотреть</span>
          <span>M — звук</span>
        </div>
      )}

      {started && (
        <button
          className="scene-mute"
          onClick={() => setMuted(toggleMute())}
          aria-label="Звук"
        >
          {muted ? '🔇' : '🔊'}
        </button>
      )}

      {dialogue && (
        <DialogueBox
          key={dialogue.id}
          name={dialogue.name}
          lines={dialogue.lines}
          onLineChange={handleLineChange}
          onTyping={handleTyping}
          onDone={closeDialogue}
        />
      )}
    </div>
  );
}
