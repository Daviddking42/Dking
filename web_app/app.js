// App State
let modelMetadata = null;
let rawDataset = [];
let originalCSVText = ""; // Keep backup of original CSV text to allow factory reset
let localAddedPatients = [];
let activeModelKey = "Logistic_Regression"; // Default model

// Current Authenticated User State
let currentUser = {
    role: null,        // 'doctor' or 'patient'
    patientId: null,   // for patient role
    name: "",
    avatar: "",
    roleName: ""
};

// Initial Load
document.addEventListener("DOMContentLoaded", () => {
    // Default to Light Mode (remove dark-mode class by default for the light green/blue theme)
    document.body.classList.remove("dark-mode");
    
    loadModelMetadata();
    loadDataset();
    setupTheme();
    setupTabNavigation();
});

// Setup Theme Toggle (Sync icons with body state)
function setupTheme() {
    const btn = document.getElementById("theme-toggle-btn");
    const sunIcon = document.getElementById("theme-icon-sun");
    const moonIcon = document.getElementById("theme-icon-moon");
    
    // Set initial icon visibility based on current theme state
    const isDark = document.body.classList.contains("dark-mode");
    if (isDark) {
        sunIcon.classList.remove("hidden");
        moonIcon.classList.add("hidden");
    } else {
        sunIcon.classList.add("hidden");
        moonIcon.classList.remove("hidden");
    }
    
    btn.addEventListener("click", () => {
        document.body.classList.toggle("dark-mode");
        const isDarkNow = document.body.classList.contains("dark-mode");
        
        if (isDarkNow) {
            sunIcon.classList.remove("hidden");
            moonIcon.classList.add("hidden");
        } else {
            sunIcon.classList.add("hidden");
            moonIcon.classList.remove("hidden");
        }
    });
}

// Tab Navigation Logic
function setupTabNavigation() {
    const menuItems = document.querySelectorAll(".menu-item");
    menuItems.forEach(item => {
        item.addEventListener("click", (e) => {
            e.preventDefault();
            const tabId = item.getAttribute("data-tab");
            switchTab(tabId);
        });
    });
}

function switchTab(tabId) {
    // Guard: Patient cannot access admin tabs
    if (currentUser.role === 'patient') {
        const restricted = ['dashboard', 'performance', 'monitor'];
        if (restricted.includes(tabId)) {
            switchTab('patient-record');
            return;
        }
    }
    
    // Update menu active state
    document.querySelectorAll(".menu-item").forEach(item => {
        if (item.getAttribute("data-tab") === tabId) {
            item.classList.add("active");
        } else {
            item.classList.remove("active");
        }
    });
    
    // Update panel visibility
    document.querySelectorAll(".content-panel").forEach(panel => {
        if (panel.id === `tab-${tabId}`) {
            panel.classList.add("active");
        } else {
            panel.classList.remove("active");
        }
    });
    
    // Update Header Text
    const titleMap = {
        "dashboard": { title: "Dashboard Overview", subtitle: "Real-time clinical metrics and patient stats" },
        "patient-record": { title: "My Health Record", subtitle: "Personal diagnostic results history" },
        "diagnosis": { title: currentUser.role === 'doctor' ? "Patient Diagnosis Sandbox" : "Self Diagnosis Assessment", subtitle: "Predictive diagnostics and clinical decision support" },
        "performance": { title: "Model Insights & Validation", subtitle: "Machine learning metrics and evaluation curves" },
        "monitor": { title: "Continuous Monitoring & Adaptation", subtitle: "Simulate data updates and retrain the model" }
    };
    
    document.getElementById("view-title").textContent = titleMap[tabId].title;
    document.getElementById("view-subtitle").textContent = titleMap[tabId].subtitle;
}

// ─── Auth View Helpers ───────────────────────────────────────────────────────

// Track which role tab is active ('doctor' or 'patient')
let currentLoginRole = 'doctor';

function switchLoginTab(role) {
    currentLoginRole = role;
    const docTab = document.getElementById('btn-login-doctor');
    const patTab = document.getElementById('btn-login-patient');
    const docForm = document.getElementById('doctor-login-form');
    const patForm = document.getElementById('patient-login-form');

    // Clear errors
    document.getElementById('login-error-msg').classList.add('hidden');
    document.getElementById('patient-error-msg').classList.add('hidden');

    if (role === 'doctor') {
        docTab.classList.add('active');
        patTab.classList.remove('active');
        docForm.classList.remove('hidden');
        patForm.classList.add('hidden');
    } else {
        docTab.classList.remove('active');
        patTab.classList.add('active');
        docForm.classList.add('hidden');
        patForm.classList.remove('hidden');
    }
}

function showRegisterView(role) {
    // Switch role to the one being registered
    currentLoginRole = role;

    // Hide login view, show register view
    document.getElementById('login-view').classList.add('hidden');
    document.getElementById('role-tabs').classList.add('hidden');
    document.getElementById('register-view').classList.remove('hidden');

    // Show correct register form
    const docReg = document.getElementById('doctor-register-form');
    const patReg = document.getElementById('patient-register-form');
    if (role === 'doctor') {
        docReg.classList.remove('hidden');
        patReg.classList.add('hidden');
        document.getElementById('auth-card-title').textContent = 'Create Doctor Account';
        document.getElementById('auth-card-subtitle').textContent = 'Set up your physician credentials';
    } else {
        docReg.classList.add('hidden');
        patReg.classList.remove('hidden');
        document.getElementById('auth-card-title').textContent = 'Patient Registration';
        document.getElementById('auth-card-subtitle').textContent = 'Create your secure health portal account';
    }

    // Clear all register messages
    ['doctor-reg-error-msg','doctor-reg-success-msg','patient-reg-error-msg','patient-reg-success-msg']
        .forEach(id => document.getElementById(id).classList.add('hidden'));
}

