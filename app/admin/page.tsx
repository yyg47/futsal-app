"use client";
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { Calendar, PlusCircle, Settings, ArrowLeft } from "lucide-react";
import Link from "next/link";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Session {
  id: string;
  date: string;
  status: string;
}

export default function AdminPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [newDate, setNewDate] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    const { data, error } = await supabase
      .from("sessions")
      .select("*")
      .order("date", { ascending: false });

    if (error) console.error("세션 불러오기 실패:", error);
    else setSessions(data || []);
  };

  // 새 세션 생성 함수
  const createSession = async () => {
    if (!newDate) {
      alert("세션 날짜를 선택해주세요!");
      return;
    }

    setLoading(true);
    const { error } = await supabase
      .from("sessions")
      .insert({ date: newDate, status: "RECRUITING" });

    if (error) {
      console.error("세션 생성 실패:", error);
      alert("세션 생성 중 오류가 발생했습니다.");
    } else {
      alert("새로운 풋살 세션이 성공적으로 개설되었습니다! ⚽");
      setNewDate("");
      fetchSessions();
    }
    setLoading(false);
  };

  // 세션 상태 변경 함수 (모집중 -> 드래프트 -> 경기중 -> 마감)
  const updateStatus = async (sessionId: string, newStatus: string) => {
    const { error } = await supabase
      .from("sessions")
      .update({ status: newStatus })
      .eq("id", sessionId);

    if (error) {
      console.error("상태 변경 실패:", error);
      alert("상태 변경 실패");
    } else {
      fetchSessions();
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 p-4 max-w-md mx-auto pb-24">
      {/* 상단 네비게이션 */}
      <div className="flex items-center justify-between mb-6">
        <Link
          href="/"
          className="text-gray-500 hover:text-gray-800 text-sm font-semibold flex items-center gap-1"
        >
          <ArrowLeft size={16} /> 메인으로 돌아가기
        </Link>
        <span className="bg-amber-100 text-amber-800 text-xs px-2.5 py-1 rounded-full font-bold flex items-center gap-1">
          <Settings size={12} /> 방장 전용 관리 패널
        </span>
      </div>

      <div className="bg-emerald-600 text-white p-5 rounded-2xl shadow-md mb-6 text-center">
        <h1 className="text-xl font-bold">🛠️ 방장 세션 관리 센터</h1>
        <p className="text-emerald-100 text-xs mt-1">
          새로운 화요일 경기를 열고 모임 상태를 통제하세요.
        </p>
      </div>

      {/* 새 세션 개설 카드 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm mb-6">
        <h2 className="font-bold text-gray-800 mb-3 text-sm flex items-center gap-2">
          <PlusCircle size={18} className="text-emerald-600" />
          새로운 화요일 세션 개설
        </h2>
        <div className="flex gap-2">
          <input
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="flex-1 p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 focus:outline-none focus:border-emerald-500"
          />
          <button
            onClick={createSession}
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 rounded-xl text-sm transition-all shadow"
          >
            {loading ? "개설중..." : "세션 개설"}
          </button>
        </div>
      </div>

      {/* 등록된 세션 목록 및 상태 관리 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <h2 className="font-bold text-gray-800 mb-3 text-sm flex items-center gap-2">
          <Calendar size={18} className="text-emerald-600" />
          세션 목록 및 상태 변경
        </h2>

        {sessions.length === 0 ? (
          <p className="text-center text-gray-400 py-6 text-xs">
            생성된 세션이 없습니다.
          </p>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="bg-gray-50 p-3.5 rounded-xl border border-gray-100"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-gray-800 text-sm">
                    📅 경기일: {session.date}
                  </span>
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                      session.status === "RECRUITING"
                        ? "bg-emerald-100 text-emerald-700"
                        : session.status === "DRAFTING"
                        ? "bg-amber-100 text-amber-700"
                        : session.status === "PLAYING"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-gray-200 text-gray-600"
                    }`}
                  >
                    {session.status}
                  </span>
                </div>

                {/* 상태 변경 버튼들 */}
                <div className="grid grid-cols-4 gap-1 mt-3">
                  <button
                    onClick={() => updateStatus(session.id, "RECRUITING")}
                    className={`py-1.5 text-[10px] font-bold rounded-lg border transition-all ${
                      session.status === "RECRUITING"
                        ? "bg-emerald-600 text-white border-emerald-600 shadow"
                        : "bg-white text-gray-600"
                    }`}
                  >
                    모집중
                  </button>
                  <button
                    onClick={() => updateStatus(session.id, "DRAFTING")}
                    className={`py-1.5 text-[10px] font-bold rounded-lg border transition-all ${
                      session.status === "DRAFTING"
                        ? "bg-amber-500 text-white border-amber-500 shadow"
                        : "bg-white text-gray-600"
                    }`}
                  >
                    드래프트
                  </button>
                  <button
                    onClick={() => updateStatus(session.id, "PLAYING")}
                    className={`py-1.5 text-[10px] font-bold rounded-lg border transition-all ${
                      session.status === "PLAYING"
                        ? "bg-blue-600 text-white border-blue-600 shadow"
                        : "bg-white text-gray-600"
                    }`}
                  >
                    경기중
                  </button>
                  <button
                    onClick={() => updateStatus(session.id, "CLOSED")}
                    className={`py-1.5 text-[10px] font-bold rounded-lg border transition-all ${
                      session.status === "CLOSED"
                        ? "bg-gray-700 text-white border-gray-700 shadow"
                        : "bg-white text-gray-600"
                    }`}
                  >
                    마감
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
