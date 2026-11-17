// هيكل مؤقت يطلع لحد ما تتحمل الصفحة
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="جاري التحميل">
      <div className="sk" style={{ width: 220, height: 26, marginBottom: 18 }} />
      <div className="kpis">
        {[0, 1, 2, 3].map((i) => <div key={i} className="sk" style={{ height: 84 }} />)}
      </div>
      <div className="sk" style={{ height: 280 }} />
    </div>
  );
}
