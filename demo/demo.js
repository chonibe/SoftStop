// Reset styles
const styles = document.createElement('style');
styles.textContent = `
    .nudge-target { transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1); }
    .active-nudge { animation: nudge-pulse 2s infinite; }
    @keyframes nudge-pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.02); }
        100% { transform: scale(1); }
    }
`;
document.head.appendChild(styles);

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
    totalBlockedCountEl.textContent = 13 + sessionBlocked;
};

const updatePressure = (val) => {
    currentPressure = Math.min(100, Math.max(0, val));
    pressureFill.style.width = `${currentPressure}%`;
    pressureValue.textContent = `${currentPressure}%`;
    
    // Visual feedback for high pressure
    const app = document.getElementById("mockApp");
    if (currentPressure > 70) {
        app.style.boxShadow = "0 0 50px rgba(239, 68, 68, 0.2)";
    } else {
        app.style.boxShadow = "0 40px 100px rgba(0,0,0,0.5)";
    }
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
        return { allowed: true };
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
        targets.forEach(t => {
            t.classList.remove("blocked");
            t.classList.add("active-nudge");
        });
        updatePressure(currentPressure + 12);
        await callApi("/record", { userId, actionType, outcome: "executed" });
    } else {
        sessionBlocked++;
        targets.forEach(t => {
            t.classList.add("blocked");
            t.classList.remove("active-nudge");
            
            // Add a temporary shield effect
            const shield = document.createElement('div');
            shield.className = "absolute inset-0 bg-accent-green/5 border-2 border-accent-green/30 rounded-xl flex items-center justify-center z-10 pointer-events-none transition-opacity duration-1000";
            shield.innerHTML = `<span class="bg-accent-green text-white text-[8px] font-bold px-1.5 py-0.5 rounded shadow-lg">🛡️ GOVERNED</span>`;
            t.style.position = "relative";
            t.appendChild(shield);
            setTimeout(() => { shield.style.opacity = "0"; setTimeout(() => shield.remove(), 1000); }, 2000);
        });
        updatePressure(currentPressure - 4);
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
}, 5000);

// Toggle Handler
governorToggle.addEventListener("change", () => {
    const enabled = governorToggle.checked;
    modeStatus.textContent = enabled ? "Governor ENABLED" : "Governor DISABLED";
    modeStatus.classList.toggle("text-accent-blue", enabled);
    modeStatus.classList.toggle("text-accent-red", !enabled);
    
    if (!enabled) {
        document.querySelectorAll(".nudge-target").forEach(t => {
            t.classList.remove("blocked");
        });
    }
});

// Manual interactions
document.querySelectorAll(".nudge-target").forEach(t => {
    t.addEventListener("click", () => {
        const type = t.dataset.nudge;
        const action = type === "pricing_push" ? "interruption" : "urgency";
        attemptEscalation(type, action);
    });
});

updateStats();
updatePressure(20);
