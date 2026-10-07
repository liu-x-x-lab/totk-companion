interface AndroidOffline {
  saveTextFile(filename: string, mime: string, contents: string): void;
  saveBundledFile(path: string): void;
  copyText(contents: string): void;
}

declare global {
  interface Window { TotkAndroid?: AndroidOffline }
}

// The native interface is available only in the APK's packaged, trusted page.
export function saveBundledFile(path: string): boolean {
  if (!window.TotkAndroid) return false;
  window.TotkAndroid.saveBundledFile(path);
  return true;
}

export function saveTextFile(filename: string, mime: string, contents: string): boolean {
  if (window.TotkAndroid) {
    window.TotkAndroid.saveTextFile(filename, mime, contents);
    return true;
  }
  const url = URL.createObjectURL(new Blob([contents], { type: mime }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return false;
}

export async function copyText(contents: string): Promise<void> {
  if (window.TotkAndroid) window.TotkAndroid.copyText(contents);
  else await navigator.clipboard.writeText(contents);
}