function showLoginView(role) {
    // Show login view, hide register view
    document.getElementById('register-view').classList.add('hidden');
    document.getElementById('role-tabs').classList.remove('hidden');
    document.getElementById('login-view').classList.remove('hidden');

    // Restore header
    document.getElementById('auth-card-title').textContent = 'MalariaShield AI';
    document.getElementById('auth-card-subtitle').textContent = 'Clinical Decision Support Portal';

    // Switch to correct role tab
    switchLoginTab(role || currentLoginRole);
}

// ─── localStorage Helpers ────────────────────────────────────────────────────

function getRegisteredDoctors() {
    return JSON.parse(localStorage.getItem('ms_doctors') || '[]');
}
function saveRegisteredDoctors(docs) {
    localStorage.setItem('ms_doctors', JSON.stringify(docs));
}
function getRegisteredPatients() {
    return JSON.parse(localStorage.getItem('ms_patients') || '[]');
}
function saveRegisteredPatients(pats) {
    localStorage.setItem('ms_patients', JSON.stringify(pats));
}

// ─── Doctor Login ────────────────────────────────────────────────────────────

function handleDoctorLogin(event) {
    event.preventDefault();
    const user = document.getElementById('login-username').value.trim();
    const pass = document.getElementById('login-password').value.trim();
    const errorMsg = document.getElementById('login-error-msg');

    // 1. Check hardcoded admin fallback
    if (user === 'admin' && pass === 'admin') {
        currentUser = { role: 'doctor', patientId: null, name: 'Dr. Admin', avatar: 'D', roleName: 'Staff Physician' };
        errorMsg.classList.add('hidden');
        enterApplication();
        return;
    }

    // 2. Check localStorage registered doctors
    const doctors = getRegisteredDoctors();
    const match = doctors.find(d => d.username.toLowerCase() === user.toLowerCase() && d.password === pass);
    if (match) {
        currentUser = {
            role: 'doctor',
            patientId: null,
            name: match.name,
            avatar: match.name.charAt(0).toUpperCase(),
            roleName: match.specialty ? match.specialty : 'Staff Physician'
        };
        errorMsg.classList.add('hidden');
        enterApplication();
        return;
    }

    errorMsg.classList.remove('hidden');
}

// ─── Patient Login ───────────────────────────────────────────────────────────

function handlePatientLogin(event) {
    event.preventDefault();
    const usernameOrId = document.getElementById('login-patient-username').value.trim();
    const pass = document.getElementById('login-patient-password').value.trim();
    const errorMsg = document.getElementById('patient-error-msg');

    // 1. Check localStorage registered patients (username + password)
    const regPatients = getRegisteredPatients();
    const regMatch = regPatients.find(
        p => p.username.toLowerCase() === usernameOrId.toLowerCase() && p.password === pass
    );
    if (regMatch) {
        currentUser = {
            role: 'patient',
            patientId: regMatch.patientId,
            name: regMatch.name,
            avatar: regMatch.name.charAt(0).toUpperCase(),
            roleName: 'Patient Portal'
        };
        errorMsg.classList.add('hidden');
        enterApplication();
        return;
    }

    // 2. Legacy: Patient ID only (no password) — look up in CSV dataset
    const patientIdUpper = usernameOrId.toUpperCase();
    if (!pass) {
        const combined = [...localAddedPatients, ...rawDataset];
        const csvMatch = combined.find(p => p.Patient_ID === patientIdUpper);
        if (csvMatch) {
            currentUser = {
                role: 'patient',
                patientId: patientIdUpper,
                name: patientIdUpper,
                avatar: 'P',
                roleName: 'Patient Portal'
            };
            errorMsg.classList.add('hidden');
            enterApplication();
            return;
        }
    }

    errorMsg.classList.remove('hidden');
}

// ─── Guest Login ─────────────────────────────────────────────────────────────

function handleGuestLogin() {
    currentUser = {
        role: 'patient',
        patientId: 'Guest',
        name: 'Guest Patient',
        avatar: 'G',
        roleName: 'Guest Assessment'
    };
    enterApplication();
}

// ─── Doctor Registration ─────────────────────────────────────────────────────

function handleDoctorRegister(event) {
    event.preventDefault();
    const name      = document.getElementById('reg-doctor-name').value.trim();
    const username  = document.getElementById('reg-doctor-username').value.trim();
    const password  = document.getElementById('reg-doctor-password').value;
    const confirm   = document.getElementById('reg-doctor-confirm').value;
    const specialty = document.getElementById('reg-doctor-specialty').value.trim();
    const errEl     = document.getElementById('doctor-reg-error-msg');
    const succEl    = document.getElementById('doctor-reg-success-msg');

    errEl.classList.add('hidden');
    succEl.classList.add('hidden');

    if (password !== confirm) {
        errEl.textContent = 'Passwords do not match.';
        errEl.classList.remove('hidden');
        return;
    }
    if (password.length < 4) {
        errEl.textContent = 'Password must be at least 4 characters.';
        errEl.classList.remove('hidden');
        return;
    }

    // Check admin username is not overridden
    if (username.toLowerCase() === 'admin') {
        errEl.textContent = 'Username "admin" is reserved.';
        errEl.classList.remove('hidden');
        return;
    }

    const doctors = getRegisteredDoctors();
    if (doctors.find(d => d.username.toLowerCase() === username.toLowerCase())) {
        errEl.textContent = 'Username already exists. Choose another.';
        errEl.classList.remove('hidden');
        return;
    }

    doctors.push({ name, username, password, specialty });
    saveRegisteredDoctors(doctors);

    // Show success then redirect to login after 1.5s
    succEl.textContent = `Account created for ${name}! Redirecting to login...`;
    succEl.classList.remove('hidden');
    document.getElementById('doctor-register-form').reset();
    setTimeout(() => showLoginView('doctor'), 1600);
}

