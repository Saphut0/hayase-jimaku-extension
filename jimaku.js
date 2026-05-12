export default {
  async test() {
    return true;
  },

  async single(query, options) {
    const apiKey = options?.apiKey;
    if (!apiKey) return [];

    const fetchFn = query?.fetch;
    if (typeof fetchFn !== "function") return [];

    const anilistId = query?.anilistId;
    const episode = query?.episode;

    // ✅ FIX 1: Always guarantee titles is an array, even if undefined/null/non-array
    const rawTitles = query?.titles;
    const titles = Array.isArray(rawTitles) ? rawTitles : [];

    let entryId = null;

    // -------------------------
    // 1. AniList lookup
    // -------------------------
    if (anilistId) {
      try {
        const res = await fetchFn(
          `https://jimaku.cc/api/entries?anilist_id=${anilistId}`,
          { headers: { Authorization: `Bearer ${apiKey}` } }
        );

        const data = await res.json();

        // ✅ FIX 2: Guard against non-array API responses (e.g. error objects)
        if (Array.isArray(data) && data.length > 0) {
          entryId = data[0].id;
        }
      } catch (e) {}
    }

    // -------------------------
    // 2. Title fallback
    // -------------------------
    if (!entryId) {
      for (const title of titles) {
        if (!title) continue;
        try {
          const res = await fetchFn(
            `https://jimaku.cc/api/entries?query=${encodeURIComponent(title)}`,
            { headers: { Authorization: `Bearer ${apiKey}` } }
          );

          const data = await res.json();

          // ✅ FIX 2 (same guard): Don't assume it's an array
          if (Array.isArray(data) && data.length > 0) {
            entryId = data[0].id;
            break;
          }
        } catch (e) {}
      }
    }

    if (!entryId) return [];

    // -------------------------
    // 3. Fetch files
    // -------------------------
    let files = [];

    try {
      const res = await fetchFn(
        `https://jimaku.cc/api/entries/${entryId}/files`,
        { headers: { Authorization: `Bearer ${apiKey}` } }
      );

      const json = await res.json();

      // ✅ FIX 2 (same guard): /files can also return a non-array on error
      files = Array.isArray(json) ? json : [];
    } catch (e) {
      return [];
    }

    if (files.length === 0) return [];

    // -------------------------
    // 4. Episode match
    // -------------------------
    const ep = String(episode ?? "").padStart(2, "0");

    let matches = ep ? files.filter(f => f?.name?.includes(ep)) : [];

    if (matches.length === 0) {
      matches = files;
    }

    // -------------------------
    // 5. Return
    // -------------------------
    return matches
      .filter(f => f?.url || f?.download_url)
      .map(f => ({
        url: f.url ?? f.download_url,
        language: "ja"
      }));
  }
};
