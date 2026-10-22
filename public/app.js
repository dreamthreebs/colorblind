import { TYPES, splitPages, embedMessage, extractMessage } from "./core.js";
import { makeArtwork, drawArtwork } from "./art.js";

const $ = (selector) => document.querySelector(selector),
  $$ = (selector) => [...document.querySelectorAll(selector)];
const state = {
  type: "deutan",
  view: "original",
  severity: 100,
  density: 1,
  seed: Math.floor(Math.random() * 2 ** 32),
  pages: [],
  page: 0,
  text: "",
  artwork: null,
  decoded: "",
};
let toastTimer, generationTimer;
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("show"), 3200);
}
function updateCount() {
  $("#count").textContent = `${$("#message").value.length} / 600`;
}
function draw() {
  if (!state.artwork) return;
  drawArtwork($("#art"), state.artwork, state.type, state.view, state.severity);
  $("#art").style.borderRadius = state.artwork.circular ? "50%" : "20px";
  $("#art").setAttribute(
    "aria-label",
    `第 ${state.page + 1} 张点彩密语，${TYPES[state.type].name}，${{ original: "原始色彩", simulation: "色觉模拟", reveal: "高对比揭晓" }[state.view]}`,
  );
  $("#pagination").hidden = state.pages.length <= 1;
  $("#page-label").textContent = `${state.page + 1} / ${state.pages.length} 张`;
  $("#prev").disabled = state.page === 0;
  $("#next").disabled = state.page === state.pages.length - 1;
  $("#simulation-settings").hidden = state.view !== "simulation";
  $("#preview-caption").textContent =
    state.view === "simulation"
      ? `${TYPES[state.type].name} · ${state.severity}% 模拟（近似）`
      : state.view === "reveal"
        ? "高对比揭晓，让每一种视角都能看见。"
        : "一眼看见，还是藏得刚刚好？";
  $("#export-note").textContent =
    `${state.pages.length > 1 ? "下载当前卡片 · " : "1000 × 1000 高清原图 · "}附带整段可读回文字`;
}
function generate({ newSeed = false, announce = false } = {}) {
  clearTimeout(generationTimer);
  if (!$("#message").value.trim()) {
    toast("先写一句想藏进颜色里的话吧。");
    $("#message").focus();
    return false;
  }
  state.text = $("#message").value.slice(0, 600);
  state.pages = splitPages(state.text);
  state.page = 0;
  if (newSeed) state.seed = Math.floor(Math.random() * 2 ** 32);
  state.artwork = makeArtwork(state.pages[0], state.density, state.seed);
  draw();
  if (announce)
    toast(
      state.pages.length > 1
        ? `密语已生成，共 ${state.pages.length} 张卡片。`
        : "你的密语，藏好了。",
    );
  return true;
}
$("#message").addEventListener("input", () => {
  updateCount();
  clearTimeout(generationTimer);
  generationTimer = setTimeout(() => {
    if ($("#message").value.trim()) generate();
  }, 500);
});
$("#generate").onclick = () => generate({ newSeed: true, announce: true });
$("#shuffle").onclick = () => {
  if (generate({ newSeed: true })) toast("同一句话，换一种圆点排列。");
};
$$("[data-message]").forEach(
  (b) =>
    (b.onclick = () => {
      $("#message").value = b.dataset.message;
      updateCount();
      generate({ newSeed: true });
    }),
);
const samples = [
  "好事发生",
  "偷偷喜欢你",
  "今晚吃火锅",
  "今天也要开心",
  "HELLO\nWORLD",
  "保持好奇",
  "你：在吗？\n我：一直都在。",
];
$("#sample").onclick = () => {
  const choices = samples.filter((s) => s !== $("#message").value);
  $("#message").value = choices[Math.floor(Math.random() * choices.length)];
  updateCount();
  generate({ newSeed: true });
};
$$("[data-type]").forEach(
  (b) =>
    (b.onclick = () => {
      state.type = b.dataset.type;
      $$("[data-type]").forEach((n) => {
        n.classList.toggle("selected", n === b);
        n.setAttribute("aria-pressed", String(n === b));
      });
      draw();
    }),
);
$$("[data-view]").forEach(
  (b) =>
    (b.onclick = () => {
      state.view = b.dataset.view;
      $$("[data-view]").forEach((n) => {
        n.classList.toggle("active", n === b);
        n.setAttribute("aria-pressed", String(n === b));
      });
      draw();
    }),
);
$("#density").oninput = () => {
  state.density = Number($("#density").value);
  $("#density-label").textContent = ["大颗粒", "细腻", "超细腻"][state.density];
  generate();
};
$("#severity").oninput = () => {
  state.severity = Number($("#severity").value);
  $("#severity-label").textContent = `${state.severity}%`;
  draw();
};
for (const [id, delta] of [
  ["prev", -1],
  ["next", 1],
])
  $("#" + id).onclick = () => {
    state.page += delta;
    state.artwork = makeArtwork(
      state.pages[state.page],
      state.density,
      state.seed + state.page,
    );
    draw();
  };
