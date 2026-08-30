(function () {
  "use strict";

  var TOTAL_STEPS = 5;
  var STEP_LABELS = ["Contact", "Service", "Details", "Budget", "Finish"];
  var MAX_FILES = 5;
  var MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB
  var ALLOWED_EXT = ["pdf", "jpg", "jpeg", "png", "dwg"];
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var PHONE_RE = /^[0-9+\-\s()]{7,18}$/;

  var currentStep = 1;
  var selectedFiles = [];

  var form, progressSteps, stepEls, backBtn, nextBtn, submitBtn,
    errorSummary, errorSummaryText, stepAnnounce, stepStatus,
    fileInput, fileDropzone, fileList, fileErrorField,
    successPanel, formShell, serviceInputs, serviceError;

  function qs(sel, ctx) {
    return (ctx || document).querySelector(sel);
  }
  function qsa(sel, ctx) {
    return Array.prototype.slice.call((ctx || document).querySelectorAll(sel));
  }

  function init() {
    form = qs("#quoteForm");
    if (!form) return;

    progressSteps = qsa(".quote-progress-step");
    stepEls = qsa(".quote-step", form);
    backBtn = qs("#qBackBtn");
    nextBtn = qs("#qNextBtn");
    submitBtn = qs("#qSubmitBtn");
    errorSummary = qs("#qErrorSummary");
    errorSummaryText = qs("#qErrorSummaryText");
    stepAnnounce = qs("#qStepAnnounce");
    stepStatus = qs("#qStepStatus");
    fileInput = qs("#qFileInput");
    fileDropzone = qs("#qFileDropzone");
    fileList = qs("#qFileList");
    fileErrorField = qs("#qFileField");
    successPanel = qs("#qSuccessPanel");
    formShell = qs("#qFormShell");
    serviceInputs = qsa('input[name="service"]');
    serviceError = qs("#qServiceError");

    bindNav();
    bindServiceCards();
    bindFieldErrorClearing();
    bindFileUpload();
    bindSubmit();

    showStep(1, true);
  }

  /* ---------------- step navigation ---------------- */

  function showStep(n, isInitial) {
    currentStep = n;

    stepEls.forEach(function (el) {
      el.hidden = Number(el.getAttribute("data-step")) !== n;
    });

    progressSteps.forEach(function (el) {
      var stepNum = Number(el.getAttribute("data-step"));
      el.classList.toggle("is-active", stepNum === n);
      el.classList.toggle("is-complete", stepNum < n);
      if (stepNum === n) {
        el.setAttribute("aria-current", "step");
      } else {
        el.removeAttribute("aria-current");
      }
    });

    if (n === 3) {
      updateStep3Visibility();
    }

    backBtn.hidden = n === 1;
    nextBtn.hidden = n === TOTAL_STEPS;
    submitBtn.hidden = n !== TOTAL_STEPS;

    var label = "Step " + n + " of " + TOTAL_STEPS + ": " + STEP_LABELS[n - 1];
    if (stepStatus) stepStatus.textContent = label;
    if (stepAnnounce) stepAnnounce.textContent = label;

    hideErrorSummary();

    if (!isInitial) {
      var activeStepEl = qs('.quote-step[data-step="' + n + '"]');
      var heading = activeStepEl && qs(".quote-step-title", activeStepEl);
      if (heading) {
        heading.setAttribute("tabindex", "-1");
        heading.focus();
        heading.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }

  function bindNav() {
    nextBtn.addEventListener("click", function () {
      var result = validateStep(currentStep);
      if (!result.valid) {
        showErrorSummary();
        if (result.firstInvalidEl) focusInvalid(result.firstInvalidEl);
        return;
      }
      if (currentStep < TOTAL_STEPS) showStep(currentStep + 1);
    });

    backBtn.addEventListener("click", function () {
      if (currentStep > 1) showStep(currentStep - 1);
    });

    form.addEventListener("keydown", function (e) {
      if (e.key !== "Enter") return;
      var tag = e.target.tagName;
      if (tag === "TEXTAREA" || tag === "BUTTON") return;
      e.preventDefault();
      if (currentStep < TOTAL_STEPS) {
        nextBtn.click();
      } else if (typeof form.requestSubmit === "function") {
        form.requestSubmit();
      } else {
        submitBtn.click();
      }
    });
  }

  function focusInvalid(el) {
    if (el.type === "checkbox" || el.type === "radio") {
      el.focus();
    } else {
      el.focus();
    }
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  /* ---------------- validation ---------------- */

  function validateStep(n) {
    if (n === 1) return validateContactStep();
    if (n === 2) return validateServiceStep();
    if (n === 5) return validateFinalStep();
    return { valid: true };
  }

  function validateContactStep() {
    var valid = true;
    var firstInvalidEl = null;

    var fullName = qs("#qFullName");
    var phone = qs("#qPhone");
    var email = qs("#qEmail");
    var city = qs("#qCity");

    if (!fullName.value.trim()) {
      setFieldError(fullName, "Please enter your full name.");
      valid = false;
      firstInvalidEl = firstInvalidEl || fullName;
    } else {
      clearFieldError(fullName);
    }

    if (!phone.value.trim()) {
      setFieldError(phone, "Please enter your phone number.");
      valid = false;
      firstInvalidEl = firstInvalidEl || phone;
    } else if (!PHONE_RE.test(phone.value.trim())) {
      setFieldError(phone, "Please enter a valid phone number.");
      valid = false;
      firstInvalidEl = firstInvalidEl || phone;
    } else {
      clearFieldError(phone);
    }

    if (!email.value.trim()) {
      setFieldError(email, "Please enter your email address.");
      valid = false;
      firstInvalidEl = firstInvalidEl || email;
    } else if (!EMAIL_RE.test(email.value.trim())) {
      setFieldError(email, "Please enter a valid email address.");
      valid = false;
      firstInvalidEl = firstInvalidEl || email;
    } else {
      clearFieldError(email);
    }

    if (!city.value.trim()) {
      setFieldError(city, "Please enter your city / location.");
      valid = false;
      firstInvalidEl = firstInvalidEl || city;
    } else {
      clearFieldError(city);
    }

    return { valid: valid, firstInvalidEl: firstInvalidEl };
  }

  function validateServiceStep() {
    var anyChecked = serviceInputs.some(function (i) {
      return i.checked;
    });
    if (!anyChecked) {
      serviceError.hidden = false;
      return { valid: false, firstInvalidEl: serviceInputs[0] };
    }
    serviceError.hidden = true;
    return { valid: true };
  }

  function validateFinalStep() {
    var consent = qs("#qConsent");
    var consentWrap = qs("#qConsentWrap");
    if (!consent.checked) {
      consentWrap.classList.add("has-error");
      qs("#qConsentError").hidden = false;
      return { valid: false, firstInvalidEl: consent };
    }
    consentWrap.classList.remove("has-error");
    qs("#qConsentError").hidden = true;
    return { valid: true };
  }

  function setFieldError(inputEl, message) {
    var wrap = inputEl.closest(".quote-field");
    if (!wrap) return;
    wrap.classList.add("has-error");
    var msgEl = qs(".quote-error-msg", wrap);
    if (msgEl) msgEl.textContent = message;
    inputEl.setAttribute("aria-invalid", "true");
  }

  function clearFieldError(inputEl) {
    var wrap = inputEl.closest(".quote-field");
    if (!wrap) return;
    wrap.classList.remove("has-error");
    inputEl.removeAttribute("aria-invalid");
  }

  function bindFieldErrorClearing() {
    ["qFullName", "qPhone", "qEmail", "qCity"].forEach(function (id) {
      var el = qs("#" + id);
      if (!el) return;
      el.addEventListener("input", function () {
        clearFieldError(el);
      });
    });
    var consent = qs("#qConsent");
    if (consent) {
      consent.addEventListener("change", function () {
        if (consent.checked) {
          qs("#qConsentWrap").classList.remove("has-error");
          qs("#qConsentError").hidden = true;
        }
      });
    }
  }

  function showErrorSummary() {
    errorSummaryText.textContent =
      "Please fix the highlighted fields before continuing.";
    errorSummary.hidden = false;
  }

  function hideErrorSummary() {
    errorSummary.hidden = true;
  }

  /* ---------------- service cards -> conditional step 3 ---------------- */

  function bindServiceCards() {
    serviceInputs.forEach(function (input) {
      input.addEventListener("change", function () {
        var card = input.closest(".quote-service-card");
        if (card) card.classList.toggle("is-selected", input.checked);
        if (input.checked) {
          serviceError.hidden = true;
        }
        updateStep3Visibility();
      });
    });
  }

  function updateStep3Visibility() {
    var map = {
      construction: qs('.quote-subsection[data-service="construction"]'),
      interior: qs('.quote-subsection[data-service="interior"]'),
      solar: qs('.quote-subsection[data-service="solar"]')
    };
    var anyDetailShown = false;

    Object.keys(map).forEach(function (key) {
      var input = qs('input[name="service"][value="' + key + '"]');
      var show = !!(input && input.checked);
      if (map[key]) map[key].hidden = !show;
      if (show) anyDetailShown = true;
    });

    var note = qs("#qNoDetailsNote");
    if (note) note.hidden = anyDetailShown;
  }

  /* ---------------- file upload ---------------- */

  function bindFileUpload() {
    if (!fileInput) return;

    fileDropzone.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        fileInput.click();
      }
    });

    fileInput.addEventListener("change", function () {
      var incoming = Array.prototype.slice.call(fileInput.files);
      var errors = [];

      incoming.forEach(function (file) {
        var ext = file.name.split(".").pop().toLowerCase();
        if (ALLOWED_EXT.indexOf(ext) === -1) {
          errors.push(file.name + ": unsupported file type.");
          return;
        }
        if (file.size > MAX_FILE_SIZE) {
          errors.push(file.name + ": file exceeds 15MB.");
          return;
        }
        if (selectedFiles.length >= MAX_FILES) {
          errors.push("You can upload up to " + MAX_FILES + " files.");
          return;
        }
        selectedFiles.push(file);
      });

      syncFileInput();
      renderFileList();
      showFileErrors(errors);
    });
  }

  function syncFileInput() {
    var dt = new DataTransfer();
    selectedFiles.forEach(function (file) {
      dt.items.add(file);
    });
    fileInput.files = dt.files;
  }

  function renderFileList() {
    fileList.innerHTML = "";
    selectedFiles.forEach(function (file, index) {
      var li = document.createElement("li");

      var name = document.createElement("span");
      name.className = "quote-file-name";
      name.textContent = file.name;

      var size = document.createElement("span");
      size.className = "quote-file-size";
      size.textContent = formatBytes(file.size);

      var removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "quote-file-remove";
      removeBtn.setAttribute("aria-label", "Remove " + file.name);
      removeBtn.innerHTML = '<i class="fa-solid fa-xmark" aria-hidden="true"></i>';
      removeBtn.addEventListener("click", function () {
        selectedFiles.splice(index, 1);
        syncFileInput();
        renderFileList();
      });

      li.appendChild(name);
      li.appendChild(size);
      li.appendChild(removeBtn);
      fileList.appendChild(li);
    });
  }

  function showFileErrors(errors) {
    if (!fileErrorField) return;
    if (errors.length) {
      fileErrorField.classList.add("has-error");
      qs(".quote-error-msg", fileErrorField).textContent = errors.join(" ");
    } else {
      fileErrorField.classList.remove("has-error");
    }
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  /* ---------------- submit ---------------- */

  function bindSubmit() {
    form.addEventListener("submit", function (e) {
      e.preventDefault();

      var stepsToCheck = [1, 2, 5];
      for (var i = 0; i < stepsToCheck.length; i++) {
        var result = validateStep(stepsToCheck[i]);
        if (!result.valid) {
          showStep(stepsToCheck[i]);
          showErrorSummary();
          if (result.firstInvalidEl) focusInvalid(result.firstInvalidEl);
          return;
        }
      }

      submitBtn.disabled = true;
      submitBtn.classList.add("is-loading");
      hideErrorSummary();

      var formData = new FormData(form);

      fetch(form.getAttribute("action") || "send-quote.php", {
        method: "POST",
        body: formData,
        headers: { Accept: "application/json" }
      })
        .then(function (res) {
          return res
            .json()
            .catch(function () {
              return { success: false, message: "" };
            })
            .then(function (data) {
              return { ok: res.ok, data: data };
            });
        })
        .then(function (result) {
          if (result.ok && result.data && result.data.success) {
            formShell.hidden = true;
            successPanel.hidden = false;
            var heading = qs(".quote-success-title", successPanel);
            if (heading) {
              heading.setAttribute("tabindex", "-1");
              heading.focus();
            }
            successPanel.scrollIntoView({ behavior: "smooth", block: "start" });
          } else {
            submitFailed(
              (result.data && result.data.message) ||
                "Sorry, something went wrong sending your request. Please try again."
            );
          }
        })
        .catch(function () {
          submitFailed(
            "Sorry, we couldn't reach the server. Please check your connection and try again."
          );
        });
    });
  }

  function submitFailed(message) {
    submitBtn.disabled = false;
    submitBtn.classList.remove("is-loading");
    errorSummaryText.textContent = message;
    errorSummary.hidden = false;
    errorSummary.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
