"use client";
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { Users, CheckCircle2 } from "lucide-react";

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
  user_id: string;
  users: User;
}

type TeamKey = "A" | "B" | "C";

export default function DraftPage() {
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [captains, setCaptains] = useState<Attendee[]>([]);
  const [teams, setTeams] = useState<Record<TeamKey, Attendee[]>>({
    A: [],
    B: [],
    C: [],
  });
  const [currentCaptainIdx, setCurrentCaptainIdx] = useState<number>(0);
  const [draftStep, setDraftStep] = useState<
    "SELECT_CAPTAINS" | "DRAFTING" | "DONE"
  >("SELECT_CAPTAINS");

  // 👈 픽 취소(Undo)를 위한 히스토리 상태 추가
  const [pickHistory, setPickHistory] = useState<
    { teamKey: TeamKey; attendee: Attendee; prevCaptainIdx: number }[]
  >([]);

  useEffect(() => {
    fetchAttendees();
  }, []);

  const fetchAttendees = async () => {
    const { data, error } = await supabase
      .from("session_attendees")
      .select(`id, user_id, users ( id, name, phone )`);

    if (error) {
      console.error("참가자 불러오기 실패:", error);
    } else if (data) {
      setAttendees(data as unknown as Attendee[]);
    }
  };

  const toggleCaptainSelection = (attendee: Attendee) => {
    if (captains.find((c) => c.user_id === attendee.user_id)) {
      setCaptains(captains.filter((c) => c.user_id !== attendee.user_id));
    } else {
      if (captains.length >= 3) {
        alert("주장은 총 3명만 지정할 수 있습니다!");
        return;
      }
      setCaptains([...captains, attendee]);
    }
  };

  const startDraft = () => {
    if (captains.length !== 3) {
      alert("주장 3명을 선택해주세요!");
      return;
    }
    setTeams({
      A: [captains[0]],
      B: [captains[1]],
      C: [captains[2]],
    });
    setDraftStep("DRAFTING");
    setPickHistory([]); // 초기화
  };

  // 멤버 픽 (히스토리 기록 추가)
  const pickPlayer = (attendee: Attendee) => {
    const teamKeys: TeamKey[] = ["A", "B", "C"];
    const activeTeamKey = teamKeys[currentCaptainIdx];

    setPickHistory((prev) => [
      ...prev,
      { teamKey: activeTeamKey, attendee, prevCaptainIdx: currentCaptainIdx },
    ]);

    setTeams((prev) => ({
      ...prev,
      [activeTeamKey]: [...prev[activeTeamKey], attendee],
    }));

    if (currentCaptainIdx < 2) {
      setCurrentCaptainIdx(currentCaptainIdx + 1);
    } else {
      setCurrentCaptainIdx(0);
    }
  };

  // 👈 픽 취소(Undo) 함수
  const undoLastPick = () => {
    if (pickHistory.length === 0) return;

    const lastPick = pickHistory[pickHistory.length - 1];
    const { teamKey, attendee, prevCaptainIdx } = lastPick;

    setTeams((prev) => ({
      ...prev,
      [teamKey]: prev[teamKey].filter((m) => m.user_id !== attendee.user_id),
    }));

    setCurrentCaptainIdx(prevCaptainIdx);
    setPickHistory((prev) => prev.slice(0, -1));
  };

  const draftedUserIds = new Set(
    Object.values(teams)
      .flat()
      .map((item) => item.user_id)
  );
  const remainingAttendees = attendees.filter(
    (item) => !draftedUserIds.has(item.user_id)
  );

  const saveDraftToDatabase = async () => {
    try {
      const { data: sessionData } = await supabase
        .from("sessions")
        .select("id")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (!sessionData) {
        alert(
          "진행 중인 경기 세션이 없습니다! 방장 화면에서 세션을 먼저 생성해주세요."
        );
        return;
      }

      const sessionId = sessionData.id;
      const teamKeys: TeamKey[] = ["A", "B", "C"];
      const teamIdMap: Record<string, string> = {};

      for (const key of teamKeys) {
        const { data: teamData, error: teamError } = await supabase
          .from("teams")
          .insert({ session_id: sessionId, team_name: `${key}팀` })
          .select("id")
          .single();

        if (teamError) throw teamError;
        teamIdMap[key] = teamData.id;
      }

      let globalPickOrder = 1;

      for (const key of teamKeys) {
        const teamMembers = teams[key];
        for (let i = 0; i < teamMembers.length; i++) {
          const member = teamMembers[i];
          const isCaptain = i === 0;
          const pickOrderValue = isCaptain ? 0 : globalPickOrder++;

          const { error: memberError } = await supabase
            .from("team_members")
            .insert({
              team_id: teamIdMap[key],
              user_id: member.user_id,
              pick_order: pickOrderValue,
            });

          if (memberError) throw memberError;
        }
      }

      setDraftStep("DONE");
    } catch (error) {
      console.error("드래프트 저장 중 에러 발생:", error);
      alert("저장 중 문제가 발생했습니다. 콘솔을 확인해주세요.");
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 p-4 max-w-md mx-auto pb-24">
      <div className="bg-emerald-600 text-white p-5 rounded-2xl shadow-md mb-6 text-center">
        <h1 className="text-xl font-bold">⚡ 스마트 디지털 드래프트</h1>
        <p className="text-emerald-100 text-xs mt-1">
          가위바위보 대신 앱으로 1분 만에 팀 완성!
        </p>
      </div>

      {draftStep === "SELECT_CAPTAINS" && (
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h2 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
            <Users size={18} className="text-emerald-600" />
            오늘의 주장 3명을 선택해주세요 ({captains.length}/3)
          </h2>
          <p className="text-xs text-gray-400 mb-4">
            참가자 중 에이스나 팀장을 3명 터치하세요.
          </p>

          <div className="space-y-2 mb-6">
            {attendees.map((item) => {
              const isSelected = captains.find(
                (c) => c.user_id === item.user_id
              );
              return (
                <div
                  key={item.id}
                  onClick={() => toggleCaptainSelection(item)}
                  className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                    isSelected
                      ? "bg-emerald-50 border-emerald-500 text-emerald-900 font-bold"
                      : "bg-gray-50 border-gray-100 text-gray-700"
                  }`}
                >
                  <span>{item.users?.name}</span>
                  {isSelected && (
                    <CheckCircle2 size={18} className="text-emerald-600" />
                  )}
                </div>
              );
            })}
          </div>

          <button
            onClick={startDraft}
            disabled={captains.length !== 3}
            className={`w-full py-3.5 rounded-2xl font-bold shadow-md transition-all ${
              captains.length === 3
                ? "bg-emerald-600 text-white hover:bg-emerald-700"
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
            }`}
          >
            주장 선정 완료 & 드래프트 시작하기 🚀
          </button>
        </div>
      )}

      {draftStep === "DRAFTING" && (
        <div>
          {/* 현재 픽 차례 안내 */}
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl mb-4 text-center">
            <span className="text-xs font-semibold text-amber-800 bg-amber-100 px-2.5 py-1 rounded-full">
              현재 픽 차례
            </span>
            <h3 className="text-lg font-bold text-amber-900 mt-2">
              주장 {["A팀", "B팀", "C팀"][currentCaptainIdx]} 님의 차례입니다!
            </h3>
            <p className="text-xs text-amber-700 mt-1">
              아래 대기자 명단에서 팀원을 탭하세요.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-6">
            {(["A", "B", "C"] as TeamKey[]).map((teamKey, idx) => (
              <div
                key={teamKey}
                className={`p-3 rounded-2xl border ${
                  currentCaptainIdx === idx
                    ? "bg-emerald-50 border-emerald-500 ring-2 ring-emerald-400"
                    : "bg-white border-gray-200"
                }`}
              >
                <h4 className="font-bold text-sm text-gray-800 mb-2 border-b pb-1">
                  {teamKey}팀
                </h4>
                <div className="space-y-1 text-xs">
                  {teams[teamKey].map((member, i) => (
                    <div key={i} className="text-gray-700 font-medium">
                      • {member.users?.name}{" "}
                      {i === 0 && (
                        <span className="text-[10px] bg-emerald-200 text-emerald-800 px-1 rounded">
                          주장
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* 남은 대기자 리스트 */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            {/* 대기자 타이틀 + 픽 취소 버튼 배치 */}
            <div className="flex items-center justify-between mb-3 border-b pb-2">
              <h3 className="font-bold text-gray-800 text-sm">
                대기 중인 멤버
              </h3>

              {/* 👈 손가락 동선에 맞춘 픽 취소 버튼 */}
              <button
                onClick={undoLastPick}
                disabled={pickHistory.length === 0}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                  pickHistory.length > 0
                    ? "bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 shadow-sm"
                    : "bg-gray-100 text-gray-300 border border-gray-100 cursor-not-allowed"
                }`}
              >
                ↩️ 마지막 픽 취소
              </button>
            </div>

            {remainingAttendees.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-gray-500 font-medium mb-4">
                  모든 팀원이 배정되었습니다! 🎉
                </p>
                <button
                  onClick={saveDraftToDatabase}
                  className="w-full bg-emerald-600 text-white font-bold py-3 rounded-xl shadow hover:bg-emerald-700 transition-all"
                >
                  드래프트 최종 확정하기
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {remainingAttendees.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => pickPlayer(item)}
                    className="p-3 bg-gray-50 hover:bg-emerald-50 border border-gray-200 hover:border-emerald-400 rounded-xl text-left font-semibold text-gray-700 transition-all flex items-center justify-between"
                  >
                    <span>{item.users?.name}</span>
                    <span className="text-xs text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">
                      + 픽
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* STEP 3: 드래프트 완료 화면 */}
      {draftStep === "DONE" && (
        <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
            ⚽
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">
            팀 편성이 완료되었습니다!
          </h2>

          <div className="space-y-4 text-left mb-6">
            {(["A", "B", "C"] as TeamKey[]).map((teamKey) => (
              <div key={teamKey} className="bg-gray-50 p-4 rounded-xl">
                <h4 className="font-bold text-sm text-emerald-700 mb-1">
                  {teamKey}팀 멤버
                </h4>
                <p className="text-sm text-gray-700">
                  {teams[teamKey].map((m) => m.users?.name).join(", ")}
                </p>
              </div>
            ))}
          </div>

          {/* 1. 단톡방 공유용 텍스트 복사 버튼 */}
          <button
            onClick={() => {
              let text = "⚽ [이번 주 화요일 풋살 팀 편성 결과] ⚽\n\n";
              (["A", "B", "C"] as TeamKey[]).forEach((key) => {
                const members = teams[key].map((m) => m.users?.name).join(", ");
                text += `🔹 ${key}팀: ${members}\n`;
              });
              navigator.clipboard.writeText(text);
              alert(
                "단톡방 공유용 텍스트가 복사되었습니다! 카톡에 붙여넣으세요 📋"
              );
            }}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-xl shadow transition-all text-sm mb-2.5 flex items-center justify-center gap-2"
          >
            📋 단톡방 공유용 텍스트 복사하기
          </button>

          {/* 2. 경기 결과 입력 페이지로 바로 가는 버튼 */}
          <button
            onClick={() => (window.location.href = "/result")}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl shadow transition-all text-sm mb-2.5"
          >
            🏆 경기 결과 입력하러 가기
          </button>

          {/* 3. 메인 홈으로 가기 버튼 */}
          <button
            onClick={() => (window.location.href = "/")}
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 rounded-xl transition-all text-sm"
          >
            🏠 메인 홈으로 가기
          </button>
        </div>
      )}
    </main>
  );
}