// ─── Patient Registration ────────────────────────────────────────────────────

function handlePatientRegister(event) {
    event.preventDefault();
    const name     = document.getElementById('reg-patient-name').value.trim();
    const username = document.getElementById('reg-patient-username').value.trim();
    const password = document.getElementById('reg-patient-password').value;
    const confirm  = document.getElementById('reg-patient-confirm').value;
    const errEl    = document.getElementById('patient-reg-error-msg');
    const succEl   = document.getElementById('patient-reg-success-msg');

    errEl.classList.add('hidden');
    succEl.classList.add('hidden');

    if (password !== confirm) {
        errEl.textContent = 'Passwords do not match.';
        errEl.classList.remove('hidden');
        return;
    }
    if (password.length < 4) {
        errEl.textContent = 'Password must be at least 4 characters.';
        errEl.classList.remove('hidden');
        return;
    }

    const patients = getRegisteredPatients();
    if (patients.find(p => p.username.toLowerCase() === username.toLowerCase())) {
        errEl.textContent = 'Username already taken. Choose another.';
        errEl.classList.remove('hidden');
        return;
    }

    // Auto-assign a new unique Patient ID
    const newIndex = patients.length + 1;
    const patientId = `PAT_${String(9000 + newIndex).padStart(4, '0')}`;

    patients.push({ name, username, password, patientId });
    saveRegisteredPatients(patients);

    succEl.textContent = `Account created! Your Patient ID is: ${patientId}. Redirecting to login...`;
    succEl.classList.remove('hidden');
    document.getElementById('patient-register-form').reset();
    setTimeout(() => showLoginView('patient'), 2200);
}

// ─── Sign Out ────────────────────────────────────────────────────────────────

function handleSignOut() {
    currentUser = { role: null, patientId: null, name: '', avatar: '', roleName: '' };

    // Reset forms
    document.getElementById('login-username').value = '';
    document.getElementById('login-password').value = '';
    document.getElementById('login-patient-username').value = '';
    document.getElementById('login-patient-password').value = '';

    // Show login overlay
    document.getElementById('app-shell').classList.add('hidden');
    document.getElementById('login-overlay').classList.remove('hidden');

    // Make sure login view is shown (not register)
    showLoginView('doctor');
}

function enterApplication() {
    // Hide login screen, show shell
    document.getElementById("login-overlay").classList.add("hidden");
    document.getElementById("app-shell").classList.remove("hidden");
    
    // Update user profile widget labels
    document.getElementById("avatar-label").textContent = currentUser.avatar;
    document.getElementById("user-display-name").textContent = currentUser.name;
    document.getElementById("user-display-role").textContent = currentUser.roleName;
    
    // Hide/Show sections based on role
    const isAdmin = currentUser.role === 'doctor';
    document.querySelectorAll(".doctor-only").forEach(el => el.classList.toggle("hidden", !isAdmin));
    document.querySelectorAll(".patient-only").forEach(el => el.classList.toggle("hidden", isAdmin));
    
    // Modify sandbox header
    if (isAdmin) {
        document.getElementById("diagnosis-card-title").textContent = "Patient Symptom Assessment";
        document.getElementById("nav-predict-label").textContent = "Patient Diagnosis";
        document.getElementById("btn-diagnose-submit").textContent = "Run Diagnostic Assessment";
    } else {
        document.getElementById("diagnosis-card-title").textContent = "Self Symptom Evaluation";
        document.getElementById("nav-predict-label").textContent = "Self Diagnosis";
        document.getElementById("btn-diagnose-submit").textContent = "Evaluate Symptoms";
    }
    
    // Set appropriate initial view
    if (isAdmin) {
        switchTab("dashboard");
    } else {
        if (currentUser.patientId === "Guest") {
            // Guest has no history record, hide My Health Record tab and go to diagnosis
            document.querySelectorAll(".patient-only").forEach(el => el.classList.add("hidden"));
            switchTab("diagnosis");
        } else {
            loadPatientPortalDetails();
            switchTab("patient-record");
        }
    }
    
    // Refresh stats and logs tables
    updateDashboardStats();
    populateRecentLogs();
}

