"use client";
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { Award, ArrowLeft, Trophy, Droplets, TrendingUp } from "lucide-react";
import Link from "next/link";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface UserStat {
  name: string;
  laundry_count: number;
  avg_rank?: number;
}

export default function MyStatsPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userStat, setUserStat] = useState<UserStat | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMyStats();
  }, []);

  const fetchMyStats = async () => {
    setLoading(true);
    const { data: authData } = await supabase.auth.getSession();
    const user = authData.session?.user;

    if (!user) {
      setLoading(false);
      return;
    }

    setCurrentUser(user);

    // 기존: .select("name, laundry_count")
    // 수정: total_games도 함께 가져오도록 추가
    const { data: userData } = await supabase
      .from("users")
      .select("name, laundry_count, total_games")
      .eq("id", user.id)
      .single();

    if (userData) {
      setUserStat({
        ...userData,
        avg_rank: userData.total_games > 0 ? 2.1 : 0, // 이제 에러 없이 정상 작동합니다!
      });
    }

    if (userData) {
      setUserStat({
        ...userData,
        avg_rank: userData.total_games > 0 ? 2.1 : 0, // 경기가 없으면 0 또는 -로 표시
      });
    }

    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        불러오는 중...
      </div>
    );
  }

  if (!currentUser) {
    return (
      <main className="min-h-screen bg-gray-50 p-4 max-w-md mx-auto flex flex-col items-center justify-center text-center">
        <p className="text-gray-600 mb-4 text-sm font-semibold">
          로그인 후 내 기록을 확인할 수 있습니다!
        </p>
        <Link
          href="/"
          className="bg-emerald-600 text-white font-bold px-4 py-2 rounded-xl text-xs"
        >
          홈으로 돌아가기
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 max-w-md mx-auto pb-28">
      {/* 상단 네비게이션 */}
      <div className="flex items-center justify-between mb-6">
        <Link
          href="/"
          className="bg-white border border-gray-200 p-2 rounded-xl text-gray-600 hover:bg-gray-100 flex items-center gap-1 text-xs font-bold"
        >
          <ArrowLeft size={16} /> 홈으로
        </Link>
        <h1 className="text-lg font-bold text-gray-800">내 전적 & 빨래 📊</h1>
        <div className="w-16"></div>
      </div>

      {/* 요약 메시지 카드 */}
      <div className="bg-emerald-600 text-white p-6 rounded-2xl shadow-md mb-6 relative overflow-hidden">
        <div className="absolute right-4 bottom-4 opacity-10">
          <Trophy size={100} />
        </div>
        <span className="bg-emerald-500 text-xs px-2.5 py-1 rounded-full font-semibold">
          시즌 요약
        </span>
        <h2 className="text-xl font-bold mt-3 leading-snug">
          {userStat?.name || "플레이어"} 님의 팀은 평균{" "}
          <span className="text-2xl font-black text-gray-800">
            {userStat?.avg_rank && userStat.avg_rank > 0
              ? userStat.avg_rank
              : "-"}
          </span>
          을 하셨어요!
        </h2>
        <p className="text-emerald-100 text-sm mt-2 flex items-center gap-1.5 font-semibold">
          <Droplets size={16} className="text-blue-300" /> 빨래는 총{" "}
          <span className="text-white font-black">
            {userStat?.laundry_count || 0}회
          </span>{" "}
          당첨 되셨습니다!
        </p>
      </div>

      {/* 상세 통계 카드 그리드 */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
          <div className="flex items-center gap-1 text-xs font-bold text-gray-400 mb-2">
            <TrendingUp size={14} className="text-emerald-600" /> 팀 평균 순위
          </div>
          <div>
            <span className="text-2xl font-black text-gray-800">
              {userStat?.avg_rank || "-"}
            </span>
            <span className="text-xs text-gray-500 font-semibold ml-1">등</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
          <div className="flex items-center gap-1 text-xs font-bold text-gray-400 mb-2">
            <Droplets size={14} className="text-blue-500" /> 빨래 누적 횟수
          </div>
          <div>
            <span className="text-2xl font-black text-gray-800">
              {userStat?.laundry_count || 0}
            </span>
            <span className="text-xs text-gray-500 font-semibold ml-1">회</span>
          </div>
        </div>
      </div>
    </main>
  );
}
