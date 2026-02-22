const el = (id) => document.getElementById(id);

const styleSelect = el("style");
const customStyleWrap = el("customStyleWrap");

const peopleCount = el("peopleCount");
const case1Wrap = el("case1Wrap");
const case2Wrap = el("case2Wrap");
const case3Wrap = el("case3Wrap");
const case3plusWrap = el("case3plusWrap");

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
  if (count === "3") return `${category}, 3: ${el("case3").value || "не указано"}`;
  return `${category}, 3+: ${el("case3plus").value || "не указано"}`;
}

function generatePlan(data) {
  // Это “псевдо-AI”: простой шаблон. Позже заменим на настоящий AI.
  const style = data.styleText.toLowerCase();
  const isKids = data.category === "kids";

  const mood = isKids ? "безопасно, ярко, много хранения" : "спокойно, аккуратно, функционально";
  const light = style.includes("лофт") ? "трековые светильники + настенные бра" : "основной свет + локальные лампы";

  return `
Комната: ${data.roomType}, ${data.size} м²
Стиль: ${data.styleText}
Кто живёт: ${data.livingSetup}
Бюджет: $${data.budget || "не указан"}, страна: ${data.country}

План:
1) Настроение: ${mood}.
2) Цвета: базовые нейтральные + 1 акцент (по стилю).
3) Освещение: ${light}.
4) Хранение: шкаф/стеллаж + закрытые коробки, чтобы не было визуального хаоса.
5) Пожелания: ${data.wishes || "—"}

(Да, это пока не AI. Это MVP, чтобы интерфейс жил.)
  `.trim();
}

function generateFurnitureList(data) {
  const base = [
    "Основная кровать/диван",
    "Тумбочка/приставной столик",
    "Шкаф или комод",
    "Освещение: потолочный + 1–2 лампы",
    "Ковёр/текстиль",
    "Шторы/жалюзи",
    "Декор: постеры/растение"
  ];

  if (data.roomType === "Кухня") {
    return ["Кухонный гарнитур", "Стол + стулья", "Освещение", "Система хранения", "Текстиль/коврик"];
  }
  if (data.roomType === "Кабинет") {
    return ["Стол", "Кресло", "Настольная лампа", "Стеллаж", "Органайзеры", "Коврик/шторы"];
  }
  return base;
}

function shopsByCountry(country) {
  const map = {
    Georgia: [
      { name: "IKEA (доставка/перекупы)", url: "https://www.ikea.com/" },
      { name: "JYSK", url: "https://jysk.com/" }
    ],
    USA: [
      { name: "IKEA", url: "https://www.ikea.com/us/en/" },
      { name: "Wayfair", url: "https://www.wayfair.com/" },
      { name: "Amazon", url: "https://www.amazon.com/" }
    ],
    UK: [
      { name: "IKEA UK", url: "https://www.ikea.com/gb/en/" },
      { name: "Argos", url: "https://www.argos.co.uk/" }
    ]
  };
  return map[country] || [{ name: "Google (поиск магазинов)", url: "https://www.google.com/" }];
}

el("generateBtn").addEventListener("click", () => {
  const styleVal = el("style").value;
  const styleText = styleVal === "custom" ? (el("customStyle").value || "custom") : styleVal;

  const data = {
    roomType: el("roomType").value,
    size: el("size").value || "—",
    styleText,
    budget: el("budget").value || "",
    country: el("country").value,
    age: el("age").value || "",
    wishes: el("wishes").value.trim(),
    category: el("category").value,
    livingSetup: getLivingSetup()
  };

  el("plan").textContent = generatePlan(data);

  const furniture = generateFurnitureList(data);
  const furnUl = el("furniture");
  furnUl.innerHTML = "";
  furniture.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    furnUl.appendChild(li);
  });

  const shops = shopsByCountry(data.country);
  const shopsUl = el("shops");
  shopsUl.innerHTML = "";
  shops.forEach((s) => {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = s.url;
    a.target = "_blank";
    a.rel = "noreferrer";
    a.textContent = s.name;
    li.appendChild(a);
    shopsUl.appendChild(li);
  });

  el("result").classList.remove("hidden");
  el("result").scrollIntoView({ behavior: "smooth" });
});
