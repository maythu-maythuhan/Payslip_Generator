/* =====================================================
   Enterprise Payslip Generator — app.js
   Phase 1: UI Foundation + Global Settings
   ===================================================== */

'use strict';

/* ─── State ──────────────────────────────────────────── */
const STATE = {
  currentPage: 'dashboard',
  sidebarCollapsed: false,
  globalSettings: {
    transportAllowance: '',
    employerName: 'Myanmar Heineken International',
    defaultBranch: 'Yangon HQ',
    taxYearLabel: '2026-2027',
    pdfFooterText: 'Powered by Microimage',
    departmentOptions: 'Finance,HR,IT,Operations,Sales,Marketing,Legal',
    designationOptions: 'Manager,Senior Executive,Executive,Officer,Assistant',
    settingsHistory: [],
  },
  employees: [],
  payslipDraft: {},
  currentEmployeeEdit: null,
  pitAdjustmentRules: [],
  pitRuleEditId: undefined,   // undefined=form hidden, null=add-new, string=editing

  /* Monthly payroll records — keyed "YYYY-M" → { [empId]: { basicSalary, phoneAllowance } } */
  payrollRecords: {},

  /* Master data — source of truth for dropdowns */
  masterData: {
    departments:  [],   // [{ id, name, createdAt }]
    designations: [],
    branches:     [],
  },
  masterDataActiveTab: 'departments',

  /* User management */
  users: [
    {
      id:          'usr_admin_001',
      displayName: 'HR Admin',
      username:    'admin',
      email:       '',
      role:        'admin',         // admin | hr_user
      isActive:    true,
      createdAt:   new Date().toISOString(),
      createdBy:   'system',
    }
  ],
};

/* ─── Persist helpers ────────────────────────────────── */
function saveState() {
  localStorage.setItem('payslip_app_state', JSON.stringify({
    globalSettings:     STATE.globalSettings,
    employees:          STATE.employees,
    payslipDraft:       STATE.payslipDraft,
    pitAdjustmentRules: STATE.pitAdjustmentRules,
    masterData:         STATE.masterData,
    users:              STATE.users,
    payrollRecords:     STATE.payrollRecords,
  }));
}

function loadState() {
  try {
    const saved = localStorage.getItem('payslip_app_state');
    if (saved) {
      const parsed = JSON.parse(saved);
      Object.assign(STATE.globalSettings, parsed.globalSettings || {});
      STATE.employees          = parsed.employees          || [];
      STATE.payslipDraft       = parsed.payslipDraft       || {};
      STATE.pitAdjustmentRules = parsed.pitAdjustmentRules || [];
      STATE.users              = parsed.users              || STATE.users;
      STATE.payrollRecords     = parsed.payrollRecords     || {};

      /* Load master data */
      if (parsed.masterData) {
        STATE.masterData.departments  = parsed.masterData.departments  || [];
        STATE.masterData.designations = parsed.masterData.designations || [];
        STATE.masterData.branches     = parsed.masterData.branches     || [];
      }

      /* One-time migration: seed master data from globalSettings comma-lists */
      const gs = STATE.globalSettings;
      if (!STATE.masterData.departments.length && gs.departmentOptions) {
        STATE.masterData.departments = gs.departmentOptions.split(',')
          .map(s => s.trim()).filter(Boolean)
          .map(name => ({ id: mdId('dept'), name, createdAt: new Date().toISOString() }));
      }
      if (!STATE.masterData.designations.length && gs.designationOptions) {
        STATE.masterData.designations = gs.designationOptions.split(',')
          .map(s => s.trim()).filter(Boolean)
          .map(name => ({ id: mdId('desig'), name, createdAt: new Date().toISOString() }));
      }
      if (!STATE.masterData.branches.length && gs.defaultBranch) {
        STATE.masterData.branches = [{ id: mdId('branch'), name: gs.defaultBranch, createdAt: new Date().toISOString() }];
      }
    }
  } catch (e) {
    console.warn('Failed to load saved state', e);
  }
}

/* ─── Master Data helpers ────────────────────────────── */
function mdId(prefix) {
  return prefix + '_' + Math.random().toString(36).slice(2, 9);
}

/* Returns name-array for a master data type, falling back to globalSettings if empty */
function getMDList(type) {
  if (STATE.masterData[type] && STATE.masterData[type].length) {
    return STATE.masterData[type].map(i => i.name);
  }
  /* legacy fallbacks */
  if (type === 'departments')  return (STATE.globalSettings.departmentOptions  || '').split(',').map(s => s.trim()).filter(Boolean);
  if (type === 'designations') return (STATE.globalSettings.designationOptions || '').split(',').map(s => s.trim()).filter(Boolean);
  if (type === 'branches')     return STATE.globalSettings.defaultBranch ? [STATE.globalSettings.defaultBranch] : [];
  return [];
}

/* ─── Toast ──────────────────────────────────────────── */
function showToast(msg, type = 'success', duration = 3000) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const icons = {
    success: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    error:   `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    warning: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    info:    `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
  };

  toast.innerHTML = `${icons[type] || icons.info}<span>${msg}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 280);
  }, duration);
}

/* ─── Navigation ─────────────────────────────────────── */
function navigate(page) {
  STATE.currentPage = page;

  // Update nav items
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });

  // Update topbar title
  const pageMeta = {
    dashboard:       { title: 'Dashboard',             sub: 'Overview & Quick Actions' },
    settings:        { title: 'Global Settings',       sub: 'Transport Allowance & Employer Defaults' },
    employees:       { title: 'Employee Master Data',  sub: 'Manage Employee Profiles' },
    'new-employee':  { title: 'New Employee',          sub: 'Create Employee Profile' },
    'edit-employee': { title: 'Edit Employee',         sub: 'Update Employee Profile' },
    payslip:         { title: 'Payslip Generator',     sub: 'Monthly Payslip Input' },
    'payslip-draft': { title: 'Payslip Draft Saved',   sub: '' },
    rules:              { title: 'Rule Engine',           sub: 'PIT Brackets, SSB & Relief Configuration' },
    'pit-rules':        { title: 'PIT Adjustment Rules',  sub: 'Configurable PIT Adjustment Layer' },
    'import-employees': { title: 'Import Employees',      sub: 'Bulk Upload via CSV or Excel' },
    'monthly-payroll':  { title: 'Monthly Payroll Run',   sub: 'Pre-fill from last month, bulk review & generate' },
    'master-data':      { title: 'Master Data',           sub: 'Departments · Designations · Branches' },
    'roles-access':     { title: 'Roles & Access',        sub: 'User Management & Permissions' },
  };

  const meta = pageMeta[page] || { title: page, sub: '' };
  document.getElementById('topbar-page-title').textContent = meta.title;
  document.getElementById('topbar-page-sub').textContent   = meta.sub;

  // Render page
  const container = document.getElementById('page-container');
  container.innerHTML = '';
  container.scrollTop = 0;

  const renderers = {
    dashboard:       renderDashboard,
    settings:        renderSettings,
    employees:       renderEmployees,
    'new-employee':  renderNewEmployee,
    'edit-employee': renderEditEmployee,
    payslip:         renderPayslip,
    rules:              renderRuleEngine,
    'pit-rules':        renderPITAdjustmentAdmin,
    'import-employees': renderImportEmployees,
    'monthly-payroll':  renderMonthlyPayroll,
    'master-data':      renderMasterData,
    'roles-access':     renderRolesAccess,
  };

  if (renderers[page]) {
    renderers[page](container);
  }

  // Wrap in page-view for animation
  container.firstElementChild && container.firstElementChild.classList.add('page-view');
}

/* ─── Sidebar Toggle ─────────────────────────────────── */
function toggleSidebar() {
  STATE.sidebarCollapsed = !STATE.sidebarCollapsed;
  const sidebar = document.getElementById('sidebar');
  const main    = document.getElementById('main-content');
  const btn     = document.getElementById('sidebar-collapse-btn');

  sidebar.classList.toggle('collapsed', STATE.sidebarCollapsed);
  main.classList.toggle('sidebar-collapsed', STATE.sidebarCollapsed);

  btn.innerHTML = STATE.sidebarCollapsed
    ? iconSvg('chevrons-right', 18)
    : iconSvg('chevrons-left', 18);
}

/* ─── SVG Icon helper (Lucide-compatible paths) ───────── */
function iconSvg(name, size = 16) {
  const icons = {
    'layout-dashboard': `<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>`,
    'settings':         `<circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>`,
    'users':            `<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>`,
    'file-text':        `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>`,
    'shield':           `<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>`,
    'chevrons-left':    `<polyline points="11 17 6 12 11 7"/><polyline points="18 17 13 12 18 7"/>`,
    'chevrons-right':   `<polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/>`,
    'plus':             `<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>`,
    'search':           `<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>`,
    'download':         `<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>`,
    'edit':             `<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>`,
    'trash':            `<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>`,
    'eye':              `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`,
    'check':            `<polyline points="20 6 9 17 4 12"/>`,
    'alert-circle':     `<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>`,
    'info':             `<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>`,
    'save':             `<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>`,
    'refresh-cw':       `<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>`,
    'briefcase':        `<rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>`,
    'clock':            `<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>`,
    'arrow-right':      `<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>`,
    'x':                `<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>`,
    'star':             `<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>`,
    'truck':            `<rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>`,
    'building':         `<rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="12" y1="6" x2="12.01" y2="6"/><line x1="12" y1="10" x2="12.01" y2="10"/><line x1="12" y1="14" x2="12.01" y2="14"/><line x1="12" y1="18" x2="12.01" y2="18"/>`,
    'user-plus':        `<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>`,
    'sliders':          `<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>`,
    'log-out':          `<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>`,
    'chevron-right':    `<polyline points="9 18 15 12 9 6"/>`,
    'history':          `<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.08"/>`,
    'lock':             `<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>`,
    'upload':           `<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>`,
    'upload-cloud':     `<polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>`,
    'file-check':       `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><polyline points="9 15 11 17 15 13"/>`,
    'alert-triangle':   `<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>`,
    'table':            `<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>`,
  };

  const path = icons[name] || '';
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
}

/* ─── Formatters ──────────────────────────────────────── */
function fmtCurrency(val) {
  if (val === '' || val == null || isNaN(Number(val))) return '—';
  return Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function monthName(num) {
  return ['January','February','March','April','May','June','July','August','September','October','November','December'][num - 1] || '';
}

/* Strip commas → Number (safe for formatted text inputs) */
function parseCurrencyInput(val) {
  return Number(String(val || '').replace(/,/g, '')) || 0;
}

/* Trigger a file download from a Blob */
function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Parse CSV text → array of plain objects (key = header, value = cell).
 * Handles quoted fields, commas inside quotes, escaped double-quotes, BOM.
 */
function parseCSVContent(text) {
  const clean = text.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = clean.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];

  function parseRow(line) {
    const cells = [];
    let cell = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') { cell += '"'; i++; }
        else inQ = !inQ;
      } else if (ch === ',' && !inQ) {
        cells.push(cell.trim()); cell = '';
      } else {
        cell += ch;
      }
    }
    cells.push(cell.trim());
    return cells;
  }

  const headers = parseRow(lines[0]);
  return lines.slice(1)
    .filter(l => l.trim() && l.replace(/,/g, '').trim())   // skip blank rows
    .map(line => {
      const vals = parseRow(line);
      const obj  = {};
      headers.forEach((h, i) => { obj[h.trim()] = vals[i] !== undefined ? vals[i] : ''; });
      return obj;
    });
}

/* Format a text input's value with thousand separators as the user types */
function formatInputCommas(el) {
  const pos  = el.selectionStart;
  const prev = el.value;
  const raw  = prev.replace(/[^\d]/g, '');
  if (!raw) { el.value = ''; return; }
  const formatted = parseInt(raw, 10).toLocaleString('en-US');
  el.value = formatted;
  // Restore cursor accounting for added commas
  const diff = formatted.length - prev.length;
  try { el.setSelectionRange(pos + diff, pos + diff); } catch (_) {}
}

/* ─── UUID helper ────────────────────────────────────── */
function uuid() {
  return 'emp_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/* ═══════════════════════════════════════════════════════
   PIT ADJUSTMENT LAYER
   Sits after PIT base calc, before final deduction.
   Formula: PIT_FINAL = MAX(PIT_BASE - ADJUSTMENT, 0)
═══════════════════════════════════════════════════════ */

/**
 * Safely evaluate a FORMULA-type adjustment expression.
 * Available variables: pitBase, basicSalary, totalEarnings, annualTaxableIncome
 */
function evaluatePITFormula(formula, vars) {
  try {
    const fn = new Function(
      'pitBase', 'basicSalary', 'totalEarnings', 'annualTaxableIncome',
      '"use strict"; return (' + formula + ');'
    );
    const result = fn(vars.pitBase, vars.basicSalary, vars.totalEarnings, vars.annualTaxableIncome);
    return (typeof result === 'number' && isFinite(result)) ? result : 0;
  } catch (e) {
    console.warn('[PIT Formula] Evaluation error:', e.message);
    return 0;
  }
}

/**
 * Select the highest-priority active adjustment rule that matches
 * the given basicSalary and payroll period (YYYY-MM).
 * Returns null if no rule qualifies.
 */
function getApplicableAdjustmentRule(basicSalary, payMonth, payYear) {
  const period  = `${payYear}-${String(payMonth).padStart(2, '0')}`;
  const salary  = Number(basicSalary) || 0;

  const matches = (STATE.pitAdjustmentRules || []).filter(r => {
    if (!r.isActive) return false;
    const lo = r.minSalary !== '' && r.minSalary != null ? Number(r.minSalary) : 0;
    const hi = r.maxSalary !== '' && r.maxSalary != null ? Number(r.maxSalary) : Infinity;
    if (salary < lo || salary > hi) return false;
    if (r.effectiveFrom && period < r.effectiveFrom) return false;
    if (r.effectiveTo   && period > r.effectiveTo)   return false;
    return true;
  });

  if (!matches.length) return null;
  matches.sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0));
  return matches[0];
}

/**
 * Apply a PIT adjustment rule to the calculated PIT base.
 * Returns a full audit object regardless of whether a rule was found.
 */
function applyPITAdjustment(pitBase, rule, calcContext) {
  if (!rule) {
    return {
      pitBase,
      adjustmentApplied: 0,
      adjustmentType:    'NONE',
      ruleUsed:          '—',
      ruleId:            null,
      pitFinal:          pitBase,
      hasAdjustment:     false,
    };
  }

  const val = Number(rule.value) || 0;
  let adjustment = 0;

  switch (rule.ruleType) {
    case 'FIXED':
      adjustment = val;
      break;
    case 'PERCENTAGE':
      adjustment = pitBase * (val / 100);
      break;
    case 'TARGET':
      adjustment = pitBase - val;
      break;
    case 'FORMULA':
      adjustment = evaluatePITFormula(rule.value, calcContext);
      break;
    default:
      adjustment = 0;
  }

  const pitFinal = Math.max(pitBase - adjustment, 0);

  return {
    pitBase,
    adjustmentApplied: adjustment,
    adjustmentType:    rule.ruleType,
    ruleUsed:          rule.ruleName,
    ruleId:            rule.ruleId,
    pitFinal,
    hasAdjustment:     true,
  };
}

/* ═══════════════════════════════════════════════════════
   PHASE 2 — CALCULATION ENGINE
   Myanmar PIT & SSB rules (configurable via RULE_SET)
═══════════════════════════════════════════════════════ */
const RULE_SET = {
  name:       'Myanmar Payroll 2026-2027',
  effectiveFrom: '2026-04',
  status:     'Active',
  currency:   'MMK',
  pitMethod:  'ANNUALIZED_MONTHLY',
  ssb: {
    employeeRate:        0.02,
    employerRate:        0.03,
    monthlyWageCap:      300000,
    maxEmployeeSSB:      6000,
    maxEmployerSSB:      9000,
  },
  pit: {
    personalReliefRate:  0.20,
    personalReliefCap:   10000000,
    brackets: [
      { lower: 0,          upper: 2000000,   rate: 0    },
      { lower: 2000000,    upper: 10000000,  rate: 0.05 },
      { lower: 10000000,   upper: 30000000,  rate: 0.10 },
      { lower: 30000000,   upper: 50000000,  rate: 0.15 },
      { lower: 50000000,   upper: 70000000,  rate: 0.20 },
      { lower: 70000000,   upper: null,      rate: 0.25 },
    ],
  },
  earningComponents: [
    { name: 'Basic Salary',              isTaxablePIT: true, isSSBBase: true  },
    { name: 'Transportation Allowance',  isTaxablePIT: true, isSSBBase: true  },
    { name: 'Phone Allowance',           isTaxablePIT: true, isSSBBase: true  },
  ],
};

/**
 * Full payslip calculation — 5-step flow:
 *   1. Earnings
 *   2. SSB
 *   3. PIT Base (annualized progressive brackets)
 *   4. PIT Adjustment Layer  ← configurable rule
 *   5. Net Pay
 *
 * payMonth / payYear are used to select the right adjustment rule.
 * Defaults to current calendar month/year when not supplied.
 */
function calculatePayslip(basicSalary, transportAllowance, phoneAllowance, payMonth, payYear) {
  const basic     = Number(basicSalary)        || 0;
  const transport = Number(transportAllowance) || 0;
  const phone     = Number(phoneAllowance)     || 0;
  const mth       = Number(payMonth)  || (new Date().getMonth() + 1);
  const yr        = Number(payYear)   || new Date().getFullYear();

  /* ── Step 1: Earnings ── */
  const totalEarnings = basic + transport + phone;

  /* ── Step 2: SSB ── */
  const ssbWageBase = Math.min(totalEarnings, RULE_SET.ssb.monthlyWageCap);
  const monthlySSB  = Math.min(
    ssbWageBase * RULE_SET.ssb.employeeRate,
    RULE_SET.ssb.maxEmployeeSSB
  );

  /* ── Step 3: PIT Base (annualized monthly) ── */
  const annualGross         = totalEarnings * 12;
  const personalRelief      = Math.min(
    annualGross * RULE_SET.pit.personalReliefRate,
    RULE_SET.pit.personalReliefCap
  );
  const annualSSBDeduction  = monthlySSB * 12;
  const annualTaxableIncome = Math.max(0, annualGross - personalRelief - annualSSBDeduction);

  let annualPIT = 0;
  for (const b of RULE_SET.pit.brackets) {
    if (annualTaxableIncome <= b.lower) break;
    const cap = b.upper === null ? annualTaxableIncome : Math.min(annualTaxableIncome, b.upper);
    annualPIT += (cap - b.lower) * b.rate;
  }
  const monthlyPITBase = annualPIT / 12;

  /* ── Step 4: PIT Adjustment Layer ── */
  const adjRule  = getApplicableAdjustmentRule(basic, mth, yr);
  const pitAudit = applyPITAdjustment(monthlyPITBase, adjRule, {
    pitBase:            monthlyPITBase,
    basicSalary:        basic,
    totalEarnings,
    annualTaxableIncome,
  });

  /* ── Step 5: Net Pay ── */
  const monthlyPIT      = pitAudit.pitFinal;          // final PIT used everywhere
  const totalDeductions = monthlyPIT + monthlySSB;
  const netPay          = totalEarnings - totalDeductions;

  return {
    /* Inputs */
    basic, transport, phone,
    /* Earnings */
    totalEarnings,
    /* SSB */
    monthlySSB,
    /* PIT audit trail */
    annualGross,
    personalRelief,
    annualSSBDeduction,
    annualTaxableIncome,
    annualPIT,
    monthlyPITBase,                       // pre-adjustment
    pitAdjustmentApplied: pitAudit.adjustmentApplied,
    pitAdjustmentType:    pitAudit.adjustmentType,
    pitRuleUsed:          pitAudit.ruleUsed,
    pitRuleId:            pitAudit.ruleId,
    hasAdjustment:        pitAudit.hasAdjustment,
    pitFinal:             pitAudit.pitFinal,
    /* Final figures */
    monthlyPIT,                           // = pitFinal (used by display/PDF)
    totalDeductions,
    netPay,
  };
}