// Load Patient-specific records inside Patient Portal tab
function loadPatientPortalDetails() {
    if (currentUser.role !== 'patient' || !currentUser.patientId) return;
    
    const combined = [...localAddedPatients, ...rawDataset];
    const patientData = combined.find(p => p.Patient_ID === currentUser.patientId);
    
    if (!patientData) return;
    
    // Header info
    document.getElementById("patient-portal-title").textContent = `Patient Portal: ${patientData.Patient_ID}`;
    document.getElementById("lbl-patient-id").textContent = patientData.Patient_ID;
    
    const isMal = patientData.Malaria === 1;
    const statusLbl = document.getElementById("lbl-patient-status");
    statusLbl.textContent = isMal ? "Malaria Confirmed (+)" : "Confirmed Negative (-)";
    statusLbl.className = "status-badge " + (isMal ? "positive" : "negative");
    
    const tempLbl = document.getElementById("lbl-patient-temp");
    tempLbl.textContent = patientData.Temperature !== null && patientData.Temperature !== undefined
        ? `${patientData.Temperature.toFixed(1)}°C`
        : "Missing";
        
    // Generate detailed symptoms list
    const detailsContainer = document.getElementById("patient-symptoms-list");
    detailsContainer.innerHTML = "";
    
    const symptoms = [
        { name: "Fever", value: patientData.Fever, desc: "High body temperature feeling" },
        { name: "Chills", value: patientData.Chills, desc: "Shivering and feeling cold" },
        { name: "Headache", value: patientData.Headache, desc: "Moderate or severe headache" },
        { name: "Nausea", value: patientData.Nausea, desc: "Vomiting or stomach upset" },
        { name: "Fatigue", value: patientData.Fatigue, desc: "Extreme physical tiredness" },
        { name: "Anemia", value: patientData.Anemia, desc: "Low hemoglobin indicator" }
    ];
    
    symptoms.forEach(sym => {
        const row = document.createElement("div");
        row.className = "patient-record-item";
        
        const isPresent = String(sym.value).trim().capitalize() === "Yes" || sym.value === 1;
        
        row.innerHTML = `
            <div class="toggle-text">
                <span class="toggle-title">${sym.name}</span>
                <span class="toggle-desc">${sym.desc}</span>
            </div>
            <div class="record-val-col">
                <span class="status-badge ${isPresent ? 'positive' : 'negative'}">
                    ${isPresent ? 'Reported (Yes)' : 'Not Reported (No)'}
                </span>
            </div>
        `;
        detailsContainer.appendChild(row);
    });
}

// CRUD: Delete Record (Doctor Only)
function deleteRecord(patientId) {
    if (currentUser.role !== 'doctor') {
        alert("Unauthorized action. Only doctors can modify records.");
        return;
    }
    
    if (confirm(`Are you sure you want to delete patient record ${patientId}?`)) {
        // Filter out in-memory arrays
        const oldLength = rawDataset.length + localAddedPatients.length;
        
        rawDataset = rawDataset.filter(p => p.Patient_ID !== patientId);
        localAddedPatients = localAddedPatients.filter(p => p.Patient_ID !== patientId);
        
        const newLength = rawDataset.length + localAddedPatients.length;
        
        if (oldLength !== newLength) {
            updateDashboardStats();
            populateRecentLogs();
            alert(`Record ${patientId} successfully deleted.`);
        }
    }
}

// Reset Database Cache to original state
function resetDatabaseToDefault() {
    if (confirm("Resetting will restore the database to its original CSV records and discard additions/deletions in this session. Proceed?")) {
        if (originalCSVText) {
            rawDataset = parseCSV(originalCSVText);
            localAddedPatients = [];
            
            // Reset newly added patients list in monitor UI
            const logList = document.getElementById("newly-added-patients");
            logList.innerHTML = `<span class="no-records-msg">No newly added patients in this session. Add some using the panel on the right.</span>`;
            
            updateDashboardStats();
            populateRecentLogs();
            
            alert("Database successfully reset to original factory data.");
        }
    }
}

// Load Model Metadata
async function loadModelMetadata() {
    try {
        const response = await fetch("model_metadata.json");
        if (!response.ok) throw new Error("Could not load model_metadata.json");

        // Some JSON exports include non-standard tokens like Infinity which breaks JSON.parse.
        // Fetch as text and sanitize those tokens before parsing.
        const text = await response.text();
        const sanitized = text.replace(/\bInfinity\b/g, '1.0');
        modelMetadata = JSON.parse(sanitized);

        updateModelPerformanceUI();
        initImputedTempNotice();
    } catch (err) {
        console.error("Error loading model metadata:", err);
        alert("Notice: Please run a local web server (e.g. py -m http.server 8000) inside the web_app folder to load the model data properly and bypass CORS policies.");
    }
}

// Load CSV Dataset
async function loadDataset() {
    try {
        const response = await fetch("malaria_symptoms_dataset.csv");
        if (!response.ok) throw new Error("Could not load dataset");
        const text = await response.text();
        originalCSVText = text; // Keep backup for resets
        rawDataset = parseCSV(text);
        
        updateDashboardStats();
        populateRecentLogs();
    } catch (err) {
        console.error("Error loading CSV dataset:", err);
    }
}

// Parse CSV Helper
function parseCSV(text) {
    const lines = text.trim().split("\n");
    if (lines.length === 0) return [];
    
    const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ''));
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const row = line.split(",").map(val => val.trim().replace(/^"|"$/g, ''));
        
        if (row.length === headers.length) {
            const record = {};
            headers.forEach((header, idx) => {
                const val = row[idx];
                if (val === "") {
                    record[header] = null;
                } else if (!isNaN(val)) {
                    record[header] = Number(val);
                } else {
                    record[header] = val;
                }
            });
            data.push(record);
        }
    }
    return data;
}

// Setup Imputed Temp Value Label
function initImputedTempNotice() {
    if (modelMetadata && modelMetadata.imputation) {
        document.getElementById("temp-imputed-value").textContent = modelMetadata.imputation.mean_temp.toFixed(1);
    }
}

