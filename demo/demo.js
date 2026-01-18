const logEl = document.getElementById("log");
const userIdEl = document.getElementById("userId");
const dismissedEl = document.getElementById("dismissed");
const statusValue = document.getElementById("statusValue");
const reasonValue = document.getElementById("reasonValue");
const cooldownValue = document.getElementById("cooldownValue");
const suggestValue = document.getElementById("suggestValue");

const log = (message) => {
  const time = new Date().toLocaleTimeString();
  logEl.textContent = `[${time}] ${message}\n` + logEl.textContent;
};

const getMode = () =>
  document.querySelector('input[name="mode"]:checked').value;

const setDecision = ({
  status = "Waiting",
  reason = "-",
  cooldown = "-",
  suggestion = "-"
} = {}) => {
  statusValue.textContent = status;
  reasonValue.textContent = reason;
  cooldownValue.textContent = cooldown;
  suggestValue.textContent = suggestion;
};

const basePath =
  window.location.hostname === "localhost" ? "/v1" : "/api";

const callApi = async (path, payload) => {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ? JSON.stringify(body.error) : res.statusText);
  }
  return res.json();
};

const handleAction = async (actionType) => {
  const userId = userIdEl.value.trim();
  const mode = getMode();
  if (!userId) {
    log("Enter a user id.");
    setDecision({ status: "Missing user" });
    return;
  }

  if (mode === "no-governor") {
    log(`No Governor: executed ${actionType}.`);
    setDecision({
      status: "Allowed",
      reason: "baseline",
      suggestion: "-"
    });
    return;
  }

  try {
    const decision = await callApi(`${basePath}/check`, { userId, actionType });
    if (!decision.allowed) {
      log(
        `Governor blocked ${actionType}. Reason: ${decision.reason}.` +
          (decision.suggestedActionType
            ? ` Suggest: ${decision.suggestedActionType}.`
            : "")
      );
      setDecision({
        status: "Blocked",
        reason: decision.reason,
        cooldown: decision.cooldownUntil ?? "-",
        suggestion: decision.suggestedActionType ?? "-"
      });
      await callApi(`${basePath}/record`, {
        userId,
        actionType,
        outcome: "blocked",
        decisionId: decision.decisionId
      });
      return;
    }

    const dismissed = dismissedEl.checked;
    log(
      `Governor allowed ${actionType}.` +
        (dismissed ? " User dismissed." : "")
    );
    setDecision({
      status: "Allowed",
      reason: decision.reason,
      cooldown: decision.cooldownUntil ?? "-",
      suggestion: decision.suggestedActionType ?? "-"
    });

    await callApi(`${basePath}/record`, {
      userId,
      actionType,
      outcome: "executed",
      decisionId: decision.decisionId,
      signals: dismissed ? { dismissed: true } : undefined
    });
  } catch (error) {
    log(`Error: ${error.message}`);
    setDecision({ status: "Error", reason: "request_failed" });
  }
};

document.querySelectorAll("[data-action]").forEach((button) => {
  button.addEventListener("click", () => handleAction(button.dataset.action));
});

document.getElementById("clearLog").addEventListener("click", () => {
  logEl.textContent = "";
  setDecision({});
});

setDecision({});
