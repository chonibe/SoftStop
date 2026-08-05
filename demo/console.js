(() => {
  const API_BASE = /localhost|127\.0\.0\.1/.test(window.location.hostname) ? "/v1" : "/api";
  const KEY_STORAGE = "softstop_console_key";
  const ACTOR = "pressure-console";

  const els = {
    userId: document.getElementById("userId"),
    apiKey: document.getElementById("apiKey"),
    tenantId: document.getElementById("tenantId"),
    loadBtn: document.getElementById("loadBtn"),
    pressureValue: document.getElementById("pressureValue"),
    thresholdLabel: document.getElementById("thresholdLabel"),
    moodLabel: document.getElementById("moodLabel"),
    meterFill: document.getElementById("meterFill"),
    decayValue: document.getElementById("decayValue"),
    emptyHint: document.getElementById("emptyHint"),
    activityFeed: document.getElementById("activityFeed"),
    activityEmpty: document.getElementById("activityEmpty"),
    statusLine: document.getElementById("statusLine"),
    healthScore: document.getElementById("healthScore"),
    orphanRate: document.getElementById("orphanRate"),
    blockRate: document.getElementById("blockRate"),
    apiPrefixHint: document.getElementById("apiPrefixHint"),
  };

  let busy = false;

  function moodFromAbsolute(pressure) {
    if (pressure >= 90) return { id: "churned", label: "Churned" };
    if (pressure >= 70) return { id: "angry", label: "Angry" };
    if (pressure >= 45) return { id: "frustrated", label: "Frustrated" };
    if (pressure >= 20) return { id: "annoyed", label: "Annoyed" };
    return { id: "happy", label: "Happy" };
  }

  function headers() {
    const h = { "Content-Type": "application/json" };
    const key = els.apiKey.value?.trim();
    if (key) h.Authorization = `Bearer ${key}`;
    return h;
  }

  function withTenant(url) {
    const tenant = els.tenantId.value?.trim();
    if (!tenant) return url;
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}tenantId=${encodeURIComponent(tenant)}`;
  }

  function setStatus(msg, kind) {
    els.statusLine.textContent = msg || "";
    els.statusLine.className = "status-line" + (kind ? ` ${kind}` : "");
  }

  function persistKey() {
    const key = els.apiKey.value?.trim();
    if (key && key.startsWith("gov_")) {
      try {
        localStorage.setItem(KEY_STORAGE, key);
      } catch (_) {}
    }
  }

  function restoreKey() {
    try {
      const stored = localStorage.getItem(KEY_STORAGE);
      if (stored) els.apiKey.value = stored;
    } catch (_) {}
  }

  function renderMeter(data) {
    const pressure = Number(data.pressure) || 0;
    const threshold = Number(data.threshold) || 100;
    const mood = moodFromAbsolute(pressure);
    const pct = Math.min(100, Math.round((pressure / threshold) * 100));

    els.pressureValue.textContent = String(Math.round(pressure));
    els.thresholdLabel.textContent = `/ ${threshold}`;
    els.moodLabel.textContent = mood.label;
    els.moodLabel.dataset.mood = mood.id;
    els.meterFill.style.width = `${pct}%`;
    els.meterFill.dataset.mood = mood.id;
    els.decayValue.textContent = String(data.decayPerHour ?? "—");
    els.emptyHint.hidden = true;

    if (data.costs && typeof data.costs === "object") {
      const parts = Object.entries(data.costs)
        .map(([k, v]) => `${k} <strong>${v}</strong>`)
        .join(" · ");
      const legendCosts = document.querySelector("#legend span:last-child");
      if (legendCosts) legendCosts.innerHTML = `Costs: ${parts}`;
    }
  }

  function formatTime(iso) {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  }

  function renderActivity(events) {
    const list = Array.isArray(events) ? events : [];
    els.activityFeed.innerHTML = "";
    if (!list.length) {
      els.activityFeed.hidden = true;
      els.activityEmpty.hidden = false;
      return;
    }
    els.activityFeed.hidden = false;
    els.activityEmpty.hidden = true;

    for (const ev of list) {
      const li = document.createElement("li");
      const badge = document.createElement("span");
      badge.className = `feed-badge ${ev.eventType || "executed"}`;
      badge.textContent = ev.eventType || "event";

      const main = document.createElement("div");
      main.className = "feed-main";
      const title = document.createElement("strong");
      title.textContent = `${ev.actionType || "action"} · ${ev.eventType || ""}`;
      const meta = document.createElement("div");
      meta.className = "feed-meta";
      const bits = [formatTime(ev.createdAt)];
      if (ev.actor) bits.push(ev.actor);
      if (ev.blockReason) bits.push(ev.blockReason);
      meta.textContent = bits.filter(Boolean).join(" · ");
      main.append(title, meta);

      const delta = document.createElement("span");
      delta.className = "feed-delta";
      if (typeof ev.cost === "number") {
        const after =
          typeof ev.pressureAfter === "number"
            ? ev.pressureAfter
            : typeof ev.projectedPressure === "number"
              ? ev.projectedPressure
              : null;
        delta.textContent =
          after != null ? `+${ev.cost} → ${after}` : `+${ev.cost}`;
      } else {
        delta.textContent = "—";
      }

      li.append(badge, main, delta);
      els.activityFeed.appendChild(li);
    }
  }

  function renderHealth(metrics) {
    if (!metrics) {
      els.healthScore.textContent = "n/a";
      els.orphanRate.textContent = "n/a";
      els.blockRate.textContent = "n/a";
      return;
    }
    els.healthScore.textContent =
      metrics.healthScore != null ? String(metrics.healthScore) : "—";
    els.orphanRate.textContent =
      metrics.orphanRate != null
        ? `${(Number(metrics.orphanRate) * 100).toFixed(1)}%`
        : "—";
    els.blockRate.textContent =
      metrics.blockRate != null
        ? `${(Number(metrics.blockRate) * 100).toFixed(1)}%`
        : "—";
  }

  async function loadHealth() {
    try {
      const res = await fetch(withTenant(`${API_BASE}/health?periodHours=24`), {
        headers: headers(),
      });
      const body = await res.json();
      if (body?.ok && body.metrics) renderHealth(body.metrics);
      else renderHealth(null);
    } catch {
      renderHealth(null);
    }
  }

  async function loadUser() {
    const userId = els.userId.value?.trim();
    if (!userId) {
      setStatus("Enter a user id.", "error");
      return;
    }
    persistKey();
    setBusy(true);
    setStatus("Loading…");
    try {
      const res = await fetch(
        withTenant(`${API_BASE}/users/${encodeURIComponent(userId)}/activity?limit=50`),
        { headers: headers() }
      );
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body?.error || `HTTP ${res.status}`);
      }
      renderMeter(body);
      renderActivity(body.events);
      setStatus(`Loaded ${userId}`, "ok");
      await loadHealth();
    } catch (err) {
      setStatus(err.message || String(err), "error");
    } finally {
      setBusy(false);
    }
  }

  async function simulate(actionType, surface) {
    const userId = els.userId.value?.trim();
    if (!userId) {
      setStatus("Enter a user id first.", "error");
      return;
    }
    persistKey();
    setBusy(true);
    setStatus(`Simulating ${actionType}…`);
    try {
      const checkRes = await fetch(withTenant(`${API_BASE}/check`), {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          userId,
          actionType,
          surface,
          context: { actor: ACTOR },
          ...(els.tenantId.value?.trim()
            ? { tenantId: els.tenantId.value.trim() }
            : {}),
        }),
      });
      const decision = await checkRes.json();
      if (!checkRes.ok) {
        throw new Error(decision?.error || `check HTTP ${checkRes.status}`);
      }

      const outcome = decision.allowed ? "executed" : "blocked";
      const recordBody = {
        userId,
        actionType,
        outcome,
        decisionId: decision.decisionId,
        context: { actor: ACTOR },
        ...(els.tenantId.value?.trim()
          ? { tenantId: els.tenantId.value.trim() }
          : {}),
      };
      if (!decision.allowed) {
        recordBody.blockReason = decision.reason;
      }

      const recordRes = await fetch(withTenant(`${API_BASE}/record`), {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(recordBody),
      });
      const recorded = await recordRes.json();
      if (!recordRes.ok) {
        throw new Error(recorded?.error || `record HTTP ${recordRes.status}`);
      }

      if (decision.allowed) {
        setStatus(
          `Allowed ${actionType} · pressure ${decision.pressure} → ${decision.projectedPressure}`,
          "ok"
        );
      } else {
        setStatus(`Blocked ${actionType}: ${decision.reason}`, "error");
      }

      await loadUser();
    } catch (err) {
      setStatus(err.message || String(err), "error");
      setBusy(false);
    }
  }

  function setBusy(next) {
    busy = next;
    els.loadBtn.disabled = next;
    document.querySelectorAll("[data-simulate]").forEach((btn) => {
      btn.disabled = next;
    });
  }

  els.loadBtn.addEventListener("click", () => {
    if (!busy) loadUser();
  });
  els.userId.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !busy) loadUser();
  });
  document.querySelectorAll("[data-simulate]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (busy) return;
      simulate(btn.dataset.simulate, btn.dataset.surface);
    });
  });

  restoreKey();
  els.apiPrefixHint.textContent = `API ${API_BASE}`;
  loadHealth();
})();
