import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
  getAuth,
  signInAnonymously,
  signInWithCustomToken,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  runTransaction,
  setLogLevel,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import {
  prepareSubmission,
  buildApplicationRecord,
  buildApplicantIndexRecord,
} from "./submission.js";

const appId = typeof __app_id !== "undefined" ? __app_id : "default-app-id";
const initialAuthToken = typeof __initial_auth_token !== "undefined" ? __initial_auth_token : null;

const loadingIndicator = document.getElementById("loading-indicator");
const formContainer = document.getElementById("form-container");
const successMessage = document.getElementById("success-message");
const applicationForm = document.getElementById("application-form");
const alertBox = document.getElementById("alert-box");
const submitButton = document.getElementById("submit-button");

const state = {
  db: null,
  auth: null,
  userId: null,
  isSubmitting: false,
};

const transientErrorCodes = new Set([
  "aborted",
  "unavailable",
  "deadline-exceeded",
  "resource-exhausted",
  "internal",
]);

function parseFirebaseConfig() {
  if (typeof __firebase_config === "undefined") {
    return null;
  }

  try {
    return JSON.parse(__firebase_config);
  } catch (error) {
    console.error("Invalid firebase config payload", error);
    return null;
  }
}

function getErrorCode(error) {
  const code = String(error?.code ?? "");
  return code.includes("/") ? code.split("/")[1] : code;
}

function isTransientFirebaseError(error) {
  return transientErrorCodes.has(getErrorCode(error));
}

async function wait(ms) {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function withRetry(operation, retries = 2) {
  let attempt = 0;

  while (attempt <= retries) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === retries || !isTransientFirebaseError(error)) {
        throw error;
      }

      await wait(400 * (attempt + 1));
      attempt += 1;
    }
  }

  throw new Error("Operation failed after retries");
}

function showAlert(message) {
  alertBox.textContent = message;
  alertBox.classList.remove("hidden");
}

function clearAlert() {
  alertBox.textContent = "";
  alertBox.classList.add("hidden");
}

function setSubmitState(isSubmitting) {
  state.isSubmitting = isSubmitting;
  submitButton.disabled = isSubmitting;
  submitButton.setAttribute("aria-busy", String(isSubmitting));
  submitButton.textContent = isSubmitting ? "Submitting..." : "Submit Executive Application";
}

function normalizeErrorMessage(error) {
  const code = getErrorCode(error);

  if (error?.message === "DUPLICATE_SUBMISSION") {
    return "An application already exists for this email or account.";
  }

  if (code === "permission-denied") {
    return "Submission blocked by security policy. This email may already have an application.";
  }

  if (code === "unavailable" || code === "deadline-exceeded") {
    return "Service is temporarily unavailable. Please retry in a moment.";
  }

  return "Submission failed due to a system error. Please retry shortly.";
}

function showSubmissionSuccess() {
  formContainer.classList.add("hidden");
  successMessage.classList.remove("hidden");
}

async function checkSubmissionStatus() {
  const docRef = doc(
    state.db,
    "artifacts",
    appId,
    "users",
    state.userId,
    "applications",
    "protocol_application",
  );

  try {
    const docSnap = await withRetry(() => getDoc(docRef));
    loadingIndicator.classList.add("hidden");

    if (docSnap.exists()) {
      showSubmissionSuccess();
      return;
    }

    formContainer.classList.remove("hidden");
  } catch (error) {
    console.error("Error checking submission status", error);
    loadingIndicator.classList.add("hidden");
    formContainer.classList.remove("hidden");
    showAlert("We could not verify previous submissions. You can still submit now.");
  }
}

async function initializeFirebase() {
  const firebaseConfig = parseFirebaseConfig();

  if (!firebaseConfig) {
    loadingIndicator.textContent =
      "Configuration error: Firebase settings are missing or invalid.";
    return;
  }

  const isLocalDev = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  setLogLevel(isLocalDev ? "warn" : "error");

  try {
    const app = initializeApp(firebaseConfig);
    state.db = getFirestore(app);
    state.auth = getAuth(app);

    if (initialAuthToken) {
      await signInWithCustomToken(state.auth, initialAuthToken);
    } else {
      await signInAnonymously(state.auth);
    }

    onAuthStateChanged(state.auth, async (user) => {
      if (!user) {
        loadingIndicator.textContent = "Authentication error: unable to initialize session.";
        return;
      }

      state.userId = user.uid;
      await checkSubmissionStatus();
    });
  } catch (error) {
    console.error("Firebase Initialization/Auth Error", error);
    loadingIndicator.textContent = "System error while initializing secure submission.";
  }
}

applicationForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!state.db || !state.userId || state.isSubmitting) {
    return;
  }

  clearAlert();

  const prepared = await prepareSubmission({
    email: document.getElementById("email").value,
    laborCost: document.getElementById("labor_cost").value,
    frictionPoint: document.getElementById("friction_point").value,
    consentAccepted: document.getElementById("consent").checked,
  });

  if (!prepared.ok) {
    showAlert(prepared.errors[0]);
    return;
  }

  setSubmitState(true);

  try {
    const submittedAtIso = new Date().toISOString();
    const applicationRecord = buildApplicationRecord({
      preparedValue: prepared.value,
      userId: state.userId,
      submittedAtIso,
    });
    const applicantIndexRecord = buildApplicantIndexRecord({
      preparedValue: prepared.value,
      userId: state.userId,
      submittedAtIso,
    });

    const applicationDocRef = doc(
      state.db,
      "artifacts",
      appId,
      "users",
      state.userId,
      "applications",
      "protocol_application",
    );

    const applicantDocRef = doc(
      state.db,
      "artifacts",
      appId,
      "applicants",
      prepared.value.emailHash,
    );

    await withRetry(() =>
      runTransaction(state.db, async (transaction) => {
        const existingApplication = await transaction.get(applicationDocRef);
        if (existingApplication.exists()) {
          throw new Error("DUPLICATE_SUBMISSION");
        }

        transaction.set(applicationDocRef, applicationRecord);
        transaction.set(applicantDocRef, applicantIndexRecord);
      }),
    );

    showSubmissionSuccess();
  } catch (error) {
    console.error("Submission failure", error);
    showAlert(normalizeErrorMessage(error));
  } finally {
    setSubmitState(false);
  }
});

initializeFirebase();
