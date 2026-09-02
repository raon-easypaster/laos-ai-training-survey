const FORM_ENDPOINT = "";
const STORAGE_KEY = "laos-ai-survey-draft-v1";
const form = document.querySelector("#surveyForm");
const progressBar = document.querySelector("#progressBar");
const answeredCount = document.querySelector("#answeredCount");
const textArea = document.querySelector("#q11");
const charCount = document.querySelector("#charCount");
const submitStatus = document.querySelector("#submitStatus");
const successDialog = document.querySelector("#successDialog");
const successMessage = document.querySelector("#successMessage");

const requiredGroups = Array.from(document.querySelectorAll("[data-required-group]"));

function groupAnswered(card) {
  const name = card.dataset.requiredGroup;
  return Boolean(form.querySelector(`[name="${name}"]:checked`));
}

function updateProgress() {
  const completed = requiredGroups.filter(groupAnswered).length;
  answeredCount.textContent = completed;
  progressBar.style.width = `${(completed / requiredGroups.length) * 100}%`;
}

function getPayload() {
  const data = new FormData(form);
  const payload = {
    submittedAt: new Date().toISOString(),
    q1: data.get("q1") || "",
    q2: data.get("q2") || "",
    q3: data.get("q3") || "",
    q4: data.get("q4") || "",
    q5: data.get("q5") || "",
    q6: data.getAll("q6"),
    q6Other: data.get("q6Other") || "",
    q7: data.get("q7") || "",
    q8: data.get("q8") || "",
    q9: data.get("q9") || "",
    q10: data.getAll("q10"),
    q10Other: data.get("q10Other") || "",
    q11: data.get("q11") || "",
  };
  return payload;
}

function saveDraft() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(getPayload()));
}

function restoreDraft() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;

  try {
    const draft = JSON.parse(raw);
    Object.entries(draft).forEach(([name, value]) => {
      if (["submittedAt", "q6Other", "q10Other"].includes(name)) return;
      const values = Array.isArray(value) ? value : [value];
      values.forEach((item) => {
        const input = Array.from(form.querySelectorAll(`[name="${name}"]`)).find((el) => el.value === item);
        if (input) input.checked = true;
      });
      if (name === "q11" && typeof value === "string") textArea.value = value;
    });

    ["q6Other", "q10Other"].forEach((name) => {
      const input = document.querySelector(`#${name}`);
      if (draft[name]) input.value = draft[name];
    });
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function syncOtherFields() {
  document.querySelectorAll("[data-other]").forEach((checkbox) => {
    const target = document.querySelector(`#${checkbox.dataset.other}`);
    target.disabled = !checkbox.checked;
    if (!checkbox.checked) target.value = "";
  });
}

function validateForm() {
  const invalidCards = requiredGroups.filter((card) => !groupAnswered(card));
  requiredGroups.forEach((card) => card.classList.toggle("is-invalid", invalidCards.includes(card)));

  if (invalidCards.length) {
    invalidCards[0].scrollIntoView({ behavior: "smooth", block: "center" });
    const focusable = invalidCards[0].querySelector("input");
    window.setTimeout(() => focusable?.focus({ preventScroll: true }), 450);
    return false;
  }
  return true;
}

function downloadResponse(payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `AI-교육-설문-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

form.addEventListener("input", (event) => {
  const card = event.target.closest("[data-required-group]");
  if (card && groupAnswered(card)) card.classList.remove("is-invalid");
  syncOtherFields();
  updateProgress();
  charCount.textContent = textArea.value.length;
  saveDraft();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  submitStatus.textContent = "";
  if (!validateForm()) {
    submitStatus.textContent = "아직 응답하지 않은 필수 문항이 있습니다.";
    return;
  }

  const payload = getPayload();
  const button = form.querySelector("button[type='submit']");
  button.disabled = true;
  submitStatus.textContent = "응답을 준비하고 있습니다…";

  try {
    if (FORM_ENDPOINT) {
      const response = await fetch(FORM_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("응답 저장에 실패했습니다.");
      successMessage.textContent = "소중한 의견이 안전하게 제출되었습니다. 감사합니다.";
    } else {
      downloadResponse(payload);
      successMessage.textContent = "현재는 응답 파일이 기기에 저장됩니다. 수집 주소를 연결하면 바로 제출되도록 전환됩니다.";
    }
    localStorage.removeItem(STORAGE_KEY);
    successDialog.showModal();
    submitStatus.textContent = "";
  } catch (error) {
    submitStatus.textContent = "제출하지 못했습니다. 잠시 후 다시 시도해 주세요.";
  } finally {
    button.disabled = false;
  }
});

document.querySelector("#closeDialog").addEventListener("click", () => successDialog.close());
successDialog.addEventListener("click", (event) => {
  if (event.target === successDialog) successDialog.close();
});

restoreDraft();
syncOtherFields();
updateProgress();
charCount.textContent = textArea.value.length;
