import { useCallback, useEffect, useRef, useState } from 'react';
import type { DialogueLine } from '../../game/data';
import { blip } from '../../game/audio';

interface Props {
  name: string;
  lines: DialogueLine[];
  onLineChange: (line: DialogueLine, index: number) => void;
  onTyping: (typing: boolean) => void;
  onDone: () => void;
}

const CHAR_MS = 22;

export default function DialogueBox({ name, lines, onLineChange, onTyping, onDone }: Props) {
  const [lineIdx, setLineIdx] = useState(0);
  const [shown, setShown] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const line = lines[lineIdx];
  const typing = shown < line.text.length;

  useEffect(() => {
    onLineChange(line, lineIdx);
  }, [line, lineIdx, onLineChange]);

  useEffect(() => {
    onTyping(typing);
  }, [typing, onTyping]);

  // печатная машинка
  useEffect(() => {
    if (!typing) return;
    const id = window.setInterval(() => {
      setShown((s) => {
        const next = Math.min(line.text.length, s + 1);
        if (next % 2 === 0 && next < line.text.length) blip();
        return next;
      });
    }, CHAR_MS);
    return () => window.clearInterval(id);
  }, [typing, line.text]);

  const advance = useCallback(() => {
    if (typing) {
      setShown(line.text.length);
      return;
    }
    if (lineIdx < lines.length - 1) {
      setLineIdx((i) => i + 1);
      setShown(0);
    } else {
      onDone();
    }
  }, [typing, line, lineIdx, lines.length, onDone]);

  // клавиатура: E / Enter / Space / Esc
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'e' || k === 'enter' || k === ' ' || k === 'escape') {
        e.preventDefault();
        e.stopPropagation();
        advance();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [advance]);

  return (
    <div
      ref={boxRef}
      onClick={advance}
      className="dialogue-box"
      role="button"
      aria-label="Диалог"
    >
      <div className="dialogue-name">{name}</div>
      <div className="dialogue-text">
        {line.text.slice(0, shown)}
        {!typing && <span className="dialogue-next">▼</span>}
      </div>
    </div>
  );
}
