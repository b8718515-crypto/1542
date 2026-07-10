import React, { useState, useEffect, useCallback, useMemo } from "react";
import { ChevronLeft, ChevronRight, X, Plus, Trash2, Users, CalendarDays, ArrowLeftRight, Circle } from "lucide-react";
import { db, ref, onValue, set } from "./firebase";

const TEAM_IDS = ["A", "B", "C", "D", "E", "F", "G", "H", "I"];
const TEAM_COLORS = {
  A: "#E86A6A",
  B: "#F0A63C",
  C: "#D6CB3A",
  D: "#4FC79A",
  E: "#4FA9E8",
  F: "#8B87E8",
  G: "#B47CE8",
  H: "#E87CBE",
  I: "#B4926A",
};
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

// 기준: 2026-07-11(토요일 아님, 실제는 토요일 확인 불필요) = D조
const BASE_UTC = Date.UTC(2026, 6, 11);
const BASE_INDEX = 3; // D

const HOLIDAYS_2026 = {
  "2026-01-01": "신정",
  "2026-02-16": "설날연휴",
  "2026-02-17": "설날",
  "2026-02-18": "설날연휴",
  "2026-03-01": "삼일절",
  "2026-03-02": "대체공휴일",
  "2026-05-01": "근로자의날",
  "2026-05-05": "어린이날",
  "2026-05-24": "부처님오신날",
  "2026-05-25": "대체공휴일",
  "2026-06-06": "현충일",
  "2026-08-15": "광복절",
  "2026-08-17": "대체공휴일",
  "2026-09-24": "추석연휴",
  "2026-09-25": "추석",
  "2026-09-26": "추석연휴",
  "2026-10-03": "개천절",
  "2026-10-05": "대체공휴일",
  "2026-10-09": "한글날",
  "2026-12-25": "크리스마스",
};

function pad(n) { return String(n).padStart(2, "0"); }
function dateKey(y, m, d) { return `${y}-${pad(m)}-${pad(d)}`; }
function teamForUTC(utcMs) {
  const diff = Math.round((utcMs - BASE_UTC) / 86400000);
  let idx = (BASE_INDEX + (diff % 9) + 9) % 9;
  return TEAM_IDS[idx];
}
function defaultTeams() {
  const t = {};
  TEAM_IDS.forEach((id) => (t[id] = []));
  return t;
}
function todayKey() {
  const n = new Date();
  return dateKey(n.getFullYear(), n.getMonth() + 1, n.getDate());
}

