const governorToggle = document.getElementById("governorToggle");
const modeStatus = document.getElementById("modeStatus");
const pressureFill = document.getElementById("pressureFill");
const pressureValue = document.getElementById("pressureValue");
const sessionAttemptsEl = document.getElementById("sessionAttempts");
const sessionBlockedEl = document.getElementById("sessionBlocked");
const sessionRateEl = document.getElementById("sessionRate");
const totalBlockedCountEl = document.getElementById("totalBlockedCount");

// Session State
let sessionAttempts = 0;
let sessionBlocked = 0;
let currentPressure = 20;
const userId = "user_demo_" + Math.random().toString(36).substr(2, 9);

const basePath = window.location.hostname === "localhost" ? "/v1" : "/api";

const updateStats = () => {
    sessionAttemptsEl.textContent = sessionAttempts;
    sessionBlockedEl.textContent = sessionBlocked;
    const rate = sessionAttempts > 0 ? Math.round((sessionBlocked / sessionAttempts) * 100) : 0;
    sessionRateEl.textContent = `${rate}%`;
    totalBlockedCountEl.textContent = 13 + sessionBlocked; // Baseline 13 + session
};

const updatePressure = (val) => {
    currentPressure = Math.min(100, Math.max(0, val));
    pressureFill.style.width = `${currentPressure}%`;
    pressureValue.textContent = `${currentPressure}%`;
};

const callApi = async (path, payload) => {
    try {
        const res = await fetch(`${basePath}${path}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        return await res.json();
    } catch (e) {
        console.error("API Error", e);
        return { allowed: true }; // Fallback to allow if API is down for demo
    }
};

const attemptEscalation = async (nudgeType, actionType) => {
    sessionAttempts++;
    const isGovernorEnabled = governorToggle.checked;
    
    let allowed = true;
    let reason = "governor_disabled";

    if (isGovernorEnabled) {
        const decision = await callApi("/check", { userId, actionType });
        allowed = decision.allowed;
        reason = decision.reason;
    }

    const targets = document.querySelectorAll(`[data-nudge="${nudgeType}"]`);
    
    if (allowed) {
        // Show nudge aggressively
        targets.forEach(t => {
            t.classList.remove("blocked");
            t.classList.add("active-nudge");
        });
        updatePressure(currentPressure + 10);
        
        // Record successful execution
        await callApi("/record", { userId, actionType, outcome: "executed" });
    } else {
        // Blocked by Governor
        sessionBlocked++;
        targets.forEach(t => {
            t.classList.add("blocked");
            t.classList.remove("active-nudge");
        });
        updatePressure(currentPressure - 2);
        
        // Record block
        await callApi("/record", { userId, actionType, outcome: "blocked" });
    }

    updateStats();
};

// Simulation Loop
const actions = [
    { nudge: "ai_insights", action: "urgency" },
    { nudge: "multi_region", action: "reminder" },
    { nudge: "sso", action: "discount" },
    { nudge: "pricing_push", action: "interruption" }
];

let simInterval = setInterval(() => {
    const pick = actions[Math.floor(Math.random() * actions.length)];
    attemptEscalation(pick.nudge, pick.action);
}, 4000);

// Toggle Handler
governorToggle.addEventListener("change", () => {
    const enabled = governorToggle.checked;
    modeStatus.textContent = enabled ? "Governor ENABLED" : "Governor DISABLED";
    document.getElementById("mockApp").classList.toggle("unprotected", !enabled);
    
    if (!enabled) {
        // Clear all blocked states immediately if disabled
        document.querySelectorAll(".nudge-target").forEach(t => {
            t.classList.remove("blocked");
        });
    }
});

// Manual Triggers (on click)
document.querySelectorAll(".nudge-target").forEach(t => {
    t.addEventListener("click", () => {
        const type = t.dataset.nudge;
        const action = type === "pricing_push" ? "interruption" : "urgency";
        attemptEscalation(type, action);
    });
});

// Initial Stats
updateStats();
