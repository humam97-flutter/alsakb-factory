import Link from "next/link";
import { getAlerts } from "@/lib/alerts";
import { getMe } from "@/lib/auth";

export default async function AlertsPage() {
  const me = await getMe();
  const alerts = await getAlerts(me);
  const groups = [...new Set(alerts.map((a) => a.group))];
  return (
    <>
      <div className="bar"><h2>التنبيهات</h2><span className="meta">{alerts.length ? `${alerts.length} تنبيه` : ""}</span></div>
      {!alerts.length ? (
        <div className="empty">ما بيه شي يحتاج انتباه هسه.</div>
      ) : (
        groups.map((g) => (
          <div key={g} className="panel" style={{ marginBottom: 10 }}>
            <b>{g}</b>
            <ul style={{ margin: "6px 0 0", paddingInlineStart: 18 }}>
              {alerts.filter((a) => a.group === g).map((a, i) => (
                <li key={i} className={a.level === "bad" ? "tone-bad" : "tone-warn"} style={{ fontSize: 14, marginBottom: 3 }}>
                  <Link href={a.href} style={{ color: "inherit" }}>{a.text}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </>
  );
}
