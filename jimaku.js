export default {
  async test() {
    return true;
  },

  async single(query, options) {
    const apiKey = options?.apiKey;
    if (!apiKey) return undefined;

    const fetchFn = query.fetch;
    const anilistId = query.anilistId;
    const episode = query.episode;
    const titles = query.titles || [];

    let entryId = null;

    // --- Try AniList ID ---
    try {
      const res = await fetchFn(
        `https://jimaku.cc/api/entries?anilist_id=${anilistId}`,
        {
          headers: { Authorization: `Bearer ${apiKey}` }
        }
      );

      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        entryId = data[0].id;
      }
    } catch (e) {}

    // --- Fallback title search ---
    if (!entryId) {
      for (let title of titles) {
        try {
          const res = await fetchFn(
            `https://jimaku.cc/api/entries?query=${encodeURIComponent(title)}`,
            {
              headers: { Authorization: `Bearer ${apiKey}` }
            }
          );

          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            entryId = data[0].id;
            break;
          }
        } catch (e) {}
      }
    }

    if (!entryId) return undefined;

    // --- Fetch files ---
    let files = [];
    try {
      const res = await fetchFn(
        `https://jimaku.cc/api/entries/${entryId}/files`,
        {
          headers: { Authorization: `Bearer ${apiKey}` }
        }
      );

      files = await res.json();
    } catch (e) {
      return undefined;
    }

    if (!Array.isArray(files)) return undefined;

    // --- Simple episode match ---
    const epStr = String(episode).padStart(2, "0");

    const matches = files.filter(f =>
      f.name && f.name.includes(epStr)
    );

    const usable = matches.length > 0 ? matches : files;

    return usable.map(f => ({
      url: f.download_url,
      language: "JP"
    }));
  }
};
