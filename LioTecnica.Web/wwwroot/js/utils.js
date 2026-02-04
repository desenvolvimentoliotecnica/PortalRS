(() => {
  const g = window;

  g.emptyToNull = (value) => {
    const text = (value ?? "").toString().trim();
    return text ? text : null;
  };

  g.parseIntOrNull = (value) => {
    const text = (value ?? "").toString().trim();
    if (!text) return null;
    const n = parseInt(text, 10);
    return Number.isFinite(n) ? n : null;
  };

  g.parseDecimalOrNull = (value) => {
    const text = (value ?? "").toString().trim();
    if (!text) return null;
    const normalized = text.replace(/\./g, "").replace(",", ".");
    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
  };

  g.parseDateOrNull = (value) => {
    const text = (value ?? "").toString().trim();
    return text ? text : null;
  };

  g.parseTimeOrNull = (value) => {
    const text = (value ?? "").toString().trim();
    return text ? text : null;
  };

  g.parseTimeSpanOrNull = (value) => {
    const text = (value ?? "").toString().trim();
    if (!text) return null;
    const parts = text.split(":").map(p => p.trim()).filter(Boolean);
    if (parts.length === 2) {
      const hh = parts[0].padStart(2, "0");
      const mm = parts[1].padStart(2, "0");
      return `${hh}:${mm}:00`;
    }
    if (parts.length === 3) {
      const hh = parts[0].padStart(2, "0");
      const mm = parts[1].padStart(2, "0");
      const ss = parts[2].padStart(2, "0");
      return `${hh}:${mm}:${ss}`;
    }
    return null;
  };

  g.parseDateInput = (value) => {
    const text = (value ?? "").toString().trim();
    if (!text) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
    const pt = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (pt) {
      const [, dd, mm, yyyy] = pt;
      return `${yyyy}-${mm}-${dd}`;
    }
    return null;
  };
})();
