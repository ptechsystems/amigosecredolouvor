import {makeDraw} from "./draw.js";

const icons = {
  gift: '<rect x="3" y="8" width="18" height="5" rx="1"/><path d="M5 13v7h14v-7M12 8v12M12 8H8a2.5 2.5 0 1 1 2.5-2.5ZM12 8h4a2.5 2.5 0 1 0-2.5-2.5Z"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/><circle cx="9" cy="7" r="4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4m.1 2.8h.01"/>',
  clipboard: '<rect x="8" y="3" width="8" height="4" rx="1"/><path d="M16 5h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h3m0 7h8m-8 4h6"/>',
  shuffle: '<path d="m18 3 3 3-3 3m0 6 3 3-3 3M3 6h3c6 0 6 12 12 12h3M3 18h3c6 0 6-12 12-12h3"/>',
  sparkles: '<path d="M9.5 2 11 7l5 1.5-5 1.5-1.5 5L8 10 3 8.5 8 7l1.5-5ZM17 12l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3ZM5 16v4m-2-2h4"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2 6.7M20 4v7h-7"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  eye: '<path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z"/><circle cx="12" cy="12" r="2.5"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3m4 0-1 14H6L5 6m5 4v6m4-6v6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
};

function setIcon(element, name) {
  element.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + icons[name] + '</svg>';
}
document.querySelectorAll("[data-icon]").forEach(element => setIcon(element, element.dataset.icon));

const byId = id => document.getElementById(id);
const storageKey = "amigo-secreto.v1";
const maxParticipants = 100;
const maxNameLength = 60;
const list = byId("participants");
const nameInput = byId("name-input");
const bulkInput = byId("bulk-input");
const revealDialog = byId("reveal-dialog");
let selectedPerson = null;
let storageAvailable = true;
let state = readState();

function blankState() {
  return {names: [], assignments: null, revealed: []};
}

function readState() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (!saved || !Array.isArray(saved.names) || saved.names.length > maxParticipants ||
        saved.names.some(name => typeof name !== "string" || !name.trim() || name.length > maxNameLength)) {
      return blankState();
    }
    const {names, assignments} = saved;
    const validDraw = Array.isArray(assignments) && names.length >= 2 &&
      assignments.length === names.length && new Set(assignments).size === names.length &&
      assignments.every((index, i) => Number.isInteger(index) && index >= 0 && index < names.length && index !== i);
    const revealed = validDraw && Array.isArray(saved.revealed)
      ? [...new Set(saved.revealed.filter(index => Number.isInteger(index) && index >= 0 && index < names.length))]
      : [];
    return {names, assignments: validDraw ? assignments : null, revealed};
  } catch (error) {
    if (!(error instanceof SyntaxError)) storageAvailable = false;
    return blankState();
  }
}

function save() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
    storageAvailable = true;
  } catch {
    storageAvailable = false;
  }
  byId("storage-warning").hidden = storageAvailable;
  document.querySelector(".footer").hidden = !storageAvailable;
}

function announce(message) {
  byId("status").textContent = message;
}

function setError(input, outputId, message = "") {
  const output = byId(outputId);
  output.textContent = message;
  output.hidden = !message;
  if (message) input.setAttribute("aria-invalid", "true");
  else input.removeAttribute("aria-invalid");
}

function normalizedName(name) {
  return name.normalize("NFC").trim().replace(/\s+/gu, " ");
}

function nameKey(name) {
  return name.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("pt-BR");
}

function addNames(rawNames) {
  const names = rawNames.map(normalizedName).filter(Boolean);
  if (!names.length) return "Digite pelo menos um nome.";
  if (names.some(name => name.length > maxNameLength)) return "Use até 60 caracteres por nome.";
  if (state.names.length + names.length > maxParticipants) return "O limite é de 100 participantes por sorteio.";

  const existing = new Set(state.names.map(nameKey));
  for (const name of names) {
    const key = nameKey(name);
    if (existing.has(key)) return `O nome “${name}” já está na lista. Use um sobrenome ou apelido para diferenciar.`;
    existing.add(key);
  }
  state.names.push(...names);
  save();
  render();
  announce(names.length === 1 ? `${names[0]} foi adicionado à lista.` : `${names.length} participantes adicionados.`);
  return "";
}

function initials(name) {
  return name.split(" ").slice(0, 2).map(word => [...word][0]).join("").toLocaleUpperCase("pt-BR");
}

