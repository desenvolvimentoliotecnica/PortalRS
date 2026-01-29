(function () {
  if (window.PortalVagasUtils) return;

  function digitsOnly(value) {
    return (value || "").replace(/\D/g, "");
  }

  function formatPhone(value) {
    const digits = digitsOnly(value).slice(0, 11);
    if (!digits) return "";
    const ddd = digits.slice(0, 2);
    const part1 = digits.length > 2 ? digits.slice(2, digits.length > 6 ? 7 : 6) : "";
    const part2 = digits.length > 6 ? digits.slice(7) : "";
    if (digits.length <= 6) return `(${ddd}) ${digits.slice(2)}`;
    return `(${ddd}) ${part1}-${part2}`;
  }

  function formatMoneyBR(value) {
    const digits = digitsOnly(value);
    if (!digits) return "";
    const cents = digits.padStart(3, "0");
    const integerPart = cents.slice(0, -2);
    const decimalPart = cents.slice(-2);
    const integerFormatted = Number(integerPart).toLocaleString("pt-BR");
    return `${integerFormatted},${decimalPart}`;
  }

  function parseMoneyBR(value) {
    if (!value) return null;
    const normalized = value.replace(/\./g, "").replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function toNumber(value) {
    if (value === "" || value === null || value === undefined) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  window.PortalVagasUtils = {
    digitsOnly,
    formatPhone,
    formatMoneyBR,
    parseMoneyBR,
    toNumber
  };
})();
