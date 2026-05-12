export default {
  async test() {
    return true;
  },

  async single(query, options) {
    const apiKey = options?.apiKey;
    if (!apiKey) return [];

    // Use the provided fetch utility from query, or fall back to global fetch
    const fetchFn = query?.fetch || fetch;
    if (typeof fetchFn !== "function") return [];

    const anilistId = query?.anilistId;
    const episode = query?.episode;
    const titles = Array.isArray(query?.titles) ? query?.titles : [];

    let entryId = null;
    const headers = { 
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'application/json'
    };

    // 1. AniList ID lookup
    if (anilistId) {
      try {
        const res = await fetchFn(`https://jimaku.cc/api/entries?anilist_id=${anilistId}`, { headers });
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          entryId = data[0].id;
        }
      } catch (e) {
        console.error("Jimaku: AniList lookup failed", e);
      }
    }

    // 2. Title fallback (Note: Jimaku uses 'q' as the parameter)
    if (!entryId) {
      for (const title of titles) {
        if (!title) continue;
        try {
          const res = await fetchFn(`https://jimaku.cc/api/entries?q=${encodeURIComponent(title)}`, { headers });
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            entryId = data[0].id;
            break;
          }
        } catch (e) {}
      }
    }

    if (!entryId) return [];

    // 3. Fetch subtitle files
    let files = [];
    try {
      const res = await fetchFn(`https://jimaku.cc/api/entries/${entryId}/files`, { headers });
      const json = await res.json();
      files = Array.isArray(json) ? json : [];
    } catch (e) {
      return [];
    }

    // 4. Episode match
    const ep = String(episode ?? "").padStart(2, "0");
    // Improvement: check for common patterns like 'E01' or ' 01 '
    let matches = ep ? files.filter(f => f?.name?.includes(ep)) : [];
    if (matches.length === 0) matches = files;

    // 5. Return SubtitleResult[]
    return matches
      .filter(f => f?.url || f?.download_url)
      .map(f => ({
        url: f.url ?? f.download_url,
        name: f.name || "Japanese Subs", // Adding name helps in the Hayase UI selection
        language: "JP" 
      }));
  }
};
