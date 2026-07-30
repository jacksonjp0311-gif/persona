export function OverlayChrome() {
  return (
    <div className="overlay-chrome">
      <div
        aria-hidden="true"
        className="overlay-drag-surface"
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          window.personaBridge?.startWindowDrag({
            x: event.screenX,
            y: event.screenY,
          });
        }}
        onPointerMove={(event) => {
          if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
          window.personaBridge?.moveWindowDrag({
            x: event.screenX,
            y: event.screenY,
          });
        }}
        onPointerUp={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
          window.personaBridge?.endWindowDrag();
        }}
        onPointerCancel={() => window.personaBridge?.endWindowDrag()}
        title="Drag Persona anywhere on your screen"
      />
      <div aria-hidden="true" className="overlay-drag-hint">
        <span>⋮⋮</span>
        Drag me
      </div>
      <button
        aria-label="Undeploy Persona"
        className="overlay-close"
        onClick={() => window.personaBridge?.hide()}
        title="Undeploy Persona"
        type="button"
      >
        ×
      </button>
    </div>
  );
}
