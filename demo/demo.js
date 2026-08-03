// Experience Manager
const introModal = document.getElementById("introModal");
const startExperience = document.getElementById("startExperience");
const experienceConsole = document.getElementById("experienceConsole");
const governorToggle = document.getElementById("governorToggle");
const modeStatus = document.getElementById("modeStatus");
const pressureFill = document.getElementById("pressureFill");
const pressureValue = document.getElementById("pressureValue");
const decisionStream = document.getElementById("decisionStream");
const totalBlockedEl = document.getElementById("totalBlocked");
const notificationStack = document.getElementById("notificationStack");
const acmeDashboard = document.getElementById("acmeDashboard");
const shieldEffect = document.getElementById("shieldEffect");

// Session State
let sessionAttempts = 0;
let sessionBlocked = 0;
let currentPressure = 20;
let isExperienceActive = false;
const userId = "user_exp_" + Math.random().toString(36).substr(2, 9);
const basePath = window.location.hostname === "localhost" ? "/v1" : "/api";

// 1. Audio Engine (Simulated)
const playSound = (type) => {
    // In a real browser we would use Audio() or a library
    // Here we'll just log or use visual pulses
};

// 2. Monitoring Stream Logic
const addStreamEntry = (type, message) => {
    const time = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const entry = document.createElement("div");
    entry.className = `flex gap-2 ${type === 'block' ? 'text-accent-orange' : 'text-slate-400'}`;
    entry.innerHTML = `<span class="text-slate-600 font-bold">${time}</span> <span>${message}</span>`;
    decisionStream.prepend(entry);
    
    // Auto-scroll logic if we had more space, here we just keep last few
    if (decisionStream.children.length > 5) {
        decisionStream.lastElementChild.remove();
    }
};

// 3. Notification Factory
const spawnNotification = (app, title, body) => {
    const icons = {
        Gmail: 'https://upload.wikimedia.org/wikipedia/commons/7/7e/Gmail_icon_%282020%29.svg',
        Slack: 'https://upload.wikimedia.org/wikipedia/commons/d/d5/Slack_icon_2019.svg',
        System: '🛡️'
    };

    const notif = document.createElement('div');
    notif.className = 'mac-notification';
    notif.innerHTML = `
        <div class="flex items-start gap-3">
            <div class="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center p-2 border border-white/10">
                ${icons[app].startsWith('http') ? `<img src="${icons[app]}" class="w-full h-full">` : `<span class="text-lg">${icons[app]}</span>`}
            </div>
            <div class="flex-1">
                <div class="flex justify-between items-center mb-0.5">
                    <span class="text-[10px] font-black uppercase tracking-widest text-slate-400">${app}</span>
                    <span class="text-[10px] text-slate-500">now</span>
                </div>
                <div class="text-sm font-bold text-white mb-0.5">${title}</div>
                <div class="text-xs text-slate-400 leading-tight">${body}</div>
            </div>
        </div>
    `;
    notificationStack.prepend(notif);
    
    // Trigger animation
    setTimeout(() => notif.classList.add('active'), 50);
    
    // Auto-remove
    setTimeout(() => {
        notif.classList.remove('active');
        setTimeout(() => notif.remove(), 500);
    }, 5000);
};

// 4. Pressure Manager
const updatePressure = (delta) => {
    currentPressure = Math.min(100, Math.max(0, currentPressure + delta));
    pressureFill.style.width = `${currentPressure}%`;
    pressureValue.textContent = `${currentPressure}%`;
    
    // Dynamic color based on pressure
    if (currentPressure > 80) {
        pressureFill.className = "h-full bg-accent-red transition-all duration-500";
        acmeDashboard.classList.add('jitter');
    } else if (currentPressure > 50) {
        pressureFill.className = "h-full bg-orange-500 transition-all duration-500";
        acmeDashboard.classList.remove('jitter');
    } else {
        pressureFill.className = "h-full bg-accent-blue transition-all duration-500";
        acmeDashboard.classList.remove('jitter');
    }
};