/* ─── Live Calculation Preview HTML ─────────────────── */
/* payMonth + payYear are needed for adjustment-rule lookup */
function liveCalcHtml(basic, transport, phone, payMonth, payYear) {
  if (!basic && !transport && !phone) {
    return `
    <div class="alert alert-info">
      <div>${iconSvg('info', 16)}</div>
      <div>Enter Basic Salary above to see a live deduction preview.</div>
    </div>`;
  }
  const c = calculatePayslip(basic, transport, phone, payMonth, payYear);

  /* Build PIT rows — show base → adjustment → final when a rule fires */
  const pitRows = c.hasAdjustment ? `
      <div class="calc-row deduct" style="opacity:.75">
        <span class="calc-row-label">PIT Base</span>
        <span class="calc-row-value">MMK ${fmtCurrency(c.monthlyPITBase)}</span>
      </div>
      <div class="calc-row" style="padding-left:var(--sp-lg);font-size:var(--font-size-xs)">
        <span style="color:var(--clr-accent)">
          ${iconSvg('arrow-right', 11)}
          Adj. <em>${c.pitRuleUsed}</em> (${c.pitAdjustmentType})
        </span>
        <span style="color:var(--clr-accent);font-weight:600">
          &minus; MMK ${fmtCurrency(c.pitAdjustmentApplied)}
        </span>
      </div>
      <div class="calc-row deduct">
        <span class="calc-row-label" style="font-weight:700">NET PIT Final</span>
        <span class="calc-row-value">MMK ${fmtCurrency(c.pitFinal)}</span>
      </div>` : `
      <div class="calc-row deduct">
        <span class="calc-row-label">NET PIT (Monthly)</span>
        <span class="calc-row-value">MMK ${fmtCurrency(c.monthlyPIT)}</span>
      </div>`;

  return `
  <div class="calc-preview-panel">
    <div class="calc-preview-header">
      ${iconSvg('lock', 13)} System-Calculated Deductions
      ${c.hasAdjustment ? `<span style="margin-left:auto;background:rgba(255,255,255,.2);padding:2px 8px;border-radius:var(--radius-full);font-size:10px">PIT Adj. Active</span>` : ''}
    </div>
    <div class="calc-preview-body">
      <div class="calc-row">
        <span class="calc-row-label">Basic Salary</span>
        <span class="calc-row-value">MMK ${fmtCurrency(c.basic)}</span>
      </div>
      <div class="calc-row">
        <span class="calc-row-label">Transportation Allowance</span>
        <span class="calc-row-value">MMK ${fmtCurrency(c.transport)}</span>
      </div>
      <div class="calc-row">
        <span class="calc-row-label">Phone Allowance</span>
        <span class="calc-row-value">MMK ${fmtCurrency(c.phone)}</span>
      </div>
      <div class="calc-row total">
        <span class="calc-row-label">Total Earnings</span>
        <span class="calc-row-value">MMK ${fmtCurrency(c.totalEarnings)}</span>
      </div>
      <div style="height:var(--sp-sm)"></div>
      ${pitRows}
      <div class="calc-row deduct">
        <span class="calc-row-label">SSB Employee (2%)</span>
        <span class="calc-row-value">MMK ${fmtCurrency(c.monthlySSB)}</span>
      </div>
      <div class="calc-row deduct total">
        <span class="calc-row-label">Total Deductions</span>
        <span class="calc-row-value">MMK ${fmtCurrency(c.totalDeductions)}</span>
      </div>
      <div class="calc-row net">
        <span>NET PAY</span>
        <span class="calc-row-value">MMK ${fmtCurrency(c.netPay)}</span>
      </div>
      <details style="margin-top:var(--sp-sm)">
        <summary style="font-size:var(--font-size-xs);color:var(--clr-text-muted);cursor:pointer;user-select:none">
          View full PIT calculation steps
        </summary>
        <div style="margin-top:var(--sp-sm);background:var(--clr-surface-2);border-radius:var(--radius-sm);padding:var(--sp-md);font-size:var(--font-size-xs);line-height:2;color:var(--clr-text-secondary);">
          Annual Gross: <strong>MMK ${fmtCurrency(c.annualGross)}</strong><br>
          Personal Relief (20%, cap 10M): <strong>MMK ${fmtCurrency(c.personalRelief)}</strong><br>
          Annual SSB Deduction: <strong>MMK ${fmtCurrency(c.annualSSBDeduction)}</strong><br>
          Annual Taxable Income: <strong>MMK ${fmtCurrency(c.annualTaxableIncome)}</strong><br>
          Annual PIT: <strong>MMK ${fmtCurrency(c.annualPIT)}</strong><br>
          Monthly PIT Base (÷12): <strong>MMK ${fmtCurrency(c.monthlyPITBase)}</strong><br>
          ${c.hasAdjustment
            ? `PIT Adjustment (<em>${c.pitRuleUsed}</em>, ${c.pitAdjustmentType}): <strong style="color:var(--clr-accent)">− MMK ${fmtCurrency(c.pitAdjustmentApplied)}</strong><br>
               PIT Final: <strong>MMK ${fmtCurrency(c.pitFinal)}</strong>`
            : `No adjustment rule applied.`}
        </div>
      </details>
    </div>
  </div>`;
}

/* ═══════════════════════════════════════════════════════
   PHASE 3 — PDF EXPORT
   Layout is pixel-matched to the reference payslip format.
   All three tables (Earnings / Deductions / Net Pay) share
   identical col widths via table-layout:fixed so the vertical
   column divider falls at exactly the same position.
═══════════════════════════════════════════════════════ */
const PAYSLIP_PRINT_CSS = `
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,'Helvetica Neue',sans-serif;color:#111;background:#fff}
    .pg{width:186mm;margin:0 auto;padding:0}

    /* ── Header band ── */
    .hdr{background:#005200;padding:13px 24px;text-align:center}
    .hdr-co{color:rgba(255,255,255,.72);font-size:9pt;font-weight:600;letter-spacing:.11em;text-transform:uppercase}
    .hdr-title{color:#fff;font-size:12pt;font-weight:800;margin-top:4px}

    /* ── Body padding ── */
    .body{padding:16px 24px 20px}

    /* ── Employee info ── */
    .et{width:100%;border-collapse:collapse;font-size:9.5pt;border-bottom:1px solid #ccc;padding-bottom:12px;margin-bottom:0}
    .et td{padding:2.5px 4px;vertical-align:top}
    .el{color:#555;width:115px;white-space:nowrap}
    .ev{font-weight:600;padding-right:16px}

    /* ── Section label ── */
    .sl{font-size:9.5pt;font-weight:700;margin:13px 0 3px;color:#111}

    /*
     * ps = "payslip section table"
     * ALL THREE tables use this class + identical <col> widths
     * so the vertical divider lands at exactly the same pixel.
     */
    .ps{width:100%;border-collapse:collapse;border:1px solid #555;table-layout:fixed}
    .ps col.d{width:68%}
    .ps col.a{width:32%}
    .ps thead th{padding:5px 10px;font-size:9.5pt;font-weight:700;border-bottom:1px solid #555;text-align:left}
    .ps thead th.a{text-align:right;border-left:1px solid #555}
    .ps tbody td{padding:5px 10px;font-size:10pt;border-bottom:1px solid #ddd}
    .ps tbody td.a{text-align:right;border-left:1px solid #555}
    .ps tbody tr:last-child td{border-bottom:none}
    .ps .tot td{font-weight:700;border-top:2px solid #555;border-bottom:none}
    .ps .tot td.d{text-align:right}

    /* ── Net Pay table (no header row) ── */
    .ps-net{margin-top:12px}
    .ps-net .ps tbody td{padding:8px 10px;font-size:11pt;font-weight:700}

    /* ── Salary original ── */
    .so{font-size:9pt;color:#888;font-style:italic;padding:5px 0 2px;display:flex;gap:40px}

    /* ── Footer ── */
    .ft{text-align:center;font-size:8pt;color:#aaa;padding-top:8px;border-top:1px solid #eee;margin-top:12px}

    @page{size:A4 portrait;margin:15mm}
    @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
`;

/* Builds a single payslip page block (.pg). Reused by single + bulk print. */
function payslipPageHTML(emp, basicSalary, phoneAllowance, month, year) {
  const gs     = STATE.globalSettings;
  const calc   = calculatePayslip(basicSalary, gs.transportAllowance, phoneAllowance, month, year);
  const mLabel = (monthName(month || new Date().getMonth() + 1) || '').toUpperCase();
  const yr     = year || new Date().getFullYear();

  return `
<div class="pg">

  <div class="hdr">
    <div class="hdr-co">${gs.employerName || ''}</div>
    <div class="hdr-title">REMUNERATION STATEMENT FOR THE MONTH OF ${mLabel} ${yr}</div>
  </div>

  <div class="body">

    <!-- Employee information block -->
    <table class="et">
      <tr>
        <td class="el">Employee Name:</td><td class="ev">${emp ? emp.name : '—'}</td>
        <td class="el">Employee No:</td><td class="ev">${emp ? (emp.employeeNo || '—') : '—'}</td>
      </tr>
      <tr>
        <td class="el">Employer Name:</td><td class="ev">${emp ? (emp.employerName || gs.employerName || '—') : (gs.employerName || '—')}</td>
        <td class="el">Branch:</td><td class="ev">${emp ? (emp.branch || gs.defaultBranch || '—') : (gs.defaultBranch || '—')}</td>
      </tr>
      <tr>
        <td class="el">Designation:</td><td class="ev">${emp ? (emp.designation || '—') : '—'}</td>
        <td class="el">Department:</td><td class="ev">${emp ? (emp.department || '—') : '—'}</td>
      </tr>
      <tr>
        <td class="el">NRC:</td><td class="ev">${emp ? (emp.nrc || '—') : '—'}</td>
        <td class="el">Join Date:</td><td class="ev">${emp ? fmtDate(emp.joinDate) : '—'}</td>
      </tr>
      <tr>
        <td class="el">Pay Period:</td><td class="ev">${monthName(month || 1)}</td>
        <td class="el">Pay Year:</td><td class="ev">${gs.taxYearLabel || yr}</td>
      </tr>
      <tr>
        <td class="el">SSB Card No:</td><td class="ev">${emp ? (emp.ssbCardNo || '—') : '—'}</td>
        <td class="el">Bank AC Number:</td><td class="ev">${emp ? (emp.bankAccountNo || '—') : '—'}</td>
      </tr>
    </table>

    <!-- EARNINGS -->
    <div class="sl">Earnings</div>
    <table class="ps">
      <col class="d"><col class="a">
      <thead><tr><th>Description</th><th class="a">Amount</th></tr></thead>
      <tbody>
        <tr><td class="d">BASIC SALARY</td><td class="a">${fmtCurrency(calc.basic)}</td></tr>
        <tr><td class="d">TRANSPORTATION ALLOWANCE</td><td class="a">${fmtCurrency(calc.transport)}</td></tr>
        <tr><td class="d">PHONE ALLOWANCE(AIR CHARGES)</td><td class="a">${fmtCurrency(calc.phone)}</td></tr>
        <tr class="tot"><td class="d">TOTAL</td><td class="a">${fmtCurrency(calc.totalEarnings)}</td></tr>
      </tbody>
    </table>

    <!-- DEDUCTIONS -->
    <div class="sl">Deductions</div>
    <table class="ps">
      <col class="d"><col class="a">
      <thead><tr><th>Description</th><th class="a">Amount</th></tr></thead>
      <tbody>
        <tr>
          <td class="d">NET PIT${calc.hasAdjustment ? '<span style="font-size:7.5pt;color:#999;font-style:italic"> *adj.</span>' : ''}</td>
          <td class="a">${fmtCurrency(calc.monthlyPIT)}</td>
        </tr>
        <tr><td class="d">SSB EMPLOYEE</td><td class="a">${fmtCurrency(calc.monthlySSB)}</td></tr>
        <tr class="tot"><td class="d">TOTAL</td><td class="a">${fmtCurrency(calc.totalDeductions)}</td></tr>
      </tbody>
    </table>

    <!-- NET PAY -->
    <div class="ps-net">
      <table class="ps">
        <col class="d"><col class="a">
        <tbody>
          <tr><td class="d">NET PAY</td><td class="a">${fmtCurrency(calc.netPay)}</td></tr>
        </tbody>
      </table>
    </div>

    <!-- Salary original -->
    <div class="so">
      <span>SALARY - ORIGINAL</span>
      <span>${fmtCurrency(calc.basic)}</span>
    </div>

    <!-- PIT adjustment footnote (admin visibility only) -->
    ${calc.hasAdjustment ? `<div style="font-size:7.5pt;color:#bbb;font-style:italic;padding:2px 0 4px">* PIT adjusted — Rule: &ldquo;${calc.pitRuleUsed}&rdquo; (${calc.pitAdjustmentType}) · Base: ${fmtCurrency(calc.monthlyPITBase)} → Final: ${fmtCurrency(calc.pitFinal)}</div>` : ''}

    <div class="ft">${gs.pdfFooterText || 'Powered by Microimage'}</div>

  </div><!-- /body -->
</div><!-- /pg -->`;
}

/* Opens a print window containing one or more payslip pages. */
function openPayslipPrintWindow(title, pagesHTML) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>${PAYSLIP_PRINT_CSS}
    .pg{page-break-after:always}
    .pg:last-child{page-break-after:auto}
  </style>
</head>
<body>
${pagesHTML}
<script>window.onload=function(){window.print();}</script>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=900,height=700');
  if (win) {
    win.document.open();
    win.document.write(html);
    win.document.close();
  } else {
    showToast('Allow pop-ups in your browser to enable PDF export.', 'warning');
  }
}

function printPayslip() {
  const draft  = STATE.payslipDraft;
  const emp    = STATE.employees.find(e => e.id === draft.selectedEmployeeId);
  const mLabel = (monthName(draft.month || new Date().getMonth() + 1) || '').toUpperCase();
  const yr     = draft.year || new Date().getFullYear();
  const fname  = `Payslip_${emp ? emp.name.replace(/\s+/g, '_') : 'Employee'}_${mLabel}_${yr}`;
  openPayslipPrintWindow(fname, payslipPageHTML(emp, draft.basicSalary, draft.phoneAllowance, draft.month, draft.year));
}

