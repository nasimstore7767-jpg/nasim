import type { ScreenKey } from '../db/types';

export interface NavItem { key: ScreenKey; label: string; icon: string; path: string; }
export interface NavGroup { title: string; icon: string; items: NavItem[]; }

export const NAV: NavGroup[] = [
  {
    title: 'الرئيسية', icon: 'fa-gauge-high',
    items: [
      { key: 'dashboard', label: 'لوحة التحكم', icon: 'fa-gauge-high', path: '/' },
    ],
  },
  {
    title: 'العمليات المالية', icon: 'fa-money-bill-transfer',
    items: [
      { key: 'receipt', label: 'سند قبض', icon: 'fa-money-bill-wave', path: '/receipt' },
      { key: 'payment', label: 'سند صرف', icon: 'fa-hand-holding-dollar', path: '/payment' },
      { key: 'cashReset', label: 'تصفير الصندوق', icon: 'fa-cash-register', path: '/cash-reset' },
    ],
  },
  {
    title: 'سير العمل', icon: 'fa-mobile-screen-button',
    items: [
      { key: 'deviceIntake', label: 'استلام جهاز', icon: 'fa-arrow-down-to-bracket', path: '/intake' },
      { key: 'deviceDelivery', label: 'تسليم جهاز', icon: 'fa-arrow-up-from-bracket', path: '/delivery' },
      { key: 'advanceRefund', label: 'استرجاع دفعة', icon: 'fa-rotate-left', path: '/refund' },
      { key: 'creditProgramming', label: 'برمجة آجلة', icon: 'fa-laptop-code', path: '/credit' },
    ],
  },
  {
    title: 'المبيعات', icon: 'fa-store',
    items: [
      { key: 'pos', label: 'بيع الإكسسوارات', icon: 'fa-cart-shopping', path: '/pos' },
      { key: 'balanceSales', label: 'بيع الرصيد', icon: 'fa-sim-card', path: '/balance' },
    ],
  },
  {
    title: 'الحسابات والمخزون', icon: 'fa-book',
    items: [
      { key: 'accounts', label: 'دليل الحسابات', icon: 'fa-sitemap', path: '/accounts' },
      { key: 'accessories', label: 'الإكسسوارات', icon: 'fa-boxes-stacked', path: '/accessories' },
    ],
  },
  {
    title: 'التقارير', icon: 'fa-chart-pie',
    items: [
      { key: 'reports', label: 'التقارير', icon: 'fa-chart-pie', path: '/reports' },
    ],
  },
  {
    title: 'الإعداد', icon: 'fa-gears',
    items: [
      { key: 'serviceSetup', label: 'إعداد الخدمات', icon: 'fa-screwdriver-wrench', path: '/service-setup' },
      { key: 'users', label: 'المستخدمون', icon: 'fa-users-gear', path: '/users' },
      { key: 'settings', label: 'إعدادات النظام', icon: 'fa-gear', path: '/settings' },
    ],
  },
];
