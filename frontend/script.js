const form = document.getElementById("detectorForm");
const input = document.getElementById("targetUrl");
const resultCard = document.getElementById("resultCard");
const riskBadge = document.getElementById("riskBadge");
const scoreText = document.getElementById("scoreText");
const signalsList = document.getElementById("signals");

function badgeClassFromRisk(risk) {
  if (risk === "HIGH") return "high";
  if (risk === "MEDIUM") return "medium";
  return "low";
}

function renderResult(data) {
  const { riskLevel, riskScore, signals } = data;

  resultCard.classList.remove("hidden");
  riskBadge.textContent = riskLevel;
  riskBadge.className = `badge ${badgeClassFromRisk(riskLevel)}`;
  scoreText.textContent = `Risiko-Score: ${riskScore}/100`;

  signalsList.innerHTML = "";
  if (!signals.length) {
    const li = document.createElement("li");
    li.textContent = "Keine auffälligen Signale erkannt.";
    signalsList.appendChild(li);
    return;
  }

  signals.forEach((signal) => {
    const li = document.createElement("li");
    li.textContent = signal;
    signalsList.appendChild(li);
  });
}

async function checkUrl(targetUrl) {
  const response = await fetch("/api/detect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: targetUrl })
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Prüfung fehlgeschlagen");
  }

  return payload;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const targetUrl = input.value.trim();
  if (!targetUrl) return;

  const button = form.querySelector("button[type='submit']");
  button.disabled = true;
  button.textContent = "Prüfe...";

  try {
    const data = await checkUrl(targetUrl);
    renderResult(data);
  } catch (error) {
    renderResult({
      riskLevel: "HIGH",
      riskScore: 100,
      signals: [error.message]
    });
  } finally {
    button.disabled = false;
    button.textContent = "Prüfen";
  }
});
