const BUILD_STEPS = [
  { key: 'cpu',         label: 'Процессор',          cat: 'cpu' },
  { key: 'motherboard', label: 'Материнская плата',  cat: 'motherboard' },
  { key: 'gpu',         label: 'Видеокарта',         cat: 'gpu' },
  { key: 'ram',         label: 'Оперативная память', cat: 'ram' },
  { key: 'storage',     label: 'Накопитель',         cat: 'storage' },
  { key: 'psu',         label: 'Блок питания',       cat: 'psu' },
  { key: 'case',        label: 'Корпус',             cat: 'case' },
  { key: 'cooler',      label: 'Охлаждение',         cat: 'cooler' }
];

let build = JSON.parse(localStorage.getItem('build') || '{}');
let currentStepKey = null;

function saveBuild() {
  localStorage.setItem('build', JSON.stringify(build));
}

function renderSteps() {
  const container = document.getElementById('builderSteps');
  container.innerHTML = BUILD_STEPS.map(step => {
    const product = build[step.key] ? PRODUCTS.find(p => p.id === build[step.key]) : null;
    return `
      <div class="builder-step ${product ? 'filled' : ''}">
        <div class="builder-step__info">
          <div class="builder-step__label">${step.label}</div>
          <div class="builder-step__name ${product ? '' : 'empty'}">
            ${product ? product.name : 'Не выбрано'}
          </div>
        </div>
        ${product ? `<div class="builder-step__price">${formatPrice(product.price)}</div>` : ''}
        <div class="builder-step__btns">
          <button class="btn btn--primary btn--sm" onclick="openModal('${step.key}')">
            ${product ? 'Заменить' : 'Выбрать'}
          </button>
          ${product ? `<button class="btn btn--danger btn--sm" onclick="removeStep('${step.key}')">×</button>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function openModal(key) {
  currentStepKey = key;
  const step = BUILD_STEPS.find(s => s.key === key);
  const products = PRODUCTS.filter(p => p.category === step.cat);

  document.getElementById('modalTitle').textContent = `Выбрать: ${step.label}`;
  document.getElementById('modalBody').innerHTML = products.map(p => `
    <div class="modal__item">
      <div class="modal__item-info">
        <div class="modal__item-title">${p.brand} — ${p.name}</div>
        <div class="modal__item-price">${formatPrice(p.price)}</div>
      </div>
      <button class="btn btn--primary btn--sm" onclick="selectProduct(${p.id})">Выбрать</button>
    </div>
  `).join('');

  document.getElementById('modalOverlay').classList.add('active');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('active');
}

function selectProduct(id) {
  build[currentStepKey] = id;
  saveBuild();
  closeModal();
  renderAll();
}

function removeStep(key) {
  delete build[key];
  saveBuild();
  renderAll();
}

function renderSummary() {
  const listEl = document.getElementById('summaryList');
  let total = 0;
  const rows = BUILD_STEPS.map(s => {
    const p = build[s.key] ? PRODUCTS.find(x => x.id === build[s.key]) : null;
    if (p) total += p.price;
    return `<div class="builder-summary__row">
      <span>${s.label}</span>
      <span>${p ? formatPrice(p.price) : '—'}</span>
    </div>`;
  }).join('');
  listEl.innerHTML = rows;
  document.getElementById('totalPrice').textContent = formatPrice(total);
}

// ==================== ПРОВЕРКА СОВМЕСТИМОСТИ ====================
function checkCompatibility() {
  const msg = document.getElementById('compatMsg');
  const errors = [];
  const warnings = [];

  const cpu = build.cpu ? PRODUCTS.find(p => p.id === build.cpu) : null;
  const mb  = build.motherboard ? PRODUCTS.find(p => p.id === build.motherboard) : null;
  const ram = build.ram ? PRODUCTS.find(p => p.id === build.ram) : null;
  const psu = build.psu ? PRODUCTS.find(p => p.id === build.psu) : null;
  const gpu = build.gpu ? PRODUCTS.find(p => p.id === build.gpu) : null;

  // Сокет CPU ↔ материнка
  if (cpu && mb && cpu.socket && mb.socket && cpu.socket !== mb.socket) {
    errors.push(`❌ Сокет процессора (${cpu.socket}) не совпадает с материнской платой (${mb.socket})`);
  }
  // Тип RAM ↔ материнка
  if (mb && ram) {
    const mbRamType = (mb.specs?.RAM || '').includes('DDR5') ? 'DDR5'
                    : (mb.specs?.RAM || '').includes('DDR4') ? 'DDR4' : null;
    if (mbRamType && ram.ramType && mbRamType !== ram.ramType) {
      errors.push(`❌ Материнская плата поддерживает ${mbRamType}, а память — ${ram.ramType}`);
    }
  }
  // Мощность БП
  if (psu && cpu && gpu) {
    const need = (cpu.tdp || 0) + (gpu.tdp || 0) + 150;
    if (psu.power && psu.power < need) {
      errors.push(`❌ Мощности БП (${psu.power} Вт) недостаточно. Рекомендуется от ${need} Вт`);
    } else if (psu.power && psu.power < need + 100) {
      warnings.push(`⚠️ БП близок к пределу (${psu.power} Вт). Рекомендуется запас +100 Вт`);
    }
  }

  if (errors.length) {
    msg.className = 'compat-error';
    msg.innerHTML = errors.join('<br>');
  } else if (warnings.length) {
    msg.className = 'compat-warning';
    msg.innerHTML = warnings.join('<br>');
  } else if (Object.keys(build).length >= 3) {
    msg.className = 'compat-ok';
    msg.innerHTML = '✅ Все выбранные комплектующие совместимы';
  } else {
    msg.className = '';
    msg.innerHTML = '';
  }
}

// ==================== РАСЧЁТ FPS ====================
function calculateFPS() {
  const cpuId = build.cpu;
  const gpuId = build.gpu;
  const ramId = build.ram;

  if (!cpuId || !gpuId || !ramId) return null;

  const gpuFactor = GPU_FPS_FACTOR[gpuId] || 1.0;
  const cpuFactor = CPU_FPS_FACTOR[cpuId] || 1.0;
  const ramFactor = RAM_FPS_FACTOR[ramId] || 1.0;

  const totalFactor = gpuFactor * cpuFactor * ramFactor;

  return GAMES.map(g => ({
    ...g,
    fps: Math.round(g.base * totalFactor)
  }));
}

// ==================== РЕНДЕР БЛОКА FPS ====================
function renderFPSBlock() {
  const container = document.getElementById('fpsBlock');
  if (!container) return;

  const fps = calculateFPS();

  if (!fps) {
    container.innerHTML = `
      <div style="padding:20px; text-align:center; color:#6e7681; font-size:13px; border:1px dashed #30363d; border-radius:10px; margin-top:15px;">
        Выберите процессор, видеокарту и ОЗУ, чтобы увидеть примерный FPS в играх
      </div>
    `;
    return;
  }

  const getColor = (fps) => {
    if (fps >= 144) return '#56d364';
    if (fps >= 60)  return '#e3b341';
    return '#ff7b72';
  };

  const getLabel = (fps) => {
    if (fps >= 144) return 'отлично';
    if (fps >= 60)  return 'играбельно';
    return 'слабо';
  };

  const rows = fps.map(g => `
    <div class="fps-row">
      <div class="fps-row__name">${g.icon} ${g.name}</div>
      <div class="fps-row__bar">
        <div class="fps-row__fill" style="width:${Math.min(g.fps / 3, 100)}%; background:${getColor(g.fps)};"></div>
      </div>
      <div class="fps-row__value" style="color:${getColor(g.fps)};">
        ${g.fps} FPS
        <span class="fps-row__label">${getLabel(g.fps)}</span>
      </div>
    </div>
  `).join('');

  container.innerHTML = `
    <h4 style="margin:20px 0 12px; color:#e6edf3; font-size:15px;">🎮 Производительность в играх</h4>
    <div class="fps-list">${rows}</div>
    <p style="font-size:11px; color:#6e7681; margin-top:12px; line-height:1.4;">
      * Расчёт приблизительный, на основе средних показателей CPU и GPU.
      FPS указан для разрешения 1080p, высокие настройки графики.
    </p>
  `;
}

function renderAll() {
  renderSteps();
  renderSummary();
  checkCompatibility();
  renderFPSBlock();
}

// ==================== ДОБАВИТЬ СБОРКУ В КОРЗИНУ ====================
document.getElementById('addBuildToCart').addEventListener('click', () => {
  const ids = Object.values(build);
  if (!ids.length) return showToast('Сборка пуста');
  ids.forEach(id => Cart.add(id));
  showToast(`✓ Добавлено ${ids.length} комплектующих`);
});

document.getElementById('clearBuild').addEventListener('click', () => {
  if (!confirm('Очистить сборку?')) return;
  build = {};
  saveBuild();
  renderAll();
});

document.getElementById('modalOverlay').addEventListener('click', e => {
  if (e.target.id === 'modalOverlay') closeModal();
});

// Инициализация
renderAll();