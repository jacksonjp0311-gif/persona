import { useEffect } from 'react';

/**
 * Soft click-through: pass clicks through empty chrome so the avatar does not
 * block the desktop, but keep hits on drag / close / dance controls.
 *
 * Default is mouse ON so the transparent window keeps compositing on Windows.
 */
export function OverlayPointerPassthrough() {
  useEffect(() => {
    const bridge = window.personaBridge;
    if (!bridge?.setMousePassthrough) return;

    // Start with hits enabled (visible + interactive).
    bridge.setMousePassthrough(false);
    let passthrough = false;

    const setPassthrough = (next: boolean) => {
      if (next === passthrough) return;
      passthrough = next;
      bridge.setMousePassthrough(next);
    };

    const onMove = (event: MouseEvent) => {
      const target = document.elementFromPoint(event.clientX, event.clientY);
      if (!target || target === document.documentElement || target === document.body) {
        setPassthrough(true);
        return;
      }
      const interactive = target.closest('[data-persona-interactive]');
      // Canvas/WebGL root is not interactive chrome — pass through so the
      // character does not steal desktop clicks, but keep control hits.
      const onCanvas =
        target.tagName === 'CANVAS' ||
        Boolean(target.closest('canvas'));
      if (interactive) {
        setPassthrough(false);
      } else if (onCanvas) {
        setPassthrough(true);
      } else {
        setPassthrough(true);
      }
    };

    const onLeave = () => setPassthrough(true);

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseleave', onLeave);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseleave', onLeave);
      bridge.setMousePassthrough(false);
    };
  }, []);

  return null;
}
