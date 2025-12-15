// Helper to manage Google Fonts
// This generates a URL like: https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap

export const getGoogleFontUrl = (fontFamily: string) => {
  if (!fontFamily) return '';
  // Handle fonts with spaces (e.g., "Open Sans" -> "Open+Sans")
  const formattedName = fontFamily.replace(/\s+/g, '+');
  return `https://fonts.googleapis.com/css2?family=${formattedName}:wght@400;700&display=swap`;
};

export const loadFont = async (fontFamily: string) => {
  if (!fontFamily) return;

  // Normalize ID to lowercase to prevent duplicates (e.g. "Roboto" vs "roboto")
  const linkId = `font-${fontFamily.replace(/\s+/g, '-').toLowerCase()}`;

  if (!document.getElementById(linkId)) {
    const link = document.createElement('link');
    link.id = linkId;
    link.rel = 'stylesheet';
    link.href = getGoogleFontUrl(fontFamily);
    link.crossOrigin = "anonymous"; // Helps with CORS
    document.head.appendChild(link);

    // Tiny yield to ensure DOM update is registered before asking to load
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  // The Critical Fix:
  // We explicitly pause here until the browser confirms the font is ready to use.
  // This prevents the UI from updating the font-family before the resource is available.
  try {
      await document.fonts.load(`1em "${fontFamily}"`);
  } catch (e) {
      console.warn(`Font loading check failed for ${fontFamily} (it may still load later)`, e);
  }
};