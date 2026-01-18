const monitorLog = document.getElementById("monitorLog");
const governorToggle = document.getElementById("governorToggle");
const modeStatus = document.getElementById("modeStatus");
const pressureFill = document.getElementById("pressureFill");
const pressureValue = document.getElementById("pressureValue");

const userId = "user_123";
let currentPressure = 0;

const basePath = window.location.hostname === "localhost" ? "/v1" : "/api";

const addLog = (type, message) => {
    const time = new Date().toLocaleTimeString([], { hour12: false });
    const entry = document.createElement("div");
    entry.className = `log-entry ${type}`;
    entry.innerHTML = `<span class="time">${time}</span> ${message}`;
    monitorLog.prepend(entry);
};

const updatePressure = (val) => {
    currentPressure = Math.min(100, Math.max(0, val));
    pressureFill.style.width = `${currentPressure}%`;
    pressureValue.textContent = `${currentPressure}%`;
    
    if (currentPressure > 70) {
        document.body.classList.add("high-pressure");
    } else {
        document.body.classList.remove("high-pressure");
    }
};

const callApi = async (path, payload) => {
    const res = await fetch(`${basePath}${path}`, {
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

const runDecisionFlow = async (actionType, nudgeElId) => {
    const isGovernorOn = governorToggle.checked;
    addLog("check", `Propose action: <strong>${actionType}</strong>`);
    
    if (!isGovernorOn) {
        addLog("allow", `Governor OFF: Action <strong>${actionType}</strong> executed automatically.`);
        if (nudgeElId) {
            const el = document.getElementById(nudgeElId);
            if (el) el.classList.add("active");
        }
        updatePressure(currentPressure + 20);
        return;
    }

    try {
        const decision = await callApi("/check", { userId, actionType });
        if (!decision.allowed) {
            addLog("block", `Governor BLOCKED <strong>${actionType}</strong>. Reason: ${decision.reason}`);
            updatePressure(currentPressure - 5);
            return;
        }

        addLog("allow", `Governor ALLOWED <strong>${actionType}</strong>. Reason: ${decision.reason}`);
        if (nudgeElId) {
            const el = document.getElementById(nudgeElId);
            if (el) el.classList.add("active");
        }
        updatePressure(currentPressure + 10);

        await callApi("/record", {
            userId,
            actionType,
            outcome: "executed",
            decisionId: decision.decisionId
        });
    } catch (e) {
        addLog("system", `Error: ${e.message}`);
    }
};

// Toggle handler
governorToggle.addEventListener("change", () => {
    const isOn = governorToggle.checked;
    document.body.classList.toggle("mode-governor", isOn);
    modeStatus.textContent = isOn ? "Governor ON" : "Governor OFF";
    addLog("system", `Governor mode switched to: ${isOn ? "ON" : "OFF"}`);
});

// Scenario Handlers
document.querySelectorAll("[data-scenario]").forEach(btn => {
    btn.addEventListener("click", async () => {
        const scenario = btn.dataset.scenario;
        
        if (scenario === "publish") {
            addLog("system", "Scenario: User attempts to publish site...");
            await runDecisionFlow("interruption", "upgradeBanner");
        } else if (scenario === "stats") {
            addLog("system", "Scenario: User viewing dashboard stats...");
            await runDecisionFlow("urgency", "conversionNudge");
            setTimeout(() => runDecisionFlow("reminder", "seoBadge"), 1000);
            setTimeout(() => runDecisionFlow("discount", "analyticsBadge"), 2000);
        } else if (scenario === "reset") {
            addLog("system", "Resetting user state and pressure...");
            updatePressure(0);
            document.querySelectorAll(".active").forEach(el => el.classList.remove("active"));
            monitorLog.innerHTML = `<div class="log-entry system">System reset.</div>`;
        }
    });
});

// Nudge Dismissals
document.getElementById("closeBanner")?.addEventListener("click", async () => {
    document.getElementById("upgradeBanner").classList.remove("active");
    addLog("system", "User dismissed upgrade banner (Hesitation signal)");
    
    try {
        await callApi("/record", {
            userId,
            actionType: "interruption",
            outcome: "blocked", // Mark as blocked/dismissed for cooldown
            signals: { dismissed: true }
        });
    } catch (e) {
        console.error("Failed to record dismissal", e);
    }
});

document.getElementById("clearMonitor").addEventListener("click", () => {
    monitorLog.innerHTML = "";
});
