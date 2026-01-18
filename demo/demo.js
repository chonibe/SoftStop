const logEl = document.getElementById("log");
const userIdEl = document.getElementById("userId");
const dismissedEl = document.getElementById("dismissed");

const log = (message) => {
  const time = new Date().toLocaleTimeString();
  logEl.textContent = `[${time}] ${message}\n` + logEl.textContent;
};

const getMode = () =>
  document.querySelector('input[name="mode"]:checked').value;

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
    return;
  }

  if (mode === "no-governor") {
    log(`No Governor: executed ${actionType}.`);
    return;
  }

  try {
    const decision = await callApi("/v1/check", { userId, actionType });
    if (!decision.allowed) {
      log(
        `Governor blocked ${actionType}. Reason: ${decision.reason}.` +
          (decision.suggestedActionType
            ? ` Suggest: ${decision.suggestedActionType}.`
            : "")
      );
      await callApi("/v1/record", {
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

    await callApi("/v1/record", {
      userId,
      actionType,
      outcome: "executed",
      decisionId: decision.decisionId,
      signals: dismissed ? { dismissed: true } : undefined
    });
  } catch (error) {
    log(`Error: ${error.message}`);
  }
};

document.querySelectorAll("[data-action]").forEach((button) => {
  button.addEventListener("click", () => handleAction(button.dataset.action));
});

document.getElementById("clearLog").addEventListener("click", () => {
  logEl.textContent = "";
});
