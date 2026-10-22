"use client";
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Users,
  CheckCircle,
  Clock,
  ShieldCheck,
  Play,
  Award,
  Settings,
  LogIn,
  LogOut,
} from "lucide-react";
import Link from "next/link";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface User {
  id: string;
  name: string;
  phone?: string;
}

interface Attendee {
  id: string;
  payment_status: "PAID" | "PENDING";
  user_id: string;
  users: User;
}

export default function FutsalHome() {
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isAdmin, setIsAdmin] = useState<boolean>(true);

  useEffect(() => {
    // 1. 초기 세션 확인
    checkUserAndSession();

    // 2. 카카오 로그인 후 돌아왔을 때 세션 변화를 실시간 감지하여 화면 업데이트
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user ?? null);
      if (session?.user && currentSessionId) {
        fetchAttendees(currentSessionId);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [currentSessionId]);

  // 1. 현재 로그인한 유저 정보 및 최신 세션 ID 가져오기
  const checkUserAndSession = async () => {
    setLoading(true);

    const { data, error } = await supabase.auth.getSession();
    console.log("현재 세션 데이터:", data);
    console.log("세션 에러:", error);

    setCurrentUser(data.session?.user ?? null);

    const { data: sessionData } = await supabase
      .from("sessions")
      .select("id")
      .order("date", { ascending: false })
      .limit(1)
      .single();

    if (sessionData) {
      setCurrentSessionId(sessionData.id);
      fetchAttendees(sessionData.id);
    }
    setLoading(false);
  };

  // 2. 해당 세션의 참가 신청 명단 불러오기
  const fetchAttendees = async (sessionId: string) => {
    const { data, error } = await supabase
      .from("session_attendees")
      .select(`id, payment_status, user_id, users ( id, name, phone )`)
      .eq("session_id", sessionId);

    if (!error) {
      setAttendees((data as unknown as Attendee[]) || []);
    }
  };

  // 3. 카카오 소셜 로그인 실행
  const handleKakaoLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "kakao",
      options: {
        redirectTo: `${window.location.origin}`,
        queryParams: {
          scope: "profile_nickname", // 이메일과 프로필 이미지를 제외하고 닉네임만 요청
        },
      },
    });
  };

  // 4. 로그아웃
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    window.location.reload();
  };

  // 5. 👈 핵심: 셀프 참가 신청하기 (선착순 15명 제한)
  // 5. 👈 수정된 셀프 참가 신청하기 (users 테이블 자동 동기화 포함)
  const handleApplySession = async () => {
    if (!currentUser) {
      alert("로그인이 필요합니다!");
      handleKakaoLogin();
      return;
    }

    if (!currentSessionId) {
      alert("현재 진행 중인 경기 세션이 없습니다!");
      return;
    }

    if (attendees.length >= 15) {
      alert("아쉽지만 선착순 15명이 마감되었습니다!");
      return;
    }

    // 이미 신청했는지 체크
    const alreadyApplied = attendees.some((a) => a.user_id === currentUser.id);
    if (alreadyApplied) {
      alert("이미 참가 신청이 완료되었습니다!");
      return;
    }

    // 💡 핵심: public.users 테이블에 내 유저 정보가 없으면 자동 등록 (Upsert)
    const kakaoName =
      currentUser.user_metadata?.name ||
      currentUser.user_metadata?.full_name ||
      currentUser.user_metadata?.preferred_username ||
      "카카오 유저";

    const { error: userError } = await supabase.from("users").upsert(
      {
        id: currentUser.id,
        name: kakaoName,
      },
      { onConflict: "id" }
    );

    if (userError) {
      console.error("유저 프로필 동기화 에러:", userError);
      alert("유저 프로필을 생성하는 중 문제가 발생했습니다.");
      return;
    }

    // session_attendees 테이블에 참가 신청 insert
    const { error } = await supabase.from("session_attendees").insert({
      session_id: currentSessionId,
      user_id: currentUser.id,
      payment_status: "PENDING", // 기본 미입금 상태
    });

    if (error) {
      console.error("신청 에러:", error);
      alert("참가 신청 중 오류가 발생했습니다.");
    } else {
      alert("참가 신청이 성공적으로 완료되었습니다! 🎉 (입금을 진행해주세요)");
      fetchAttendees(currentSessionId);
    }
  };

  // 방장용 입금 상태 토글
  const togglePayment = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "PAID" ? "PENDING" : "PAID";
    const { error } = await supabase
      .from("session_attendees")
      .update({ payment_status: newStatus })
      .eq("id", id);

    if (!error && currentSessionId) {
      fetchAttendees(currentSessionId);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 p-4 max-w-md mx-auto pb-28">
      {/* 상단 모임 정보 카드 */}
      <div className="bg-emerald-600 text-white p-5 rounded-2xl shadow-md mb-6 relative">
        <div className="flex items-center justify-between">
          <span className="bg-emerald-500 text-xs px-2.5 py-1 rounded-full font-semibold">
            매주 화요일 정기 풋살
          </span>

          <div className="flex items-center gap-2">
            <Link
              href="/admin"
              className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs px-2.5 py-1 rounded-full font-bold flex items-center gap-1 transition-all"
            >
              <Settings size={12} /> 관리자 센터
            </Link>
            {currentUser ? (
              <button
                onClick={handleLogout}
                className="bg-rose-600 text-white text-xs px-2 py-1 rounded-full font-bold flex items-center gap-1"
              >
                <LogOut size={12} /> 로그아웃
              </button>
            ) : (
              <button
                onClick={handleKakaoLogin}
                className="bg-amber-400 text-amber-950 text-xs px-2.5 py-1 rounded-full font-bold flex items-center gap-1"
              >
                <LogIn size={12} /> 카카오 로그인
              </button>
            )}
          </div>
        </div>

        <h1 className="text-2xl font-bold mt-2">이번 주 화요일 풋살 ⚽</h1>
        <p className="text-emerald-100 text-sm mt-1">
          장소: 실내 풋살장 / 시간: 20:00 ~ 22:00
        </p>
        <div className="mt-4 flex items-center justify-between text-sm border-t border-emerald-500 pt-3">
          <span>신청 인원</span>
          <span className="font-bold text-lg">{attendees.length} / 15명</span>
        </div>
      </div>

      {/* 빠른 이동 네비게이션 */}
      <div className="grid grid-cols-2 gap-2 mb-6">
        <Link
          href="/draft"
          className="bg-white hover:bg-emerald-50 border border-emerald-200 p-3 rounded-2xl shadow-sm text-center flex flex-col items-center justify-center transition-all"
        >
          <Play size={20} className="text-emerald-600 mb-1" />
          <span className="font-bold text-xs text-gray-800">
            디지털 드래프트 ⚡
          </span>
        </Link>
        <Link
          href="/result"
          className="bg-white hover:bg-emerald-50 border border-emerald-200 p-3 rounded-2xl shadow-sm text-center flex flex-col items-center justify-center transition-all"
        >
          <Award size={20} className="text-emerald-600 mb-1" />
          <span className="font-bold text-xs text-gray-800">
            경기 결과 & 빨래 🏆
          </span>
        </Link>
      </div>

      {/* 참가 신청 명단 리스트 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-800 flex items-center gap-2">
            <Users size={18} className="text-emerald-600" />
            참가 신청 명단 (선착순 15명)
          </h2>
          {isAdmin && (
            <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-medium flex items-center gap-1">
              <ShieldCheck size={12} /> 방장 모드
            </span>
          )}
        </div>

        {loading ? (
          <p className="text-center text-gray-400 py-6">불러오는 중...</p>
        ) : attendees.length === 0 ? (
          <p className="text-center text-gray-400 py-6">
            아직 신청자가 없습니다. 첫 주자가 되어보세요!
          </p>
        ) : (
          <div className="space-y-2">
            {attendees.map((item, index) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-xl"
              >
                <div className="flex items-center gap-3">
                  <span className="font-bold text-gray-400 text-sm w-5">
                    {index + 1}
                  </span>
                  <span className="font-semibold text-gray-700">
                    {item.users?.name || "카카오 유저"}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      isAdmin && togglePayment(item.id, item.payment_status)
                    }
                    className={`text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1 transition-colors ${
                      item.payment_status === "PAID"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-orange-100 text-orange-700"
                    }`}
                  >
                    {item.payment_status === "PAID" ? (
                      <CheckCircle size={12} />
                    ) : (
                      <Clock size={12} />
                    )}
                    {item.payment_status === "PAID" ? "입금완료" : "미입금"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 하단 셀프 참가 신청 버튼 */}
      <div className="fixed bottom-4 left-4 right-4 max-w-md mx-auto">
        <button
          onClick={handleApplySession}
          className={`w-full font-bold py-3.5 rounded-2xl shadow-lg transition-all ${
            attendees.length >= 15
              ? "bg-gray-300 text-gray-600 cursor-not-allowed"
              : "bg-emerald-600 hover:bg-emerald-700 text-white"
          }`}
        >
          {attendees.length >= 15
            ? "선착순 마감되었습니다 🚫"
            : "참가 신청하기 (셀프 선착순 ⚽)"}
        </button>
      </div>
    </main>
  );
}
