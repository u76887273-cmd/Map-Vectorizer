MAP VECTORIZER — INSTALLABLE PWA

This package is designed for iPhone Safari and desktop browsers.

INSTALL ON iPHONE:
1. Put this folder on any HTTPS web host.
2. Open index.html through that HTTPS address in Safari.
3. Tap Share.
4. Choose Add to Home Screen.
5. Launch Map Vectorizer from the Home Screen.

The app has:
- Offline service worker after the first load.
- No CDN dependency for Shapefile export.
- Branch-aware tracing.
- Intersection handling.
- Vertex editing.
- Save/load project JSON.
- Optional georeferencing.
- Shapefile + SHX + DBF + PRJ export.

IMPORTANT:
A local file opened directly from Files/Safari cannot install a PWA or reliably run a service worker. It must be served from HTTPS for the installable/offline behavior.

For a production deployment, upload the folder contents as-is to an HTTPS static host.