/* ═══════════════════════════════════════════════════════
   SCREEN: DASHBOARD
═══════════════════════════════════════════════════════ */
function renderDashboard(container) {
  const totalEmp = STATE.employees.length;
  const hasTransport = STATE.globalSettings.transportAllowance !== '';

  container.innerHTML = `
  <div class="page-view">

    <!-- Page Header -->
    <div class="page-header">
      <div class="page-header-left">
        <h1 class="page-title">Dashboard</h1>
        <p class="page-subtitle">${STATE.globalSettings.employerName || 'HR Portal'} · Payslip Management</p>
      </div>
      <div class="page-header-actions">
        <button class="btn btn-primary btn-lg" onclick="navigate('payslip')">
          ${iconSvg('plus', 16)} Generate Payslip
        </button>
      </div>
    </div>

    <!-- Transport not set warning -->
    ${!hasTransport ? `
    <div class="alert alert-warning mb-lg">
      <div>${iconSvg('alert-circle', 16)}</div>
      <div>
        <div class="alert-title">Transport Allowance Not Configured</div>
        Payslips cannot be generated until transport allowance is set.
        <a href="#" onclick="navigate('settings');return false;" style="color:inherit;font-weight:700;text-decoration:underline;margin-left:6px">Configure now →</a>
      </div>
    </div>` : ''}

    <!-- Key stats -->
    <div class="stat-grid" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr))">
      <div class="stat-card" onclick="navigate('employees')">
        <div class="stat-card-icon primary">${iconSvg('users', 20)}</div>
        <div class="stat-card-body">
          <div class="stat-value">${totalEmp}</div>
          <div class="stat-label">Employees</div>
          <div class="stat-trend up">${totalEmp === 0 ? 'Add your first employee' : 'View all →'}</div>
        </div>
      </div>
      <div class="stat-card" onclick="navigate('settings')">
        <div class="stat-card-icon accent">${iconSvg('truck', 20)}</div>
        <div class="stat-card-body">
          <div class="stat-value" style="font-size:var(--font-size-lg)">${hasTransport ? 'MMK ' + fmtCurrency(STATE.globalSettings.transportAllowance) : '—'}</div>
          <div class="stat-label">Transport Allowance</div>
          <div class="stat-trend ${hasTransport ? 'up' : 'down'}">${hasTransport ? 'Active' : 'Not set'}</div>
        </div>
      </div>
      <div class="stat-card" onclick="navigate('settings')">
        <div class="stat-card-icon warning">${iconSvg('briefcase', 20)}</div>
        <div class="stat-card-body">
          <div class="stat-value">${STATE.globalSettings.taxYearLabel || '—'}</div>
          <div class="stat-label">Tax Year</div>
          <div class="stat-trend up">Active rule set</div>
        </div>
      </div>
      <div class="stat-card" onclick="navigate('pit-rules')">
        <div class="stat-card-icon ${STATE.pitAdjustmentRules.filter(r=>r.isActive).length > 0 ? 'primary' : 'neutral' }">${iconSvg('sliders', 20)}</div>
        <div class="stat-card-body">
          <div class="stat-value">${STATE.pitAdjustmentRules.filter(r=>r.isActive).length}</div>
          <div class="stat-label">PIT Adj. Rules</div>
          <div class="stat-trend up">Active rules →</div>
        </div>
      </div>
    </div>

    <!-- Recent employees -->
    <div class="card">
      <div class="card-header">
        <div>
          <div class="card-title">Employees</div>
          <div class="card-subtitle">${totalEmp} registered · click any row to generate a payslip</div>
        </div>
        <div style="display:flex;gap:var(--sp-sm)">
          <button class="btn btn-secondary btn-sm" onclick="navigate('new-employee')">${iconSvg('user-plus',13)} Add</button>
          <button class="btn btn-secondary btn-sm" onclick="navigate('employees')">View All ${iconSvg('arrow-right',13)}</button>
        </div>
      </div>
      ${STATE.employees.length === 0 ? `
      <div class="table-empty">
        <div class="table-empty-icon">${iconSvg('users', 36)}</div>
        <div class="table-empty-title">No employees yet</div>
        <div class="table-empty-sub">Add your first employee to start generating payslips.</div>
        <div style="margin-top:var(--sp-lg)">
          <button class="btn btn-primary" onclick="navigate('new-employee')">${iconSvg('plus',14)} Add First Employee</button>
        </div>
      </div>` : `
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Emp No</th>
              <th>Department · Designation</th>
              <th>Branch</th>
              <th style="text-align:right">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${STATE.employees.slice(-8).reverse().map(emp => `
            <tr style="cursor:pointer" onclick="generatePayslipFor('${emp.id}')">
              <td>
                <div style="display:flex;align-items:center;gap:var(--sp-sm)">
                  <div style="width:32px;height:32px;border-radius:50%;background:var(--clr-primary);color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0">${emp.name.slice(0,2).toUpperCase()}</div>
                  <div style="font-weight:600;font-size:var(--font-size-sm)">${emp.name}</div>
                </div>
              </td>
              <td><code style="font-size:12px;background:var(--clr-surface-2);padding:2px 6px;border-radius:4px">${emp.employeeNo||'—'}</code></td>
              <td style="font-size:var(--font-size-sm);color:var(--clr-text-secondary)">${emp.department||'—'} · ${emp.designation||'—'}</td>
              <td style="font-size:var(--font-size-sm)">${emp.branch||'—'}</td>
              <td style="text-align:right" onclick="event.stopPropagation()">
                <div style="display:flex;align-items:center;justify-content:flex-end;gap:4px">
                  <button class="btn btn-primary btn-sm" onclick="generatePayslipFor('${emp.id}')">${iconSvg('file-text',13)} Payslip</button>
                  <button class="btn btn-ghost btn-sm btn-icon" onclick="editEmployee('${emp.id}')">${iconSvg('edit',13)}</button>
                </div>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`}
    </div>

  </div>`;
}

/* ═══════════════════════════════════════════════════════
   SCREEN: GLOBAL SETTINGS
═══════════════════════════════════════════════════════ */
function renderSettings(container) {
  const gs = STATE.globalSettings;

  container.innerHTML = `
  <div class="page-view">
    <div class="page-header">
      <div class="page-header-left">
        <h1 class="page-title">Global Settings</h1>
        <p class="page-subtitle">Configure company-wide defaults. These values auto-apply to every new payslip.</p>
      </div>
    </div>

    <!-- Transport Allowance Card (featured) -->
    <div class="card mb-lg" style="border-left: 4px solid var(--clr-primary);">
      <div class="card-header">
        <div style="display:flex;align-items:center;gap:var(--sp-sm)">
          <div style="width:36px;height:36px;background:var(--clr-primary-light);border-radius:var(--radius-sm);display:flex;align-items:center;justify-content:center;color:var(--clr-primary)">${iconSvg('truck', 18)}</div>
          <div>
            <div class="card-title">Transportation Allowance</div>
            <div class="card-subtitle">Single global value — automatically applied to all payslips</div>
          </div>
        </div>
        <span class="badge badge-primary">${iconSvg('lock', 11)} Admin Only</span>
      </div>
      <div class="card-body">
        <div class="alert alert-info mb-lg">
          <div>${iconSvg('info', 16)}</div>
          <div>
            <div class="alert-title">How it works</div>
            Set the transport allowance once here. Every new payslip will automatically use this value.
            HR users will see it as read-only. Only HR Admin can update it.
          </div>
        </div>

        <div class="form-grid-2 form-grid">
          <div class="form-group">
            <label class="form-label">Transport Allowance Amount <span class="required">*</span></label>
            <div class="input-with-icon">
              <div class="input-icon" style="font-size:11px;font-weight:700;color:var(--clr-text-muted)">MMK</div>
              <input type="number" id="gs-transport" class="form-control" style="padding-left:52px"
                placeholder="e.g. 350000"
                value="${gs.transportAllowance}"
                min="0" step="1000">
            </div>
            <div class="form-hint">Enter amount in Myanmar Kyat (MMK). Example: 350,000</div>
          </div>
          <div class="form-group">
            <label class="form-label">Effective From Month</label>
            <input type="month" id="gs-effective-month" class="form-control"
              value="${new Date().toISOString().slice(0,7)}">
            <div class="form-hint">The month this allowance amount takes effect</div>
          </div>
        </div>

        ${gs.settingsHistory.length > 0 ? `
        <div class="mt-lg">
          <div class="section-divider">
            <div class="section-divider-line"></div>
            <div class="section-divider-label">Change History</div>
            <div class="section-divider-line"></div>
          </div>
          ${gs.settingsHistory.slice(-5).reverse().map(h => `
          <div class="history-item">
            <div class="history-item-dot"></div>
            <div>MMK ${fmtCurrency(h.value)} — Effective: ${h.effectiveFrom} — Saved by <strong>${h.changedBy}</strong> on ${h.changedAt}</div>
          </div>`).join('')}
        </div>` : ''}
      </div>
      <div class="card-footer">
        <button class="btn btn-secondary" onclick="resetTransportField()">
          ${iconSvg('refresh-cw', 13)} Reset
        </button>
        <button class="btn btn-primary" onclick="saveTransportAllowance()">
          ${iconSvg('save', 13)} Save Transport Allowance
        </button>
      </div>
    </div>

    <!-- Employer Defaults Card -->
    <div class="card mb-lg">
      <div class="card-header">
        <div style="display:flex;align-items:center;gap:var(--sp-sm)">
          <div style="width:36px;height:36px;background:var(--clr-accent-light);border-radius:var(--radius-sm);display:flex;align-items:center;justify-content:center;color:var(--clr-accent)">${iconSvg('building', 18)}</div>
          <div>
            <div class="card-title">Employer & Organisation Defaults</div>
            <div class="card-subtitle">Default values pre-filled on every payslip</div>
          </div>
        </div>
      </div>
      <div class="card-body">
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">Employer / Company Name <span class="required">*</span></label>
            <input type="text" id="gs-employer" class="form-control"
              placeholder="e.g. Myanmar Heineken International"
              value="${gs.employerName}">
          </div>
          <div class="form-group">
            <label class="form-label">Default Branch</label>
            <input type="text" id="gs-branch" class="form-control"
              placeholder="e.g. Yangon HQ"
              value="${gs.defaultBranch}">
          </div>
          <div class="form-group">
            <label class="form-label">Tax Year Label</label>
            <input type="text" id="gs-taxyear" class="form-control"
              placeholder="e.g. 2026-2027"
              value="${gs.taxYearLabel}"
              maxlength="10">
            <div class="form-hint">Used in PDF header and reports</div>
          </div>
          <div class="form-group">
            <label class="form-label">PDF Footer Text</label>
            <input type="text" id="gs-footer" class="form-control"
              placeholder="e.g. Powered by Microimage"
              value="${gs.pdfFooterText}">
          </div>
          <div class="form-group full-width">
            <label class="form-label">Departments</label>
            <div style="display:flex;align-items:center;gap:var(--sp-md);padding:var(--sp-md);background:var(--clr-surface-2);border:1px solid var(--clr-border);border-radius:var(--radius-sm)">
              <div style="flex:1">
                <div style="font-size:var(--font-size-sm);font-weight:600;color:var(--clr-text-primary)">${STATE.masterData.departments.length} department${STATE.masterData.departments.length !== 1 ? 's' : ''} configured</div>
                <div style="font-size:var(--font-size-xs);color:var(--clr-text-muted);margin-top:2px">${getMDList('departments').slice(0,5).join(', ')}${getMDList('departments').length > 5 ? '…' : ''}</div>
              </div>
              <button class="btn btn-secondary btn-sm" onclick="navigate('master-data')">${iconSvg('edit',13)} Manage</button>
            </div>
            <div class="form-hint">Managed in Master Data. Changes reflect immediately in employee forms.</div>
          </div>
          <div class="form-group full-width">
            <label class="form-label">Designations</label>
            <div style="display:flex;align-items:center;gap:var(--sp-md);padding:var(--sp-md);background:var(--clr-surface-2);border:1px solid var(--clr-border);border-radius:var(--radius-sm)">
              <div style="flex:1">
                <div style="font-size:var(--font-size-sm);font-weight:600;color:var(--clr-text-primary)">${STATE.masterData.designations.length} designation${STATE.masterData.designations.length !== 1 ? 's' : ''} configured</div>
                <div style="font-size:var(--font-size-xs);color:var(--clr-text-muted);margin-top:2px">${getMDList('designations').slice(0,5).join(', ')}${getMDList('designations').length > 5 ? '…' : ''}</div>
              </div>
              <button class="btn btn-secondary btn-sm" onclick="navigate('master-data')">${iconSvg('edit',13)} Manage</button>
            </div>
            <div class="form-hint">Managed in Master Data. Changes reflect immediately in employee forms.</div>
          </div>
        </div>
      </div>
      <div class="card-footer">
        <button class="btn btn-primary" onclick="saveEmployerDefaults()">
          ${iconSvg('save', 13)} Save Defaults
        </button>
      </div>
    </div>

    <!-- Active Rule Set -->
    <div class="card">
      <div class="card-header">
        <div style="display:flex;align-items:center;gap:var(--sp-sm)">
          <div style="width:36px;height:36px;background:var(--clr-primary-light);border-radius:var(--radius-sm);display:flex;align-items:center;justify-content:center;color:var(--clr-primary)">${iconSvg('sliders', 18)}</div>
          <div>
            <div class="card-title">Active Payroll Rule Set</div>
            <div class="card-subtitle">Myanmar PIT &amp; SSB — used for all payslip auto-calculations</div>
          </div>
        </div>
        <div style="display:flex;gap:var(--sp-sm)">
          <span class="badge badge-accent">${iconSvg('check', 11)} Active</span>
          <button class="btn btn-secondary btn-sm" onclick="navigate('rules')">${iconSvg('edit', 13)} Brackets</button>
          <button class="btn btn-secondary btn-sm" onclick="navigate('pit-rules')">${iconSvg('sliders', 13)} PIT Adj.</button>
        </div>
      </div>
      <div class="card-body">
        <div class="alert alert-success mb-lg">
          <div>${iconSvg('check', 16)}</div>
          <div>
            <div class="alert-title">Phase 2 Calculation Engine Active</div>
            PIT and SSB are automatically calculated on every payslip using the rule set below.
            No manual entry of tax amounts is required or permitted.
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-lg)">
          <div>
            <div style="font-size:var(--font-size-xs);font-weight:700;color:var(--clr-text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:var(--sp-sm)">SSB Configuration</div>
            <div class="card" style="box-shadow:none">
              <div class="card-body compact" style="font-size:var(--font-size-sm)">
                <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--clr-border)">
                  <span style="color:var(--clr-text-muted)">Employee Rate</span><strong>2%</strong>
                </div>
                <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--clr-border)">
                  <span style="color:var(--clr-text-muted)">Monthly Wage Cap</span><strong>MMK 300,000</strong>
                </div>
                <div style="display:flex;justify-content:space-between;padding:4px 0">
                  <span style="color:var(--clr-text-muted)">Max Employee SSB</span><strong>MMK 6,000</strong>
                </div>
              </div>
            </div>
          </div>
          <div>
            <div style="font-size:var(--font-size-xs);font-weight:700;color:var(--clr-text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:var(--sp-sm)">PIT Brackets (Annual)</div>
            <div class="card" style="box-shadow:none">
              <div class="table-wrapper">
                <table style="font-size:12px">
                  <thead><tr><th>Annual Taxable Income</th><th style="text-align:right">Rate</th></tr></thead>
                  <tbody>
                    <tr><td>0 – 2,000,000</td><td style="text-align:right">0%</td></tr>
                    <tr><td>2,000,001 – 10,000,000</td><td style="text-align:right">5%</td></tr>
                    <tr><td>10,000,001 – 30,000,000</td><td style="text-align:right">10%</td></tr>
                    <tr><td>30,000,001 – 50,000,000</td><td style="text-align:right">15%</td></tr>
                    <tr><td>50,000,001 – 70,000,000</td><td style="text-align:right">20%</td></tr>
                    <tr><td>Above 70,000,000</td><td style="text-align:right">25%</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
        <div class="mt-lg" style="background:var(--clr-surface-2);border-radius:var(--radius-md);padding:var(--sp-md) var(--sp-lg);font-size:var(--font-size-sm)">
          <strong>Personal Relief:</strong> <span style="color:var(--clr-text-secondary)">MIN(Annual Gross × 20%, MMK 10,000,000)</span>
          &nbsp;·&nbsp;
          <strong>Method:</strong> <span style="color:var(--clr-text-secondary)">Annualized Monthly</span>
          &nbsp;·&nbsp;
          <strong>Effective:</strong> <span style="color:var(--clr-text-secondary)">${RULE_SET.effectiveFrom}</span>
        </div>
      </div>
    </div>
  </div>`;
}

function saveTransportAllowance() {
  const val = document.getElementById('gs-transport').value.trim();
  const month = document.getElementById('gs-effective-month').value;

  if (!val || isNaN(Number(val)) || Number(val) < 0) {
    showToast('Please enter a valid transport allowance amount.', 'error');
    return;
  }

  const prev = STATE.globalSettings.transportAllowance;
  STATE.globalSettings.transportAllowance = val;

  // Log to history
  STATE.globalSettings.settingsHistory.push({
    field: 'transportAllowance',
    value: val,
    previousValue: prev,
    effectiveFrom: month,
    changedBy: 'HR Admin',
    changedAt: new Date().toLocaleString('en-GB'),
  });

  saveState();
  showToast(`Transport Allowance saved: MMK ${fmtCurrency(val)}`, 'success');
  navigate('settings');
}

function resetTransportField() {
  document.getElementById('gs-transport').value = STATE.globalSettings.transportAllowance;
  document.getElementById('gs-effective-month').value = new Date().toISOString().slice(0, 7);
}

function saveEmployerDefaults() {
  STATE.globalSettings.employerName    = document.getElementById('gs-employer').value.trim();
  STATE.globalSettings.defaultBranch   = document.getElementById('gs-branch').value.trim();
  STATE.globalSettings.taxYearLabel    = document.getElementById('gs-taxyear').value.trim();
  STATE.globalSettings.pdfFooterText   = document.getElementById('gs-footer').value.trim();
  /* dept/desig now managed via Master Data screen */
  saveState();
  showToast('Employer defaults saved successfully.', 'success');
}

/* ═══════════════════════════════════════════════════════
   SCREEN: EMPLOYEE LIST
═══════════════════════════════════════════════════════ */
function renderEmployees(container) {
  let searchQuery = '';

  function renderTable() {
    const filtered = STATE.employees.filter(e =>
      e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.employeeNo || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.department || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    return `
    <div class="table-wrapper">
      ${filtered.length === 0 ? `
      <div class="table-empty">
        <div class="table-empty-icon">${iconSvg('users', 40)}</div>
        <div class="table-empty-title">${searchQuery ? 'No employees found' : 'No employees yet'}</div>
        <div class="table-empty-sub">${searchQuery ? `No results for "${searchQuery}"` : 'Add your first employee profile to get started.'}</div>
        ${!searchQuery ? `<div style="margin-top:var(--sp-lg)"><button class="btn btn-primary" onclick="navigate('new-employee')">${iconSvg('plus', 14)} Add Employee</button></div>` : ''}
      </div>` : `
      <table>
        <thead>
          <tr>
            <th>Employee</th>
            <th>Employee No</th>
            <th>NRC</th>
            <th>Department</th>
            <th>Designation</th>
            <th>Branch</th>
            <th>Join Date</th>
            <th>Status</th>
            <th style="text-align:right">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map(emp => `
          <tr>
            <td>
              <div style="display:flex;align-items:center;gap:10px">
                <div style="width:34px;height:34px;border-radius:50%;background:var(--clr-primary);color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0">${emp.name.slice(0,2).toUpperCase()}</div>
                <div>
                  <div style="font-weight:600;font-size:13px">${emp.name}</div>
                  <div style="font-size:11px;color:var(--clr-text-muted)">${emp.bankAccountNo ? 'A/C: ' + emp.bankAccountNo : ''}</div>
                </div>
              </div>
            </td>
            <td><code style="font-size:12px;background:var(--clr-surface-2);padding:2px 7px;border-radius:4px;font-weight:600">${emp.employeeNo || '—'}</code></td>
            <td style="font-size:12px;color:var(--clr-text-secondary)">${emp.nrc || '—'}</td>
            <td>${emp.department || '—'}</td>
            <td>${emp.designation || '—'}</td>
            <td>${emp.branch || '—'}</td>
            <td style="font-size:12px">${fmtDate(emp.joinDate)}</td>
            <td><span class="badge badge-accent">Active</span></td>
            <td style="text-align:right">
              <div style="display:flex;align-items:center;justify-content:flex-end;gap:4px">
                <button class="btn btn-ghost btn-sm btn-icon" title="Generate Payslip" onclick="generatePayslipFor('${emp.id}')">${iconSvg('file-text', 14)}</button>
                <button class="btn btn-ghost btn-sm btn-icon" title="Edit" onclick="editEmployee('${emp.id}')">${iconSvg('edit', 14)}</button>
                <button class="btn btn-ghost btn-sm btn-icon" title="Delete" style="color:var(--clr-danger)" onclick="deleteEmployee('${emp.id}')">${iconSvg('trash', 14)}</button>
              </div>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>`}
    </div>`;
  }

  container.innerHTML = `
  <div class="page-view">
    <div class="page-header">
      <div class="page-header-left">
        <h1 class="page-title">Employee Master Data</h1>
        <p class="page-subtitle">Search, view, and manage all employee profiles.</p>
      </div>
      <div class="page-header-actions">
        <button class="btn btn-secondary" onclick="navigate('import-employees')">
          ${iconSvg('upload', 14)} Bulk Import
        </button>
        <button class="btn btn-primary" onclick="navigate('new-employee')">
          ${iconSvg('user-plus', 14)} Add Employee
        </button>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div style="display:flex;align-items:center;gap:var(--sp-md);flex:1">
          <div class="search-input-wrapper" style="flex:1;max-width:400px">
            <div style="position:relative">
              <div style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--clr-text-muted)">${iconSvg('search', 15)}</div>
              <input type="text" id="emp-search" class="form-control" placeholder="Search by name, employee no, or department…"
                style="padding-left:38px" oninput="onEmpSearch(this.value)">
            </div>
          </div>
          <div style="color:var(--clr-text-muted);font-size:var(--font-size-sm);white-space:nowrap">
            <strong style="color:var(--clr-text-primary)">${STATE.employees.length}</strong> total employees
          </div>
        </div>
      </div>
      <div id="emp-table-wrapper">
        ${renderTable()}
      </div>
    </div>
  </div>`;

  window.onEmpSearch = (q) => {
    searchQuery = q;
    document.getElementById('emp-table-wrapper').innerHTML = renderTable();
  };
}

function editEmployee(id) {
  STATE.currentEmployeeEdit = id;
  navigate('edit-employee');
}

function generatePayslipFor(id) {
  STATE.payslipDraft.selectedEmployeeId = id;
  navigate('payslip');
}

function deleteEmployee(id) {
  if (!confirm('Are you sure you want to remove this employee profile?')) return;
  STATE.employees = STATE.employees.filter(e => e.id !== id);
  saveState();
  showToast('Employee removed.', 'warning');
  navigate('employees');
}

/* ═══════════════════════════════════════════════════════
   SCREEN: NEW EMPLOYEE
═══════════════════════════════════════════════════════ */
function renderNewEmployee(container) {
  const depts    = getMDList('departments');
  const desigs   = getMDList('designations');
  const branches = getMDList('branches');

  container.innerHTML = `
  <div class="page-view">
    <div class="page-header">
      <div class="page-header-left">
        <h1 class="page-title">Add New Employee</h1>
        <p class="page-subtitle">Fill in the employee profile details. Fields marked <span style="color:var(--clr-danger)">*</span> are required.</p>
      </div>
      <div class="page-header-actions">
        <button class="btn btn-secondary" onclick="navigate('employees')">${iconSvg('x', 13)} Cancel</button>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div style="display:flex;align-items:center;gap:var(--sp-sm)">
          <div style="width:36px;height:36px;background:var(--clr-primary-light);border-radius:var(--radius-sm);display:flex;align-items:center;justify-content:center;color:var(--clr-primary)">${iconSvg('users', 18)}</div>
          <div>
            <div class="card-title">Personal Information</div>
            <div class="card-subtitle">Basic identification and employment details</div>
          </div>
        </div>
      </div>
      <div class="card-body">
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">Full Name <span class="required">*</span></label>
            <input type="text" id="ne-name" class="form-control" placeholder="e.g. U Kyaw Zin Oo">
          </div>
          <div class="form-group">
            <label class="form-label">Employee Number <span class="required">*</span></label>
            <input type="text" id="ne-empno" class="form-control" placeholder="e.g. EMP-0042">
          </div>
          <div class="form-group">
            <label class="form-label">NRC</label>
            <input type="text" id="ne-nrc" class="form-control" placeholder="e.g. 12/OKHANA(N)123456">
          </div>
          <div class="form-group">
            <label class="form-label">Join Date</label>
            <input type="date" id="ne-joindate" class="form-control" max="${new Date().toISOString().slice(0,10)}">
          </div>
          <div class="form-group">
            <label class="form-label">SSB Card No</label>
            <input type="text" id="ne-ssb" class="form-control" placeholder="e.g. SSB-00123">
          </div>
          <div class="form-group">
            <label class="form-label">Bank Account Number</label>
            <input type="text" id="ne-bank" class="form-control" placeholder="e.g. KBZ-0001234567">
          </div>
        </div>
      </div>
    </div>

    <div class="card mt-lg">
      <div class="card-header">
        <div style="display:flex;align-items:center;gap:var(--sp-sm)">
          <div style="width:36px;height:36px;background:var(--clr-accent-light);border-radius:var(--radius-sm);display:flex;align-items:center;justify-content:center;color:var(--clr-accent)">${iconSvg('briefcase', 18)}</div>
          <div>
            <div class="card-title">Employment Details</div>
            <div class="card-subtitle">Position, department, and branch assignment</div>
          </div>
        </div>
      </div>
      <div class="card-body">
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">Employer Name</label>
            <input type="text" id="ne-employer" class="form-control"
              value="${STATE.globalSettings.employerName}"
              placeholder="Company name">
            <div class="form-hint">Pre-filled from global settings</div>
          </div>
          <div class="form-group">
            <label class="form-label">Branch</label>
            ${branches.length ? `
            <select id="ne-branch" class="form-control">
              <option value="">— Select Branch —</option>
              ${branches.map(b => `<option value="${b}" ${b === STATE.globalSettings.defaultBranch ? 'selected' : ''}>${b}</option>`).join('')}
            </select>` : `
            <input type="text" id="ne-branch" class="form-control"
              value="${STATE.globalSettings.defaultBranch}" placeholder="e.g. Yangon HQ">`}
            <div class="form-hint">
              ${branches.length ? '' : 'Pre-filled from Global Settings. '}
              <a href="#" onclick="navigate('master-data');return false;" style="color:var(--clr-primary);font-weight:600">Manage branches →</a>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Department</label>
            <select id="ne-dept" class="form-control">
              <option value="">— Select Department —</option>
              ${depts.map(d => `<option value="${d}">${d}</option>`).join('')}
            </select>
            ${!depts.length ? `<div class="form-hint"><a href="#" onclick="navigate('master-data');return false;" style="color:var(--clr-primary);font-weight:600">Add departments in Master Data →</a></div>` : ''}
          </div>
          <div class="form-group">
            <label class="form-label">Designation</label>
            <select id="ne-desig" class="form-control">
              <option value="">— Select Designation —</option>
              ${desigs.map(d => `<option value="${d}">${d}</option>`).join('')}
            </select>
            ${!desigs.length ? `<div class="form-hint"><a href="#" onclick="navigate('master-data');return false;" style="color:var(--clr-primary);font-weight:600">Add designations in Master Data →</a></div>` : ''}
          </div>
        </div>
      </div>
      <div class="card-footer">
        <button class="btn btn-secondary" onclick="navigate('employees')">${iconSvg('x', 13)} Cancel</button>
        <button class="btn btn-primary" onclick="saveNewEmployee()">
          ${iconSvg('save', 13)} Save Employee
        </button>
      </div>
    </div>
  </div>`;
}

function saveNewEmployee() {
  const name    = document.getElementById('ne-name').value.trim();
  const empNo   = document.getElementById('ne-empno').value.trim();

  if (!name)  { showToast('Employee name is required.', 'error'); document.getElementById('ne-name').focus(); return; }
  if (!empNo) { showToast('Employee number is required.', 'error'); document.getElementById('ne-empno').focus(); return; }

  // Check unique employee number
  if (STATE.employees.some(e => e.employeeNo === empNo)) {
    showToast('Employee number already exists. Use a unique ID.', 'error'); return;
  }

  const emp = {
    id:          uuid(),
    name,
    employeeNo:  empNo,
    nrc:         document.getElementById('ne-nrc').value.trim(),
    joinDate:    document.getElementById('ne-joindate').value,
    ssbCardNo:   document.getElementById('ne-ssb').value.trim(),
    bankAccountNo: document.getElementById('ne-bank').value.trim(),
    employerName:  document.getElementById('ne-employer').value.trim(),
    branch:        document.getElementById('ne-branch').value.trim(),
    department:    document.getElementById('ne-dept').value,
    designation:   document.getElementById('ne-desig').value,
    createdAt:     new Date().toISOString(),
  };

  STATE.employees.push(emp);
  saveState();
  showToast(`Employee "${name}" saved successfully!`, 'success');
  navigate('employees');
}