// 5. API Logic
const callApi = async (path, payload) => {
    try {
        const res = await fetch(`${basePath}${path}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        return await res.json();
    } catch (e) {
        return { allowed: true };
    }
};

// 6. Escalation Flow
const attemptEscalation = async (nudgeType, actionType, source) => {
    if (!isExperienceActive) return;
    
    sessionAttempts++;
    const isGovernorOn = governorToggle.checked;
    
    let allowed = true;
    let reason = "governor_disabled";

    if (isGovernorOn) {
        const decision = await callApi("/check", { userId, actionType });
        allowed = decision.allowed;
        reason = decision.reason;
    }

    if (allowed) {
        addStreamEntry('allow', `ALLOWED: <strong>${source}</strong> request passed gate.`);
        
        // Execute UI Impact
        if (nudgeType === 'notification') {
            spawnNotification(source, "Limited Time Offer", "Upgrade your plan now and save 50%. This offer expires in 4 hours.");
        } else if (nudgeType === 'pricing_push') {
            document.getElementById('fakeViewers').classList.add('opacity-100');
            document.querySelector('[data-nudge="pricing_push"]').classList.add('active-nudge');
        } else {
            const el = document.getElementById(`${nudgeType}Badge`);
            if (el) el.classList.remove('hidden');
        }
        
        updatePressure(15);
        await callApi("/record", { userId, actionType, outcome: "executed" });
    } else {
        sessionBlocked++;
        addStreamEntry('block', `BLOCKED: <strong>${source}</strong> denied. Reason: ${reason}`);
        
        // Visual feedback for block
        const target = document.querySelector(`[data-nudge="${nudgeType}"]`);
        if (target) {
            target.classList.add('shield-active');
            setTimeout(() => target.classList.remove('shield-active'), 2000);
        }
        
        updatePressure(-5);
        await callApi("/record", { userId, actionType, outcome: "blocked" });
    }

    // Update Footer Stats
    document.getElementById("footerAttempts").textContent = sessionAttempts;
    document.getElementById("footerBlocked").textContent = sessionBlocked;
    document.getElementById("footerRate").textContent = `${Math.round((sessionBlocked / sessionAttempts) * 100)}%`;
    totalBlockedEl.textContent = sessionBlocked;
};

// 7. Scroll Engine & Simulation
const phases = [
    { threshold: 0.1, nudge: 'seo', action: 'urgency', source: 'Marketing' },
    { threshold: 0.25, nudge: 'notification', action: 'reminder', source: 'Gmail' },
    { threshold: 0.4, nudge: 'ai_insights', action: 'urgency', source: 'Sales' },
    { threshold: 0.55, nudge: 'notification', action: 'interruption', source: 'Slack' },
    { threshold: 0.7, nudge: 'pricing_push', action: 'interruption', source: 'Retention' }
];

window.addEventListener('scroll', () => {
    if (!isExperienceActive) return;
    
    const scrollPercent = window.scrollY / (document.documentElement.scrollHeight - window.innerHeight);
    
    phases.forEach((phase, idx) => {
        if (scrollPercent > phase.threshold && !phase.triggered) {
            phase.triggered = true;
            attemptEscalation(phase.nudge, phase.action, phase.source);
        }
    });

    // Auto-enable Governor at 80% scroll if it's off
    if (scrollPercent > 0.8 && !governorToggle.checked) {
        governorToggle.checked = true;
        governorToggle.dispatchEvent(new Event('change'));
        
        // Show shield wave
        shieldEffect.classList.add('opacity-100');
        setTimeout(() => shieldEffect.classList.remove('opacity-100'), 2000);
    }
});

// Event Listeners
startExperience.addEventListener("click", () => {
    introModal.classList.add('opacity-0');
    setTimeout(() => {
        introModal.remove();
        experienceConsole.classList.remove('translate-y-32');
        isExperienceActive = true;
    }, 700);
});

governorToggle.addEventListener("change", () => {
    const isOn = governorToggle.checked;
    modeStatus.textContent = isOn ? "Governor ENABLED" : "Governor OFF";
    modeStatus.className = `text-xs font-black uppercase tracking-widest ${isOn ? 'text-accent-green' : 'text-accent-red'}`;
    
    if (isOn) {
        // Clear chaos immediately
        updatePressure(-30);
        document.getElementById('fakeViewers').classList.remove('opacity-100');
        document.querySelectorAll('.active-nudge').forEach(el => el.classList.remove('active-nudge'));
    }
});

// Initial Setup
updatePressure(0);
