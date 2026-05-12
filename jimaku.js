export default {
  async test() {
    return true;
  },

  async single(query, options) {
    const { fetch, anilistId, episode, titles } = query;
    const apiKey = options?.apiKey;
    const preferredLang = (options?.preferredLanguage || "JP").toUpperCase();

    if (!apiKey) {
      throw new Error("Missing Jimaku API key");
    }

    // ---------- helpers ----------
    const normalizeEpisode = (ep) => {
      const num = String(ep).padStart(2, "0");
      return [
        `E${num}`,
        `EP${num}`,
        `Episode ${ep}`,
        `-${num}`,
        ` ${ep} `
      ];
    };

    const matchEpisode = (filename, ep) => {
      const patterns = normalizeEpisode(ep);
      return patterns.some(p =>
        filename.toLowerCase().includes(p.toLowerCase())
      );
    };

    const detectLang = (name) => {
      const lower = name.toLowerCase();
      if (lower.includes("eng") || lower.includes("english")) return "EN";
      if (lower.includes("jpn") || lower.includes("japanese")) return "JP";
      return "UNKNOWN";
    };

    const scoreFile = (file) => {
      let score = 0;
      const name = file.name.toLowerCase();

      if (name.includes("bd")) score += 3;
      if (name.includes("blu")) score += 3;
      if (name.includes("web")) score += 2;
      if (name.includes("1080")) score += 2;
      if (name.includes("720")) score += 1;

      return score;
    };

    // ---------- step 1: find entry ----------
    let entryId = null;

    try {
      // try AniList ID first
      const res = await fetch(
        `https://jimaku.cc/api/entries?anilist_id=${anilistId}`,
        {
          headers: { Authorization: `Bearer ${apiKey}` }
        }
      );

      const data = await res.json();

      if (data && data.length > 0) {
        entryId = data[0].id;
      }
    } catch (e) {}

    // fallback: title search
    if (!entryId && titles?.length) {
      for (const title of titles) {
        try {
          const res = await fetch(
            `https://jimaku.cc/api/entries?query=${encodeURIComponent(title)}`,
            {
              headers: { Authorization: `Bearer ${apiKey}` }
            }
          );

          const data = await res.json();

          if (data && data.length > 0) {
            entryId = data[0].id;
            break;
          }
        } catch (e) {}
      }
    }

    if (!entryId) return undefined;

    // ---------- step 2: fetch files ----------
    let files = [];

    try {
      const res = await fetch(
        `https://jimaku.cc/api/entries/${entryId}/files`,
        {
          headers: { Authorization: `Bearer ${apiKey}` }
        }
      );

      files = await res.json();
    } catch (e) {
      throw new Error("Failed to fetch subtitle files");
    }

    if (!files || files.length === 0) return undefined;

    // ---------- step 3: filter ----------
    let filtered = files.filter(file =>
      matchEpisode(file.name, episode)
    );

    // fallback: if nothing matched, use all
    if (filtered.length === 0) {
      filtered = files;
    }

    // ---------- step 4: language filtering ----------
    filtered = filtered.map(file => ({
      ...file,
      detectedLang: detectLang(file.name),
      score: scoreFile(file)
    }));

    // prioritize preferred language
    filtered.sort((a, b) => {
      if (a.detectedLang === preferredLang && b.detectedLang !== preferredLang) return -1;
      if (b.detectedLang === preferredLang && a.detectedLang !== preferredLang) return 1;
      return b.score - a.score;
    });

    // ---------- step 5: return ----------
    return filtered.map(file => ({
      url: file.download_url,
      language: file.detectedLang === "UNKNOWN" ? preferredLang : file.detectedLang
    }));
  }
};