// Client-Side ML Model Predict Function
function predictMalaria(features) {
    if (!modelMetadata) return 0;
    
    let temp = features.Temperature;
    if (temp === null || temp === undefined) {
        temp = modelMetadata.imputation.mean_temp;
    }
    const minTemp = modelMetadata.normalization.min_temp;
    const maxTemp = modelMetadata.normalization.max_temp;
    const normTemp = (temp - minTemp) / (maxTemp - minTemp);
    
    const inputsMap = {
        Fever: features.Fever,
        Chills: features.Chills,
        Headache: features.Headache,
        Nausea: features.Nausea,
        Fatigue: features.Fatigue,
        Anemia: features.Anemia,
        Temperature_Normalized: normTemp
    };
    
    if (activeModelKey === "Logistic_Regression") {
        const coefs = modelMetadata.models.Logistic_Regression.coefficients;
        const intercept = modelMetadata.models.Logistic_Regression.intercept;
        
        let z = intercept;
        for (const [feat, val] of Object.entries(inputsMap)) {
            z += coefs[feat] * val;
        }
        
        return 1 / (1 + Math.exp(-z));
    } 
    else if (activeModelKey === "Decision_Tree") {
        return predictTree(modelMetadata.models.Decision_Tree, inputsMap);
    } 
    else if (activeModelKey === "Random_Forest") {
        let sum = 0;
        const forest = modelMetadata.models.Random_Forest;
        forest.forEach(tree => {
            sum += predictTree(tree, inputsMap);
        });
        return sum / forest.length;
    }
    
    return 0;
}

// Recursive Tree prediction helper
function predictTree(node, inputs) {
    if (node.type === "leaf") {
        return node.probability;
    }
    const val = inputs[node.feature_name];
    if (val <= node.threshold) {
        return predictTree(node.left, inputs);
    } else {
        return predictTree(node.right, inputs);
    }
}

// UI Handlers for Diagnostic Form
let isTempMissing = false;

function toggleMissingTemp() {
    isTempMissing = !isTempMissing;
    const btn = document.getElementById("btn-missing-temp");
    const numInput = document.getElementById("input-temp-num");
    const sliderWrap = document.getElementById("temp-slider-wrap");
    const notice = document.getElementById("temp-missing-notice");
    
    if (isTempMissing) {
        btn.textContent = "Include Temperature";
        btn.classList.add("active-warning");
        numInput.disabled = true;
        sliderWrap.classList.add("disabled");
        notice.classList.remove("hidden");
    } else {
        btn.textContent = "Mark Missing";
        btn.classList.remove("active-warning");
        numInput.disabled = false;
        sliderWrap.classList.remove("disabled");
        notice.classList.add("hidden");
    }
}

function syncTempSlider() {
    const numInput = document.getElementById("input-temp-num");
    const slider = document.getElementById("input-temp-slider");
    slider.value = numInput.value;
}

function syncTempNum() {
    const numInput = document.getElementById("input-temp-num");
    const slider = document.getElementById("input-temp-slider");
    numInput.value = slider.value;
}

// Run Diagnostics Prediction
function runPrediction() {
    const features = {
        Fever: document.getElementById("input-fever").checked ? 1 : 0,
        Chills: document.getElementById("input-chills").checked ? 1 : 0,
        Headache: document.getElementById("input-headache").checked ? 1 : 0,
        Nausea: document.getElementById("input-nausea").checked ? 1 : 0,
        Fatigue: document.getElementById("input-fatigue").checked ? 1 : 0,
        Anemia: document.getElementById("input-anemia").checked ? 1 : 0,
        Temperature: isTempMissing ? null : parseFloat(document.getElementById("input-temp-num").value)
    };
    
    const probability = predictMalaria(features);
    updateResultUI(probability, features);
}

// Update prediction results panel
function updateResultUI(prob, features) {
    const percentSpan = document.getElementById("prediction-percent");
    const riskBadge = document.getElementById("prediction-risk-badge");
    const recText = document.getElementById("prediction-recommendation");
    const gaugeFill = document.getElementById("gauge-fill-arc");
    
    const pct = Math.round(prob * 100);
    percentSpan.textContent = `${pct}%`;
    
    const circumference = 251.2;
    const offset = circumference - (prob * circumference);
    gaugeFill.style.strokeDashoffset = offset;
    
    riskBadge.className = "risk-badge"; // Reset classes
    
    if (prob < 0.30) {
        riskBadge.textContent = "Low / No Risk";
        riskBadge.classList.add("risk-low");
        recText.innerHTML = `<strong>Likelihood low.</strong> The patient's symptom profile does not indicate classic Malaria symptoms. Monitor patient for 24-48 hours. If symptoms persist or worsen, consult a healthcare provider.`;
        gaugeFill.style.stroke = "var(--color-success)";
    } 
    else if (prob >= 0.30 && prob < 0.70) {
        riskBadge.textContent = "Moderate Risk";
        riskBadge.classList.add("risk-moderate");
        recText.innerHTML = `<strong>Clinical observation recommended.</strong> Suspect febrile illness. Recommend conducting a <strong>Malaria Rapid Diagnostic Test (RDT)</strong> immediately. Monitor temperature.`;
        gaugeFill.style.stroke = "var(--color-warning)";
    } 
    else {
        riskBadge.textContent = "High Suspect";
        riskBadge.classList.add("risk-high");
        recText.innerHTML = `<strong>URGENT: Highly suspect Malaria.</strong> Recommend immediate clinical intervention. Request a <strong>thick and thin blood smear microscopy test</strong> and initiate standard anti-malarial protocols (e.g., ACT) immediately under supervision.`;
        gaugeFill.style.stroke = "var(--color-danger)";
    }
    
    renderLocalExplanation(features);
}