function switchTab(read) {
  $("#create-panel").hidden = read;
  $("#read-panel").hidden = !read;
  for (const id of ["create", "read"]) {
    const active = (id === "read") === read;
    $("#" + id + "-tab").setAttribute("aria-selected", String(active));
    $("#" + id + "-tab").tabIndex = active ? 0 : -1;
  }
}
$("#create-tab").onclick = () => switchTab(false);
$("#read-tab").onclick = () => switchTab(true);
$(".tabs").onkeydown = (e) => {
  if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
    e.preventDefault();
    const read =
      e.key === "Home"
        ? false
        : e.key === "End"
          ? true
          : $("#read-tab").getAttribute("aria-selected") !== "true";
    switchTab(read);
    $(read ? "#read-tab" : "#create-tab").focus();
  }
};
$("#download").onclick = async () => {
  if (!$("#message").value.trim()) {
    toast("请先输入文字并生成密语。");
    return;
  }
  if (state.text !== $("#message").value) generate();
  const button = $("#download");
  button.disabled = true;
  try {
    const payload = {
      text: state.text,
      type: state.type,
      page: state.page + 1,
      pages: state.pages.length,
    };
    // Always export original colors, regardless of the current simulation/reveal view.
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1000;
    drawArtwork(canvas, state.artwork, state.type, "original");
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
    if (!blob) throw new Error("图片生成失败，请重试。");
    const bytes = embedMessage(
      new Uint8Array(await blob.arrayBuffer()),
      payload,
    );
    const url = URL.createObjectURL(new Blob([bytes], { type: "image/png" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `color-whisper-${payload.type}-${payload.page}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    toast("原始彩色 PNG 已下载，附带可读回文字。");
  } catch (e) {
    toast(e.message);
  } finally {
    button.disabled = false;
  }
};
let readId = 0;
async function readFile(file) {
  if (!file) return;
  const requestId = ++readId;
  $("#read-result").hidden = true;
  $("#read-error").textContent = "";
  try {
    if (file.size > 20 * 1024 * 1024)
      throw new Error("文件超过 20 MB，请选择原始密语 PNG。");
    const payload = extractMessage(new Uint8Array(await file.arrayBuffer()));
    if (requestId !== readId) return;
    state.decoded = payload.text;
    $("#decoded").textContent = payload.text;
    $("#read-result").hidden = false;
    toast("找到藏在图片里的话了。");
  } catch (e) {
    if (requestId === readId) $("#read-error").textContent = e.message;
  }
}
$("#upload").onchange = (e) => {
  readFile(e.target.files[0]);
  e.target.value = "";
};
const upload = $(".upload");
for (const event of ["dragover", "dragenter"])
  upload.addEventListener(event, (e) => {
    e.preventDefault();
    upload.classList.add("dragging");
  });
for (const event of ["dragleave", "drop"])
  upload.addEventListener(event, (e) => {
    e.preventDefault();
    upload.classList.remove("dragging");
  });
upload.addEventListener("drop", (e) => readFile(e.dataTransfer.files[0]));
$("#use-decoded").onclick = () => {
  $("#message").value = state.decoded;
  updateCount();
  switchTab(false);
  generate({ newSeed: true, announce: true });
};
generate();
// If a web font arrives later, redraw the text mask using the final font metrics.
document.fonts.ready.then(() => generate());
