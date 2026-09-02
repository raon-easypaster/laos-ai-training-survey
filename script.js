const GOOGLE_FORM_ENDPOINT =
  "https://docs.google.com/forms/d/e/1FAIpQLSdprOyARY3EYbnt6lmMLpyeJiYVMrmpco3YNcmHHzjDpqMupg/formResponse";
const GOOGLE_FORM_FIELDS = {
  q0: "entry.1854980917",
  q1: "entry.46208689",
  q2: "entry.710343738",
  q3: "entry.1587771847",
  q4: "entry.1278130471",
  q5: "entry.2053560430",
  q6: "entry.2074971978",
  q7: "entry.2056016261",
  q8: "entry.325503724",
  q9: "entry.1032592620",
  q10: "entry.1604710063",
  q11: "entry.1823296068",
};
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
    q0: data.get("q0") || "",
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

function toGoogleFormData(payload) {
  const googleData = new URLSearchParams();

  ["q0", "q1", "q2", "q3", "q4", "q5", "q7", "q8", "q9", "q11"].forEach((key) => {
    if (payload[key]) googleData.append(GOOGLE_FORM_FIELDS[key], payload[key]);
  });

  ["q6", "q10"].forEach((key) => {
    payload[key].forEach((value) => {
      if (value === "기타") {
        googleData.append(GOOGLE_FORM_FIELDS[key], "__other_option__");
        googleData.append(`${GOOGLE_FORM_FIELDS[key]}.other_option_response`, payload[`${key}Other`]);
      } else {
        googleData.append(GOOGLE_FORM_FIELDS[key], value);
      }
    });
  });

  googleData.append("fvv", "1");
  googleData.append("pageHistory", "0");
  return googleData;
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
  submitStatus.textContent = "응답을 제출하고 있습니다…";

  try {
    await fetch(GOOGLE_FORM_ENDPOINT, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: toGoogleFormData(payload),
    });
    successMessage.textContent = "소중한 의견이 Google Form에 제출되었습니다. 감사합니다.";
    localStorage.removeItem(STORAGE_KEY);
    form.reset();
    syncOtherFields();
    updateProgress();
    charCount.textContent = "0";
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
