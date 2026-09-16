/**
 * Expense Tracker — app.js
 * Stack: Vanilla JS + Chart.js 4 + LocalStorage
 */

'use strict';

// ─── Constants ───────────────────────────────────────────────────────────────

const STORAGE_KEY = 'expense_tracker_transactions';

/** Category colours match CSS custom properties */
const CATEGORY_COLORS = {
  Food:      '#f97316',
  Transport: '#3b82f6',
  Fun:       '#a855f7',
};

// ─── State ───────────────────────────────────────────────────────────────────

/** @type {{ id: string, name: string, amount: number, category: string }[]} */
let transactions = loadFromStorage();

// ─── DOM References ──────────────────────────────────────────────────────────

const form          = document.getElementById('transaction-form');
const inputName     = document.getElementById('item-name');
const inputAmount   = document.getElementById('amount');
const selectCat     = document.getElementById('category');
const errorName     = document.getElementById('error-name');
const errorAmount   = document.getElementById('error-amount');
const errorCategory = document.getElementById('error-category');

const totalBalanceEl = document.getElementById('total-balance');
const transactionList = document.getElementById('transaction-list');
const emptyState      = document.getElementById('empty-state');
const countBadge      = document.getElementById('count-badge');

const chartCanvas = document.getElementById('spending-chart');
const chartEmpty  = document.getElementById('chart-empty');

// ─── Chart instance ──────────────────────────────────────────────────────────

let pieChart = null;

// ─── LocalStorage ────────────────────────────────────────────────────────────

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveToStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

// ─── Validation ──────────────────────────────────────────────────────────────

/**
 * Validates all form fields.
 * Returns true if valid, false otherwise.
 * Shows inline error messages and marks invalid fields.
 */
function validateForm() {
  let valid = true;

  // Reset previous errors
  clearFieldError(inputName,   errorName);
  clearFieldError(inputAmount, errorAmount);
  clearFieldError(selectCat,   errorCategory);

  const name   = inputName.value.trim();
  const amount = inputAmount.value.trim();
  const cat    = selectCat.value;

  if (!name) {
    setFieldError(inputName, errorName, 'Item name is required.');
    valid = false;
  }

  if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
    setFieldError(inputAmount, errorAmount, 'Enter a valid amount greater than 0.');
    valid = false;
  }

  if (!cat) {
    setFieldError(selectCat, errorCategory, 'Please select a category.');
    valid = false;
  }

  return valid;
}

function setFieldError(field, errorEl, message) {
  field.classList.add('invalid');
  errorEl.textContent = message;
}

function clearFieldError(field, errorEl) {
  field.classList.remove('invalid');
  errorEl.textContent = '';
}

// Clear error on user interaction
[inputName, inputAmount, selectCat].forEach(field => {
  field.addEventListener('input', () => {
    field.classList.remove('invalid');
  });
  field.addEventListener('change', () => {
    field.classList.remove('invalid');
  });
});

// ─── Add Transaction ─────────────────────────────────────────────────────────

function addTransaction(name, amount, category) {
  const transaction = {
    id:       crypto.randomUUID(),
    name:     name,
    amount:   parseFloat(amount),
    category: category,
  };
  transactions.push(transaction);
  saveToStorage();
  render();
}

// ─── Delete Transaction ──────────────────────────────────────────────────────

function deleteTransaction(id) {
  transactions = transactions.filter(t => t.id !== id);
  saveToStorage();
  render();
}

// ─── Calculations ─────────────────────────────────────────────────────────────

function calcTotal() {
  return transactions.reduce((sum, t) => sum + t.amount, 0);
}

/**
 * Returns totals grouped by category.
 * @returns {{ Food: number, Transport: number, Fun: number }}
 */
function calcByCategory() {
  return transactions.reduce((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + t.amount;
    return acc;
  }, {});
}

// ─── Render Helpers ──────────────────────────────────────────────────────────

function formatCurrency(value) {
  return '$' + value.toFixed(2);
}

