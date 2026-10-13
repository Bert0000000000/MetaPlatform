/** Copy during the user gesture, including public HTTP browsers without Clipboard API. */
export async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const focused = document.activeElement;
  const input = document.createElement('textarea');
  input.value = text;
  input.readOnly = true;
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.append(input);
  try {
    input.focus({ preventScroll: true });
    input.select();
    if (typeof document.execCommand !== 'function' || !document.execCommand('copy')) {
      throw new Error('Clipboard copy was rejected');
    }
  } finally {
    input.remove();
    if (focused instanceof HTMLElement) focused.focus({ preventScroll: true });
  }
}
