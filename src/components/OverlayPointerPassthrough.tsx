import { useEffect } from 'react';

/**
 * Desktop-pet hit testing: ignore mouse over transparent pixels so Settings
 * (and other apps) stay clickable, then re-enable hits on chrome controls.
 */
export function OverlayPointerPassthrough() {
  useEffect(() => {
    const bridge = window.personaBridge;
    if (!bridge?.setMousePassthrough) return;

    bridge.setMousePassthrough(true);
    let passthrough = true;

    const setPassthrough = (next: boolean) => {
      if (next === passthrough) return;
      passthrough = next;
      bridge.setMousePassthrough(next);
    };

    const onMove = (event: MouseEvent) => {
      const target = document.elementFromPoint(event.clientX, event.clientY);
      const interactive = target?.closest("[data-persona-interactive]");
      setPassthrough(!interactive);
    };

    const onLeave = () => setPassthrough(true);

    // Periodically force click-through so Deploy is never blocked if mouse
    // events stop while ignoreMouseEvents is false.
    const watchdog = window.setInterval(() => {
      if (passthrough) bridge.setMousePassthrough(true);
    }, 2000);

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseleave", onLeave);
    return () => {
      window.clearInterval(watchdog);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
      bridge.setMousePassthrough(true);
    };
  }, []);

  return null;
}