// ─── Render Balance ──────────────────────────────────────────────────────────

function renderBalance() {
  totalBalanceEl.textContent = formatCurrency(calcTotal());
}

// ─── Render Transaction List ─────────────────────────────────────────────────

function renderList() {
  // Remove all items except the empty-state placeholder
  Array.from(transactionList.querySelectorAll('.transaction-item')).forEach(el => el.remove());

  if (transactions.length === 0) {
    emptyState.style.display = '';
    countBadge.textContent = '0';
    return;
  }

  emptyState.style.display = 'none';
  countBadge.textContent = transactions.length;

  // Render newest first
  [...transactions].reverse().forEach(t => {
    const li = document.createElement('li');
    li.className = 'transaction-item';
    li.dataset.id = t.id;

    li.innerHTML = `
      <span class="category-dot ${escapeHtml(t.category)}" aria-hidden="true"></span>
      <div class="item-info">
        <div class="item-name" title="${escapeHtml(t.name)}">${escapeHtml(t.name)}</div>
        <div class="item-category">${escapeHtml(t.category)}</div>
      </div>
      <span class="item-amount">-${formatCurrency(t.amount)}</span>
      <button
        class="btn-delete"
        aria-label="Delete ${escapeHtml(t.name)}"
        data-id="${escapeHtml(t.id)}"
        title="Delete"
      >✕</button>
    `;

    transactionList.appendChild(li);
  });
}

// ─── Render Chart ─────────────────────────────────────────────────────────────

function renderChart() {
  const byCategory = calcByCategory();
  const labels  = Object.keys(byCategory);
  const data    = Object.values(byCategory);
  const colors  = labels.map(l => CATEGORY_COLORS[l] || '#94a3b8');

  if (labels.length === 0) {
    chartCanvas.style.display = 'none';
    chartEmpty.style.display  = '';
    if (pieChart) {
      pieChart.destroy();
      pieChart = null;
    }
    return;
  }

  chartEmpty.style.display  = 'none';
  chartCanvas.style.display = '';

  if (pieChart) {
    // Update existing chart data in-place (smoother)
    pieChart.data.labels            = labels;
    pieChart.data.datasets[0].data  = data;
    pieChart.data.datasets[0].backgroundColor = colors;
    pieChart.update();
    return;
  }

  pieChart = new Chart(chartCanvas, {
    type: 'pie',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderColor:     '#ffffff',
        borderWidth:     3,
        hoverOffset:     10,
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            font:        { size: 13, family: "'Segoe UI', system-ui, sans-serif" },
            padding:     16,
            usePointStyle: true,
            pointStyleWidth: 10,
          },
        },
        tooltip: {
          callbacks: {
            label(ctx) {
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const pct   = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : 0;
              return ` ${ctx.label}: ${formatCurrency(ctx.parsed)} (${pct}%)`;
            },
          },
        },
      },
    },
  });
}

// ─── Master Render ────────────────────────────────────────────────────────────

function render() {
  renderBalance();
  renderList();
  renderChart();
}

// ─── Utility: XSS-safe escaping ──────────────────────────────────────────────

function escapeHtml(str) {
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;');
}

// ─── Event Listeners ─────────────────────────────────────────────────────────

// Form submit
form.addEventListener('submit', (e) => {
  e.preventDefault();

  if (!validateForm()) return;

  addTransaction(
    inputName.value.trim(),
    inputAmount.value.trim(),
    selectCat.value,
  );

  // Reset form
  form.reset();
  clearFieldError(inputName,   errorName);
  clearFieldError(inputAmount, errorAmount);
  clearFieldError(selectCat,   errorCategory);

  // Focus name field for quick successive entries
  inputName.focus();
});

// Delete via event delegation on the list
transactionList.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-delete');
  if (!btn) return;
  deleteTransaction(btn.dataset.id);
});

// ─── Init ─────────────────────────────────────────────────────────────────────

render();
