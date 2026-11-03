'use strict';
/* Loads editable content: the live database (api/content, served by server.py),
   falling back to the static data/content.json when there is no server. */
const Content = {
  async load() {
    for (const url of ['api/content', 'data/content.json']) {
      try {
        const r = await fetch(url, { cache: 'no-store' });
        if (r.ok) {
          const j = await r.json();
          if (j && typeof j === 'object' && j.dialogs) return j;
        }
      } catch (e) { /* try the next source */ }
    }
    return { profile: {}, levels: [], dialogs: {}, sfx: {}, comma: {}, projects: [], gallery: { poem: {}, videos: [] }, share: {} };
  },
};
