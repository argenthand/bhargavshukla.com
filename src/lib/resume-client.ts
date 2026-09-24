// The print button needs JavaScript, so it stays hidden until this runs. Everything else works without it.
const button = document.querySelector<HTMLButtonElement>('.print-button');
if (button) {
  button.hidden = false;
  button.addEventListener('click', () => window.print());
}
