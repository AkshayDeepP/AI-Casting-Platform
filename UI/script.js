let filterMode = "all";

function showError(inputId, message) {
  const input = document.getElementById(inputId);
  input.style.border = "1px solid red";

  let error = input.nextElementSibling;
  if (!error || !error.classList.contains("error-msg")) {
    error = document.createElement("div");
    error.className = "error-msg";
    error.style.color = "red";
    error.style.fontSize = "12px";
    error.style.marginBottom = "8px";
    input.parentNode.insertBefore(error, input.nextSibling);
  }

  error.innerText = message;
}

function clearError(inputId) {
  const input = document.getElementById(inputId);
  input.style.border = "none";

  let error = input.nextElementSibling;
  if (error && error.classList.contains("error-msg")) {
    error.remove();
  }
}

async function login() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  const res = await fetch("https://ai-casting-platform.onrender.com/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email, password })
  });

  const data = await res.json();

  if (data.token) {
    localStorage.setItem("token", data.token);
    localStorage.setItem("role", data.role);

    alert("Login successful");

    if (data.role === "director") {
      window.location.href = "directordashboard.html";
    } else {
      window.location.href = "auditions.html";
    }
  } else {
    alert("Login failed");
  }
}

function togglePassword(inputId, element) {
  const input = document.getElementById(inputId);

  if (input.type === "password") {
    input.type = "text";
    element.textContent = "🙈";
  } else {
    input.type = "password";
    element.textContent = "👁️";
  }
}

function addLogoutButton() {
  const path = window.location.pathname;

  // Skip pages
  if (path.includes("apply.html") || path.includes("index.html")) return;

  const nav = document.querySelector(".nav");
  if (!nav) return;

  const btn = document.createElement("button");
  btn.innerText = "Logout";
  btn.onclick = logout;
  btn.style.width = "auto";
  btn.style.padding = "8px 16px";

  nav.appendChild(btn);
}

// run on page load
window.onload = addLogoutButton;
async function signup() {
  const name = document.getElementById("name").value;
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const role = document.getElementById("role").value;

  const res = await fetch("https://ai-casting-platform.onrender.com/signup", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ name, email, password, role })
  });

  const data = await res.json();

  alert(data.message);
  window.location.href = "login.html";
}
//  FIXED: Single correct saveAudition function
async function saveAudition(event) {
  const movie = document.getElementById("movie").value.trim();
  const role = document.getElementById("role").value.trim();
  const ageRange = document.getElementById("ageRange").value.trim();
  const deadline = document.getElementById("deadline").value;
  const directorId = localStorage.getItem("token"); // or userId if you store it
  const today = new Date().toISOString().split("T")[0];
  const genderRequirement = document.getElementById("genderRequirement").value;
  if (deadline < today) {
    alert("Deadline cannot be in the past");
    return;
  }
  const maxApplicants = document.getElementById("maxApplicants").value;
  const poster = `https://picsum.photos/seed/${encodeURIComponent(movie)}/600/400`;

  //  MULTI SKILL FIX
  const skills = [];
  document.querySelectorAll(".skills-grid input:checked").forEach(cb => {
    skills.push(cb.value);
  });
  

  //  VALIDATION
  if (!movie || !role || !ageRange || !deadline || !maxApplicants || !genderRequirement) {
    alert("Please fill all fields");
    return;
  }

  if (skills.length === 0) {
    alert("Please select at least one skill");
    return;
  }

  const response = await fetch("https://ai-casting-platform.onrender.com/auditions");
  let auditions = await response.json();

  const newAudition = {
    movie,
    role,
    ageRange,
    skills,
    deadline,
    maxApplicants: parseInt(maxApplicants),
    applicants: 0,
    poster,
    genderRequirement,
    directorId
  };
  
  auditions.push(newAudition);
  await fetch("https://ai-casting-platform.onrender.com/auditions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(newAudition)
  });

  alert("Audition posted successfully!");

  // clear form
  document.getElementById("movie").value = "";
  document.getElementById("role").value = "";
  document.getElementById("ageRange").value = "";
  document.getElementById("deadline").value = "";
  document.getElementById("maxApplicants").value = "";

  document.querySelectorAll(".skills-grid input").forEach(cb => cb.checked = false);
}