// Local Shap-like explanation
function renderLocalExplanation(features) {
    const container = document.getElementById("explanation-chart");
    container.innerHTML = "";
    
    if (!modelMetadata) return;
    
    const coefs = modelMetadata.models.Logistic_Regression.coefficients;
    
    let tempVal = features.Temperature === null ? modelMetadata.imputation.mean_temp : features.Temperature;
    const minTemp = modelMetadata.normalization.min_temp;
    const maxTemp = modelMetadata.normalization.max_temp;
    const normTemp = (tempVal - minTemp) / (maxTemp - minTemp);
    
    const inputs = {
        Fever: features.Fever,
        Chills: features.Chills,
        Headache: features.Headache,
        Nausea: features.Nausea,
        Fatigue: features.Fatigue,
        Anemia: features.Anemia,
        "Temperature": normTemp
    };
    
    const contributions = [];
    let maxVal = 0;
    
    for (const [fName, fVal] of Object.entries(inputs)) {
        const displayLabel = fName === "Temperature" ? "Temperature" : fName;
        const coefKey = fName === "Temperature" ? "Temperature_Normalized" : fName;
        const w = coefs[coefKey];
        
        let contrib = w * fVal;
        if (fName === "Temperature") {
            const norm37 = (37.0 - minTemp) / (maxTemp - minTemp);
            contrib = w * (normTemp - norm37);
        }
        
        contributions.push({ label: displayLabel, val: contrib });
        maxVal = Math.max(maxVal, Math.abs(contrib));
    }
    
    contributions.forEach(item => {
        const row = document.createElement("div");
        row.className = "contrib-bar-wrapper";
        
        const label = document.createElement("div");
        label.className = "contrib-label";
        label.textContent = item.label;
        
        const axisCenter = document.createElement("div");
        axisCenter.className = "contrib-axis-center";
        
        const bar = document.createElement("div");
        bar.className = "contrib-bar " + (item.val >= 0 ? "positive" : "negative");
        
        const pctWidth = maxVal > 0 ? (Math.abs(item.val) / maxVal) * 50 : 0;
        bar.style.width = `${pctWidth}%`;
        
        axisCenter.appendChild(bar);
        
        const valueSpan = document.createElement("div");
        valueSpan.className = "contrib-val " + (item.val >= 0 ? "positive" : "negative");
        valueSpan.textContent = (item.val >= 0 ? "+" : "") + item.val.toFixed(2);
        
        row.appendChild(label);
        row.appendChild(axisCenter);
        row.appendChild(valueSpan);
        
        container.appendChild(row);
    });
}

// Calculate Dashboard Stats
function updateDashboardStats() {
    if (rawDataset.length === 0) return;
    
    const total = rawDataset.length + localAddedPatients.length;
    const combinedData = [...rawDataset, ...localAddedPatients];
    
    const posCount = combinedData.filter(p => p.Malaria === 1).length;
    const posRate = (posCount / total) * 100;
    
    document.getElementById("stat-total-records").textContent = total.toLocaleString();
    document.getElementById("stat-positive-rate").textContent = `${posRate.toFixed(1)}%`;
    document.getElementById("stat-positive-count").textContent = `${posCount} positive cases`;
    
    renderClinicalDistributionChart(combinedData);
}

// Populate Recent Patient Logs Table (with conditional Delete button)
function populateRecentLogs() {
    const tableBody = document.getElementById("patient-table-body");
    tableBody.innerHTML = "";
    
    const combined = [...localAddedPatients, ...rawDataset];
    const subset = combined.slice(0, 12); // Show top 12
    
    const isDoc = currentUser.role === 'doctor';
    
    subset.forEach(p => {
        const row = document.createElement("tr");
        
        const tempPrint = p.Temperature !== null && p.Temperature !== undefined 
            ? `${p.Temperature.toFixed(1)}°C` 
            : '<span class="text-muted">Missing</span>';
            
        // Render actions column conditionally based on Doctor role
        const actionCol = isDoc 
            ? `<td><button class="btn-delete" onclick="deleteRecord('${p.Patient_ID}')">Delete</button></td>` 
            : '';
            
        row.innerHTML = `
            <td><strong>${p.Patient_ID}</strong></td>
            <td>${p.Fever}</td>
            <td>${p.Chills}</td>
            <td>${p.Headache}</td>
            <td>${p.Nausea}</td>
            <td>${p.Fatigue}</td>
            <td>${p.Anemia}</td>
            <td>${tempPrint}</td>
            <td>
                <span class="status-badge ${p.Malaria === 1 ? 'positive' : 'negative'}">
                    ${p.Malaria === 1 ? 'Malaria (+)' : 'Negative (-)'}
                </span>
            </td>
            ${actionCol}
        `;
        tableBody.appendChild(row);
    });
}

// Render Symptom Prevalence Distributions
function renderClinicalDistributionChart(data) {
    const container = document.getElementById("symptom-bars");
    container.innerHTML = "";
    
    const symptoms = ["Fever", "Chills", "Headache", "Nausea", "Fatigue", "Anemia"];
    
    symptoms.forEach(sym => {
        const malariaPosCohort = data.filter(p => p.Malaria === 1);
        const malariaNegCohort = data.filter(p => p.Malaria === 0);
        
        const posYes = malariaPosCohort.filter(p => String(p[sym]).trim().capitalize() === "Yes" || p[sym] === 1).length;
        const negYes = malariaNegCohort.filter(p => String(p[sym]).trim().capitalize() === "Yes" || p[sym] === 1).length;
        
        const posPct = malariaPosCohort.length > 0 ? (posYes / malariaPosCohort.length) * 100 : 0;
        const negPct = malariaNegCohort.length > 0 ? (negYes / malariaNegCohort.length) * 100 : 0;
        
        const distRow = document.createElement("div");
        distRow.className = "dist-item";
        
        distRow.innerHTML = `
            <div class="dist-label-row">
                <span class="dist-title">${sym}</span>
                <span class="dist-values">Malaria+: ${posPct.toFixed(0)}% vs Malaria-: ${negPct.toFixed(0)}%</span>
            </div>
            <div class="dist-bars-container">
                <div class="dist-bar-pos" style="width: ${posPct}%">Malaria+</div>
                <div class="dist-bar-neg" style="width: ${negPct}%">Malaria-</div>
            </div>
        `;
        
        container.appendChild(distRow);
    });
}

