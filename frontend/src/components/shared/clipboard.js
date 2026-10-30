// navigator.clipboard only exists in a secure context, and plenty of AbuseBox
// installs are reached over plain HTTP on a LAN address. Fall back to the old
// textarea trick there, so copying works instead of doing nothing at all.
export async function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    const written = await navigator.clipboard.writeText(text).then(() => true, () => false);
    if (written) return true;
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  // Off-screen but still selectable; fixed so selecting it can't scroll the page.
  area.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0';
  document.body.appendChild(area);
  area.select();
  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  }
  area.remove();
  return copied;
}
