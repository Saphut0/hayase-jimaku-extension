export default {
  async test() {
    // Basic connectivity test
    return true;
  },

  async single(query, options) {
    const apiKey = options?.apiKey;
    if (!apiKey) throw new Error("Jimaku API Key is missing in extension settings.");

    // IMPORTANT: Use the fetch function provided by Hayase
    const fetchFn = query.fetch;
    
    const anilistId = query.anilistId;
    const episode = query.episode;
    const titles = query.titles || [];

    let entryId = null;
    const headers = { 
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'application/json'
    };

    // 1. Try AniList ID Lookup
    if (anilistId) {
      try {
        const res = await fetchFn(`https://jimaku.cc/api/entries?anilist_id=${anilistId}`, { headers });
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          entryId = data[0].id;
        }
      } catch (e) {
        console.error("Jimaku AniList lookup failed", e);
      }
    }

    // 2. Fallback to Title Search (using 'q' per Jimaku API)
    if (!entryId && titles.length > 0) {
      try {
        const res = await fetchFn(`https://jimaku.cc/api/entries?q=${encodeURIComponent(titles[0])}`, { headers });
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          entryId = data[0].id;
        }
      } catch (e) {
        console.error("Jimaku Title lookup failed", e);
      }
    }

    if (!entryId) return [];

    // 3. Fetch Files
    try {
      const res = await fetchFn(`https://jimaku.cc/api/entries/${entryId}/files`, { headers });
      const files = await res.json();
      if (!Array.isArray(files)) return [];

      const epStr = String(episode).padStart(2, '0');

      return files
        .filter(f => !episode || f.name.includes(epStr))
        .map(f => ({
          url: f.url || f.download_url,
          language: "JP" // Must be one of the supported codes like 'JP'
        }));
    } catch (e) {
      return [];
    }
  }
};
