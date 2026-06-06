import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { useRxQuery } from '../hooks/useRx';
import { PageHeader, SectionCard } from '../components/ui/Page';
import { CustomerPicker } from '../components/CustomerPicker';
import { fmtYER, fmtDateAr, todayISO, nowTime } from '../lib/format';
import { createDeviceIntake } from '../services/operations';
import type { DeviceJobDoc, DeviceJobType, DeviceTypeDoc, IssueDoc } from '../db/types';

export default function DeviceIntake() {
  const { db, user } = useApp();
  const { push } = useToast();
  const { data: issues } = useRxQuery<IssueDoc>(() => db?.issues.find(), [db]);
  const { data: jobs } = useRxQuery<DeviceJobDoc>(() => db?.deviceJobs.find(), [db]);
  const { data: deviceTypes } = useRxQuery<DeviceTypeDoc>(() => db?.deviceTypes.find(), [db]);

  const [type, setType] = useState<DeviceJobType>('programming');
  const [date, setDate] = useState(todayISO());
  const [dateEdited, setDateEdited] = useState(false);
  const [time] = useState(nowTime());
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [receiver, setReceiver] = useState('');
  const [deviceType, setDeviceType] = useState('');
  const [issue, setIssue] = useState('');
  const [model, setModel] = useState('');
  const [serial, setSerial] = useState('');
  const [agreedPrice, setAgreedPrice] = useState('');
  const [advance, setAdvance] = useState('');
  const [saving, setSaving] = useState(false);

  const catIssues = useMemo(() => issues.filter((i) => i.category === type), [issues, type]);
  const deviceTypeOptions = useMemo(
    () => [...deviceTypes].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0)), [deviceTypes],
  );
  const remaining = Math.max(0, (parseFloat(agreedPrice) || 0) - (parseFloat(advance) || 0));
  const recentJobs = useMemo(
    () => [...jobs].sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1)).slice(0, 8), [jobs],
  );

  function reset() {
    setCustomerId(null); setCustomerName(''); setReceiver(''); setDeviceType('');
    setIssue(''); setModel(''); setSerial(''); setAgreedPrice(''); setAdvance('');
    setDate(todayISO()); setDateEdited(false);
  }

  async function submit() {
    if (!db) return;
    if (!customerId) { push('warning', 'اختر العميل أو أضف عميلاً جديداً'); return; }
    if (!deviceType.trim()) { push('warning', 'أدخل نوع الجهاز'); return; }
    if (!issue) { push('warning', 'اختر العطل / الخدمة المطلوبة'); return; }
    const adv = parseFloat(advance) || 0;
    const price = parseFloat(agreedPrice) || 0;
    if (adv > price && price > 0) { push('error', 'الدفعة المقدمة أكبر من السعر المتفق عليه'); return; }
    setSaving(true);
    try {
      const r = await createDeviceIntake(db, {
        type, date, time, customerId, customerName, receiver,
        deviceType: deviceType.trim(), issue, model: model.trim(), serial: serial.trim(),
        agreedPrice: price, advance: adv, createdBy: user?.username || '',
      });
      push('success', `تم استلام الجهاز برقم ${r.receiptNo}`);
      reset();
    } catch (err: any) {
      push('error', err.message || 'فشل استلام الجهاز');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader title="استلام جهاز" subtitle="تسجيل جهاز جديد للبرمجة أو الصيانة" icon="fa-arrow-down-to-bracket" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SectionCard title="بيانات الاستلام" icon="fa-clipboard-list" className="lg:col-span-2">
          <div className="flex gap-2 mb-5">
            {(['programming', 'maintenance'] as DeviceJobType[]).map((t) => (
              <button key={t} onClick={() => { setType(t); setIssue(''); }}
                className={`flex-1 py-3 rounded-xl font-bold transition-all border-2 ${
                  type === t ? 'border-royal-500 bg-royal-50 text-royal-700' : 'border-gray-100 text-ink-400 hover:bg-gray-50'}`}>
                <i className={`fa-solid ${t === 'programming' ? 'fa-laptop-code' : 'fa-screwdriver-wrench'} ml-2`}></i>
                {t === 'programming' ? 'برمجة' : 'صيانة'}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <CustomerPicker value={customerId} onChange={(id, name) => { setCustomerId(id); setCustomerName(name); }} />
            </div>
            <div>
              <label className="field-label">اسم المُسلِّم (إن اختلف)</label>
              <input className="input" value={receiver} onChange={(e) => setReceiver(e.target.value)} placeholder="اختياري" />
            </div>
            <div>
              <label className="field-label">نوع الجهاز</label>
              <select className="input" value={deviceType} onChange={(e) => setDeviceType(e.target.value)}>
                <option value="">— اختر نوع الجهاز —</option>
                {deviceTypeOptions.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">العطل / الخدمة</label>
              <select className="input" value={issue} onChange={(e) => setIssue(e.target.value)}>
                <option value="">— اختر —</option>
                {catIssues.map((i) => <option key={i.id} value={i.name}>{i.name}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">الموديل</label>
              <input className="input" value={model} onChange={(e) => setModel(e.target.value)} placeholder="اختياري" />
            </div>
            <div>
              <label className="field-label">الرقم التسلسلي / IMEI</label>
              <input className="input num" value={serial} onChange={(e) => setSerial(e.target.value)} placeholder="اختياري" />
            </div>
            <div>
              <label className="field-label">السعر المتفق عليه</label>
              <input type="number" min="0" className="input num" value={agreedPrice} onChange={(e) => setAgreedPrice(e.target.value)} placeholder="0" />
            </div>
            <div>
              <label className="field-label">الدفعة المقدمة</label>
              <input type="number" min="0" className="input num" value={advance} onChange={(e) => setAdvance(e.target.value)} placeholder="0" />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="الملخص" icon="fa-receipt">
          <div className="space-y-4">
            <div>
              <label className="field-label">تاريخ الاستلام</label>
              <input type="date" className="input num" value={date}
                onChange={(e) => { setDate(e.target.value); setDateEdited(true); }} />
              {dateEdited && <p className="text-xs text-amber-600 mt-1"><i className="fa-solid fa-triangle-exclamation"></i> تم تعديل التاريخ يدوياً</p>}
              <p className="text-xs text-ink-300 mt-1">الوقت: <span className="num">{time}</span></p>
            </div>
            <div className="p-4 rounded-xl bg-ink-50 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-ink-500">السعر</span><span className="num font-bold">{fmtYER(parseFloat(agreedPrice) || 0)}</span></div>
              <div className="flex justify-between"><span className="text-ink-500">المقدم</span><span className="num font-bold text-emerald-600">{fmtYER(parseFloat(advance) || 0)}</span></div>
              <div className="flex justify-between text-base font-extrabold border-t border-ink-200 pt-2"><span>المتبقي</span><span className="num text-royal-700">{fmtYER(remaining)}</span></div>
            </div>
            <button className="btn-primary w-full justify-center py-3" disabled={saving} onClick={submit}>
              {saving ? <i className="fa-solid fa-spinner fa-spin"></i> : <><i className="fa-solid fa-floppy-disk"></i> استلام الجهاز</>}
            </button>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="أحدث الاستلامات" icon="fa-clock-rotate-left" className="mt-6">
        {recentJobs.length === 0 ? (
          <p className="text-center text-ink-300 py-6">لا توجد استلامات بعد</p>
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="data-table">
              <thead><tr><th>الرقم</th><th>العميل</th><th>الجهاز</th><th>الخدمة</th><th>النوع</th><th className="text-left">المتبقي</th><th>الحالة</th></tr></thead>
              <tbody>
                {recentJobs.map((j) => (
                  <tr key={j.id}>
                    <td className="num font-semibold text-royal-600">{j.receiptNo}</td>
                    <td>{j.customerName}</td>
                    <td>{j.deviceType}</td>
                    <td className="text-ink-500">{j.issue}</td>
                    <td><span className={`badge ${j.type === 'programming' ? 'badge-royal' : 'badge-amber'}`}>{j.type === 'programming' ? 'برمجة' : 'صيانة'}</span></td>
                    <td className="num text-left font-bold">{fmtYER(j.remaining)}</td>
                    <td><span className={`badge ${j.status === 'open' ? 'badge-blue' : j.status === 'delivered' ? 'badge-green' : 'badge-red'}`}>
                      {j.status === 'open' ? 'مفتوح' : j.status === 'delivered' ? 'مُسلَّم' : 'مسترجع'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