export default function App() {
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(7); // 1-12
  const [teams, setTeams] = useState(defaultTeams());
  const [subs, setSubs] = useState({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("calendar");
  const [selectedDate, setSelectedDate] = useState(null);
  const [saving, setSaving] = useState(false);
  const [newMemberInputs, setNewMemberInputs] = useState({});
  const [subForm, setSubForm] = useState({ original: "", substitute: "", note: "" });

  useEffect(() => {
    let teamsLoaded = false;
    let subsLoaded = false;
    const maybeDone = () => { if (teamsLoaded && subsLoaded) setLoading(false); };

    const unsubTeams = onValue(ref(db, "teams"), (snap) => {
      const val = snap.val();
      // Firebase는 빈 배열([])을 가진 키를 자동으로 지워버리므로,
      // 항상 defaultTeams()로 9개 조 키를 다 채운 뒤 실제 값으로 덮어쓴다.
      setTeams({ ...defaultTeams(), ...(val || {}) });
      teamsLoaded = true;
      maybeDone();
    }, () => { teamsLoaded = true; maybeDone(); });

    const unsubSubs = onValue(ref(db, "subs"), (snap) => {
      const val = snap.val();
      if (val) setSubs(val);
      subsLoaded = true;
      maybeDone();
    }, () => { subsLoaded = true; maybeDone(); });

    return () => { unsubTeams(); unsubSubs(); };
  }, []);

  const persistTeams = useCallback((next) => {
    setTeams(next);
    setSaving(true);
    set(ref(db, "teams"), next).finally(() => setSaving(false));
  }, []);

  const persistSubs = useCallback((next) => {
    setSubs(next);
    setSaving(true);
    set(ref(db, "subs"), next).finally(() => setSaving(false));
  }, []);

  const addMember = (teamId) => {
    const name = (newMemberInputs[teamId] || "").trim();
    if (!name) return;
    const next = { ...teams, [teamId]: [...teams[teamId], name] };
    persistTeams(next);
    setNewMemberInputs({ ...newMemberInputs, [teamId]: "" });
  };
  const removeMember = (teamId, idx) => {
    const next = { ...teams, [teamId]: teams[teamId].filter((_, i) => i !== idx) };
    persistTeams(next);
  };

  const addSub = () => {
    if (!selectedDate || !subForm.original || !subForm.substitute.trim()) return;
    const list = subs[selectedDate] ? [...subs[selectedDate]] : [];
    list.push({
      id: Date.now().toString(36),
      original: subForm.original,
      substitute: subForm.substitute.trim(),
      note: subForm.note.trim(),
    });
    persistSubs({ ...subs, [selectedDate]: list });
    setSubForm({ original: "", substitute: "", note: "" });
  };
  const removeSub = (dKey, id) => {
    const list = (subs[dKey] || []).filter((s) => s.id !== id);
    const next = { ...subs };
    if (list.length) next[dKey] = list; else delete next[dKey];
    persistSubs(next);
  };

  const grid = useMemo(() => {
    const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
    const startWeekday = firstOfMonth.getUTCDay();
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const cells = [];
    const leadStart = new Date(Date.UTC(year, month - 1, 1 - startWeekday));
    for (let i = 0; i < 42; i++) {
      const cellUTC = Date.UTC(leadStart.getUTCFullYear(), leadStart.getUTCMonth(), leadStart.getUTCDate() + i);
      const d = new Date(cellUTC);
      cells.push({
        y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, day: d.getUTCDate(),
        inMonth: d.getUTCMonth() + 1 === month && d.getUTCFullYear() === year,
        utc: cellUTC, weekday: d.getUTCDay(),
      });
      if (i >= 34 && d.getUTCMonth() + 1 !== month && (i + 1) % 7 === 0) break;
    }
    return cells;
  }, [year, month]);

  const changeMonth = (delta) => {
    let m = month + delta, y = year;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    setMonth(m); setYear(y);
  };

  const selectedInfo = useMemo(() => {
    if (!selectedDate) return null;
    const [y, m, d] = selectedDate.split("-").map(Number);
    const utc = Date.UTC(y, m - 1, d);
    const team = teamForUTC(utc);
    const roster = teams[team] || [];
    const daySubs = subs[selectedDate] || [];
    const holiday = HOLIDAYS_2026[selectedDate];
    const weekday = new Date(utc).getUTCDay();
    return { y, m, d, team, roster, daySubs, holiday, weekday };
  }, [selectedDate, teams, subs]);

  if (loading) {
    return (
      <div style={{ minHeight: 420, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", color: "var(--muted)", fontFamily: "Inter, sans-serif" }}>
        불러오는 중...
      </div>
    );
  }

  return (
    <div className="app-root">
      <style>{STYLE}</style>

      <div className="header">
        <div className="header-title">
          <CalendarDays size={20} color="var(--amber)" />
          <div>
            <h1>야간 돌발 근무 대기조</h1>
            <p>A~I조 순환 대기 일정 · 2026년 7월 11일 D조 기준</p>
          </div>
        </div>
        <div className="tabs">
          <button className={tab === "calendar" ? "tab active" : "tab"} onClick={() => setTab("calendar")}>
            <CalendarDays size={15} /> 일정표
          </button>
          <button className={tab === "teams" ? "tab active" : "tab"} onClick={() => setTab("teams")}>
            <Users size={15} /> 조 인원 관리
          </button>
        </div>
      </div>

      <div className="share-note">
        이 일정과 조 인원 정보는 이 기기(브라우저)에 저장됩니다. {saving && <span className="saving">· 저장 중…</span>}
      </div>

      {tab === "calendar" && (
        <div className="panel">
          <div className="month-nav">
            <button className="icon-btn" onClick={() => changeMonth(-1)}><ChevronLeft size={18} /></button>
            <div className="month-label">{year}년 {month}월</div>
            <button className="icon-btn" onClick={() => changeMonth(1)}><ChevronRight size={18} /></button>
            <button className="today-btn" onClick={() => { const n = new Date(); setYear(n.getFullYear()); setMonth(n.getMonth() + 1); }}>오늘</button>
          </div>

          <div className="legend">
            {TEAM_IDS.map((id) => (
              <div key={id} className="legend-item">
                <span className="dot" style={{ background: TEAM_COLORS[id] }} />{id}조
              </div>
            ))}
          </div>

          <div className="weekday-row">
            {WEEKDAYS.map((w, i) => (
              <div key={w} className={"weekday " + (i === 0 ? "sun" : i === 6 ? "sat" : "")}>{w}</div>
            ))}
          </div>

          <div className="grid">
            {grid.map((c) => {
              const dKey = dateKey(c.y, c.m, c.day);
              const team = teamForUTC(c.utc);
              const holiday = HOLIDAYS_2026[dKey];
              const daySubs = subs[dKey];
              const isToday = dKey === todayKey();
              const roster = teams[team] || [];
              const displayNames = roster.map((name) => {
                const sub = daySubs && daySubs.find((s) => s.original === name);
                return sub ? { name: sub.substitute, subbed: true } : { name, subbed: false };
              });
              return (
                <button
                  key={dKey}
                  className={"cell" + (c.inMonth ? "" : " dim") + (isToday ? " today" : "")}
                  style={{ borderTopColor: TEAM_COLORS[team] }}
                  onClick={() => setSelectedDate(dKey)}
                >
                  <div className="cell-top">
                    <span className={"cell-date" + (c.weekday === 0 ? " sun" : c.weekday === 6 ? " sat" : "") + (holiday ? " holiday" : "")}>{c.day}</span>
                    <span className="cell-badge" style={{ background: TEAM_COLORS[team] }}>{team}</span>
                  </div>
                  {holiday && <div className="cell-holiday">{holiday}</div>}
                  {displayNames.length > 0 && (
                    <div className="cell-names">
                      {displayNames.map((n, i) => (
                        <span key={i} className={n.subbed ? "cell-name subbed" : "cell-name"}>
                          {n.name}{i < displayNames.length - 1 ? "," : ""}
                        </span>
                      ))}
                    </div>
                  )}
                  {daySubs && daySubs.length > 0 && <div className="cell-sub-dot" title="대근 있음" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {tab === "teams" && (
        <div className="panel">
          <div className="teams-grid">
            {TEAM_IDS.map((id) => {
              const roster = teams[id] || [];
              return (
              <div className="team-card" key={id}>
                <div className="team-card-head">
                  <span className="dot lg" style={{ background: TEAM_COLORS[id] }} />
                  <span className="team-name">{id}조</span>
                  <span className="team-count">{roster.length}명</span>
                </div>
                <div className="member-list">
                  {roster.length === 0 && <div className="empty-hint">등록된 인원이 없습니다</div>}
                  {roster.map((name, idx) => (
                    <div className="member-row" key={idx}>
                      <span>{name}</span>
                      <button className="icon-btn small" onClick={() => removeMember(id, idx)}><Trash2 size={13} /></button>
                    </div>
                  ))}
                </div>
                <div className="add-row">
                  <input
                    placeholder="이름 입력"
                    value={newMemberInputs[id] || ""}
                    onChange={(e) => setNewMemberInputs({ ...newMemberInputs, [id]: e.target.value })}
                    onKeyDown={(e) => { if (e.key === "Enter") addMember(id); }}
                  />
                  <button className="icon-btn" onClick={() => addMember(id)}><Plus size={15} /></button>
                </div>
              </div>
              );
            })}
          </div>
        </div>
      )}

      {selectedInfo && (
        <div className="modal-backdrop" onClick={() => setSelectedDate(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <div className="modal-date">{selectedInfo.y}년 {selectedInfo.m}월 {selectedInfo.d}일 ({WEEKDAYS[selectedInfo.weekday]})</div>
                {selectedInfo.holiday && <div className="modal-holiday">{selectedInfo.holiday}</div>}
              </div>
              <button className="icon-btn" onClick={() => setSelectedDate(null)}><X size={18} /></button>
            </div>

            <div className="modal-team">
              <span className="dot lg" style={{ background: TEAM_COLORS[selectedInfo.team] }} />
              <span>당직조 <strong>{selectedInfo.team}조</strong></span>
            </div>

            <div className="modal-section-title">근무 인원</div>
            <div className="roster-list">
              {selectedInfo.roster.length === 0 && <div className="empty-hint">{selectedInfo.team}조에 등록된 인원이 없습니다. 조 인원 관리 탭에서 먼저 등록해주세요.</div>}
              {selectedInfo.roster.map((name) => {
                const sub = selectedInfo.daySubs.find((s) => s.original === name);
                return (
                  <div className="roster-row" key={name}>
                    {sub ? (
                      <span className="sub-swap"><span className="struck">{name}</span> <ArrowLeftRight size={12} /> <strong>{sub.substitute}</strong></span>
                    ) : (
                      <span>{name}</span>
                    )}
                    {sub && <button className="icon-btn small" onClick={() => removeSub(selectedDate, sub.id)}><Trash2 size={13} /></button>}
                  </div>
                );
              })}
            </div>

            {selectedInfo.roster.length > 0 && (
              <div className="sub-form">
                <div className="modal-section-title">대근 등록</div>
                <select value={subForm.original} onChange={(e) => setSubForm({ ...subForm, original: e.target.value })}>
                  <option value="">원래 인원 선택</option>
                  {selectedInfo.roster
                    .filter((name) => !selectedInfo.daySubs.some((s) => s.original === name))
                    .map((name) => <option value={name} key={name}>{name}</option>)}
                </select>
                <input placeholder="대근자 이름" value={subForm.substitute} onChange={(e) => setSubForm({ ...subForm, substitute: e.target.value })} />
                <input placeholder="메모 (선택)" value={subForm.note} onChange={(e) => setSubForm({ ...subForm, note: e.target.value })} />
                <button className="add-sub-btn" onClick={addSub}><Plus size={14} /> 대근 등록</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&display=swap');
* { box-sizing: border-box; }
.app-root {
  --bg: #0B1120; --panel: #121A2C; --panel-alt: #182238; --border: #263352;
  --text: #E7ECF5; --muted: #8B96B3; --amber: #F0A63C; --red: #E86A6A;
  font-family: 'Inter', sans-serif; background: var(--bg); color: var(--text);
  padding: 20px; border-radius: 14px; width: 100%; max-width: 1100px; margin: 0 auto;
  overflow-x: hidden;
}
@media (min-width: 900px) and (min-aspect-ratio: 1/1) {
  .app-root { padding: 28px 32px; }
}
.header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 14px; margin-bottom: 6px; }
.header-title { display: flex; gap: 10px; align-items: flex-start; }
.header-title h1 { font-family: 'Space Grotesk', sans-serif; font-size: 18px; margin: 0; letter-spacing: -0.01em; }
.header-title p { margin: 2px 0 0; font-size: 12px; color: var(--muted); }
.tabs { display: flex; gap: 6px; background: var(--panel-alt); padding: 4px; border-radius: 9px; border: 1px solid var(--border); }
.tab { display: flex; align-items: center; gap: 6px; background: transparent; border: none; color: var(--muted); font-size: 12.5px; padding: 7px 12px; border-radius: 6px; cursor: pointer; font-family: inherit; }
.tab.active { background: var(--panel); color: var(--text); }
.share-note { font-size: 11px; color: var(--muted); margin: 10px 2px 14px; }
.saving { color: var(--amber); }
.panel { background: var(--panel); border: 1px solid var(--border); border-radius: 12px; padding: 20px; margin-top: 10px; }
.month-nav { display: flex; align-items: center; gap: 10px; margin-bottom: 18px; }
.month-label { font-family: 'Space Grotesk', sans-serif; font-size: 20px; font-weight: 600; min-width: 120px; text-align: center; }
.icon-btn { background: var(--panel-alt); border: 1px solid var(--border); color: var(--text); border-radius: 7px; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; cursor: pointer; }
.icon-btn.small { width: 24px; height: 24px; }
.today-btn { margin-left: auto; background: transparent; border: 1px solid var(--border); color: var(--muted); font-size: 13px; padding: 7px 12px; border-radius: 7px; cursor: pointer; font-family: inherit; }
.legend { display: flex; flex-wrap: wrap; gap: 14px; margin-bottom: 18px; padding-bottom: 14px; border-bottom: 1px solid var(--border); }
.legend-item { display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--muted); }
.dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
.dot.lg { width: 13px; height: 13px; }
.weekday-row { display: grid; grid-template-columns: repeat(7, 1fr); margin-bottom: 8px; }
.weekday { text-align: center; font-size: 13px; color: var(--muted); padding: 6px 0; }
.weekday.sun { color: var(--red); }
.weekday.sat { color: #4FA9E8; }
.grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; }
.cell { background: var(--panel-alt); border: 1px solid var(--border); border-top: 3px solid; border-radius: 8px; min-height: 112px; padding: 9px; display: flex; flex-direction: column; cursor: pointer; text-align: left; font-family: inherit; position: relative; }
.cell-names { margin-top: 5px; font-size: 11px; line-height: 1.4; color: var(--muted); overflow: hidden; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; }
.cell-name { margin-right: 2px; }
.cell-name.subbed { color: var(--amber); font-weight: 600; }
.cell.dim { opacity: 0.35; }
.cell.today { box-shadow: 0 0 0 2px var(--amber); }
.cell-top { display: flex; justify-content: space-between; align-items: flex-start; }
.cell-date { font-size: 14.5px; color: var(--text); font-family: 'Space Grotesk', sans-serif; }
.cell-date.sun { color: var(--red); }
.cell-date.sat { color: #4FA9E8; }
.cell-date.holiday { color: var(--red); font-weight: 700; }
.cell-badge { color: #0B1120; font-size: 11.5px; font-weight: 700; width: 21px; height: 21px; border-radius: 6px; display: flex; align-items: center; justify-content: center; }
.cell-holiday { font-size: 10px; color: var(--red); margin-top: auto; line-height: 1.2; }
.cell-sub-dot { position: absolute; bottom: 6px; right: 6px; width: 7px; height: 7px; border-radius: 50%; background: var(--amber); }
.teams-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 10px; }
.team-card { background: var(--panel-alt); border: 1px solid var(--border); border-radius: 10px; padding: 12px; }
.team-card-head { display: flex; align-items: center; gap: 7px; margin-bottom: 8px; }
.team-name { font-family: 'Space Grotesk', sans-serif; font-weight: 600; font-size: 13px; }
.team-count { margin-left: auto; font-size: 11px; color: var(--muted); }
.member-list { display: flex; flex-direction: column; gap: 4px; min-height: 20px; margin-bottom: 8px; }
.member-row { display: flex; justify-content: space-between; align-items: center; background: var(--panel); border-radius: 6px; padding: 5px 8px; font-size: 12.5px; }
.empty-hint { font-size: 11px; color: var(--muted); padding: 4px 0; }
.add-row { display: flex; gap: 6px; }
.add-row input { flex: 1; background: var(--panel); border: 1px solid var(--border); border-radius: 6px; color: var(--text); font-size: 12.5px; padding: 6px 8px; font-family: inherit; }
.modal-backdrop { position: fixed; inset: 0; background: rgba(4,7,15,0.6); display: flex; align-items: center; justify-content: center; z-index: 50; padding: 16px; }
.modal { background: var(--panel); border: 1px solid var(--border); border-radius: 12px; padding: 18px; width: 100%; max-width: 380px; max-height: 85vh; overflow-y: auto; }
.modal-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
.modal-date { font-family: 'Space Grotesk', sans-serif; font-size: 15px; font-weight: 600; }
.modal-holiday { font-size: 11.5px; color: var(--red); margin-top: 2px; }
.modal-team { display: flex; align-items: center; gap: 8px; font-size: 13px; margin-bottom: 14px; padding-bottom: 12px; border-bottom: 1px solid var(--border); }
.modal-section-title { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 6px; }
.roster-list { display: flex; flex-direction: column; gap: 4px; margin-bottom: 14px; }
.roster-row { display: flex; justify-content: space-between; align-items: center; background: var(--panel-alt); border-radius: 6px; padding: 6px 9px; font-size: 12.5px; }
.sub-swap { display: flex; align-items: center; gap: 5px; color: var(--amber); }
.struck { text-decoration: line-through; color: var(--muted); }
.sub-form { display: flex; flex-direction: column; gap: 6px; padding-top: 10px; border-top: 1px solid var(--border); }
.sub-form select, .sub-form input { background: var(--panel-alt); border: 1px solid var(--border); border-radius: 6px; color: var(--text); font-size: 12.5px; padding: 7px 9px; font-family: inherit; }
.add-sub-btn { display: flex; align-items: center; justify-content: center; gap: 5px; background: var(--amber); color: #201400; border: none; border-radius: 7px; padding: 8px; font-size: 12.5px; font-weight: 600; cursor: pointer; margin-top: 2px; font-family: inherit; }
@media (max-width: 520px) {
  .app-root { padding: 14px; }
  .grid { gap: 5px; }
  .cell { min-height: 80px; padding: 6px; }
  .cell-date { font-size: 12px; }
  .cell-badge { width: 17px; height: 17px; font-size: 10px; }
  .cell-names { font-size: 9.5px; -webkit-line-clamp: 3; }
  .month-label { font-size: 16px; min-width: 90px; }
}
`;
