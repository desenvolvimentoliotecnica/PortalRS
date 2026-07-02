import {
  ROUTES,
  RH_BOTTOM_NAV,
  PORTAL_BOTTOM_NAV,
} from './routes.js';

let toastTimer;

/** Navega para uma rota registrada */
export function navigateTo(routeId, options = {}) {
  const route = ROUTES[routeId];
  if (!route) {
    console.warn('[nav] Rota desconhecida:', routeId);
    return;
  }
  if (options.toast) {
    showToast(options.toast);
    setTimeout(() => {
      window.location.href = route.file;
    }, options.delay ?? 600);
    return;
  }
  window.location.href = route.file;
}

/** Toast compartilhado — usa #toast se existir na página */
export function showToast(message, duration = 2000) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add('show');
  toastTimer = setTimeout(() => toast.classList.remove('show'), duration);
}

function wireRhBottomNav(activeNav) {
  document.querySelectorAll('.bottom-nav .nav-item[data-nav]').forEach((item) => {
    const key = item.dataset.nav;
    const routeId = RH_BOTTOM_NAV[key];
    if (!routeId) return;
    item.href = '#';
    item.dataset.route = routeId;
    item.classList.toggle('active', key === activeNav);
  });
}

function wirePortalBottomNav(activeNav) {
  document.querySelectorAll('.bottom-nav .nav-item').forEach((item) => {
    const label = item.querySelector('span')?.textContent?.trim().toLowerCase();
    const map = {
      início: 'inicio',
      inicio: 'inicio',
      vagas: 'vagas',
      candidaturas: 'candidaturas',
    };
    const key = map[label] || item.dataset.nav;
    const routeId = key ? PORTAL_BOTTOM_NAV[key] : null;
    if (routeId) {
      item.href = '#';
      item.dataset.route = routeId;
      if (activeNav && key === activeNav) item.classList.add('active');
    }
  });
}

function bindRouteDelegation() {
  document.addEventListener(
    'click',
    (e) => {
      const el = e.target.closest('[data-route]');
      if (!el) return;
      e.preventDefault();
      e.stopPropagation();
      const routeId = el.dataset.route;
      const toastMsg = el.dataset.routeToast;
      if (toastMsg) {
        navigateTo(routeId, { toast: toastMsg });
      } else {
        navigateTo(routeId);
      }
    },
    true
  );
}

let delegationBound = false;

/**
 * Inicializa navegação da página atual.
 * @param {string} routeId — id da rota (ex: 'rh-dashboard')
 */
export function initPage(routeId) {
  const route = ROUTES[routeId];
  if (!route) return;

  if (route.title) {
    const prefix = route.world === 'portal' ? 'Liotécnica' : route.world === 'hub' ? 'Talent RH' : 'Talent RH';
    document.title = route.world === 'hub' ? `${route.title}` : `${prefix} — ${route.title}`;
  }

  if (route.world === 'rh' && route.nav) {
    wireRhBottomNav(route.nav);
  }
  if (route.world === 'portal' && route.nav) {
    wirePortalBottomNav(route.nav);
  }

  if (!delegationBound) {
    bindRouteDelegation();
    delegationBound = true;
  }

  window.TalentNav = { navigateTo, showToast, ROUTES };
}