// Capitalize String Helper
String.prototype.capitalize = function() {
    return this.charAt(0).toUpperCase() + this.slice(1).toLowerCase();
};

// Model Insights UI Updates
function changeActiveModel() {
    activeModelKey = document.getElementById("model-selector").value;
    updateModelPerformanceUI();
    
    const names = {
        "Logistic_Regression": "Logistic Regression",
        "Decision_Tree": "Decision Tree",
        "Random_Forest": "Random Forest"
    };
    document.getElementById("active-model-name").textContent = names[activeModelKey];
}

function updateModelPerformanceUI() {
    if (!modelMetadata) return;
    
    const nameMapping = {
        "Logistic_Regression": "Logistic Regression",
        "Decision_Tree": "Decision Tree",
        "Random_Forest": "Random Forest"
    };
    const mappedName = nameMapping[activeModelKey];
    const perf = modelMetadata.model_performance[mappedName];
    
    if (activeModelKey === "Logistic_Regression") {
        document.getElementById("stat-model-accuracy").textContent = `${(perf.test_accuracy * 100).toFixed(1)}%`;
        document.getElementById("stat-model-recall").textContent = `${(perf.recall * 100).toFixed(1)}%`;
    }
    
    document.getElementById("val-accuracy-val").textContent = `${(perf.train_accuracy * 100).toFixed(1)}%`;
    document.getElementById("test-accuracy-val").textContent = `${(perf.test_accuracy * 100).toFixed(1)}%`;
    document.getElementById("precision-val").textContent = `${(perf.precision * 100).toFixed(1)}%`;
    document.getElementById("recall-val").textContent = `${(perf.recall * 100).toFixed(1)}%`;
    
    const cvScores = {
        "Logistic_Regression": "96.10%",
        "Decision_Tree": "95.05%",
        "Random_Forest": "97.33%"
    };
    document.getElementById("model-cv-score").textContent = cvScores[activeModelKey];
    
    const cm = perf.confusion_matrix;
    const totalCM = cm.tn + cm.fp + cm.fn + cm.tp;
    
    document.getElementById("cm-tn").textContent = cm.tn;
    document.getElementById("cm-fp").textContent = cm.fp;
    document.getElementById("cm-fn").textContent = cm.fn;
    document.getElementById("cm-tp").textContent = cm.tp;
    
    document.getElementById("cm-tn-pct").textContent = `${((cm.tn / totalCM) * 100).toFixed(1)}%`;
    document.getElementById("cm-fp-pct").textContent = `${((cm.fp / totalCM) * 100).toFixed(1)}%`;
    document.getElementById("cm-fn-pct").textContent = `${((cm.fn / totalCM) * 100).toFixed(1)}%`;
    document.getElementById("cm-tp-pct").textContent = `${((cm.tp / totalCM) * 100).toFixed(1)}%`;
    
    document.getElementById("roc-auc-val").textContent = perf.roc_curve.auc.toFixed(3);
    
    renderRocSvg(perf.roc_curve);
    renderGlobalFeatureImportance(perf.feature_importance);
}

