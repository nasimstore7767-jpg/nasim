import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { useRxQuery } from '../hooks/useRx';
import { PageHeader, EmptyState } from '../components/ui/Page';
import { CustomerPicker } from '../components/CustomerPicker';
import { VoucherHistory } from '../components/VoucherHistory';
import { fmtYER, todayISO } from '../lib/format';
import { createPosSale } from '../services/operations';
import type { AccessoryDoc, PosItem } from '../db/types';

interface CartLine extends PosItem {}

export default function Pos() {
  const { db, user, settings } = useApp();
  const { push } = useToast();
  const { data: accessories } = useRxQuery<AccessoryDoc>(() => db?.accessories.find(), [db]);

  const [term, setTerm] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('نقدي');
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const t = term.trim().toLowerCase();
    if (!t) return accessories;
    return accessories.filter((a) => a.name.toLowerCase().includes(t) || String(a.itemNo).includes(t));
  }, [accessories, term]);

  const total = cart.reduce((s, l) => s + l.total, 0);

  function addToCart(a: AccessoryDoc) {
    const allowZero = settings?.allowSellZeroStock ?? true;
    if (!allowZero && a.quantity <= 0) { push('warning', `الصنف "${a.name}" غير متوفر في المخزون`); return; }
    setCart((c) => {
      const ex = c.find((l) => l.accessoryId === a.id);
      if (ex) return c.map((l) => l.accessoryId === a.id ? { ...l, qty: l.qty + 1, total: (l.qty + 1) * l.price } : l);
      return [...c, { accessoryId: a.id, name: a.name, qty: 1, price: a.sellPrice, total: a.sellPrice }];
    });
  }

  function updateLine(id: string, patch: Partial<CartLine>) {
    setCart((c) => c.map((l) => {
      if (l.accessoryId !== id) return l;
      const next = { ...l, ...patch };
      next.total = (next.qty || 0) * (next.price || 0);
      return next;
    }));
  }

  async function checkout() {
    if (!db) return;
    if (!cart.length) { push('warning', 'السلة فارغة'); return; }
    setSaving(true);
    try {
      const r = await createPosSale(db, {
        date: todayISO(), customerId, customerName,
        items: cart.map((l) => ({ ...l })), createdBy: user?.username || '',
      });
      push('success', `تمت عملية البيع — فاتورة ${r.invoiceNo}`);
      setCart([]); setCustomerId(null); setCustomerName('نقدي');
    } catch (err: any) {
      push('error', err.message || 'فشل إتمام البيع');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader title="نقطة بيع الإكسسوارات" subtitle="بيع مباشر للإكسسوارات مع تحصيل نقدي" icon="fa-cart-shopping" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Products */}
        <div className="lg:col-span-2">
          <div className="relative mb-4">
            <i className="fa-solid fa-magnifying-glass absolute right-3 top-1/2 -translate-y-1/2 text-gray-300"></i>
            <input className="input pr-9" placeholder="ابحث عن صنف..." value={term} onChange={(e) => setTerm(e.target.value)} />
          </div>
          {filtered.length === 0 ? (
            <div className="card"><EmptyState icon="fa-boxes-stacked" title="لا توجد أصناف" hint="أضف أصنافاً من شاشة الإكسسوارات" /></div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filtered.map((a) => (
                <button key={a.id} onClick={() => addToCart(a)}
                  className="card p-4 text-right hover:shadow-elevated hover:-translate-y-0.5 transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-10 h-10 rounded-lg bg-royal-50 text-royal-600 flex items-center justify-center"><i className="fa-solid fa-plug"></i></div>
                    <span className={`badge ${a.quantity > 0 ? 'badge-green' : 'badge-red'}`}>{a.quantity > 0 ? `${a.quantity}` : 'نفد'}</span>
                  </div>
                  <p className="font-bold text-ink-700 text-sm line-clamp-2 h-10">{a.name}</p>
                  <p className="num font-extrabold text-royal-700 mt-1">{fmtYER(a.sellPrice)}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Cart */}
        <div className="card flex flex-col h-fit sticky top-20">
          <header className="px-5 py-4 border-b border-gray-100 flex items-center gap-2 font-bold text-ink-700">
            <i className="fa-solid fa-cart-shopping text-royal-500"></i> السلة ({cart.length})
          </header>
          <div className="p-4">
            <CustomerPicker value={customerId} allowCash onChange={(id, name) => { setCustomerId(id); setCustomerName(name); }} />
          </div>
          <div className="flex-1 overflow-y-auto px-4 max-h-72 space-y-2">
            {cart.length === 0 ? (
              <p className="text-center text-ink-300 py-8 text-sm">السلة فارغة، اختر أصنافاً</p>
            ) : cart.map((l) => (
              <div key={l.accessoryId} className="p-3 rounded-xl bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-sm text-ink-700">{l.name}</span>
                  <button className="text-red-400 hover:text-red-600" onClick={() => setCart((c) => c.filter((x) => x.accessoryId !== l.accessoryId))}><i className="fa-solid fa-xmark"></i></button>
                </div>
                <div className="flex items-center gap-2">
                  <input type="number" min="1" className="input num btn-sm w-16" value={l.qty} onChange={(e) => updateLine(l.accessoryId, { qty: parseInt(e.target.value) || 1 })} />
                  <span className="text-ink-300">×</span>
                  <input type="number" min="0" className="input num btn-sm flex-1" value={l.price} onChange={(e) => updateLine(l.accessoryId, { price: parseFloat(e.target.value) || 0 })} />
                  <span className="num font-bold text-royal-700 text-sm whitespace-nowrap">{fmtYER(l.total)}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="p-4 border-t border-gray-100">
            <div className="flex justify-between text-lg font-extrabold mb-3"><span>الإجمالي</span><span className="num text-royal-700">{fmtYER(total)}</span></div>
            <button className="btn-success w-full justify-center py-3" disabled={saving || !cart.length} onClick={checkout}>
              {saving ? <i className="fa-solid fa-spinner fa-spin"></i> : <><i className="fa-solid fa-check"></i> إتمام البيع</>}
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <VoucherHistory title="فواتير البيع السابقة" icon="fa-cart-shopping"
          sources={['posSale']} screen="pos" />
      </div>
    </div>
  );
}