function render() {
  const count = state.names.length;
  const isDrawn = state.assignments !== null;
  byId("counter").textContent = count;
  byId("counter").setAttribute("aria-label", count === 1 ? "1 participante" : `${count} participantes`);
  byId("participants-hint").textContent = isDrawn
    ? "Toque no seu nome para abrir seu resultado."
    : "Adicione quem vai participar da brincadeira.";
  byId("add-form").hidden = isDrawn;
  byId("empty").hidden = count !== 0;
  list.hidden = count === 0;
  list.replaceChildren(...state.names.map((name, index) => {
    const row = document.createElement("li");
    row.className = "participant-row";

    const avatar = document.createElement("span");
    avatar.className = "avatar";
    avatar.setAttribute("aria-hidden", "true");
    avatar.textContent = initials(name);

    const label = document.createElement("span");
    label.className = "participant-name";
    label.textContent = name;

    const action = document.createElement("button");
    action.type = "button";
    action.dataset.index = index;
    const icon = document.createElement("span");
    icon.dataset.icon = "";
    action.append(icon);
    if (isDrawn) {
      const seen = state.revealed.includes(index);
      action.className = seen ? "text-button row-action seen" : "text-button row-action";
      action.append(seen ? "Já visto" : "Ver resultado");
      action.setAttribute("aria-label", seen ? `Ver novamente o resultado de ${name}` : `Ver resultado de ${name}`);
      setIcon(icon, seen ? "check" : "lock");
    } else {
      action.className = "icon-button remove";
      action.setAttribute("aria-label", `Remover ${name}`);
      setIcon(icon, "trash");
    }
    row.append(avatar, label, action);
    return row;
  }));
  byId("before-draw").hidden = isDrawn;
  byId("after-draw").hidden = !isDrawn;
  byId("draw-title").textContent = isDrawn ? "Sorteio realizado" : "Sorteio";
  byId("draw-button").disabled = count < 2 || isDrawn;
  byId("draw-note").textContent = count < 2 ? "Mínimo de 2 participantes" : `${count} participantes prontos para o sorteio`;

  if (isDrawn) {
    const revealed = state.revealed.length;
    byId("draw-progress").textContent = revealed === count
      ? "Todos já viram o resultado."
      : `${revealed} de ${count} participantes já viram o resultado.`;
    const percentage = Math.round(revealed / count * 100);
    byId("progress").setAttribute("aria-valuenow", percentage);
    byId("progress-fill").style.width = percentage + "%";
  }
  byId("storage-warning").hidden = storageAvailable;
  document.querySelector(".footer").hidden = !storageAvailable;
}

function participantButton(index) {
  return list.querySelector(`button[data-index="${index}"]`);
}

function clearResult() {
  byId("secret-name").textContent = "";
  byId("secret-name").hidden = true;
  byId("reveal-button").hidden = false;
  byId("hide-button").hidden = true;
  byId("reveal-instruction").hidden = false;
}

byId("add-form").addEventListener("submit", event => {
  event.preventDefault();
  if (state.assignments) return;
  const message = addNames([nameInput.value]);
  setError(nameInput, "form-error", message);
  if (!message) nameInput.value = "";
  nameInput.focus();
});

nameInput.addEventListener("input", () => setError(nameInput, "form-error"));
bulkInput.addEventListener("input", () => setError(bulkInput, "bulk-error"));
byId("bulk-button").addEventListener("click", () => byId("bulk-dialog").showModal());
byId("help-button").addEventListener("click", () => byId("help-dialog").showModal());

byId("bulk-form").addEventListener("submit", event => {
  event.preventDefault();
  if (state.assignments) return;
  const message = addNames(bulkInput.value.split(/\r?\n/u));
  setError(bulkInput, "bulk-error", message);
  if (message) {
    bulkInput.focus();
    return;
  }
  bulkInput.value = "";
  byId("bulk-dialog").close();
  nameInput.focus();
});

byId("draw-button").addEventListener("click", () => {
  if (state.names.length < 2 || state.assignments) return;
  state.assignments = makeDraw(state.names.length);
  save();
  render();
  announce("Sorteio realizado. Cada participante pode revelar seu resultado.");
  participantButton(0)?.focus({preventScroll: true});
});

list.addEventListener("click", event => {
  const button = event.target.closest("button[data-index]");
  if (!button) return;
  const index = Number(button.dataset.index);
  if (state.assignments) {
    selectedPerson = index;
    clearResult();
    byId("reveal-title").textContent = state.names[index];
    revealDialog.showModal();
    byId("reveal-button").focus();
    return;
  }

  const [removed] = state.names.splice(index, 1);
  save();
  render();
  setError(nameInput, "form-error");
  announce(`${removed} foi removido da lista.`);
  (participantButton(index) ?? participantButton(index - 1) ?? nameInput).focus();
});

byId("reveal-button").addEventListener("click", () => {
  if (selectedPerson === null || !state.assignments || !revealDialog.open) return;
  const result = byId("secret-name");
  byId("reveal-title").textContent = "Seu amigo secreto é…";
  byId("reveal-instruction").hidden = true;
  result.textContent = state.names[state.assignments[selectedPerson]];
  result.hidden = false;
  result.setAttribute("role", "status");
  byId("reveal-button").hidden = true;
  byId("hide-button").hidden = false;
  byId("hide-button").focus();
  if (!state.revealed.includes(selectedPerson)) {
    state.revealed.push(selectedPerson);
    save();
  }
});

revealDialog.addEventListener("close", () => {
  if (revealDialog.open) return;
  const lastPerson = selectedPerson;
  selectedPerson = null;
  clearResult();
  render();
  if (!document.hidden) participantButton(lastPerson)?.focus({preventScroll: true});
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden && revealDialog.open) revealDialog.close();
});

byId("reset-button").addEventListener("click", () => byId("reset-dialog").showModal());
byId("confirm-reset").addEventListener("click", () => {
  state.assignments = null;
  state.revealed = [];
  save();
  byId("reset-dialog").close();
  render();
  announce("Sorteio desfeito. Os participantes continuam na lista.");
  byId("draw-button").focus();
});

document.querySelectorAll("[data-close]").forEach(button => {
  button.addEventListener("click", () => button.closest("dialog").close());
});

render();