/* ═══════════════════════════════════════════════════════
   SCREEN: EDIT EMPLOYEE
═══════════════════════════════════════════════════════ */
function renderEditEmployee(container) {
  const emp = STATE.employees.find(e => e.id === STATE.currentEmployeeEdit);
  if (!emp) { navigate('employees'); return; }

  const depts    = getMDList('departments');
  const desigs   = getMDList('designations');
  const branches = getMDList('branches');

  function optionsHtml(arr, selected) {
    return arr.map(d => `<option value="${d}" ${d === selected ? 'selected' : ''}>${d}</option>`).join('');
  }

  container.innerHTML = `
  <div class="page-view">
    <div class="page-header">
      <div class="page-header-left">
        <h1 class="page-title">Edit Employee</h1>
        <p class="page-subtitle">Update the profile for <strong>${emp.name}</strong> (${emp.employeeNo})</p>
      </div>
      <div class="page-header-actions">
        <button class="btn btn-secondary" onclick="navigate('employees')">${iconSvg('x', 13)} Cancel</button>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div style="display:flex;align-items:center;gap:var(--sp-sm)">
          <div style="width:40px;height:40px;border-radius:50%;background:var(--clr-primary);color:#fff;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700">${emp.name.slice(0,2).toUpperCase()}</div>
          <div>
            <div class="card-title">${emp.name}</div>
            <div class="card-subtitle">${emp.employeeNo} · ${emp.department || 'No dept'} · ${emp.designation || 'No designation'}</div>
          </div>
        </div>
      </div>
      <div class="card-body">
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">Full Name <span class="required">*</span></label>
            <input type="text" id="ee-name" class="form-control" value="${emp.name}">
          </div>
          <div class="form-group">
            <label class="form-label">Employee Number <span class="required">*</span></label>
            <input type="text" id="ee-empno" class="form-control" value="${emp.employeeNo}">
          </div>
          <div class="form-group">
            <label class="form-label">NRC</label>
            <input type="text" id="ee-nrc" class="form-control" value="${emp.nrc || ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Join Date</label>
            <input type="date" id="ee-joindate" class="form-control" value="${emp.joinDate || ''}">
          </div>
          <div class="form-group">
            <label class="form-label">SSB Card No</label>
            <input type="text" id="ee-ssb" class="form-control" value="${emp.ssbCardNo || ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Bank Account Number</label>
            <input type="text" id="ee-bank" class="form-control" value="${emp.bankAccountNo || ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Employer Name</label>
            <input type="text" id="ee-employer" class="form-control" value="${emp.employerName || ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Branch</label>
            ${branches.length ? `
            <select id="ee-branch" class="form-control">
              <option value="">— Select Branch —</option>
              ${branches.map(b => `<option value="${b}" ${b === emp.branch ? 'selected' : ''}>${b}</option>`).join('')}
              ${emp.branch && !branches.includes(emp.branch) ? `<option value="${emp.branch}" selected>${emp.branch} (current)</option>` : ''}
            </select>` : `
            <input type="text" id="ee-branch" class="form-control" value="${emp.branch || ''}" placeholder="e.g. Yangon HQ">`}
          </div>
          <div class="form-group">
            <label class="form-label">Department</label>
            <select id="ee-dept" class="form-control">
              <option value="">— Select Department —</option>
              ${optionsHtml(depts, emp.department)}
              ${emp.department && !depts.includes(emp.department) ? `<option value="${emp.department}" selected>${emp.department} (current)</option>` : ''}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Designation</label>
            <select id="ee-desig" class="form-control">
              <option value="">— Select Designation —</option>
              ${optionsHtml(desigs, emp.designation)}
              ${emp.designation && !desigs.includes(emp.designation) ? `<option value="${emp.designation}" selected>${emp.designation} (current)</option>` : ''}
            </select>
          </div>
        </div>
      </div>
      <div class="card-footer">
        <button class="btn btn-danger btn-sm" onclick="deleteEmployee('${emp.id}')">${iconSvg('trash', 13)} Delete</button>
        <div style="flex:1"></div>
        <button class="btn btn-secondary" onclick="navigate('employees')">${iconSvg('x', 13)} Cancel</button>
        <button class="btn btn-primary" onclick="updateEmployee('${emp.id}')">
          ${iconSvg('save', 13)} Save Changes
        </button>
      </div>
    </div>
  </div>`;
}

function updateEmployee(id) {
  const idx = STATE.employees.findIndex(e => e.id === id);
  if (idx === -1) return;

  const name  = document.getElementById('ee-name').value.trim();
  const empNo = document.getElementById('ee-empno').value.trim();

  if (!name)  { showToast('Employee name is required.', 'error'); return; }
  if (!empNo) { showToast('Employee number is required.', 'error'); return; }

  // Check unique emp no (exclude self)
  if (STATE.employees.some((e, i) => e.employeeNo === empNo && i !== idx)) {
    showToast('Employee number already used by another employee.', 'error'); return;
  }

  STATE.employees[idx] = {
    ...STATE.employees[idx],
    name,
    employeeNo:  empNo,
    nrc:         document.getElementById('ee-nrc').value.trim(),
    joinDate:    document.getElementById('ee-joindate').value,
    ssbCardNo:   document.getElementById('ee-ssb').value.trim(),
    bankAccountNo: document.getElementById('ee-bank').value.trim(),
    employerName:  document.getElementById('ee-employer').value.trim(),
    branch:        document.getElementById('ee-branch').value.trim(),
    department:    document.getElementById('ee-dept').value,
    designation:   document.getElementById('ee-desig').value,
    updatedAt:     new Date().toISOString(),
  };

  saveState();
  showToast(`Employee "${name}" updated successfully!`, 'success');
  navigate('employees');
}