function selectAudition(auditionStr) {
  const audition = JSON.parse(decodeURIComponent(auditionStr));
  localStorage.setItem("selectedAudition", JSON.stringify(audition));
  window.location.href = "apply.html";
}

async function submitApplication() {
  let isValid = true;

  const name = document.getElementById("name").value.trim();
  const age = parseInt(document.getElementById("age").value);
  const gender = document.getElementById("gender").value;
  const experience = parseInt(document.getElementById("experience").value);



  const skills = [];
  document.querySelectorAll(".skill-item input:checked").forEach(cb => {
    skills.push(cb.value);
  });

  ["name", "age", "gender", "experience"].forEach(clearError);

  if (!name) {
    showError("name", "Name is required");
    isValid = false;
  }

  if (!age || age <= 0) {
    showError("age", "Enter a valid age");
    isValid = false;
  }

  if (gender === "Select Gender") {
    showError("gender", "Please select gender");
    isValid = false;
  }

  if (skills.length === 0) {
    alert("Please select at least one skill");
    isValid = false;
  }

  if (!experience || experience < 0) {
    showError("experience", "Enter valid experience");
    isValid = false;
  }

  if (!isValid) return;

  const selected = JSON.parse(localStorage.getItem("selectedAudition"));
  if (gender !== selected.genderRequirement) {
    alert(`This role is only for ${selected.genderRequirement} candidates`);
    return;
  }
  if (!selected) {
    alert("No audition selected");
    window.location.href = "auditions.html";
    return;
  }
  const responseAuditions = await fetch("https://ai-casting-platform.onrender.com/auditions");
  let auditions = await responseAuditions.json();


  const [minAge, maxAge] = selected.ageRange.split("-").map(Number);

  if (age < minAge || age > maxAge) {
    alert("Your age is outside the allowed range");
    return;
  }

  const auditionIndex = auditions.findIndex(a =>
  a._id === selected._id
);

  if (auditionIndex === -1) {
    alert("Audition not found!");
    return;
  }

  const audition = auditions[auditionIndex];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const deadline = new Date(audition.deadline);
  deadline.setHours(0, 0, 0, 0);

  if (deadline < today) {
    alert("This audition is closed");
    return;
  }

  if ((audition.applicants || 0) >= audition.maxApplicants) {
    alert("This audition is full");
    return;
  }

  const response = await fetch("https://ai-casting-platform.onrender.com/evaluate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      candidate: { name, age, skills, experience },
      audition: audition,
    }),
  });

  let aiResult;

  try {
    const response = await fetch("https://ai-casting-platform.onrender.com/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        candidate: { name, age, skills, experience },
        audition: audition,
      }),
    });

    if (!response.ok) throw new Error("Server error");

    aiResult = await response.json();

  } catch (err) {
    console.error(err);
    aiResult = {
      score: 5,
      reason: "Server error fallback"
    };
  }

  const applicant = {
    name,
    age,
    gender,
    experience,
    skills,
    score: aiResult.score,
    reason: aiResult.reason
  };

 
  await fetch("https://ai-casting-platform.onrender.com/apply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      ...applicant,
      auditionId: audition._id   //  important link
    })
  });
  await fetch(`https://ai-casting-platform.onrender.com/auditions/${audition._id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      applicants: audition.applicants + 1
    })
  });

  alert("Application submitted successfully");

  window.location.href = "resultsdir.html";
  window.location.href = "resultscan.html";
}

async function loadResults() {
  const container = document.getElementById("results");
  if (!container) return;

  const directorId = localStorage.getItem("token");

  const response = await fetch(`https://ai-casting-platform.onrender.com/applicants/${directorId}`);
  let data = await response.json();

  data.sort((a, b) => parseFloat(b.score) - parseFloat(a.score));

  if (filterMode === "shortlisted") {
    data = data.filter(app => parseFloat(app.score) > 6);
  }

  container.innerHTML = "";

  if (data.length === 0) {
    container.innerHTML = "<p>No applications yet</p>";
    return;
  }

  data.forEach((app, index) => {
    const div = document.createElement("div");
    div.className = "card";

    const badge = index === 0
      ? "<p style='color:gold; font-weight:bold;'>Top Candidate</p>"
      : "";

    div.innerHTML = `
      ${badge}
      <h3>${app.name}</h3>
      <p><strong>Age:</strong> ${app.age}</p>
      <p><strong>Skills:</strong> ${app.skills.join(", ")}</p>
      <p><strong>Experience:</strong> ${app.experience} years</p>

      <div class="score-box">Score: ${app.score}/10</div>
      <div class="reason">
        ${app.reason ? app.reason : "No explanation available"}
      </div>
    `;

    container.appendChild(div);
  });
}

 async function loadAuditions() {
  const container = document.getElementById("auditions");
  if (!container) return;

  const response = await fetch("https://ai-casting-platform.onrender.com/auditions");
  let auditions = await response.json();

  auditions = auditions.map(a => ({
    ...a,
    applicants: a.applicants || 0
  }));

  

  container.innerHTML = "";

  if (auditions.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        No auditions available 😟😟
      </div>
    `;
    return;
  }

  
  const today = new Date();

  auditions.forEach((audition, index) => {
    const deadline = new Date(audition.deadline);
    const deadlineDate = new Date(audition.deadline);
    const formattedDate = new Date(deadlineDate).toLocaleDateString('en-IN');

    const daysLeft = Math.ceil(
      (deadlineDate - today) / (1000 * 60 * 60 * 24)
    );
    let status = "Open";
    let canApply = true;

    if (deadline < today) {
      status = "Closed";
      canApply = false;
    }

    if (audition.applicants >= audition.maxApplicants) {
      status = "Full";
      canApply = false;
    }

    const div = document.createElement("div");
    div.className = "card";

    div.innerHTML = `
    <div class="poster">
      <img src="${audition.poster}" alt="poster">
      <span class="status-badge ${status.toLowerCase()}">${status}</span>
    </div>
  
    <div class="card-content">
      <h3>${audition.movie}</h3>
      <p class="role">${audition.role}</p>
  
      <p>Age: ${audition.ageRange}</p>
      <div class="skills">
        ${audition.skills.map(skill => 
          `<span class="skill-tag">${skill}</span>`
        ).join("")}
      </div>

      <p>Gender: ${audition.genderRequirement}</p>
  
      <p class="small">
        Applicants: ${(audition.applicants || 0)}/${audition.maxApplicants}
      </p>
      <div class="progress-bar">
        <div class="progress" style="width: ${(audition.applicants / audition.maxApplicants) * 100}%"></div>
      </div>

      <span class="deadline">Deadline: ${formattedDate} - </span>

      <span class="days-left" style="font-size: medium">
        ${daysLeft > 0 ? `${daysLeft} days left` : "Deadline passed"}
      </span>
  
      ${
        canApply
          ? `<button onclick="selectAudition('${encodeURIComponent(JSON.stringify(audition))}')">
          Apply Now
        </button>`
          : `<button disabled>
              ${status === "Closed" ? "Deadline Passed" : "Full"}
            </button>`
      }
    </div>
  `;

    container.appendChild(div);
  });
}

function showSelectedAudition() {
  const box = document.getElementById("selectedAuditionBox");
  if (!box) return;

  let audition;

  try {
    audition = JSON.parse(localStorage.getItem("selectedAudition"));
  } catch {
    box.innerHTML = `<p style="color:red;">Invalid audition data</p>`;
    return;
  }

  if (!audition) {
    box.innerHTML = `<p style="color:red;">No audition selected</p>`;
    return;
  }

  box.innerHTML = `
    <h3>Applying for:</h3>
    <p><strong>Movie:</strong> ${audition.movie}</p>
    <p><strong>Role:</strong> ${audition.role}</p>
    <p><strong>Gender:</strong> ${audition.genderRequirement}</p>
    <p><strong>Skills:</strong> ${audition.skills.join(", ")}</p>
    <p><strong>Age Range:</strong> ${audition.ageRange}</p>
    <p><strong>Deadline:</strong> ${new Date(audition.deadline).toLocaleDateString()}</p>
    <p style="color:red; font-weight:bold; text-align:center;font-size:">
    ⚠ Application once submitted cannot be edited!!
  </p>
  `;
}

function showAll() {
  filterMode = "all";
  loadResults();
}

function showShortlisted() {
  filterMode = "shortlisted";
  loadResults();
}

window.onload = function () {
  loadResults();
  loadAuditions();
  showSelectedAudition();

  //  Restrict past dates
  const today = new Date().toISOString().split("T")[0];
  const deadlineInput = document.getElementById("deadline");

  if (deadlineInput) {
    deadlineInput.setAttribute("min", today);
  }
};