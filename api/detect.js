const suspiciousKeywords = [
  "login",
  "verify",
  "account",
  "wallet",
  "password",
  "bank",
  "gift",
  "urgent",
  "bonus",
  "crypto"
];

const fakeTlds = [".zip", ".mov", ".xyz", ".top", ".click", ".gq"];

function toAsciiDomain(hostname) {
  try {
    return new URL(`http://${hostname}`).hostname;
  } catch {
    return hostname;
  }
}

function hasMixedScript(domain) {
  return /[^\u0000-\u007f]/.test(domain);
}

function looksLikeIp(hostname) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
}

function normalizeUrl(rawUrl) {
  if (!rawUrl) return null;
  const withProtocol = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
  return new URL(withProtocol);
}

function analyzeTarget(targetUrl) {
  const signals = [];
  let riskScore = 0;

  const urlObject = normalizeUrl(targetUrl);
  if (!urlObject) {
    return { riskLevel: "HIGH", riskScore: 100, signals: ["Ungültige URL."] };
  }

  const full = `${urlObject.hostname}${urlObject.pathname}${urlObject.search}`.toLowerCase();
  const hostname = urlObject.hostname.toLowerCase();
  const asciiDomain = toAsciiDomain(hostname);

  if (urlObject.protocol !== "https:") {
    riskScore += 20;
    signals.push("Kein HTTPS: Verbindung ist leichter manipulierbar.");
  }

  const matchedKeywords = suspiciousKeywords.filter((keyword) => full.includes(keyword));
  if (matchedKeywords.length) {
    riskScore += Math.min(35, matchedKeywords.length * 8);
    signals.push(`Auffällige Begriffe gefunden: ${matchedKeywords.join(", ")}.`);
  }

  if (hostname.split(".").length > 4) {
    riskScore += 15;
    signals.push("Viele Subdomains erkannt (typisches Phishing-Muster).");
  }

  if (hostname.includes("--") || hostname.includes("0") || hostname.includes("1")) {
    riskScore += 12;
    signals.push("Domain enthält auffällige Zeichen/Ziffern (mögliche Lookalike-Domain).");
  }

  if (fakeTlds.some((tld) => hostname.endsWith(tld))) {
    riskScore += 18;
    signals.push("Verdächtige Top-Level-Domain erkannt.");
  }

  if (looksLikeIp(hostname)) {
    riskScore += 20;
    signals.push("Direkte IP statt Domain verwendet.");
  }

  if (hasMixedScript(asciiDomain)) {
    riskScore += 10;
    signals.push("Nicht-ASCII-Zeichen in Domain erkannt (IDN-Homograph möglich).");
  }

  const atCount = (targetUrl.match(/@/g) || []).length;
  if (atCount > 0) {
    riskScore += 20;
    signals.push("@-Zeichen in URL erkannt (URL-Verschleierung möglich).");
  }

  riskScore = Math.min(100, riskScore);

  let riskLevel = "LOW";
  if (riskScore >= 60) {
    riskLevel = "HIGH";
  } else if (riskScore >= 30) {
    riskLevel = "MEDIUM";
  }

  return { riskLevel, riskScore, signals };
}

function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Nur POST erlaubt." });
  }

  try {
    const targetUrl = req.body?.url?.trim();
    const result = analyzeTarget(targetUrl);
    return res.status(200).json(result);
  } catch {
    return res.status(400).json({ error: "URL konnte nicht analysiert werden." });
  }
}

module.exports = handler;
