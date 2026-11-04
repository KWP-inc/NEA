/** Opens NEA's live face scan (camera, pulse, stress, water and skin) from anywhere on the site. */
export const openLiveScan = () => window.dispatchEvent(new CustomEvent("nea:livescan"));
