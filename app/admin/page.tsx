"use client";
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  ShieldCheck,
  Plus,
  CheckCircle,
  XCircle,
  ArrowLeft,
  Trash2,
  UserPlus,
} from "lucide-react";
import Link from "next/link";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Attendee {
  id: string;
  user_id: string;
  payment_status: "PAID" | "PENDING";
  users: {
    id: string;
    name: string;
  };
}

interface Session {
  id: string;
  date: string;
}

interface UserProfile {
  id: string;
  name: string;
}

export default function AdminPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null
  );
  const [attendees, setAttendees] = useState<Attendee[]>();
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [selectedUserIdToAdd, setSelectedUserIdToAdd] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const [newDate, setNewDate] = useState("");

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedSessionId) {
      fetchAttendees(selectedSessionId);
    }
  }, [selectedSessionId]);

  const fetchInitialData = async () => {
    setLoading(true);
    const { data: sessionData } = await supabase
      .from("sessions")
      .select("*")
      .order("date", { ascending: false });

    if (sessionData && sessionData.length > 0) {
      setSessions(sessionData);
      setSelectedSessionId(sessionData[0].id);
    }

    const { data: usersData } = await supabase.from("users").select("id, name");
    if (usersData) {
      setAllUsers(usersData);
    }

    setLoading(false);
  };

  const fetchAttendees = async (sessionId: string) => {
    const { data } = await supabase
      .from("session_attendees")
      .select(`id, user_id, payment_status, users ( id, name )`)
      .eq("session_id", sessionId);

    if (data) {
      setAttendees(data as unknown as Attendee[]);
    }
  };

  // 새 세션 생성 (날짜만 등록)
  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDate) {
      alert("날짜를 선택해 주세요!");
      return;
    }

    const { data, error } = await supabase
      .from("sessions")
      .insert({ date: newDate })
      .select()
      .single();

    if (error) {
      alert("세션 생성 실패: " + error.message);
    } else if (data) {
      alert("새로운 풋살 세션이 생성되었습니다! 🚀");
      setSessions([data, ...sessions]);
      setSelectedSessionId(data.id);
      setNewDate("");
    }
  };

  // 입금 상태 토글
  const togglePayment = async (attendeeId: string, currentStatus: string) => {
    const newStatus = currentStatus === "PAID" ? "PENDING" : "PAID";
    const { error } = await supabase
      .from("session_attendees")
      .update({ payment_status: newStatus })
      .eq("id", attendeeId);

    if (!error && selectedSessionId) {
      fetchAttendees(selectedSessionId);
    }
  };

  // 방장이 수동으로 참가자 추가하기
  const handleAddAttendeeManually = async () => {
    if (!selectedSessionId || !selectedUserIdToAdd) {
      alert("추가할 유저를 선택해 주세요!");
      return;
    }

    const already = attendees?.some((a) => a.user_id === selectedUserIdToAdd);
    if (already) {
      alert("이미 해당 세션에 신청된 참가자입니다!");
      return;
    }

    const { error } = await supabase.from("session_attendees").insert({
      session_id: selectedSessionId,
      user_id: selectedUserIdToAdd,
      payment_status: "PENDING",
    });

    if (error) {
      alert("참가자 추가 중 오류가 발생했습니다: " + error.message);
    } else {
      alert("참가자가 추가되었습니다! 👍");
      setSelectedUserIdToAdd("");
      fetchAttendees(selectedSessionId);
    }
  };

  // 방장이 참가자 명단에서 제외하기 (삭제)
  const handleRemoveAttendee = async (attendeeId: string, userName: string) => {
    if (
      !confirm(`"${userName}" 님을 이번 세션 참가 명단에서 제외하시겠습니까?`)
    )
      return;

    const { error } = await supabase
      .from("session_attendees")
      .delete()
      .eq("id", attendeeId);

    if (error) {
      alert("삭제 실패: " + error.message);
    } else {
      if (selectedSessionId) fetchAttendees(selectedSessionId);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        관리자 패널 로딩 중...
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 max-w-md mx-auto pb-28">
      <div className="flex items-center justify-between mb-6">
        <Link
          href="/"
          className="bg-white border border-gray-200 p-2 rounded-xl text-gray-600 hover:bg-gray-100 flex items-center gap-1 text-xs font-bold"
        >
          <ArrowLeft size={16} /> 홈으로
        </Link>
        <h1 className="text-lg font-bold text-gray-800 flex items-center gap-1.5">
          <ShieldCheck className="text-emerald-600" size={20} /> 방장 패널 👑
        </h1>
        <div className="w-16"></div>
      </div>

      {/* 새 세션 생성 박스 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm mb-6 border border-gray-100">
        <h2 className="font-bold text-gray-800 text-sm mb-3 flex items-center gap-1">
          <Plus size={16} className="text-emerald-600" /> 새 화요일 세션
          개설하기
        </h2>
        <form onSubmit={handleCreateSession} className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 font-semibold block mb-1">
              날짜 선택
            </label>
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-sm font-medium text-gray-800 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-sm shadow-md transition-all"
          >
            세션 추가하기 📅
          </button>
        </form>
      </div>

      {/* 세션 선택 탭 */}
      {sessions.length > 0 && (
        <div className="mb-6">
          <label className="text-xs text-gray-500 font-semibold block mb-2">
            관리할 세션 선택
          </label>
          <select
            value={selectedSessionId || ""}
            onChange={(e) => setSelectedSessionId(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded-xl p-3 text-sm font-bold text-gray-800 shadow-sm focus:outline-none focus:border-emerald-500"
          >
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                📅 {s.date} 세션
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 방장 수동 참가자 추가 박스 */}
      {selectedSessionId && (
        <div className="bg-white rounded-2xl p-4 shadow-sm mb-6 border border-gray-100">
          <h2 className="font-bold text-gray-800 text-sm mb-2 flex items-center gap-1">
            <UserPlus size={16} className="text-emerald-600" /> 참가자 수동 추가
          </h2>
          <div className="flex gap-2">
            <select
              value={selectedUserIdToAdd}
              onChange={(e) => setSelectedUserIdToAdd(e.target.value)}
              className="flex-1 bg-gray-50 border border-gray-200 rounded-xl p-2 text-xs font-semibold text-gray-800 focus:outline-none focus:border-emerald-500"
            >
              <option value="">-- 추가할 회원 선택 --</option>
              {allUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            <button
              onClick={handleAddAttendeeManually}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-xs shadow transition-all"
            >
              추가
            </button>
          </div>
        </div>
      )}

      {/* 참가자 명단 관리 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <h2 className="font-bold text-gray-800 text-sm mb-3 flex items-center justify-between">
          <span>참가자 명단 관리</span>
          <span className="text-xs text-emerald-600 font-semibold">
            총 {attendees?.length || 0}명
          </span>
        </h2>

        {!attendees || attendees.length === 0 ? (
          <p className="text-center text-gray-400 text-xs py-6">
            참가 신청한 인원이 없습니다.
          </p>
        ) : (
          <div className="space-y-2">
            {attendees.map((attendee, idx) => (
              <div
                key={attendee.id}
                className="flex items-center justify-between bg-gray-50 p-3 rounded-xl border border-gray-100"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-400 w-5">
                    {idx + 1}
                  </span>
                  <span className="font-bold text-gray-800 text-sm">
                    {attendees[idx].users?.name || "유저"}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      togglePayment(attendee.id, attendee.payment_status)
                    }
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      attendee.payment_status === "PAID"
                        ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                        : "bg-orange-100 text-orange-700 hover:bg-orange-200"
                    }`}
                  >
                    {attendee.payment_status === "PAID" ? (
                      <CheckCircle size={12} />
                    ) : (
                      <XCircle size={12} />
                    )}
                    {attendee.payment_status === "PAID" ? "입금완료" : "미입금"}
                  </button>

                  <button
                    onClick={() =>
                      handleRemoveAttendee(
                        attendee.id,
                        attendee.users?.name || "유저"
                      )
                    }
                    className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-all"
                    title="명단에서 제외"
                  >
                    <Trash2 size={14} />
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