/* ═══════════════════════════════════════════════════════
   SCREEN: PAYSLIP GENERATOR
   Simplified 2-step flow: Fill Details → Preview & Download
═══════════════════════════════════════════════════════ */
function renderPayslip(container) {
  const gs        = STATE.globalSettings;
  const draft     = STATE.payslipDraft;
  const employees = STATE.employees;
  const hasTransport = gs.transportAllowance !== '';
  const step      = draft.step || 1;
  const _UNUSED_preselectedId = draft.selectedEmployeeId || '';  // kept for compat

  function renderStepIndicator(currentStep) {
    const steps = [
      { n: 1, label: 'Fill Details' },
      { n: 2, label: 'Preview & Download' },
    ];
    return `
    <div class="stepper">
      ${steps.map((s, i) => `
        ${i > 0 ? `<div class="step-line ${currentStep > s.n ? 'done' : ''}"></div>` : ''}
        <div class="step-item">
          <div class="step-indicator">
            <div class="step-circle ${currentStep === s.n ? 'active' : ''} ${currentStep > s.n ? 'done' : ''}">
              ${currentStep > s.n ? iconSvg('check', 12) : s.n}
            </div>
            <div class="step-label ${currentStep === s.n ? 'active' : ''} ${currentStep > s.n ? 'done' : ''}">${s.label}</div>
          </div>
        </div>`).join('')}
    </div>`;
  }

  /* ── Compact employee card ── */
  function empCard(emp) {
    if (!emp) return '';
    return `
    <div style="display:flex;align-items:center;gap:var(--sp-md);background:var(--clr-primary-light);border:1px solid var(--clr-border);border-radius:var(--radius-md);padding:var(--sp-md) var(--sp-lg);margin-top:var(--sp-md)">
      <div style="width:38px;height:38px;border-radius:50%;background:var(--clr-primary);color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;flex-shrink:0">${emp.name.slice(0,2).toUpperCase()}</div>
      <div style="flex:1;display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:2px var(--sp-lg)">
        ${[['Name',emp.name],['Emp No',emp.employeeNo||'—'],['Branch',emp.branch||'—'],['Dept',emp.department||'—'],['NRC',emp.nrc||'—'],['Join Date',fmtDate(emp.joinDate)]].map(([l,v]) => `
        <div>
          <div style="font-size:9px;font-weight:700;color:var(--clr-text-muted);text-transform:uppercase;letter-spacing:.05em">${l}</div>
          <div style="font-size:12px;font-weight:600;color:var(--clr-text-primary)">${v}</div>
        </div>`).join('')}
      </div>
    </div>`;
  }

  /* ── STEP 1: All inputs on one screen ── */
  function stepOneHtml() {
    const selEmp = employees.find(e => e.id === (draft.selectedEmployeeId||''));
    const now    = new Date();
    return `
    <div class="card">
      ${employees.length === 0 ? `
      <div class="card-body">
        <div class="alert alert-warning">
          <div>${iconSvg('alert-circle',16)}</div>
          <div><div class="alert-title">No Employees Found</div>
            Please <a href="#" onclick="navigate('new-employee');return false;" style="color:inherit;font-weight:700;text-decoration:underline">add an employee</a> first.
          </div>
        </div>
      </div>` : `
      <div class="card-body">
        <!-- Employee -->
        <div class="section-divider mt-0">
          <div class="section-divider-line"></div>
          <div class="section-divider-label">Employee</div>
          <div class="section-divider-line"></div>
        </div>
        <div style="display:flex;align-items:flex-end;gap:var(--sp-md);flex-wrap:wrap">
          <div class="form-group" style="flex:1;min-width:260px;max-width:420px">
            <label class="form-label">Select Employee <span class="required">*</span></label>
            <select id="ps-employee" class="form-control" style="height:44px;font-size:14px">
              <option value="">— Select an Employee —</option>
              ${employees.map(e => `<option value="${e.id}" ${e.id===(draft.selectedEmployeeId||'')?'selected':''}>${e.name} (${e.employeeNo})</option>`).join('')}
            </select>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="navigate('new-employee')">${iconSvg('user-plus',13)} New Employee</button>
        </div>
        <div id="emp-card">${selEmp ? empCard(selEmp) : ''}</div>

        <!-- Pay Period -->
        <div class="section-divider">
          <div class="section-divider-line"></div>
          <div class="section-divider-label">Pay Period</div>
          <div class="section-divider-line"></div>
        </div>
        <div class="form-grid form-grid-3">
          <div class="form-group">
            <label class="form-label">Pay Month <span class="required">*</span></label>
            <select id="ps-month" class="form-control">
              ${[...Array(12)].map((_,i) => `<option value="${i+1}" ${(draft.month||now.getMonth()+1)===i+1?'selected':''}>${monthName(i+1)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Pay Year <span class="required">*</span></label>
            <input type="number" id="ps-year" class="form-control"
              value="${draft.year||now.getFullYear()}" min="2020" max="2035">
          </div>
          <div class="form-group">
            <label class="form-label">Tax Year <span class="field-system-badge">${iconSvg('lock',10)} Auto</span></label>
            <input type="text" class="form-control read-only" readonly value="${gs.taxYearLabel||'—'}">
          </div>
        </div>

        <!-- Earnings -->
        <div class="section-divider">
          <div class="section-divider-line"></div>
          <div class="section-divider-label">Earnings</div>
          <div class="section-divider-line"></div>
        </div>
        <div class="form-grid form-grid-2">
          <div class="form-group">
            <label class="form-label">Basic Salary <span class="required">*</span></label>
            <div style="position:relative">
              <div style="position:absolute;left:12px;top:50%;transform:translateY(-50%);font-size:11px;font-weight:700;color:var(--clr-text-muted)">MMK</div>
              <input type="text" id="ps-basic" class="form-control" style="padding-left:52px"
                placeholder="1,500,000" oninput="formatInputCommas(this)"
                value="${draft.basicSalary ? parseCurrencyInput(draft.basicSalary).toLocaleString('en-US') : ''}">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Phone Allowance</label>
            <div style="position:relative">
              <div style="position:absolute;left:12px;top:50%;transform:translateY(-50%);font-size:11px;font-weight:700;color:var(--clr-text-muted)">MMK</div>
              <input type="text" id="ps-phone" class="form-control" style="padding-left:52px"
                placeholder="0" oninput="formatInputCommas(this)"
                value="${draft.phoneAllowance ? parseCurrencyInput(draft.phoneAllowance).toLocaleString('en-US') : ''}">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Transport Allowance <span class="field-system-badge">${iconSvg('lock',10)} Auto</span></label>
            <div style="position:relative">
              <div style="position:absolute;left:12px;top:50%;transform:translateY(-50%);font-size:11px;font-weight:700;color:var(--clr-text-muted)">MMK</div>
              <input type="text" class="form-control read-only" readonly style="padding-left:52px"
                value="${hasTransport ? fmtCurrency(gs.transportAllowance) : 'Not configured — set in Global Settings'}">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Employer Name <span class="field-system-badge">${iconSvg('lock',10)} Auto</span></label>
            <input type="text" class="form-control read-only" readonly
              value="${selEmp ? (selEmp.employerName||gs.employerName||'—') : (gs.employerName||'—')}">
          </div>
        </div>

        <!-- Live calculation preview -->
        <div class="section-divider">
          <div class="section-divider-line"></div>
          <div class="section-divider-label">Live Deduction Preview</div>
          <div class="section-divider-line"></div>
        </div>
        <div id="live-calc-preview">
          ${liveCalcHtml(parseCurrencyInput(draft.basicSalary),Number(gs.transportAllowance||0),parseCurrencyInput(draft.phoneAllowance),draft.month||now.getMonth()+1,draft.year||now.getFullYear())}
        </div>
      </div>
      <div class="card-footer">
        <button class="btn btn-secondary" onclick="navigate('dashboard')">${iconSvg('x',13)} Cancel</button>
        <div style="flex:1"></div>
        <button class="btn btn-ghost" onclick="saveDraft()">${iconSvg('save',13)} Save Draft</button>
        <button class="btn btn-primary" onclick="goToPreview()">
          Generate Payslip ${iconSvg('arrow-right',13)}
        </button>
      </div>
      `}
    </div>`;
  }

  /* ── STEP 2: Clean payslip preview matching the reference format ── */
  /* ── STEP 2: Clean payslip preview matching reference screenshot ── */
  function stepTwoHtml() {
    const selId = draft.selectedEmployeeId || '';
    const emp   = employees.find(e => e.id === selId);

    const calc  = calculatePayslip(draft.basicSalary, gs.transportAllowance, draft.phoneAllowance, draft.month, draft.year);
    const mLabel = monthName(draft.month || new Date().getMonth()+1).toUpperCase();
    const yr    = draft.year || new Date().getFullYear();
    return `
    <div class="card">
      <div class="card-header">
        <div>
          <div class="card-title">Payslip Preview</div>
          <div class="card-subtitle">${emp ? emp.name + ' · ' : ''}${monthName(draft.month||1)} ${yr}</div>
        </div>
        <button class="btn btn-primary" onclick="printPayslip()">
          ${iconSvg('download',14)} Download PDF
        </button>
      </div>

      <div class="card-body" style="background:var(--clr-bg);padding:var(--sp-xl)">

        <!-- ────────── Payslip Document ────────── -->
        <div class="ps-doc">

          <div class="ps-doc-header">
            <div class="ps-doc-employer">${gs.employerName||''}</div>
            <div class="ps-doc-title">REMUNERATION STATEMENT FOR THE MONTH OF ${mLabel} ${yr}</div>
          </div>

          <div class="ps-doc-body">

            <!-- Employee info -->
            <table class="ps-emp-table">
              ${emp ? [
                ['Employee Name',emp.name,                               'Employee No',   emp.employeeNo||'—'],
                ['Employer Name',emp.employerName||gs.employerName||'—', 'Branch',        emp.branch||gs.defaultBranch||'—'],
                ['Designation',  emp.designation||'—',                   'Department',    emp.department||'—'],
                ['NRC',          emp.nrc||'—',                           'Join Date',     fmtDate(emp.joinDate)],
                ['Pay Period',   monthName(draft.month||1),              'Pay Year',      gs.taxYearLabel||String(yr)],
                ['SSB Card No',  emp.ssbCardNo||'—',                    'Bank AC Number',emp.bankAccountNo||'—'],
              ].map(([l1,v1,l2,v2]) => `
              <tr>
                <td class="ps-emp-lbl">${l1}:</td><td class="ps-emp-val">${v1}</td>
                <td class="ps-emp-lbl">${l2}:</td><td class="ps-emp-val">${v2}</td>
              </tr>`).join('') : '<tr><td colspan="4" style="color:#aaa;padding:6px 0">No employee selected</td></tr>'}
            </table>

            <!-- EARNINGS ─── identical col widths = same column divider -->
            <div class="ps-section-label">Earnings</div>
            <table class="ps-tbl">
              <col style="width:68%"><col style="width:32%">
              <thead><tr><th>Description</th><th>Amount</th></tr></thead>
              <tbody>
                <tr><td>BASIC SALARY</td><td>${fmtCurrency(calc.basic)}</td></tr>
                <tr><td>TRANSPORTATION ALLOWANCE</td><td>${fmtCurrency(calc.transport)}</td></tr>
                <tr><td>PHONE ALLOWANCE(AIR CHARGES)</td><td>${fmtCurrency(calc.phone)}</td></tr>
                <tr class="ps-total"><td>TOTAL</td><td>${fmtCurrency(calc.totalEarnings)}</td></tr>
              </tbody>
            </table>

            <!-- DEDUCTIONS ─── same col widths as above -->
            <div class="ps-section-label">Deductions</div>
            <table class="ps-tbl">
              <col style="width:68%"><col style="width:32%">
              <thead><tr><th>Description</th><th>Amount</th></tr></thead>
              <tbody>
                <tr>
                  <td>NET PIT${calc.hasAdjustment ? '<sup style="font-size:8px;color:#999">*</sup>' : ''}</td>
                  <td>${fmtCurrency(calc.monthlyPIT)}</td>
                </tr>
                <tr><td>SSB EMPLOYEE</td><td>${fmtCurrency(calc.monthlySSB)}</td></tr>
                <tr class="ps-total"><td>TOTAL</td><td>${fmtCurrency(calc.totalDeductions)}</td></tr>
              </tbody>
            </table>

            <!-- NET PAY ─── same col widths = divider at same position -->
            <table class="ps-tbl ps-net-tbl">
              <col style="width:68%"><col style="width:32%">
              <tbody>
                <tr><td>NET PAY</td><td>${fmtCurrency(calc.netPay)}</td></tr>
              </tbody>
            </table>

            <div class="ps-sal-orig">SALARY - ORIGINAL &nbsp;&nbsp; ${fmtCurrency(calc.basic)}</div>

            ${calc.hasAdjustment ? `
            <div style="font-size:10.5px;color:var(--clr-accent-dark);background:var(--clr-accent-light);border-radius:var(--radius-sm);padding:var(--sp-sm) var(--sp-md);margin-top:var(--sp-sm)">
              * PIT adjusted — Rule: <strong>${calc.pitRuleUsed}</strong> (${calc.pitAdjustmentType})
              &nbsp;·&nbsp; Base: MMK ${fmtCurrency(calc.monthlyPITBase)} → Final: MMK ${fmtCurrency(calc.pitFinal)}
            </div>` : ''}

            <div class="ps-doc-footer">${gs.pdfFooterText||'Powered by Microimage'}</div>
          </div>
        </div>
        <!-- ─────── end payslip document ─────── -->

        <!-- Audit trail for admin -->
        <div class="alert alert-success mt-lg">
          <div>${iconSvg('check',16)}</div>
          <div style="font-size:var(--font-size-xs);line-height:1.8">
            <div class="alert-title">Calculation Audit</div>
            Taxable Income: <strong>MMK ${fmtCurrency(calc.annualTaxableIncome)}</strong>
            &nbsp;·&nbsp; Annual PIT: <strong>MMK ${fmtCurrency(calc.annualPIT)}</strong>
            &nbsp;·&nbsp; PIT Base/mo: <strong>MMK ${fmtCurrency(calc.monthlyPITBase)}</strong>
            ${calc.hasAdjustment
              ? `&nbsp;·&nbsp; Adj (<strong>${calc.pitRuleUsed}</strong>): −MMK ${fmtCurrency(calc.pitAdjustmentApplied)} → Final: <strong>MMK ${fmtCurrency(calc.pitFinal)}</strong>`
              : '&nbsp;·&nbsp; <span style="color:var(--clr-text-muted)">No PIT adjustment active</span>'}
            &nbsp;·&nbsp; SSB: <strong>MMK ${fmtCurrency(calc.monthlySSB)}</strong>
          </div>
        </div>

      </div>
      <div class="card-footer">
        <button class="btn btn-secondary" onclick="goBackToForm()">
          ${iconSvg('arrow-right',13)} Back to Edit
        </button>
        <div style="flex:1"></div>
        <button class="btn btn-primary" onclick="printPayslip()">
          ${iconSvg('download',13)} Download PDF
        </button>
      </div>
    </div>`;
  }   /* end stepTwoHtml */

  /* ── Render ── */
  container.innerHTML = `
  <div class="page-view">
    <div class="page-header">
      <div class="page-header-left">
        <h1 class="page-title">Payslip Generator</h1>
        <p class="page-subtitle">Generate and download a monthly employee payslip.</p>
      </div>
    </div>

    ${!hasTransport && step === 1 ? `
    <div class="alert alert-warning mb-lg">
      <div>${iconSvg('alert-circle',16)}</div>
      <div><div class="alert-title">Transport Allowance Not Set</div>
        <a href="#" onclick="navigate('settings');return false;" style="color:inherit;font-weight:700;text-decoration:underline">Go to Global Settings →</a>
      </div>
    </div>` : ''}

    ${renderStepIndicator(step)}

    <div id="step-content">
      ${step === 1 ? stepOneHtml() : stepTwoHtml()}
    </div>
  </div>`;

  /* ── Employee dropdown → update compact card ── */
  const empSel = document.getElementById('ps-employee');
  if (empSel) {
    empSel.addEventListener('change', () => {
      const emp = employees.find(e => e.id === empSel.value);
      const el  = document.getElementById('emp-card');
      if (el) el.innerHTML = emp ? empCard(emp) : '';
      STATE.payslipDraft.selectedEmployeeId = empSel.value;
    });
  }

  /* ── Live calculation listeners ── */
  const basicInput = document.getElementById('ps-basic');
  const phoneInput = document.getElementById('ps-phone');
  if (basicInput || phoneInput) {
    function updateLiveCalc() {
      const b = parseCurrencyInput(basicInput ? basicInput.value : 0);
      const p = parseCurrencyInput(phoneInput ? phoneInput.value : 0);
      const t = Number(gs.transportAllowance || 0);
      const m = Number(document.getElementById('ps-month')?.value || new Date().getMonth()+1);
      const y = Number(document.getElementById('ps-year')?.value  || new Date().getFullYear());
      const el = document.getElementById('live-calc-preview');
      if (el) el.innerHTML = liveCalcHtml(b, t, p, m, y);
    }
    if (basicInput) basicInput.addEventListener('input', updateLiveCalc);
    if (phoneInput) phoneInput.addEventListener('input', updateLiveCalc);
    const mSel = document.getElementById('ps-month');
    const yInp = document.getElementById('ps-year');
    if (mSel) mSel.addEventListener('change', updateLiveCalc);
    if (yInp) yInp.addEventListener('input',  updateLiveCalc);
  }

  /* ── Navigation helpers ── */
  window.goToPreview = () => {
    const selId    = document.getElementById('ps-employee')?.value || draft.selectedEmployeeId;
    const rawBasic = document.getElementById('ps-basic')?.value    || '';
    const rawPhone = document.getElementById('ps-phone')?.value    || '';
    const month    = document.getElementById('ps-month')?.value    || '';
    const year     = document.getElementById('ps-year')?.value     || '';
    const basic    = parseCurrencyInput(rawBasic);
    const phone    = parseCurrencyInput(rawPhone);

    if (!selId)        { showToast('Please select an employee.', 'error'); return; }
    if (!basic||basic<0) { showToast('Please enter a valid basic salary.', 'error'); document.getElementById('ps-basic')?.focus(); return; }
    if (!hasTransport) { showToast('Transport allowance not configured. Go to Global Settings.', 'error'); return; }

    STATE.payslipDraft = {
      ...STATE.payslipDraft,
      selectedEmployeeId: selId,
      basicSalary:        basic,
      phoneAllowance:     phone || 0,
      month:              Number(month),
      year:               Number(year),
      step:               2,
    };
    saveState();
    navigate('payslip');
  };

  window.goBackToForm = () => {
    STATE.payslipDraft.step = 1;
    saveState();
    navigate('payslip');
  };

  window.saveDraft = () => {
    const selId    = document.getElementById('ps-employee')?.value    || draft.selectedEmployeeId;
    const rawBasic = document.getElementById('ps-basic')?.value       || draft.basicSalary;
    const rawPhone = document.getElementById('ps-phone')?.value       || draft.phoneAllowance;
    const month    = document.getElementById('ps-month')?.value       || draft.month;
    const year     = document.getElementById('ps-year')?.value        || draft.year;
    STATE.payslipDraft = {
      ...STATE.payslipDraft,
      selectedEmployeeId: selId,
      basicSalary:        parseCurrencyInput(rawBasic),
      phoneAllowance:     parseCurrencyInput(rawPhone),
      month:              Number(month),
      year:               Number(year),
    };
    saveState();
    showToast('Draft saved.', 'info');
  };

  window.resetPayslip = () => {
    STATE.payslipDraft = { step: 1 };
    saveState();
    navigate('payslip');
  };

  /* backward-compat aliases */
  window.goToStep2     = window.goToPreview;
  window.goToStep1     = window.goBackToForm;
  window.goToStep2Back = window.goBackToForm;
  window.goToStep3     = window.goToPreview;
}

/* ═══════════════════════════════════════════════════════
   SCREEN: RULE ENGINE (Phase 5 Preview)
═══════════════════════════════════════════════════════ */
function renderRuleEngine(container) {
  const rs = RULE_SET;
  container.innerHTML = `
  <div class="page-view">
    <div class="page-header">
      <div class="page-header-left">
        <h1 class="page-title">Rule Engine</h1>
        <p class="page-subtitle">View the active payroll rule set. Full rule editing (Phase 5) allows bracket, SSB, and relief updates without code changes.</p>
      </div>
      <div class="page-header-actions">
        <span class="badge badge-accent" style="font-size:var(--font-size-sm);padding:6px 14px">${iconSvg('check', 13)} Active Rule Set</span>
      </div>
    </div>

    <!-- Rule Set Header Card -->
    <div class="card mb-lg" style="border-left:4px solid var(--clr-primary)">
      <div class="card-body" style="display:flex;align-items:center;gap:var(--sp-xl);flex-wrap:wrap">
        <div>
          <div style="font-size:var(--font-size-xs);font-weight:700;color:var(--clr-text-muted);text-transform:uppercase;letter-spacing:.06em">Rule Set Name</div>
          <div style="font-size:var(--font-size-lg);font-weight:700;color:var(--clr-text-primary);margin-top:2px">${rs.name}</div>
        </div>
        <div>
          <div style="font-size:var(--font-size-xs);font-weight:700;color:var(--clr-text-muted);text-transform:uppercase;letter-spacing:.06em">Effective From</div>
          <div style="font-size:var(--font-size-md);font-weight:600;margin-top:2px">${rs.effectiveFrom}</div>
        </div>
        <div>
          <div style="font-size:var(--font-size-xs);font-weight:700;color:var(--clr-text-muted);text-transform:uppercase;letter-spacing:.06em">Currency</div>
          <div style="font-size:var(--font-size-md);font-weight:600;margin-top:2px">${rs.currency}</div>
        </div>
        <div>
          <div style="font-size:var(--font-size-xs);font-weight:700;color:var(--clr-text-muted);text-transform:uppercase;letter-spacing:.06em">PIT Method</div>
          <div style="font-size:var(--font-size-md);font-weight:600;margin-top:2px">${rs.pitMethod}</div>
        </div>
        <div>
          <div style="font-size:var(--font-size-xs);font-weight:700;color:var(--clr-text-muted);text-transform:uppercase;letter-spacing:.06em">Status</div>
          <div style="margin-top:2px"><span class="badge badge-accent">${rs.status}</span></div>
        </div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-lg);margin-bottom:var(--sp-lg)">

      <!-- PIT Brackets -->
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">PIT Brackets</div>
            <div class="card-subtitle">Progressive annual income tax tiers</div>
          </div>
          <span class="badge badge-neutral">6 tiers</span>
        </div>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Lower Bound</th>
                <th>Upper Bound</th>
                <th style="text-align:right">Rate</th>
                <th style="text-align:right">Max Tax in Tier</th>
              </tr>
            </thead>
            <tbody>
              ${rs.pit.brackets.map((b, i) => {
                const tierSize = b.upper === null ? '∞' : fmtCurrency(b.upper - b.lower);
                const maxTax   = b.upper === null ? '—' : fmtCurrency((b.upper - b.lower) * b.rate);
                return `
              <tr>
                <td style="font-size:11px;color:var(--clr-text-muted)">${i + 1}</td>
                <td>MMK ${fmtCurrency(b.lower)}</td>
                <td>${b.upper === null ? 'Unlimited' : 'MMK ' + fmtCurrency(b.upper)}</td>
                <td style="text-align:right"><strong style="color:${b.rate === 0 ? 'var(--clr-text-muted)' : 'var(--clr-primary)'}">${(b.rate * 100).toFixed(0)}%</strong></td>
                <td style="text-align:right;font-size:12px;color:var(--clr-text-secondary)">${maxTax}</td>
              </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- SSB + Relief -->
      <div style="display:flex;flex-direction:column;gap:var(--sp-lg)">

        <!-- SSB -->
        <div class="card">
          <div class="card-header">
            <div class="card-title">SSB Rules</div>
            <span class="badge badge-neutral">Employee</span>
          </div>
          <div class="card-body compact" style="font-size:var(--font-size-sm)">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-md)">
              ${[
                ['Employee Rate', (rs.ssb.employeeRate * 100).toFixed(0) + '%'],
                ['Employer Rate', (rs.ssb.employerRate * 100).toFixed(0) + '%'],
                ['Monthly Wage Cap', 'MMK ' + fmtCurrency(rs.ssb.monthlyWageCap)],
                ['Max Employee SSB', 'MMK ' + fmtCurrency(rs.ssb.maxEmployeeSSB)],
                ['Max Employer SSB', 'MMK ' + fmtCurrency(rs.ssb.maxEmployerSSB)],
              ].map(([l, v]) => `
              <div>
                <div style="font-size:var(--font-size-xs);font-weight:600;color:var(--clr-text-muted);text-transform:uppercase;letter-spacing:.05em">${l}</div>
                <div style="font-weight:700;margin-top:2px">${v}</div>
              </div>`).join('')}
            </div>
          </div>
        </div>

        <!-- Relief -->
        <div class="card">
          <div class="card-header">
            <div class="card-title">Relief Rules</div>
            <span class="badge badge-neutral">1 active</span>
          </div>
          <div class="card-body compact" style="font-size:var(--font-size-sm)">
            <div style="display:flex;justify-content:space-between;align-items:center;padding:var(--sp-sm) 0;border-bottom:1px solid var(--clr-border)">
              <div>
                <div style="font-weight:600">Basic Personal Relief</div>
                <div style="font-size:var(--font-size-xs);color:var(--clr-text-muted)">Type: Percentage of Annual Gross</div>
              </div>
              <div style="text-align:right">
                <div style="font-weight:700;color:var(--clr-primary)">${(rs.pit.personalReliefRate * 100).toFixed(0)}%</div>
                <div style="font-size:var(--font-size-xs);color:var(--clr-text-muted)">Cap: MMK ${fmtCurrency(rs.pit.personalReliefCap)}</div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>

    <!-- Earning Components -->
    <div class="card mb-lg">
      <div class="card-header">
        <div class="card-title">Earning Component Taxability</div>
        <div class="card-subtitle">Controls which components are included in PIT and SSB base</div>
      </div>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Component</th>
              <th style="text-align:center">PIT Taxable</th>
              <th style="text-align:center">SSB Base</th>
            </tr>
          </thead>
          <tbody>
            ${rs.earningComponents.map((c, i) => `
            <tr>
              <td style="font-size:11px;color:var(--clr-text-muted)">${i + 1}</td>
              <td><strong>${c.name}</strong></td>
              <td style="text-align:center">
                <span class="badge ${c.isTaxablePIT ? 'badge-accent' : 'badge-neutral'}">${c.isTaxablePIT ? 'Yes' : 'No'}</span>
              </td>
              <td style="text-align:center">
                <span class="badge ${c.isSSBBase ? 'badge-primary' : 'badge-neutral'}">${c.isSSBBase ? 'Yes' : 'No'}</span>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Sample Calculation -->
    <div class="card">
      <div class="card-header">
        <div>
          <div class="card-title">Sample Calculation Verification</div>
          <div class="card-subtitle">Using PRD reference values — Basic 1,361,000 · Transport 350,000 · Phone 20,000</div>
        </div>
      </div>
      <div class="card-body">
        ${(() => {
          const c = calculatePayslip(1361000, 350000, 20000);
          return `
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:var(--sp-lg)">
            ${[
              ['Total Earnings',        fmtCurrency(c.totalEarnings),       'primary'],
              ['Annual Gross',          fmtCurrency(c.annualGross),          'neutral'],
              ['Personal Relief',       fmtCurrency(c.personalRelief),       'neutral'],
              ['Annual Taxable Income', fmtCurrency(c.annualTaxableIncome),  'neutral'],
              ['Annual PIT',            fmtCurrency(c.annualPIT),            'danger'],
              ['Monthly PIT',          fmtCurrency(c.monthlyPIT),           'danger'],
              ['SSB Employee',         fmtCurrency(c.monthlySSB),           'danger'],
              ['Net Pay',               fmtCurrency(c.netPay),               'accent'],
            ].map(([l, v, col]) => `
            <div style="padding:var(--sp-md);background:var(--clr-surface-2);border-radius:var(--radius-md);border:1px solid var(--clr-border)">
              <div style="font-size:var(--font-size-xs);font-weight:600;color:var(--clr-text-muted);text-transform:uppercase;letter-spacing:.05em">${l}</div>
              <div style="font-size:var(--font-size-md);font-weight:700;color:var(--clr-${col});margin-top:3px">MMK ${v}</div>
            </div>`).join('')}
          </div>
          <div class="alert alert-info mt-lg">
            <div>${iconSvg('info', 16)}</div>
            <div>PRD reference: Monthly PIT = 87,880 · SSB = 6,000. Calculated: PIT = ${fmtCurrency(c.monthlyPIT)} · SSB = ${fmtCurrency(c.monthlySSB)}.</div>
          </div>`;
        })()}
      </div>
    </div>

  </div>`;
}

/* ═══════════════════════════════════════════════════════
   SCREEN: PIT ADJUSTMENT RULES ADMIN
═══════════════════════════════════════════════════════ */
function renderPITAdjustmentAdmin(container) {
  const editing   = STATE.pitRuleEditId !== undefined;   // form visible?
  const isNew     = STATE.pitRuleEditId === null;
  const editRule  = editing && !isNew
    ? STATE.pitAdjustmentRules.find(r => r.ruleId === STATE.pitRuleEditId) || null
    : null;

  const ruleTypeOptions = ['FIXED','PERCENTAGE','TARGET','FORMULA'];
  const ruleTypeLabels  = {
    FIXED:      'Fixed Amount',
    PERCENTAGE: 'Percentage of PIT Base',
    TARGET:     'Target PIT Value',
    FORMULA:    'Custom Formula Expression',
  };
  const ruleTypeHints = {
    FIXED:      'Subtract a fixed MMK amount from PIT Base. Example: 10000',
    PERCENTAGE: 'Subtract a % of PIT Base. Example: 15 means subtract 15%',
    TARGET:     'Force PIT to a specific target MMK value. Example: 50000',
    FORMULA:    'Custom JS expression. Variables: pitBase, basicSalary, totalEarnings, annualTaxableIncome. Example: pitBase * 0.5',
  };
  const cur = editRule || {};

  /* ── Form card HTML ── */
  const formCard = !editing ? '' : `
  <div class="card mb-lg" style="border-left:4px solid var(--clr-primary)">
    <div class="card-header">
      <div style="display:flex;align-items:center;gap:var(--sp-sm)">
        <div style="width:36px;height:36px;background:var(--clr-primary-light);border-radius:var(--radius-sm);display:flex;align-items:center;justify-content:center;color:var(--clr-primary)">${iconSvg('edit', 18)}</div>
        <div>
          <div class="card-title">${isNew ? 'Add New Adjustment Rule' : 'Edit Rule — ' + (cur.ruleName || '')}</div>
          <div class="card-subtitle">Configure when and how PIT should be adjusted after base calculation</div>
        </div>
      </div>
    </div>
    <div class="card-body">
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">Rule Name <span class="required">*</span></label>
          <input type="text" id="par-name" class="form-control" placeholder="e.g. Q1 2026 Relief Reduction" value="${cur.ruleName || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Rule Type <span class="required">*</span></label>
          <select id="par-type" class="form-control" onchange="updatePITRuleTypeHint()">
            ${ruleTypeOptions.map(t => `<option value="${t}" ${(cur.ruleType || 'FIXED') === t ? 'selected' : ''}>${ruleTypeLabels[t]}</option>`).join('')}
          </select>
        </div>
        <div class="form-group full-width">
          <label class="form-label" id="par-value-label">Value <span class="required">*</span></label>
          <input type="text" id="par-value" class="form-control"
            placeholder="e.g. 10000"
            value="${cur.value || ''}">
          <div class="form-hint" id="par-value-hint">${ruleTypeHints[cur.ruleType || 'FIXED']}</div>
        </div>
      </div>

      <div class="section-divider mt-md">
        <div class="section-divider-line"></div>
        <div class="section-divider-label">Salary Range Filter (optional)</div>
        <div class="section-divider-line"></div>
      </div>
      <div class="form-grid form-grid-2">
        <div class="form-group">
          <label class="form-label">Min Basic Salary (MMK)</label>
          <input type="text" id="par-min" class="form-control" placeholder="Leave blank for no minimum"
            oninput="formatInputCommas(this)"
            value="${cur.minSalary != null && cur.minSalary !== '' ? Number(cur.minSalary).toLocaleString('en-US') : ''}">
          <div class="form-hint">Rule only applies when basic salary ≥ this value</div>
        </div>
        <div class="form-group">
          <label class="form-label">Max Basic Salary (MMK)</label>
          <input type="text" id="par-max" class="form-control" placeholder="Leave blank for no maximum"
            oninput="formatInputCommas(this)"
            value="${cur.maxSalary != null && cur.maxSalary !== '' ? Number(cur.maxSalary).toLocaleString('en-US') : ''}">
          <div class="form-hint">Rule only applies when basic salary ≤ this value</div>
        </div>
      </div>

      <div class="section-divider mt-md">
        <div class="section-divider-line"></div>
        <div class="section-divider-label">Effective Date Range</div>
        <div class="section-divider-line"></div>
      </div>
      <div class="form-grid form-grid-2">
        <div class="form-group">
          <label class="form-label">Effective From <span class="required">*</span></label>
          <input type="month" id="par-from" class="form-control" value="${cur.effectiveFrom || new Date().toISOString().slice(0,7)}">
          <div class="form-hint">Month this rule starts applying (YYYY-MM)</div>
        </div>
        <div class="form-group">
          <label class="form-label">Effective To</label>
          <input type="month" id="par-to" class="form-control" value="${cur.effectiveTo || ''}">
          <div class="form-hint">Leave blank for open-ended (no expiry)</div>
        </div>
      </div>

      <div class="section-divider mt-md">
        <div class="section-divider-line"></div>
        <div class="section-divider-label">Priority &amp; Status</div>
        <div class="section-divider-line"></div>
      </div>
      <div class="form-grid form-grid-2">
        <div class="form-group">
          <label class="form-label">Priority</label>
          <input type="number" id="par-priority" class="form-control" min="0" max="999"
            placeholder="0" value="${cur.priority != null ? cur.priority : 0}">
          <div class="form-hint">Higher number = selected first when multiple rules match</div>
        </div>
        <div class="form-group">
          <label class="form-label">Active</label>
          <div style="display:flex;align-items:center;gap:var(--sp-md);height:42px">
            <label class="toggle-switch">
              <input type="checkbox" id="par-active" ${(cur.isActive !== false) ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </label>
            <span style="font-size:var(--font-size-sm);color:var(--clr-text-secondary)">Enable this rule</span>
          </div>
        </div>
      </div>
    </div>
    <div class="card-footer">
      <button class="btn btn-secondary" onclick="cancelPITRuleEdit()">${iconSvg('x', 13)} Cancel</button>
      <div style="flex:1"></div>
      <button class="btn btn-primary" onclick="savePITRule()">
        ${iconSvg('save', 13)} ${isNew ? 'Add Rule' : 'Save Changes'}
      </button>
    </div>
  </div>`;

  /* ── Rules table ── */
  const rules = STATE.pitAdjustmentRules;

  const typeColors = { FIXED:'badge-primary', PERCENTAGE:'badge-accent', TARGET:'badge-warning', FORMULA:'badge-neutral' };

  const rulesTable = rules.length === 0 ? `
  <div class="table-empty">
    <div class="table-empty-icon">${iconSvg('sliders', 40)}</div>
    <div class="table-empty-title">No adjustment rules yet</div>
    <div class="table-empty-sub">Click "Add New Rule" to create your first PIT adjustment rule.</div>
  </div>` : `
  <div class="table-wrapper">
    <table>
      <thead>
        <tr>
          <th>Rule Name</th>
          <th>Type</th>
          <th>Value</th>
          <th>Salary Range</th>
          <th>Effective Period</th>
          <th>Priority</th>
          <th style="text-align:center">Status</th>
          <th style="text-align:right">Actions</th>
        </tr>
      </thead>
      <tbody>
        ${rules.map(r => {
          const salMin = r.minSalary !== '' && r.minSalary != null ? 'MMK ' + fmtCurrency(r.minSalary) : '—';
          const salMax = r.maxSalary !== '' && r.maxSalary != null ? 'MMK ' + fmtCurrency(r.maxSalary) : '∞';
          const period = (r.effectiveFrom || '—') + ' → ' + (r.effectiveTo || 'open');
          const valDisplay = r.ruleType === 'FORMULA'
            ? `<code style="font-size:11px;background:var(--clr-surface-2);padding:2px 6px;border-radius:4px;max-width:160px;display:inline-block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${r.value}">${r.value}</code>`
            : r.ruleType === 'PERCENTAGE' ? r.value + '%'
            : r.ruleType === 'TARGET'     ? 'Target: MMK ' + fmtCurrency(r.value)
            : 'MMK ' + fmtCurrency(r.value);
          return `
          <tr>
            <td>
              <div style="font-weight:600;font-size:var(--font-size-sm)">${r.ruleName}</div>
              <div style="font-size:11px;color:var(--clr-text-muted)">${r.ruleId}</div>
            </td>
            <td><span class="badge ${typeColors[r.ruleType] || 'badge-neutral'}">${r.ruleType}</span></td>
            <td style="font-size:var(--font-size-sm)">${valDisplay}</td>
            <td style="font-size:12px;color:var(--clr-text-secondary)">${salMin} – ${salMax}</td>
            <td style="font-size:12px;color:var(--clr-text-secondary)">${period}</td>
            <td style="text-align:center">
              <span class="badge badge-neutral">${r.priority || 0}</span>
            </td>
            <td style="text-align:center">
              <label class="toggle-switch" title="${r.isActive ? 'Active — click to deactivate' : 'Inactive — click to activate'}">
                <input type="checkbox" ${r.isActive ? 'checked' : ''} onchange="togglePITRuleActive('${r.ruleId}')">
                <span class="toggle-slider"></span>
              </label>
            </td>
            <td style="text-align:right">
              <div style="display:flex;align-items:center;justify-content:flex-end;gap:4px">
                <button class="btn btn-ghost btn-sm btn-icon" title="Edit" onclick="editPITRule('${r.ruleId}')">${iconSvg('edit', 14)}</button>
                <button class="btn btn-ghost btn-sm btn-icon" title="Delete" style="color:var(--clr-danger)" onclick="deletePITRule('${r.ruleId}')">${iconSvg('trash', 14)}</button>
              </div>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>`;

  /* ── Simulate card ── */
  const simResult = document.getElementById('pit-sim-result') ? document.getElementById('pit-sim-result').innerHTML : '';

  container.innerHTML = `
  <div class="page-view">
    <div class="page-header">
      <div class="page-header-left">
        <h1 class="page-title">PIT Adjustment Rules</h1>
        <p class="page-subtitle">
          Configure rules that adjust PIT after base calculation.
          Formula: <strong>PIT Final = MAX(PIT Base − Adjustment, 0)</strong>
        </p>
      </div>
      <div class="page-header-actions">
        ${!editing ? `<button class="btn btn-primary" onclick="addNewPITRule()">${iconSvg('plus', 14)} Add New Rule</button>` : ''}
      </div>
    </div>

    <!-- How it works banner -->
    <div class="alert alert-info mb-lg">
      <div>${iconSvg('info', 16)}</div>
      <div>
        <div class="alert-title">How the Adjustment Layer Works</div>
        After calculating PIT Base using the progressive brackets, the system looks for a matching active rule.
        If found, it subtracts the adjustment amount to produce PIT Final. HR users always see only the final PIT.
        Rules are matched by salary range and effective date; the highest-priority rule wins.
      </div>
    </div>

    ${formCard}

    <!-- Simulate card -->
    <div class="card mb-lg">
      <div class="card-header">
        <div style="display:flex;align-items:center;gap:var(--sp-sm)">
          <div style="width:36px;height:36px;background:var(--clr-warning-light);border-radius:var(--radius-sm);display:flex;align-items:center;justify-content:center;color:var(--clr-warning)">${iconSvg('eye', 18)}</div>
          <div>
            <div class="card-title">Test &amp; Simulate</div>
            <div class="card-subtitle">Enter salary and period to preview which rule applies and what PIT would be</div>
          </div>
        </div>
      </div>
      <div class="card-body">
        <div class="form-grid form-grid-3">
          <div class="form-group">
            <label class="form-label">Basic Salary (MMK) <span class="required">*</span></label>
            <input type="text" id="sim-salary" class="form-control" placeholder="1,500,000"
              oninput="formatInputCommas(this)">
          </div>
          <div class="form-group">
            <label class="form-label">Pay Month</label>
            <select id="sim-month" class="form-control">
              ${[...Array(12)].map((_, i) => `<option value="${i+1}" ${new Date().getMonth() === i ? 'selected' : ''}>${monthName(i+1)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Pay Year</label>
            <input type="number" id="sim-year" class="form-control" value="${new Date().getFullYear()}" min="2020" max="2035">
          </div>
        </div>
        <div id="pit-sim-result" style="margin-top:var(--sp-md)"></div>
      </div>
      <div class="card-footer">
        <button class="btn btn-primary" onclick="runPITSimulation()">
          ${iconSvg('eye', 13)} Run Simulation
        </button>
      </div>
    </div>

    <!-- Rules table card -->
    <div class="card">
      <div class="card-header">
        <div>
          <div class="card-title">All Adjustment Rules</div>
          <div class="card-subtitle">${rules.length} rule${rules.length !== 1 ? 's' : ''} configured</div>
        </div>
        ${!editing ? `<button class="btn btn-secondary btn-sm" onclick="addNewPITRule()">${iconSvg('plus', 13)} Add Rule</button>` : ''}
      </div>
      ${rulesTable}
    </div>

  </div>`;

  /* Update value label/hint dynamically when type changes */
  window.updatePITRuleTypeHint = () => {
    const t     = document.getElementById('par-type')?.value || 'FIXED';
    const label = document.getElementById('par-value-label');
    const hint  = document.getElementById('par-value-hint');
    const inp   = document.getElementById('par-value');
    if (label) label.innerHTML = { FIXED:'Value (MMK)', PERCENTAGE:'Value (%)', TARGET:'Target PIT (MMK)', FORMULA:'Formula Expression' }[t] + ' <span class="required">*</span>';
    if (hint)  hint.textContent = ruleTypeHints[t];
    if (inp)   inp.placeholder  = { FIXED:'e.g. 10000', PERCENTAGE:'e.g. 15', TARGET:'e.g. 50000', FORMULA:'e.g. pitBase * 0.5' }[t];
  };

  /* Init label for current type */
  window.updatePITRuleTypeHint();
}

/* ── PIT Rule CRUD actions ── */
window.addNewPITRule = () => {
  STATE.pitRuleEditId = null;
  navigate('pit-rules');
};

window.editPITRule = (id) => {
  STATE.pitRuleEditId = id;
  navigate('pit-rules');
};

window.cancelPITRuleEdit = () => {
  STATE.pitRuleEditId = undefined;
  navigate('pit-rules');
};

window.deletePITRule = (id) => {
  const rule = STATE.pitAdjustmentRules.find(r => r.ruleId === id);
  if (!rule) return;
  if (!confirm(`Delete rule "${rule.ruleName}"? This cannot be undone.`)) return;
  STATE.pitAdjustmentRules = STATE.pitAdjustmentRules.filter(r => r.ruleId !== id);
  saveState();
  showToast(`Rule "${rule.ruleName}" deleted.`, 'warning');
  STATE.pitRuleEditId = undefined;
  navigate('pit-rules');
};

window.togglePITRuleActive = (id) => {
  const idx = STATE.pitAdjustmentRules.findIndex(r => r.ruleId === id);
  if (idx === -1) return;
  STATE.pitAdjustmentRules[idx].isActive = !STATE.pitAdjustmentRules[idx].isActive;
  STATE.pitAdjustmentRules[idx].updatedAt = new Date().toISOString();
  saveState();
  const r = STATE.pitAdjustmentRules[idx];
  showToast(`"${r.ruleName}" ${r.isActive ? 'activated' : 'deactivated'}.`, r.isActive ? 'success' : 'warning');
  navigate('pit-rules');
};

window.savePITRule = () => {
  const name     = document.getElementById('par-name')?.value.trim()     || '';
  const type     = document.getElementById('par-type')?.value             || 'FIXED';
  const value    = document.getElementById('par-value')?.value.trim()    || '';
  const minRaw   = document.getElementById('par-min')?.value             || '';
  const maxRaw   = document.getElementById('par-max')?.value             || '';
  const fromVal  = document.getElementById('par-from')?.value            || '';
  const toVal    = document.getElementById('par-to')?.value              || '';
  const priority = Number(document.getElementById('par-priority')?.value  || 0);
  const isActive = document.getElementById('par-active')?.checked        ?? true;

  if (!name)      { showToast('Rule Name is required.', 'error'); document.getElementById('par-name').focus(); return; }
  if (!value)     { showToast('Value / Expression is required.', 'error'); document.getElementById('par-value').focus(); return; }
  if (!fromVal)   { showToast('Effective From date is required.', 'error'); return; }

  const minSalary = minRaw ? parseCurrencyInput(minRaw) : '';
  const maxSalary = maxRaw ? parseCurrencyInput(maxRaw) : '';

  const isNew = STATE.pitRuleEditId === null;
  const now   = new Date().toISOString();

  if (isNew) {
    const rule = {
      ruleId:       'pit_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36),
      ruleName:     name,
      ruleType:     type,
      value,
      minSalary,
      maxSalary,
      effectiveFrom: fromVal,
      effectiveTo:   toVal || '',
      priority,
      isActive,
      createdAt:    now,
      updatedAt:    now,
    };
    STATE.pitAdjustmentRules.push(rule);
    showToast(`Rule "${name}" added.`, 'success');
  } else {
    const idx = STATE.pitAdjustmentRules.findIndex(r => r.ruleId === STATE.pitRuleEditId);
    if (idx === -1) { showToast('Rule not found.', 'error'); return; }
    STATE.pitAdjustmentRules[idx] = {
      ...STATE.pitAdjustmentRules[idx],
      ruleName:     name,
      ruleType:     type,
      value,
      minSalary,
      maxSalary,
      effectiveFrom: fromVal,
      effectiveTo:   toVal || '',
      priority,
      isActive,
      updatedAt:    now,
    };
    showToast(`Rule "${name}" updated.`, 'success');
  }

  saveState();
  STATE.pitRuleEditId = undefined;
  navigate('pit-rules');
};

window.runPITSimulation = () => {
  const salaryRaw = document.getElementById('sim-salary')?.value || '';
  const month     = Number(document.getElementById('sim-month')?.value  || new Date().getMonth() + 1);
  const year      = Number(document.getElementById('sim-year')?.value   || new Date().getFullYear());
  const salary    = parseCurrencyInput(salaryRaw);

  if (!salary) {
    document.getElementById('pit-sim-result').innerHTML = `
    <div class="alert alert-warning"><div>${iconSvg('alert-circle',16)}</div><div>Enter a basic salary to simulate.</div></div>`;
    return;
  }

  /* Use sample values for transport + phone just for simulation */
  const transport = Number(STATE.globalSettings.transportAllowance || 0);
  const c = calculatePayslip(salary, transport, 0, month, year);
  const period = `${monthName(month)} ${year}`;

  document.getElementById('pit-sim-result').innerHTML = `
  <div style="background:var(--clr-surface-2);border:1px solid var(--clr-border);border-radius:var(--radius-md);padding:var(--sp-lg);font-size:var(--font-size-sm)">
    <div style="font-weight:700;margin-bottom:var(--sp-md);color:var(--clr-text-primary)">
      Simulation Result — Basic Salary MMK ${fmtCurrency(salary)}, ${period}
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:var(--sp-md)">
      ${[
        ['PIT Base',             fmtCurrency(c.monthlyPITBase), 'text-secondary'],
        ['Adjustment Applied',   c.hasAdjustment ? '− MMK ' + fmtCurrency(c.pitAdjustmentApplied) : 'None', c.hasAdjustment ? 'accent' : 'text-muted'],
        ['Rule Used',            c.hasAdjustment ? c.pitRuleUsed + ' (' + c.pitAdjustmentType + ')' : '—', 'text-secondary'],
        ['PIT Final',            fmtCurrency(c.pitFinal), 'primary'],
        ['SSB Employee',         fmtCurrency(c.monthlySSB), 'text-secondary'],
        ['Net Pay (est.)',        fmtCurrency(c.netPay), 'accent'],
      ].map(([l,v,col]) => `
      <div style="background:var(--clr-surface);padding:var(--sp-md);border-radius:var(--radius-sm);border:1px solid var(--clr-border)">
        <div style="font-size:var(--font-size-xs);font-weight:600;color:var(--clr-text-muted);text-transform:uppercase;letter-spacing:.05em">${l}</div>
        <div style="font-weight:700;color:var(--clr-${col});margin-top:3px">${v}</div>
      </div>`).join('')}
    </div>
    ${!c.hasAdjustment ? `
    <div style="margin-top:var(--sp-md);color:var(--clr-text-muted);font-size:var(--font-size-xs)">
      ${iconSvg('info',12)} No active adjustment rule matched this salary and period. Add a rule above to apply adjustments.
    </div>` : ''}
  </div>`;
};

/* ═══════════════════════════════════════════════════════
   SCREEN: IMPORT EMPLOYEES
   Bulk upload via CSV or Excel with validation preview.
═══════════════════════════════════════════════════════ */
function renderImportEmployees(container) {

  /* ── Template column definitions ── */
  const COLS = [
    { label: 'Employee Name*',         field: 'name',         req: true,  example: 'U Kyaw Zin Oo',                       note: '' },
    { label: 'Employee Number*',       field: 'employeeNo',   req: true,  example: 'EMP-001',                             note: 'Must be unique' },
    { label: 'NRC',                    field: 'nrc',          req: false, example: '12/OKHANA(N)123456',                  note: '' },
    { label: 'Join Date (YYYY-MM-DD)', field: 'joinDate',     req: false, example: '2023-01-15',                          note: 'ISO date format' },
    { label: 'SSB Card No',            field: 'ssbCardNo',    req: false, example: 'SSB-00123',                           note: '' },
    { label: 'Bank Account Number',    field: 'bankAccountNo',req: false, example: 'KBZ-0001234567',                      note: '' },
    { label: 'Employer Name',          field: 'employerName', req: false, example: STATE.globalSettings.employerName||'', note: 'Auto-filled from Global Settings' },
    { label: 'Branch',                 field: 'branch',       req: false, example: STATE.globalSettings.defaultBranch||'',note: 'Auto-filled from Global Settings' },
    { label: 'Department',             field: 'department',   req: false, example: 'Finance',                             note: '' },
    { label: 'Designation',            field: 'designation',  req: false, example: 'Manager',                             note: '' },
  ];

  /* Column header → employee field (flexible, case-insensitive) */
  function mapCol(header) {
    const h = String(header).toLowerCase().replace(/\*/g,'').replace(/\(.*?\)/g,'').trim();
    return ({
      'employee name':'name','name':'name','full name':'name','staff name':'name',
      'employee number':'employeeNo','employee no':'employeeNo','emp no':'employeeNo',
      'emp number':'employeeNo','employee id':'employeeNo','staff id':'employeeNo','id':'employeeNo',
      'nrc':'nrc','nrc number':'nrc','nrc no':'nrc',
      'join date':'joinDate','joining date':'joinDate','date of joining':'joinDate','start date':'joinDate',
      'ssb card no':'ssbCardNo','ssb card':'ssbCardNo','ssb no':'ssbCardNo','ssb':'ssbCardNo',
      'bank account number':'bankAccountNo','bank account':'bankAccountNo','bank ac number':'bankAccountNo',
      'bank account no':'bankAccountNo','bank ac':'bankAccountNo','account number':'bankAccountNo',
      'employer name':'employerName','employer':'employerName','company':'employerName','company name':'employerName',
      'branch':'branch','office':'branch','location':'branch',
      'department':'department','dept':'department','division':'department',
      'designation':'designation','position':'designation','job title':'designation','title':'designation','role':'designation',
    })[h] || null;
  }

  /* Validate a single mapped row against existing data + current batch */
  function validateRow(emp, batchNos) {
    const errors   = [];
    const warnings = [];
    if (!emp.name)       errors.push('Employee Name is required');
    if (!emp.employeeNo) errors.push('Employee Number is required');
    if (emp.employeeNo) {
      if (batchNos.has(emp.employeeNo))
        errors.push(`Duplicate Employee No in this file`);
      if (STATE.employees.some(e => e.employeeNo === emp.employeeNo))
        warnings.push('Already exists in system — will be skipped');
    }
    if (emp.joinDate && isNaN(new Date(emp.joinDate).getTime()))
      warnings.push('Join Date not recognised — will be left blank');

    const existsAlready = emp.employeeNo && STATE.employees.some(e => e.employeeNo === emp.employeeNo);
    const status = errors.length ? 'error' : existsAlready ? 'skip' : 'valid';
    return { errors, warnings, status };
  }

  /* Convert raw parsed rows → validated import rows */
  let importRows = [];

  function processRawRows(rawRows) {
    if (!rawRows.length) { showToast('No data rows found in file.', 'warning'); return; }

    /* Map each raw object through the column mapper */
    const batchNos = new Set();
    const mapped = rawRows
      .map(raw => {
        const emp = {};
        Object.keys(raw).forEach(h => {
          const f = mapCol(h);
          if (f) emp[f] = String(raw[h] || '').trim();
        });
        if (!emp.employerName) emp.employerName = STATE.globalSettings.employerName || '';
        if (!emp.branch)       emp.branch       = STATE.globalSettings.defaultBranch || '';
        return emp;
      })
      .filter(emp => emp.name || emp.employeeNo);   // drop blank rows

    if (!mapped.length) {
      showToast('No matching columns found. Please use the provided template.', 'error');
      return;
    }

    importRows = mapped.map((emp, i) => {
      const { errors, warnings, status } = validateRow(emp, batchNos);
      if (emp.employeeNo && status !== 'skip') batchNos.add(emp.employeeNo);
      return { ...emp, _row: i + 2, _errors: errors, _warnings: warnings, _status: status };
    });

    renderPreview();
  }

  /* Parse file based on extension */
  function parseFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (file.size > 5 * 1024 * 1024) { showToast('File too large (max 5 MB).', 'error'); return; }

    if (ext === 'csv') {
      const reader = new FileReader();
      reader.onload  = e => processRawRows(parseCSVContent(e.target.result));
      reader.onerror = () => showToast('Could not read file.', 'error');
      reader.readAsText(file, 'UTF-8');

    } else if (ext === 'xlsx' || ext === 'xls') {
      if (!window.XLSX) { showToast('Excel library not loaded — please upload a .csv file.', 'warning'); return; }
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const wb   = XLSX.read(e.target.result, { type: 'array', cellDates: true });
          const ws   = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
          processRawRows(rows);
        } catch (err) {
          showToast('Failed to parse Excel file. Try saving as .csv first.', 'error');
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      showToast('Unsupported file. Please upload .csv, .xlsx, or .xls', 'error');
    }
  }

  /* Update the upload zone visual state */
  function setUploadZoneState(name, sizeKB) {
    const zone  = document.getElementById('upload-zone');
    const label = document.getElementById('upload-zone-label');
    if (zone)  { zone.classList.add('file-loaded'); }
    if (label) { label.innerHTML = `${iconSvg('file-check',18)} <strong>${name}</strong> &nbsp;·&nbsp; ${sizeKB.toFixed(1)} KB — parsing…`; }
  }

  /* Render/refresh the validation preview section */
  function renderPreview() {
    const total   = importRows.length;
    const valid   = importRows.filter(r => r._status === 'valid').length;
    const skipped = importRows.filter(r => r._status === 'skip').length;
    const errors  = importRows.filter(r => r._status === 'error').length;

    const statusBadge = r =>
      r._status === 'valid' ? `<span class="badge badge-accent">${iconSvg('check',10)} Ready</span>` :
      r._status === 'skip'  ? `<span class="badge badge-warning">${iconSvg('alert-circle',10)} Exists</span>` :
                              `<span class="badge badge-danger">${iconSvg('x',10)} Error</span>`;

    const issueText = r => [...r._errors, ...r._warnings].join(' · ') || '';

    const el = document.getElementById('import-preview');
    if (!el) return;

    el.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div>
          <div class="card-title">Step 3 — Review &amp; Import</div>
          <div class="card-subtitle">${total} row${total !== 1 ? 's' : ''} parsed from file</div>
        </div>
        <div style="display:flex;gap:var(--sp-sm);align-items:center;flex-wrap:wrap">
          <span class="badge badge-accent" style="font-size:var(--font-size-sm)">${valid} ready</span>
          ${skipped ? `<span class="badge badge-warning" style="font-size:var(--font-size-sm)">${skipped} exist</span>` : ''}
          ${errors  ? `<span class="badge badge-danger"  style="font-size:var(--font-size-sm)">${errors} errors</span>` : ''}
        </div>
      </div>

      ${valid === 0 && skipped === 0 ? `
      <div class="card-body">
        <div class="alert alert-warning">
          <div>${iconSvg('alert-triangle',16)}</div>
          <div>
            <div class="alert-title">Nothing to import</div>
            All rows have errors. Fix the issues in your file and re-upload.
          </div>
        </div>
      </div>` : valid === 0 && skipped > 0 ? `
      <div class="card-body">
        <div class="alert alert-info">
          <div>${iconSvg('info',16)}</div>
          <div>
            <div class="alert-title">All employees already exist</div>
            Every Employee Number in this file matches an existing record. No new records will be added.
          </div>
        </div>
      </div>` : ''}

      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th style="width:44px">#</th>
              <th style="width:90px">Status</th>
              <th>Name</th>
              <th>Emp No</th>
              <th>Department</th>
              <th>Designation</th>
              <th>Branch</th>
              <th>Issue</th>
            </tr>
          </thead>
          <tbody>
            ${importRows.map(r => `
            <tr class="import-row-${r._status}">
              <td style="color:var(--clr-text-muted);font-size:11px">${r._row}</td>
              <td>${statusBadge(r)}</td>
              <td style="font-weight:600">${r.name || `<em style="color:var(--clr-danger)">missing</em>`}</td>
              <td>
                ${r.employeeNo
                  ? `<code style="font-size:12px;background:var(--clr-surface-2);padding:2px 6px;border-radius:4px">${r.employeeNo}</code>`
                  : `<em style="color:var(--clr-danger);font-size:12px">missing</em>`}
              </td>
              <td style="font-size:12px;color:var(--clr-text-secondary)">${r.department||'—'}</td>
              <td style="font-size:12px;color:var(--clr-text-secondary)">${r.designation||'—'}</td>
              <td style="font-size:12px;color:var(--clr-text-secondary)">${r.branch||'—'}</td>
              <td style="font-size:11px;color:${r._errors.length ? 'var(--clr-danger)' : 'var(--clr-warning)'}">
                ${issueText(r)}
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>

      <div class="card-footer">
        <button class="btn btn-secondary" onclick="clearImportSession()">
          ${iconSvg('refresh-cw',13)} Clear &amp; Re-upload
        </button>
        <div style="flex:1"></div>
        ${valid > 0 ? `
        <button class="btn btn-primary" onclick="executeEmployeeImport()">
          ${iconSvg('check',13)} Import ${valid} Employee${valid !== 1 ? 's' : ''}
        </button>` : ''}
      </div>
    </div>`;
  }

  /* ── Global action handlers ── */
  window.executeEmployeeImport = () => {
    const toAdd = importRows.filter(r => r._status === 'valid');
    if (!toAdd.length) { showToast('No valid rows to import.', 'warning'); return; }

    const now  = new Date().toISOString();
    const news = toAdd.map(r => ({
      id:            uuid(),
      name:          r.name          || '',
      employeeNo:    r.employeeNo    || '',
      nrc:           r.nrc           || '',
      joinDate:      r.joinDate && !isNaN(new Date(r.joinDate)) ? r.joinDate : '',
      ssbCardNo:     r.ssbCardNo     || '',
      bankAccountNo: r.bankAccountNo || '',
      employerName:  r.employerName  || STATE.globalSettings.employerName || '',
      branch:        r.branch        || STATE.globalSettings.defaultBranch || '',
      department:    r.department    || '',
      designation:   r.designation   || '',
      createdAt:     now,
    }));

    STATE.employees.push(...news);
    saveState();
    showToast(`${news.length} employee${news.length !== 1 ? 's' : ''} imported successfully.`, 'success');
    navigate('employees');
  };

  window.clearImportSession = () => {
    importRows = [];
    const zone  = document.getElementById('upload-zone');
    const label = document.getElementById('upload-zone-label');
    const fi    = document.getElementById('file-input');
    const prev  = document.getElementById('import-preview');
    if (zone)  { zone.classList.remove('file-loaded'); zone.style.borderColor = ''; zone.style.background = ''; }
    if (label) { label.textContent = 'Drop your CSV or Excel file here, or click to browse'; }
    if (fi)    { fi.value = ''; }
    if (prev)  { prev.innerHTML = ''; }
  };

  window.handleImportFile = (source) => {
    const file = source instanceof Event
      ? source.dataTransfer.files[0]
      : source.files[0];
    if (!file) return;
    setUploadZoneState(file.name, file.size / 1024);
    parseFile(file);
  };

  /* ── Template download ── */
  window.downloadEmpTemplate = (fmt) => {
    const headers = COLS.map(c => c.label);
    const sample  = COLS.map(c => c.example);

    if (fmt === 'csv') {
      const csv  = [headers, sample]
        .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
        .join('\n');
      triggerDownload(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }), 'Employee_Import_Template.csv');

    } else if (fmt === 'xlsx') {
      if (!window.XLSX) { showToast('Excel library not loaded. Download the CSV template instead.', 'warning'); return; }
      const ws = XLSX.utils.aoa_to_sheet([headers, sample]);
      ws['!cols'] = headers.map((_, i) => ({ wch: i < 2 ? 24 : 20 }));
      /* Bold the header row */
      headers.forEach((_, i) => {
        const cell = ws[XLSX.utils.encode_cell({ r: 0, c: i })];
        if (cell) cell.s = { font: { bold: true } };
      });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Employees');
      XLSX.writeFile(wb, 'Employee_Import_Template.xlsx');
    }
  };

  /* ── Render page ── */
  container.innerHTML = `
  <div class="page-view">

    <div class="page-header">
      <div class="page-header-left">
        <h1 class="page-title">Import Employees</h1>
        <p class="page-subtitle">Bulk-upload employee profiles from a CSV or Excel file in three steps.</p>
      </div>
      <div class="page-header-actions">
        <button class="btn btn-secondary" onclick="navigate('employees')">
          ${iconSvg('arrow-right',13)} Back to Employees
        </button>
      </div>
    </div>

    <!-- ─── Step 1: Download template ─── -->
    <div class="card mb-lg">
      <div class="card-header">
        <div style="display:flex;align-items:center;gap:var(--sp-sm)">
          <div style="width:32px;height:32px;background:var(--clr-primary-light);border-radius:var(--radius-sm);display:flex;align-items:center;justify-content:center;color:var(--clr-primary)">
            <span style="font-weight:800;font-size:13px">1</span>
          </div>
          <div>
            <div class="card-title">Download Template</div>
            <div class="card-subtitle">Use our template — do not change column headers</div>
          </div>
        </div>
        <div style="display:flex;gap:var(--sp-sm)">
          <button class="btn btn-secondary" onclick="downloadEmpTemplate('csv')">
            ${iconSvg('download',13)} CSV Template
          </button>
          <button class="btn btn-secondary" onclick="downloadEmpTemplate('xlsx')">
            ${iconSvg('download',13)} Excel Template
          </button>
        </div>
      </div>
      <div class="card-body compact">
        <table class="template-guide" style="width:100%;border-collapse:collapse">
          <thead>
            <tr>
              <th style="text-align:left">Column</th>
              <th>Required</th>
              <th style="text-align:left">Example Value</th>
              <th style="text-align:left">Notes</th>
            </tr>
          </thead>
          <tbody>
            ${COLS.map(c => `
            <tr>
              <td><strong style="font-size:var(--font-size-xs)">${c.label}</strong></td>
              <td style="text-align:center">
                ${c.req
                  ? `<span class="badge badge-danger" style="font-size:10px">Required</span>`
                  : `<span class="badge badge-neutral" style="font-size:10px">Optional</span>`}
              </td>
              <td style="color:var(--clr-text-muted);font-style:italic;font-size:var(--font-size-xs)">${c.example || '—'}</td>
              <td style="color:var(--clr-text-muted);font-size:var(--font-size-xs)">${c.note}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- ─── Step 2: Upload ─── -->
    <div class="card mb-lg">
      <div class="card-header">
        <div style="display:flex;align-items:center;gap:var(--sp-sm)">
          <div style="width:32px;height:32px;background:var(--clr-accent-light);border-radius:var(--radius-sm);display:flex;align-items:center;justify-content:center;color:var(--clr-accent)">
            <span style="font-weight:800;font-size:13px">2</span>
          </div>
          <div>
            <div class="card-title">Upload Your File</div>
            <div class="card-subtitle">Drag &amp; drop or click to browse — .csv, .xlsx, .xls · max 5 MB</div>
          </div>
        </div>
      </div>
      <div class="card-body">
        <div class="upload-zone" id="upload-zone"
          onclick="document.getElementById('file-input').click()"
          ondragover="event.preventDefault();this.classList.add('drag-over')"
          ondragleave="this.classList.remove('drag-over')"
          ondrop="event.preventDefault();this.classList.remove('drag-over');handleImportFile(event)">
          <div class="upload-zone-icon">${iconSvg('upload-cloud', 44)}</div>
          <div class="upload-zone-title" id="upload-zone-label">
            Drop your CSV or Excel file here, or click to browse
          </div>
          <div class="upload-zone-sub">Accepts: .csv &nbsp;·&nbsp; .xlsx &nbsp;·&nbsp; .xls &nbsp;·&nbsp; Max 5 MB</div>
        </div>
        <input type="file" id="file-input" accept=".csv,.xlsx,.xls" style="display:none"
          onchange="handleImportFile(this)">
      </div>
    </div>

    <!-- ─── Step 3: Preview (shown after upload) ─── -->
    <div id="import-preview"></div>

  </div>`;
}

/* ═══════════════════════════════════════════════════════
   SCREEN: MONTHLY PAYROLL RUN
   Pre-fill from last month, review, bulk edit, and generate.
═══════════════════════════════════════════════════════ */
function renderMonthlyPayroll(container) {
  /* Initialize payroll session (month/year/filter selection only) */
  if (!window._payrollSession) {
    const now = new Date();
    window._payrollSession = {
      year:   now.getFullYear(),
      month:  now.getMonth() + 1,
      filter: { dept: '' },
    };
  }
  const s  = window._payrollSession;
  const gs = STATE.globalSettings;

  /* Period key for STATE.payrollRecords */
  const periodKey = () => `${s.year}-${s.month}`;

  /*
   * Salary resolution order (gives effortless month-to-month carry-forward):
   *   1. This month's saved record
   *   2. The employee's standing basicSalary (last value they were paid)
   *   3. 0
   */
  function getSalary(emp) {
    const rec = STATE.payrollRecords[periodKey()];
    if (rec && rec[emp.id] && typeof rec[emp.id].basicSalary === 'number') {
      return rec[emp.id].basicSalary;
    }
    return Number(emp.basicSalary) || 0;
  }
  function getPhone(emp) {
    const rec = STATE.payrollRecords[periodKey()];
    if (rec && rec[emp.id] && typeof rec[emp.id].phoneAllowance === 'number') {
      return rec[emp.id].phoneAllowance;
    }
    return Number(emp.phoneAllowance) || 0;
  }

  /* Persist a salary edit for the active period + update the standing value */
  function persistSalary(emp, salary) {
    const key = periodKey();
    if (!STATE.payrollRecords[key]) STATE.payrollRecords[key] = {};
    if (!STATE.payrollRecords[key][emp.id]) STATE.payrollRecords[key][emp.id] = {};
    STATE.payrollRecords[key][emp.id].basicSalary   = salary;
    STATE.payrollRecords[key][emp.id].phoneAllowance = getPhone(emp);
    /* update the standing value so future months pre-fill automatically */
    const idx = STATE.employees.findIndex(e => e.id === emp.id);
    if (idx !== -1) STATE.employees[idx].basicSalary = salary;
    saveState();
  }

  /* ── Helpers ── */
  window.setPayrollMonth = (y, m) => {
    s.year = parseInt(y); s.month = parseInt(m);
    renderMonthlyPayroll(container);
  };

  window.setPayrollDept = (d) => {
    s.filter.dept = d;
    renderMonthlyPayroll(container);
  };

  /* Inline save — fires on blur. No full re-render (keeps focus smooth);
     just reformats the field, recomputes the total, and flashes "Saved". */
  window.updatePayrollSalary = (empId, rawVal, inputEl) => {
    const emp = STATE.employees.find(e => e.id === empId);
    if (!emp) return;
    const salary = parseCurrencyInput(rawVal);
    persistSalary(emp, salary);
    if (inputEl) inputEl.value = salary ? fmtCurrency(salary) : '';
    /* recompute total */
    const totEl = document.getElementById('pr-total');
    if (totEl) {
      const list = filteredEmployees();
      totEl.textContent = fmtCurrency(list.reduce((sum, e) => sum + getSalary(e), 0));
    }
    /* flash a saved indicator on the row */
    const flag = document.getElementById('saved-' + empId);
    if (flag) {
      flag.style.opacity = '1';
      clearTimeout(flag._t);
      flag._t = setTimeout(() => { flag.style.opacity = '0'; }, 1200);
    }
  };

  /* Send one employee straight to the payslip preview, fully pre-filled. */
  window.payrollGenerateOne = (empId) => {
    const emp = STATE.employees.find(e => e.id === empId);
    if (!emp) return;
    const salary = getSalary(emp);
    if (!salary || salary <= 0) { showToast('Set a basic salary first.', 'warning'); return; }
    if (gs.transportAllowance === '' || gs.transportAllowance == null) {
      showToast('Transport allowance not configured. Go to Global Settings.', 'error'); return;
    }
    STATE.payslipDraft = {
      selectedEmployeeId: emp.id,
      basicSalary:        salary,
      phoneAllowance:     getPhone(emp),
      month:              s.month,
      year:               s.year,
      step:               2,           // jump straight to preview / download
    };
    saveState();
    navigate('payslip');
  };

  /* Bulk: open one print window with every payslip stacked (one per page). */
  window.generateAllPayslips = () => {
    const list    = filteredEmployees();
    const ready   = list.filter(e => getSalary(e) > 0);
    const missing = list.length - ready.length;
    if (!ready.length) { showToast('No employees have a salary set yet.', 'warning'); return; }
    if (gs.transportAllowance === '' || gs.transportAllowance == null) {
      showToast('Transport allowance not configured. Go to Global Settings.', 'error'); return;
    }
    if (missing > 0 && !confirm(`${missing} employee(s) have no salary and will be skipped.\n\nGenerate ${ready.length} payslip(s)?`)) return;

    const pages = ready.map(e => payslipPageHTML(e, getSalary(e), getPhone(e), s.month, s.year)).join('\n');
    openPayslipPrintWindow(`Payroll_${s.year}-${String(s.month).padStart(2,'0')}`, pages);
    showToast(`Opened ${ready.length} payslip${ready.length !== 1 ? 's' : ''} for printing.`, 'success');
  };

  window.exportPayrollCSV = () => {
    const list = filteredEmployees();
    if (!list.length) { showToast('No data to export.', 'warning'); return; }
    const headers = ['Employee Name', 'Employee No', 'Department', 'Basic Salary', 'Pay Period'];
    const period  = `${monthName(s.month)} ${s.year}`;
    let csv = headers.map(h => `"${h}"`).join(',') + '\n';
    csv += list.map(e =>
      [e.name, e.employeeNo || '', e.department || '', getSalary(e), period]
        .map(c => `"${c}"`).join(',')
    ).join('\n');
    const fileName = `Payroll_${s.year}-${String(s.month).padStart(2,'0')}.csv`;
    triggerDownload(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }), fileName);
    showToast(`Exported ${list.length} row${list.length !== 1 ? 's' : ''}.`, 'success');
  };

  /* Employees in the active department filter */
  function filteredEmployees() {
    return STATE.employees
      .filter(e => !s.filter.dept || e.department === s.filter.dept)
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }

  const list        = filteredEmployees();
  const depts       = [...new Set(STATE.employees.map(e => e.department).filter(Boolean))].sort();
  const totalSalary = list.reduce((sum, e) => sum + getSalary(e), 0);
  const setCount    = list.filter(e => getSalary(e) > 0).length;
  const noTransport = gs.transportAllowance === '' || gs.transportAllowance == null;

  container.innerHTML = `
  <div class="page-view">

    <div class="page-header">
      <div class="page-header-left">
        <h1 class="page-title">Monthly Payroll Run</h1>
        <p class="page-subtitle">Salaries pre-fill from the previous month — just review, edit what changed, and generate.</p>
      </div>
      <div class="page-header-actions">
        <button class="btn btn-secondary btn-sm" onclick="exportPayrollCSV()">
          ${iconSvg('download',13)} Export CSV
        </button>
        <button class="btn btn-primary" onclick="generateAllPayslips()">
          ${iconSvg('zap',13)} Generate All (${setCount})
        </button>
      </div>
    </div>

    ${noTransport ? `
    <div class="alert alert-warning mb-lg">
      <div>${iconSvg('alert-circle', 16)}</div>
      <div>
        <div class="alert-title">Transport Allowance Not Configured</div>
        Payslips cannot be generated until transport allowance is set.
        <a href="#" onclick="navigate('settings');return false;" style="color:inherit;font-weight:700;text-decoration:underline;margin-left:6px">Configure now →</a>
      </div>
    </div>` : ''}

    <!-- Filters -->
    <div class="card mb-lg">
      <div class="card-body" style="display:flex;align-items:flex-end;gap:var(--sp-lg);flex-wrap:wrap">
        <div style="flex:0 1 auto">
          <label class="form-label" style="display:block;margin-bottom:var(--sp-sm)">Pay Period</label>
          <div style="display:flex;gap:var(--sp-xs)">
            <select id="pr-month" class="form-control" style="width:140px"
              onchange="setPayrollMonth(document.getElementById('pr-year').value, this.value)">
              ${Array.from({length:12}, (_, i) => i+1).map(m => `<option value="${m}" ${m === s.month ? 'selected' : ''}>${monthName(m)}</option>`).join('')}
            </select>
            <select id="pr-year" class="form-control" style="width:100px"
              onchange="setPayrollMonth(this.value, document.getElementById('pr-month').value)">
              ${[2024, 2025, 2026, 2027].map(y => `<option value="${y}" ${y === s.year ? 'selected' : ''}>${y}</option>`).join('')}
            </select>
          </div>
        </div>
        <div style="flex:0 1 auto">
          <label class="form-label" style="display:block;margin-bottom:var(--sp-sm)">Department</label>
          <select class="form-control" onchange="setPayrollDept(this.value)" style="min-width:180px">
            <option value="">— All Departments —</option>
            ${depts.map(d => `<option value="${d}" ${s.filter.dept === d ? 'selected' : ''}>${d}</option>`).join('')}
          </select>
        </div>
        <div style="flex:1"></div>
        <div style="text-align:right">
          <div style="font-size:var(--font-size-xs);color:var(--clr-text-muted);margin-bottom:4px">Total Payroll · ${monthName(s.month)} ${s.year}</div>
          <div id="pr-total" style="font-size:24px;font-weight:700;color:var(--clr-primary)">${fmtCurrency(totalSalary)}</div>
        </div>
      </div>
    </div>

    <!-- Payroll table -->
    <div class="card">
      <div class="card-header">
        <div>
          <div class="card-title">Employees</div>
          <div class="card-subtitle">${list.length} employee${list.length !== 1 ? 's' : ''} · ${s.filter.dept || 'all departments'} · ${setCount} with salary set</div>
        </div>
      </div>
      ${list.length === 0 ? `
      <div class="table-empty">
        <div class="table-empty-icon">${iconSvg('users',36)}</div>
        <div class="table-empty-title">No employees</div>
        <div class="table-empty-sub">Add employees first or adjust the department filter.</div>
      </div>` : `
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th style="width:44px">#</th>
              <th>Employee</th>
              <th>Department</th>
              <th style="text-align:right">Basic Salary (MMK)</th>
              <th style="text-align:right;width:120px">Payslip</th>
            </tr>
          </thead>
          <tbody>
            ${list.map((emp, i) => {
              const sal = getSalary(emp);
              return `
            <tr>
              <td style="color:var(--clr-text-muted);font-size:11px">${i + 1}</td>
              <td>
                <div style="font-weight:600">${emp.name}</div>
                <div style="font-size:11px;color:var(--clr-text-muted)">${emp.employeeNo || emp.id.slice(0,8)}${emp.designation ? ' · ' + emp.designation : ''}</div>
              </td>
              <td><span class="badge badge-neutral">${emp.department || '—'}</span></td>
              <td style="text-align:right;white-space:nowrap">
                <input type="text" class="form-control" style="text-align:right;max-width:150px;display:inline-block"
                  value="${sal ? fmtCurrency(sal) : ''}"
                  placeholder="0.00"
                  oninput="formatInputCommas(this)"
                  onchange="updatePayrollSalary('${emp.id}', this.value, this)">
                <span id="saved-${emp.id}" style="display:inline-block;margin-left:6px;font-size:11px;color:var(--clr-accent);opacity:0;transition:opacity .2s;font-weight:600">✓ Saved</span>
              </td>
              <td style="text-align:right">
                <button class="btn ${sal > 0 ? 'btn-secondary' : 'btn-ghost'} btn-sm"
                  ${sal > 0 ? '' : 'disabled style="opacity:.4;cursor:not-allowed"'}
                  title="Generate &amp; preview payslip"
                  onclick="payrollGenerateOne('${emp.id}')">
                  ${iconSvg('arrow-right',13)} Generate
                </button>
              </td>
            </tr>`; }).join('')}
          </tbody>
        </table>
      </div>`}
    </div>

  </div>`;
}

/* ═══════════════════════════════════════════════════════
   SCREEN: MASTER DATA
   Departments · Designations · Branches
   These lists power all employee form dropdowns.
═══════════════════════════════════════════════════════ */
function renderMasterData(container) {
  const tab  = STATE.masterDataActiveTab || 'departments';

  const TABS = {
    departments:  { label: 'Departments',  icon: 'briefcase', singular: 'Department'  },
    designations: { label: 'Designations', icon: 'star',      singular: 'Designation' },
    branches:     { label: 'Branches',     icon: 'building',  singular: 'Branch'      },
  };

  /* ── Pending import preview (stored on window to survive re-render) ── */
  if (!window._mdImportPreview) window._mdImportPreview = { type: '', names: [] };

  /* ── Helpers exposed globally so onclick works ── */
  window.switchMDTab = (t) => { STATE.masterDataActiveTab = t; navigate('master-data'); };

  window.addMDItem = () => {
    const input = document.getElementById('md-new-name');
    const name  = (input ? input.value : '').trim();
    if (!name) { showToast('Please enter a name.', 'error'); if (input) input.focus(); return; }
    if (STATE.masterData[tab].some(i => i.name.toLowerCase() === name.toLowerCase())) {
      showToast(`"${name}" already exists.`, 'warning'); return;
    }
    STATE.masterData[tab].push({ id: mdId(TABS[tab].singular.toLowerCase()), name, createdAt: new Date().toISOString() });
    saveState(); showToast(`"${name}" added.`, 'success'); navigate('master-data');
  };

  window.removeMDItem = (id) => {
    const item = STATE.masterData[tab].find(i => i.id === id);
    if (!item) return;
    if (!confirm(`Remove "${item.name}"?\n\nExisting employees using this value are not affected.`)) return;
    STATE.masterData[tab] = STATE.masterData[tab].filter(i => i.id !== id);
    saveState(); showToast(`"${item.name}" removed.`, 'warning'); navigate('master-data');
  };

  window.downloadMDTemplate = () => {
    const label    = TABS[tab].label;
    const examples = STATE.masterData[tab].slice(0, 3).map(i => `"${i.name}"`).join('\n')
      || { departments: '"Finance"\n"HR"\n"IT"', designations: '"Manager"\n"Executive"\n"Officer"', branches: '"Yangon HQ"\n"Mandalay"\n"Nay Pyi Taw"' }[tab];
    const csv = `"Name"\n${examples}`;
    triggerDownload(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }), `${label}_Template.csv`);
  };

  window.handleMDFile = (source) => {
    const file = (source instanceof Event) ? source.dataTransfer.files[0] : source.files[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) { showToast('Only .csv files supported.', 'error'); return; }
    const reader = new FileReader();
    reader.onload = e => {
      const rows  = parseCSVContent(e.target.result);
      const names = rows.map(row => {
        const k = Object.keys(row).find(h => h.replace(/\*/g,'').trim().toLowerCase() === 'name');
        return k ? String(row[k]).trim() : '';
      }).filter(Boolean);
      if (!names.length) { showToast('No "Name" column found. Use the template.', 'error'); return; }

      const existing = new Set(STATE.masterData[tab].map(i => i.name.toLowerCase()));
      window._mdImportPreview = {
        type:   tab,
        newItems: names.filter(n => !existing.has(n.toLowerCase())),
        dupItems: names.filter(n =>  existing.has(n.toLowerCase())),
      };
      renderMDImportPreview();
    };
    reader.readAsText(file, 'UTF-8');
  };

  window.confirmMDImport = () => {
    const p   = window._mdImportPreview;
    if (!p || !p.newItems.length) return;
    const now = new Date().toISOString();
    const added = p.newItems.map(name => ({ id: mdId(TABS[p.type].singular.toLowerCase()), name, createdAt: now }));
    STATE.masterData[p.type].push(...added);
    saveState();
    window._mdImportPreview = { type: '', newItems: [], dupItems: [] };
    showToast(`${added.length} item${added.length !== 1 ? 's' : ''} imported.`, 'success');
    navigate('master-data');
  };

  function renderMDImportPreview() {
    const p  = window._mdImportPreview;
    const el = document.getElementById('md-import-preview');
    if (!el || !p) return;
    el.innerHTML = `
    <div style="margin-top:var(--sp-lg);padding:var(--sp-lg);background:var(--clr-surface-2);border:1px solid var(--clr-border);border-radius:var(--radius-md)">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:var(--sp-sm);margin-bottom:var(--sp-md)">
        <div style="font-size:var(--font-size-sm)">
          <strong>${p.newItems.length + p.dupItems.length} rows</strong> &nbsp;·&nbsp;
          <span style="color:var(--clr-accent)">${p.newItems.length} new</span>
          ${p.dupItems.length ? ` &nbsp;·&nbsp; <span style="color:var(--clr-text-muted)">${p.dupItems.length} already exist (skipped)</span>` : ''}
        </div>
        ${p.newItems.length ? `
        <button class="btn btn-primary btn-sm" onclick="confirmMDImport()">
          ${iconSvg('check',13)} Import ${p.newItems.length} Item${p.newItems.length !== 1 ? 's' : ''}
        </button>` : ''}
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:var(--sp-xs)">
        ${p.newItems.map(n => `<span class="badge badge-accent">${iconSvg('plus',10)} ${n}</span>`).join('')}
        ${p.dupItems.map(n => `<span class="badge badge-neutral">${n}</span>`).join('')}
      </div>
    </div>`;
  }

  /* ── Build item table for active tab ── */
  const items = STATE.masterData[tab];

  container.innerHTML = `
  <div class="page-view">

    <div class="page-header">
      <div class="page-header-left">
        <h1 class="page-title">Master Data</h1>
        <p class="page-subtitle">Central lists that power all employee form dropdowns. Changes apply instantly.</p>
      </div>
    </div>

    <!-- Tab switcher -->
    <div style="display:flex;gap:var(--sp-sm);margin-bottom:var(--sp-lg);flex-wrap:wrap">
      ${Object.entries(TABS).map(([key, t]) => `
      <button class="btn ${tab === key ? 'btn-primary' : 'btn-secondary'}" onclick="switchMDTab('${key}')">
        ${iconSvg(t.icon, 14)} ${t.label}
        <span class="badge ${tab === key ? '' : 'badge-neutral'}" style="margin-left:4px;${tab===key?'background:rgba(255,255,255,.25);color:#fff':''}">
          ${STATE.masterData[key].length}
        </span>
      </button>`).join('')}
    </div>

    <!-- Add + Bulk Upload -->
    <div class="card mb-lg">
      <div class="card-header">
        <div style="display:flex;align-items:center;gap:var(--sp-sm)">
          <div style="width:32px;height:32px;background:var(--clr-primary-light);border-radius:var(--radius-sm);display:flex;align-items:center;justify-content:center;color:var(--clr-primary)">${iconSvg(TABS[tab].icon, 16)}</div>
          <div>
            <div class="card-title">Add ${TABS[tab].singular}</div>
            <div class="card-subtitle">Type a name or bulk-upload from CSV</div>
          </div>
        </div>
      </div>
      <div class="card-body">

        <!-- Quick add -->
        <div style="display:flex;gap:var(--sp-sm);max-width:480px">
          <input type="text" id="md-new-name" class="form-control"
            placeholder="Enter ${TABS[tab].singular.toLowerCase()} name…"
            onkeydown="if(event.key==='Enter')addMDItem()">
          <button class="btn btn-primary" onclick="addMDItem()">
            ${iconSvg('plus', 13)} Add
          </button>
        </div>

        <!-- Bulk upload -->
        <div class="section-divider mt-lg">
          <div class="section-divider-line"></div>
          <div class="section-divider-label">Or Bulk Upload via CSV</div>
          <div class="section-divider-line"></div>
        </div>
        <div style="display:flex;align-items:center;gap:var(--sp-md);flex-wrap:wrap">
          <button class="btn btn-secondary btn-sm" onclick="downloadMDTemplate()">
            ${iconSvg('download', 13)} Download CSV Template
          </button>
          <div class="upload-zone" style="flex:1;min-width:260px;padding:var(--sp-md) var(--sp-lg);display:flex;align-items:center;gap:var(--sp-sm);min-height:auto"
            onclick="document.getElementById('md-file-input').click()"
            ondragover="event.preventDefault();this.classList.add('drag-over')"
            ondragleave="this.classList.remove('drag-over')"
            ondrop="event.preventDefault();this.classList.remove('drag-over');handleMDFile(event)">
            ${iconSvg('upload', 16)}
            <span style="font-size:var(--font-size-sm);color:var(--clr-text-muted)">Drop CSV here, or click to browse</span>
          </div>
          <input type="file" id="md-file-input" accept=".csv" style="display:none" onchange="handleMDFile(this)">
        </div>

        <!-- Import preview -->
        <div id="md-import-preview"></div>
      </div>
    </div>

    <!-- Current items list -->
    <div class="card">
      <div class="card-header">
        <div>
          <div class="card-title">${TABS[tab].label}</div>
          <div class="card-subtitle">${items.length} item${items.length !== 1 ? 's' : ''} · used in all employee form dropdowns</div>
        </div>
        ${items.length > 0 ? `
        <button class="btn btn-secondary btn-sm" onclick="downloadMDTemplate()">
          ${iconSvg('download',13)} Export CSV
        </button>` : ''}
      </div>
      ${items.length === 0 ? `
      <div class="table-empty">
        <div class="table-empty-icon">${iconSvg(TABS[tab].icon, 36)}</div>
        <div class="table-empty-title">No ${TABS[tab].label.toLowerCase()} yet</div>
        <div class="table-empty-sub">Add items above — they'll appear instantly in employee form dropdowns.</div>
      </div>` : `
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th style="width:44px">#</th>
              <th>${TABS[tab].singular} Name</th>
              <th>Date Added</th>
              <th style="text-align:right">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((item, i) => `
            <tr>
              <td style="color:var(--clr-text-muted);font-size:11px">${i + 1}</td>
              <td><strong>${item.name}</strong></td>
              <td style="font-size:12px;color:var(--clr-text-muted)">${fmtDate(item.createdAt)}</td>
              <td style="text-align:right">
                <button class="btn btn-ghost btn-sm btn-icon" style="color:var(--clr-danger)"
                  title="Remove" onclick="removeMDItem('${item.id}')">
                  ${iconSvg('trash', 13)}
                </button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`}
    </div>

  </div>`;

  /* Restore pending import preview after re-render */
  if (window._mdImportPreview && window._mdImportPreview.newItems && window._mdImportPreview.newItems.length) {
    renderMDImportPreview();
  }
}

/* ═══════════════════════════════════════════════════════
   SCREEN: ROLES & ACCESS
   Admin manages HR users and their permission levels.
═══════════════════════════════════════════════════════ */
function renderRolesAccess(container) {

  /* ── Role definitions ── */
  const ROLES = {
    admin: {
      label:       'HR Admin',
      color:       'badge-primary',
      description: 'Full system access including payslips, employees, settings, rules, and user management.',
      permissions: [
        'Generate & export payslips',
        'Add / edit / delete employees',
        'Import employees via CSV/Excel',
        'Configure Global Settings',
        'Manage PIT brackets & SSB rules',
        'Manage PIT adjustment rules',
        'Manage Master Data (Dept / Desig / Branch)',
        'Add, edit, and remove system users',
        'Monthly Payroll Run & bulk operations',
      ],
    },
    hr_user: {
      label:       'HR User',
      color:       'badge-accent',
      description: 'Day-to-day payslip generation and employee data entry. Cannot delete or change settings.',
      permissions: [
        'Generate & export payslips',
        'Add employees & import via CSV',
        'View employee list',
        'Export employee data',
        'Monthly Payroll Run (read-only)',
      ],
    },
  };

  const editing = STATE.pitRuleEditId;  // reuse pitRuleEditId to track user edit (null=add, id=edit)

  /* ── Global handlers ── */
  window.saveUser = () => {
    const name  = document.getElementById('usr-name')?.value.trim();
    const uname = document.getElementById('usr-username')?.value.trim();
    const email = document.getElementById('usr-email')?.value.trim() || '';
    const role  = document.getElementById('usr-role')?.value || 'hr_user';

    if (!name)  { showToast('Display name is required.', 'error'); return; }
    if (!uname) { showToast('Username is required.', 'error'); return; }

    const isNew = !STATE.pitRuleEditId || STATE.pitRuleEditId === 'new-user';
    const now   = new Date().toISOString();

    if (isNew) {
      if (STATE.users.some(u => u.username.toLowerCase() === uname.toLowerCase())) {
        showToast(`Username "${uname}" already exists.`, 'error'); return;
      }
      STATE.users.push({
        id:          'usr_' + Math.random().toString(36).slice(2, 10),
        displayName: name,
        username:    uname,
        email,
        role,
        isActive:    true,
        createdAt:   now,
        createdBy:   'admin',
      });
      showToast(`User "${name}" added.`, 'success');
    } else {
      const idx = STATE.users.findIndex(u => u.id === STATE.pitRuleEditId);
      if (idx === -1) return;
      STATE.users[idx] = { ...STATE.users[idx], displayName: name, email, role, updatedAt: now };
      showToast(`User "${name}" updated.`, 'success');
    }
    STATE.pitRuleEditId = undefined;
    saveState();
    navigate('roles-access');
  };

  window.editUser = (id) => {
    STATE.pitRuleEditId = id;
    navigate('roles-access');
  };

  window.cancelUserEdit = () => {
    STATE.pitRuleEditId = undefined;
    navigate('roles-access');
  };

  window.removeUser = (id) => {
    const user = STATE.users.find(u => u.id === id);
    if (!user) return;
    if (user.role === 'admin' && STATE.users.filter(u => u.role === 'admin' && u.isActive).length <= 1) {
      showToast('Cannot remove the last active Admin.', 'error'); return;
    }
    if (!confirm(`Remove user "${user.displayName}" (${user.username})?\nThis action cannot be undone.`)) return;
    STATE.users = STATE.users.filter(u => u.id !== id);
    saveState();
    showToast(`User "${user.displayName}" removed.`, 'warning');
    navigate('roles-access');
  };

  window.toggleUserActive = (id) => {
    const idx  = STATE.users.findIndex(u => u.id === id);
    if (idx === -1) return;
    const user = STATE.users[idx];
    if (user.role === 'admin' && STATE.users.filter(u => u.role === 'admin' && u.isActive).length <= 1 && user.isActive) {
      showToast('Cannot deactivate the last active Admin.', 'error'); return;
    }
    STATE.users[idx] = { ...user, isActive: !user.isActive, updatedAt: new Date().toISOString() };
    saveState();
    showToast(`${STATE.users[idx].displayName} ${STATE.users[idx].isActive ? 'activated' : 'deactivated'}.`,
              STATE.users[idx].isActive ? 'success' : 'warning');
    navigate('roles-access');
  };

  /* ── User form ── */
  const showForm  = STATE.pitRuleEditId !== undefined;
  const isNewUser = STATE.pitRuleEditId === null || STATE.pitRuleEditId === 'new-user';
  const editTarget = !isNewUser ? STATE.users.find(u => u.id === STATE.pitRuleEditId) : null;

  const formHtml = !showForm ? '' : `
  <div class="card mb-lg" style="border-left:4px solid var(--clr-primary)">
    <div class="card-header">
      <div style="display:flex;align-items:center;gap:var(--sp-sm)">
        <div style="width:32px;height:32px;background:var(--clr-primary-light);border-radius:var(--radius-sm);display:flex;align-items:center;justify-content:center;color:var(--clr-primary)">${iconSvg('user-plus',16)}</div>
        <div>
          <div class="card-title">${isNewUser ? 'Add New User' : 'Edit User — ' + (editTarget?.displayName || '')}</div>
          <div class="card-subtitle">Fill in the user details and assign a role</div>
        </div>
      </div>
    </div>
    <div class="card-body">
      <div class="form-grid form-grid-2">
        <div class="form-group">
          <label class="form-label">Display Name <span class="required">*</span></label>
          <input type="text" id="usr-name" class="form-control" placeholder="e.g. Ma Su Su"
            value="${editTarget?.displayName || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Username <span class="required">*</span></label>
          <input type="text" id="usr-username" class="form-control" placeholder="e.g. susu"
            value="${editTarget?.username || ''}" ${!isNewUser ? 'readonly class="form-control read-only"' : ''}>
          ${!isNewUser ? '<div class="form-hint">Username cannot be changed after creation</div>' : ''}
        </div>
        <div class="form-group">
          <label class="form-label">Email (optional)</label>
          <input type="email" id="usr-email" class="form-control" placeholder="user@company.com"
            value="${editTarget?.email || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Role <span class="required">*</span></label>
          <select id="usr-role" class="form-control">
            ${Object.entries(ROLES).map(([key, r]) =>
              `<option value="${key}" ${(editTarget?.role || 'hr_user') === key ? 'selected' : ''}>${r.label}</option>`
            ).join('')}
          </select>
          <div class="form-hint" id="usr-role-hint">${ROLES[editTarget?.role || 'hr_user'].description}</div>
        </div>
      </div>
    </div>
    <div class="card-footer">
      <button class="btn btn-secondary" onclick="cancelUserEdit()">${iconSvg('x',13)} Cancel</button>
      <div style="flex:1"></div>
      <button class="btn btn-primary" onclick="saveUser()">
        ${iconSvg('save',13)} ${isNewUser ? 'Add User' : 'Save Changes'}
      </button>
    </div>
  </div>`;

  /* ── Render page ── */
  container.innerHTML = `
  <div class="page-view">

    <div class="page-header">
      <div class="page-header-left">
        <h1 class="page-title">Roles &amp; Access</h1>
        <p class="page-subtitle">Manage who can access the system and what they can do.</p>
      </div>
      <div class="page-header-actions">
        ${!showForm ? `
        <button class="btn btn-primary" onclick="STATE.pitRuleEditId=null;navigate('roles-access')">
          ${iconSvg('user-plus',14)} Add User
        </button>` : ''}
      </div>
    </div>

    <!-- Info banner -->
    <div class="alert alert-info mb-lg">
      <div>${iconSvg('info',16)}</div>
      <div>
        <div class="alert-title">Role-Based Access Control</div>
        User management is active. Full login enforcement requires a backend authentication system.
        Use this panel to plan and document which staff members have which roles.
      </div>
    </div>

    ${formHtml}

    <!-- Role capabilities matrix -->
    <div class="card mb-lg">
      <div class="card-header">
        <div class="card-title">Role Capabilities</div>
        <div class="card-subtitle">What each role can do</div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:var(--sp-lg);padding:var(--sp-xl)">
        ${Object.entries(ROLES).map(([key, r]) => `
        <div style="border:1px solid var(--clr-border);border-radius:var(--radius-md);padding:var(--sp-lg)">
          <div style="display:flex;align-items:center;gap:var(--sp-sm);margin-bottom:var(--sp-md)">
            <span class="badge ${r.color}" style="font-size:var(--font-size-sm)">${r.label}</span>
          </div>
          <p style="font-size:var(--font-size-xs);color:var(--clr-text-muted);margin-bottom:var(--sp-md);line-height:1.5">${r.description}</p>
          <ul style="list-style:none;padding:0;margin:0">
            ${r.permissions.map(p => `
            <li style="display:flex;align-items:flex-start;gap:var(--sp-xs);padding:3px 0;font-size:var(--font-size-xs);color:var(--clr-text-secondary)">
              <span style="color:var(--clr-accent);flex-shrink:0;margin-top:1px">${iconSvg('check',11)}</span> ${p}
            </li>`).join('')}
          </ul>
        </div>`).join('')}
      </div>
    </div>

    <!-- Users table -->
    <div class="card">
      <div class="card-header">
        <div>
          <div class="card-title">System Users</div>
          <div class="card-subtitle">${STATE.users.length} user${STATE.users.length !== 1 ? 's' : ''} · ${STATE.users.filter(u=>u.isActive).length} active</div>
        </div>
        ${!showForm ? `
        <button class="btn btn-secondary btn-sm" onclick="STATE.pitRuleEditId=null;navigate('roles-access')">
          ${iconSvg('user-plus',13)} Add User
        </button>` : ''}
      </div>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Username</th>
              <th>Role</th>
              <th style="text-align:center">Status</th>
              <th style="text-align:right">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${STATE.users.map(u => {
              const r = ROLES[u.role] || ROLES.hr_user;
              const isCurrentSession = u.id === 'usr_admin_001';
              return `
            <tr>
              <td>
                <div style="display:flex;align-items:center;gap:var(--sp-sm)">
                  <div style="width:34px;height:34px;border-radius:50%;background:var(--clr-primary);color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0">
                    ${u.displayName.slice(0,2).toUpperCase()}
                  </div>
                  <div>
                    <div style="font-weight:600;font-size:var(--font-size-sm)">${u.displayName}
                      ${isCurrentSession ? `<span class="badge badge-neutral" style="font-size:9px;margin-left:4px">You</span>` : ''}
                    </div>
                    <div style="font-size:11px;color:var(--clr-text-muted)">${u.email || '—'}</div>
                  </div>
                </div>
              </td>
              <td><code style="font-size:12px;background:var(--clr-surface-2);padding:2px 6px;border-radius:4px">${u.username}</code></td>
              <td><span class="badge ${r.color}">${r.label}</span></td>
              <td style="text-align:center">
                <label class="toggle-switch" title="${u.isActive ? 'Active — click to deactivate' : 'Inactive — click to activate'}">
                  <input type="checkbox" ${u.isActive ? 'checked' : ''} onchange="toggleUserActive('${u.id}')">
                  <span class="toggle-slider"></span>
                </label>
              </td>
              <td style="text-align:right">
                <div style="display:flex;align-items:center;justify-content:flex-end;gap:4px">
                  <button class="btn btn-ghost btn-sm btn-icon" title="Edit" onclick="editUser('${u.id}')">${iconSvg('edit',13)}</button>
                  ${!isCurrentSession ? `
                  <button class="btn btn-ghost btn-sm btn-icon" title="Remove" style="color:var(--clr-danger)" onclick="removeUser('${u.id}')">${iconSvg('trash',13)}</button>` : ''}
                </div>
              </td>
            </tr>`; }).join('')}
          </tbody>
        </table>
      </div>
    </div>

  </div>`;

  /* Live role description update */
  const roleSelect = document.getElementById('usr-role');
  const roleHint   = document.getElementById('usr-role-hint');
  if (roleSelect && roleHint) {
    roleSelect.addEventListener('change', () => {
      roleHint.textContent = ROLES[roleSelect.value]?.description || '';
    });
  }
}

/* ─── App Initialization ──────────────────────────────── */
function initApp() {
  loadState();

  // Sidebar nav items
  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.addEventListener('click', () => navigate(item.dataset.page));
  });

  // Sidebar collapse toggle
  document.getElementById('sidebar-collapse-btn').addEventListener('click', toggleSidebar);

  // Navigate to default page
  navigate(STATE.currentPage);
}

document.addEventListener('DOMContentLoaded', initApp);