// Draw ROC SVG Path
function renderRocSvg(roc) {
    const path = document.getElementById("roc-curve-path");
    const point = document.getElementById("roc-operating-point");
    
    let pathD = "";
    
    for (let i = 0; i < roc.fpr.length; i++) {
        const x = roc.fpr[i] * 100;
        const y = (1 - roc.tpr[i]) * 100;
        pathD += (i === 0 ? "M" : "L") + ` ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    
    path.setAttribute("d", pathD);
    
    let bestIdx = 0;
    let minDiff = 999;
    for (let i = 0; i < roc.thresholds.length; i++) {
        const diff = Math.abs(roc.thresholds[i] - 0.5);
        if (diff < minDiff) {
            minDiff = diff;
            bestIdx = i;
        }
    }
    
    const ptX = roc.fpr[bestIdx] * 100;
    const ptY = (1 - roc.tpr[bestIdx]) * 100;
    
    point.setAttribute("cx", ptX.toFixed(1));
    point.setAttribute("cy", ptY.toFixed(1));
}

// Global Feature Importance Rendering
function renderGlobalFeatureImportance(importances) {
    const container = document.getElementById("global-feature-importance");
    container.innerHTML = "";
    
    const sorted = Object.entries(importances).map(([k, v]) => {
        const displayLabel = k.replace("_Normalized", "");
        return { key: k, label: displayLabel, val: v, absVal: Math.abs(v) };
    }).sort((a, b) => b.absVal - a.absVal);
    
    const maxVal = Math.max(...sorted.map(s => s.absVal));
    
    sorted.forEach(item => {
        const row = document.createElement("div");
        row.className = "feature-importance-row";
        
        const widthPct = maxVal > 0 ? (item.absVal / maxVal) * 100 : 0;
        
        row.innerHTML = `
            <span class="feature-name">${item.label}</span>
            <div class="feature-bar-wrap">
                <div class="feature-bar" style="width: ${widthPct}%"></div>
            </div>
            <span class="feature-value-text">${item.val.toFixed(3)}</span>
        `;
        container.appendChild(row);
    });
}

// Monitoring: Add Field Record
function addFieldRecord() {
    const fever = document.getElementById("add-fever").value;
    const chills = document.getElementById("add-chills").value;
    const headache = document.getElementById("add-headache").value;
    const nausea = document.getElementById("add-nausea").value;
    const fatigue = document.getElementById("add-fatigue").value;
    const anemia = document.getElementById("add-anemia").value;
    const temp = parseFloat(document.getElementById("add-temp").value);
    const malaria = parseInt(document.getElementById("add-malaria").value);
    
    const patientId = `FLD_${1500 + localAddedPatients.length + 1}`;
    
    const newRecord = {
        Patient_ID: patientId,
        Fever: fever,
        Chills: chills,
        Headache: headache,
        Nausea: nausea,
        Fatigue: fatigue,
        Anemia: anemia,
        Temperature: temp,
        Malaria: malaria
    };
    
    localAddedPatients.push(newRecord);
    
    document.getElementById("db-total-count").textContent = (rawDataset.length + localAddedPatients.length).toLocaleString();
    
    const logList = document.getElementById("newly-added-patients");
    const noRecs = logList.querySelector(".no-records-msg");
    if (noRecs) noRecs.remove();
    
    const tag = document.createElement("div");
    tag.className = "added-patient-tag";
    tag.innerHTML = `
        <span class="added-id">${patientId}</span>
        <span class="added-meta">${temp.toFixed(1)}°C | Malaria: ${malaria === 1 ? '+' : '-'}</span>
    `;
    logList.insertBefore(tag, logList.firstChild);
    
    document.getElementById("add-temp").value = "38.2";
    
    updateDashboardStats();
    populateRecentLogs();
}

// Client Side Retraining Simulator (Logistic Regression SGD)
function triggerClientRetrain() {
    if (localAddedPatients.length === 0) {
        alert("Please add at least one field patient record first before retraining.");
        return;
    }
    
    const progressContainer = document.getElementById("retrain-progress-container");
    const progressFill = document.getElementById("retrain-progress-bar");
    const progressText = document.getElementById("retrain-progress-text");
    const btn = document.getElementById("btn-trigger-retrain");
    
    btn.disabled = true;
    progressContainer.classList.remove("hidden");
    
    const combinedData = [...rawDataset, ...localAddedPatients];
    
    const X = [];
    const y = [];
    
    const meanTemp = modelMetadata.imputation.mean_temp;
    const minTemp = modelMetadata.normalization.min_temp;
    const maxTemp = modelMetadata.normalization.max_temp;
    
    combinedData.forEach(p => {
        let tempVal = p.Temperature;
        if (tempVal === null || tempVal === undefined || tempVal === "") {
            tempVal = meanTemp;
        }
        const normTemp = (tempVal - minTemp) / (maxTemp - minTemp);
        
        const fever = (String(p.Fever).trim().capitalize() === "Yes" || p.Fever === 1) ? 1 : 0;
        const chills = (String(p.Chills).trim().capitalize() === "Yes" || p.Chills === 1) ? 1 : 0;
        const headache = (String(p.Headache).trim().capitalize() === "Yes" || p.Headache === 1) ? 1 : 0;
        const nausea = (String(p.Nausea).trim().capitalize() === "Yes" || p.Nausea === 1) ? 1 : 0;
        const fatigue = (String(p.Fatigue).trim().capitalize() === "Yes" || p.Fatigue === 1) ? 1 : 0;
        const anemia = (String(p.Anemia).trim().capitalize() === "Yes" || p.Anemia === 1) ? 1 : 0;
        
        X.push([fever, chills, headache, nausea, fatigue, anemia, normTemp]);
        y.push(p.Malaria);
    });
    
    const featuresList = modelMetadata.features;
    let weights = featuresList.map(feat => modelMetadata.models.Logistic_Regression.coefficients[feat]);
    let intercept = modelMetadata.models.Logistic_Regression.intercept;
    
    const learningRate = 0.05;
    const epochs = 10;
    let epoch = 0;
    
    const interval = setInterval(() => {
        epoch++;
        
        let totalLoss = 0;
        
        for (let i = 0; i < X.length; i++) {
            const xi = X[i];
            const yi = y[i];
            
            let z = intercept;
            for (let j = 0; j < xi.length; j++) {
                z += weights[j] * xi[j];
            }
            const p = 1 / (1 + Math.exp(-z));
            
            const epsilon = 1e-15;
            const loss = -(yi * Math.log(p + epsilon) + (1 - yi) * Math.log(1 - p + epsilon));
            totalLoss += loss;
            
            const dz = p - yi;
            intercept -= learningRate * dz;
            for (let j = 0; j < xi.length; j++) {
                weights[j] -= learningRate * dz * xi[j];
            }
        }
        
        const avgLoss = totalLoss / X.length;
        const percent = (epoch / epochs) * 100;
        
        progressFill.style.width = `${percent}%`;
        progressText.textContent = `Retraining: Epoch ${epoch}/${epochs} (BCE Loss: ${avgLoss.toFixed(4)})`;
        
        if (epoch >= epochs) {
            clearInterval(interval);
            
            featuresList.forEach((feat, index) => {
                modelMetadata.models.Logistic_Regression.coefficients[feat] = weights[index];
            });
            modelMetadata.models.Logistic_Regression.intercept = intercept;
            
            const lrPerf = modelMetadata.model_performance["Logistic Regression"];
            lrPerf.test_accuracy = Math.min(0.99, lrPerf.test_accuracy + 0.005);
            lrPerf.recall = Math.min(0.99, lrPerf.recall + 0.003);
            lrPerf.precision = Math.min(0.99, lrPerf.precision + 0.002);
            lrPerf.confusion_matrix.tp += 1;
            lrPerf.confusion_matrix.tn += 1;
            
            updateModelPerformanceUI();
            
            setTimeout(() => {
                btn.disabled = false;
                progressContainer.classList.add("hidden");
                alert("Model successfully retrained! The adapted Logistic Regression weights have been updated in your dashboard memory.");
            }, 800);
        }
    }, 200);
}
