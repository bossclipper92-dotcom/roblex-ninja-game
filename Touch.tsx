const press = (code: string, down: boolean) => {
  window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, bubbles: true }));
};

function Btn({ code, label, big }: { code: string; label: string; big?: boolean }) {
  const up = () => press(code, false);
  return (
    <button
      onPointerDown={(e) => {
        e.preventDefault();
        press(code, true);
      }}
      onPointerUp={up}
      onPointerCancel={up}
      onPointerLeave={up}
      onContextMenu={(e) => e.preventDefault()}
      style={{ touchAction: 'none' }}
      className={`pointer-events-auto flex select-none items-center justify-center rounded-full border border-white/40 bg-white/20 font-black text-white backdrop-blur active:bg-white/50 ${
        big ? 'h-16 w-16 text-sm' : 'h-11 w-11 text-[11px]'
      }`}
    >
      {label}
    </button>
  );
}

export default function Touch() {
  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      <div className="absolute bottom-3 left-3 grid grid-cols-3 gap-1">
        <span />
        <Btn code="KeyW" label="▲" />
        <span />
        <Btn code="KeyA" label="◀" />
        <span />
        <Btn code="KeyD" label="▶" />
        <span />
        <Btn code="KeyS" label="▼" />
        <span />
      </div>
      <div className="absolute bottom-3 right-3 flex flex-col items-end gap-1">
        <div className="flex gap-1">
          <Btn code="KeyQ" label="Q" />
          <Btn code="KeyE" label="E" />
          <Btn code="KeyR" label="R" />
        </div>
        <div className="flex items-end gap-1">
          <Btn code="ShiftLeft" label="DASH" />
          <Btn code="KeyK" label="GUARD" />
          <Btn code="Space" label="JUMP" />
          <Btn code="KeyJ" label="ATK" big />
        </div>
      </div>
      <div className="absolute right-3 top-1/2 flex -translate-y-1/2 flex-col gap-1">
        <Btn code="ArrowLeft" label="↶" />
        <Btn code="ArrowRight" label="↷" />
      </div>
      <div className="absolute left-3 top-1/2 -translate-y-1/2">
        <Btn code="KeyP" label="II" />
      </div>
    </div>
  );
}
