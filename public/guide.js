const cards = [...document.querySelectorAll(".control")];
const search = document.querySelector("#control-search");
const count = document.querySelector("#result-count");
const buttons = [...document.querySelectorAll("[data-filter]")];
let category = "all";

const filter = () => {
  const query = search.value.trim().toLowerCase();
  let visible = 0;
  for (const card of cards) {
    const matchesCategory = category === "all" || card.dataset.category === category;
    const matchesQuery = !query || card.textContent.toLowerCase().includes(query);
    card.hidden = !(matchesCategory && matchesQuery);
    if (!card.hidden) visible++;
  }
  count.textContent = `${visible} of ${cards.length} controls shown`;
};

search.addEventListener("input", filter);
for (const button of buttons) button.addEventListener("click", () => {
  category = button.dataset.filter;
  for (const item of buttons) item.setAttribute("aria-pressed", String(item === button));
  filter();
});
filter();
