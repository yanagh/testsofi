const el = (id) => document.getElementById(id);

const styleSelect = el("style");
const customStyleWrap = el("customStyleWrap");

const peopleCount = el("peopleCount");
const case1Wrap = el("case1Wrap");
const case2Wrap = el("case2Wrap");
const case3Wrap = el("case3Wrap");
const case3plusWrap = el("case3plusWrap");

const generateBtn = el("generateBtn");
const resultSection = el("result");
const selectedSection = el("selectedResult");
const statusText = el("statusText");
const designOptions = el("designOptions");

let lastGeneratedDesigns = [];
let selectedDesignId = null;

function updateStyleUI() {
  const isCustom = styleSelect.value === "custom";
  customStyleWrap.classList.toggle("hidden", !isCustom);
}

function updatePeopleUI() {
  const v = peopleCount.value;
  case1Wrap.classList.toggle("hidden", v !== "1");
  case2Wrap.classList.toggle("hidden", v !== "2");
  case3Wrap.classList.toggle("hidden", v !== "3");
  case3plusWrap.classList.toggle("hidden", v !== "3plus");
}

styleSelect.addEventListener("change", updateStyleUI);
peopleCount.addEventListener("change", updatePeopleUI);

updateStyleUI();
updatePeopleUI();

function getLivingSetup() {
  const count = peopleCount.value;
  const category = el("category").value;

  if (count === "1") return `${category}, 1: ${el("case1").value}`;
  if (count === "2") return `${category}, 2: ${el("case2").value}`;
  if (count === "3") return `${category}, 3: ${el("case3").value || "not specified"}`;
  return `${category}, 3+: ${el("case3plus").value || "not specified"}`;
}

function getPayload() {
  const styleVal = el("style").value;
  const styleText = styleVal === "custom" ? (el("customStyle").value || "custom") : styleVal;

  return {
    roomType: el("roomType").value,
    size: el("size").value || "-",
    styleText,
    budget: el("budget").value || "",
    country: el("country").value,
    age: el("age").value || "",
    wishes: el("wishes").value.trim(),
    category: el("category").value,
    livingSetup: getLivingSetup()
  };
}

function setLoadingState(isLoading) {
  generateBtn.disabled = isLoading;
  generateBtn.textContent = isLoading ? "Generating 3 designs..." : "Generate";
  generateBtn.classList.toggle("btn-disabled", isLoading);
}

function renderSelectedDesign(design) {
  selectedDesignId = design.id;
  el("selectedTitle").textContent = `${design.title} (${design.budgetRange})`;
  el("selectedSummary").textContent = design.summary;

  const selectedImage = el("selectedImage");
  selectedImage.src = design.imageUrl;

  const selectedFurniture = el("selectedFurniture");
  selectedFurniture.innerHTML = "";

  design.furniture.forEach((item) => {
    const li = document.createElement("li");
    const link = document.createElement("a");
    link.href = item.url;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = `${item.name} - ${item.store}`;
    li.appendChild(link);
    selectedFurniture.appendChild(li);
  });

  selectedSection.classList.remove("hidden");
}

function renderDesignOptions(designs) {
  designOptions.innerHTML = "";

  designs.forEach((design) => {
    const card = document.createElement("article");
    card.className = "design-option";
    if (design.id === selectedDesignId) {
      card.classList.add("selected");
    }

    const img = document.createElement("img");
    img.className = "design-image";
    img.src = design.imageUrl;
    img.alt = `${design.title} room option`;

    const title = document.createElement("h3");
    title.className = "design-title";
    title.textContent = `${design.title} (${design.budgetRange})`;

    const summary = document.createElement("p");
    summary.className = "design-summary";
    summary.textContent = design.summary;

    const pickButton = document.createElement("button");
    pickButton.className = "btn pick-btn";
    pickButton.textContent = "Choose this design";
    pickButton.addEventListener("click", () => {
      renderSelectedDesign(design);
      renderDesignOptions(lastGeneratedDesigns);
      selectedSection.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    card.appendChild(img);
    card.appendChild(title);
    card.appendChild(summary);
    card.appendChild(pickButton);
    designOptions.appendChild(card);
  });
}

async function generateDesigns() {
  const payload = getPayload();

  setLoadingState(true);
  resultSection.classList.remove("hidden");
  selectedSection.classList.add("hidden");
  statusText.textContent = "Generating 3 room options...";
  designOptions.innerHTML = "";

  try {
    const res = await fetch("/api/generate-designs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      let message = `Request failed: ${res.status}`;
      try {
        const errorJson = await res.json();
        if (errorJson?.error) {
          message = errorJson.error;
        }
      } catch (_ignored) {
      }
      throw new Error(message);
    }

    const json = await res.json();
    if (!Array.isArray(json.designs) || json.designs.length !== 3) {
      throw new Error("Invalid designs payload");
    }

    lastGeneratedDesigns = json.designs;
    selectedDesignId = null;
    statusText.textContent = "Done. Pick the design you like best.";
    renderDesignOptions(lastGeneratedDesigns);
  } catch (err) {
    console.error(err);
    statusText.textContent = `Could not generate designs: ${err.message}`;
  } finally {
    setLoadingState(false);
  }
}

generateBtn.addEventListener("click", generateDesigns);
