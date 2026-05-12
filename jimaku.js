export default {
  async test() {
    return true;
  },

  async single(query, options) {
    const apiKey = options?.apiKey;

    if (!apiKey) {
      return undefined;
    }

    const fetchFn = query.fetch;
    const anilistId = query.anilistId;
    const episode = query.episode;
    const titles = query.titles || [];

    let entryId = null;

    // -----------------------------
    // 1. Try AniList ID lookup
    // -----------------------------
    try {
      const res = await fetchFn(
        `https://jimaku.cc/api/entries?anilist_id=${anilistId}`,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`
          }
        }
      );

      const data = await res.json();

      if (Array.isArray(data) && data.length > 0) {
        entryId = data[0].id;
      }
    } catch (e) {}

    // -----------------------------
    // 2. Fallback: title search
    // -----------------------------
    if (!entryId) {
      for (const title of titles) {
        try {
          const res = await fetchFn(
            `https://jimaku.cc/api/entries?query=${encodeURIComponent(title)}`,
            {
              headers: {
                Authorization: `Bearer ${apiKey}`
              }
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

    if (!entryId) {
      return undefined;
    }

    // -----------------------------
    // 3. Fetch subtitle files
    // -----------------------------
    let files = [];

    try {
      const res = await fetchFn(
        `https://jimaku.cc/api/entries/${entryId}/files`,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`
          }
        }
      );

      const json = await res.json();

      // 🔥 CRITICAL FIX: ensure iterable
      if (Array.isArray(json)) {
        files = json;
      } else {
        files = [];
      }
    } catch (e) {
      return undefined;
    }

    if (files.length === 0) {
      return undefined;
    }

    // -----------------------------
    // 4. Episode filtering (safe)
    // -----------------------------
    const epStr = String(episode).padStart(2, "0");

    let matches = files.filter(f =>
      f?.name?.includes(epStr)
    );

    if (matches.length === 0) {
      matches = files;
    }

    // -----------------------------
    // 5. Final mapping (Hayase format)
    // -----------------------------
    return matches
      .filter(f => f?.download_url)
      .map(f => ({
        url: f.download_url,
        language: "ja"
      }));
  }
};
