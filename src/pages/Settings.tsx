import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { PageHeader, SectionCard } from '../components/ui/Page';

export default function Settings() {
  const { db, settings, refreshSettings } = useApp();
  const { push } = useToast();
  const [companyName, setCompanyName] = useState('');
  const [logo, setLogo] = useState('');
  const [allowSellZeroStock, setAllowSellZeroStock] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setCompanyName(settings.companyName || '');
      setLogo(settings.logo || '');
      setAllowSellZeroStock(settings.allowSellZeroStock ?? true);
    }
  }, [settings]);

  function onLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) { push('warning', 'حجم الشعار كبير، يُفضل أقل من 500KB'); }
    const reader = new FileReader();
    reader.onload = () => setLogo(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function save() {
    if (!db) return;
    if (!companyName.trim()) { push('warning', 'أدخل اسم المؤسسة'); return; }
    setSaving(true);
    try {
      const doc = await db.settings.findOne('settings').exec();
      await doc?.patch({
        companyName: companyName.trim(), logo, allowSellZeroStock,
        updatedAt: new Date().toISOString(),
      });
      await refreshSettings();
      push('success', 'تم حفظ الإعدادات');
    } catch (err: any) {
      push('error', err.message || 'فشل الحفظ');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader title="إعدادات النظام" subtitle="بيانات المؤسسة والعملة وخيارات البيع" icon="fa-gear" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SectionCard title="بيانات المؤسسة" icon="fa-building" className="lg:col-span-2">
          <div className="space-y-5">
            <div>
              <label className="field-label">اسم المؤسسة</label>
              <input className="input" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
            </div>
            <div>
              <label className="field-label">العملة</label>
              <input className="input num bg-ink-50" value="الريال اليمني (YER)" disabled />
              <p className="text-xs text-ink-300 mt-1">العملة ثابتة على الريال اليمني</p>
            </div>
            <div>
              <label className="field-label">شعار المؤسسة</label>
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-xl border-2 border-dashed border-ink-200 flex items-center justify-center overflow-hidden bg-ink-50">
                  {logo ? <img src={logo} alt="logo" className="w-full h-full object-contain" /> : <i className="fa-solid fa-image text-ink-300 text-2xl"></i>}
                </div>
                <div className="space-y-2">
                  <input type="file" accept="image/*" onChange={onLogoFile} className="text-sm" />
                  {logo && <button className="btn-ghost btn-sm text-red-500" onClick={() => setLogo('')}><i className="fa-solid fa-xmark"></i> إزالة الشعار</button>}
                </div>
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="خيارات البيع" icon="fa-sliders">
          <label className="flex items-start gap-3 p-3 rounded-xl bg-ink-50 cursor-pointer">
            <input type="checkbox" className="mt-1 w-4 h-4 accent-royal-600" checked={allowSellZeroStock}
              onChange={(e) => setAllowSellZeroStock(e.target.checked)} />
            <div>
              <p className="font-semibold text-ink-700 text-sm">السماح بالبيع عند نفاد المخزون</p>
              <p className="text-xs text-ink-400 mt-1">يسمح ببيع الإكسسوارات حتى لو كانت الكمية صفراً</p>
            </div>
          </label>
          <button className="btn-primary w-full justify-center py-3 mt-5" disabled={saving} onClick={save}>
            {saving ? <i className="fa-solid fa-spinner fa-spin"></i> : <><i className="fa-solid fa-floppy-disk"></i> حفظ الإعدادات</>}
          </button>
        </SectionCard>
      </div>
    </div>
  );
}
