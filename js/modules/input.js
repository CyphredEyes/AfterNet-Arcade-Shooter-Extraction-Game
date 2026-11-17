export const input = {
  keys: Object.create(null),
  mouseX: 0,
  mouseY: 0,
  mouseDown: false,
};

export function initInput(canvas) {
  window.addEventListener('keydown', e => { input.keys[e.key.toLowerCase()] = true; });
  window.addEventListener('keyup',   e => { input.keys[e.key.toLowerCase()] = false; });

  canvas.addEventListener('pointermove', e => {
    input.mouseX = e.clientX;
    input.mouseY = e.clientY;
  });
  canvas.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    input.mouseDown = true;
    input.mouseX = e.clientX;
    input.mouseY = e.clientY;
  });
  window.addEventListener('pointerup', () => { input.mouseDown = false; });
  window.addEventListener('blur', () => {
    input.mouseDown = false;
    for (const k in input.keys) input.keys[k] = false;
  });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
}