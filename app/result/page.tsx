"use client";
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { Trophy, Award, CheckCircle } from "lucide-react";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface User {
  id: string;
  name: string;
}

interface Attendee {
  id: string;
  user_id: string;
  users: User;
}

interface TeamData {
  wins: number;
  draws: number;
  losses: number;
  points: number;
}

interface Match {
  id: number;
  team1: string;
  team2: string;
  winner: string;
}

// 팀 내 픽 순서 보정이 반영된 Hidden Elo 계산 함수
function calculateInternalRatingChange(
  teamRank: number, // 팀 순위 (1, 2, 3)
  pickOrder: number, // 팀 내 지명 순서 (1 = 1순위 에이스, 4 = 막픽 등)
  totalTeamSize: number // 해당 팀의 총 인원수
): number {
  let baseDelta = 0;
  if (teamRank === 1) baseDelta = 15;
  else if (teamRank === 2) baseDelta = 0;
  else if (teamRank === 3) baseDelta = -15;

  const reverseIndex = totalTeamSize - pickOrder; // 후순위일수록 큰 값

  if (teamRank === 1) {
    // 🏆 1등 팀: 후순위(막픽)가 팀을 캐리했을 때의 대이변 보너스
    const underdogCarryBonus = reverseIndex * 3.5;
    return Math.round(baseDelta + underdogCarryBonus);
  }

  if (teamRank === 3) {
    // 💀 3등 팀: 1순위(에이스)에게 책임 감점을, 막픽에게 방어권 부여
    const acePenalty = pickOrder === 1 ? -10 : 0;
    const underdogDefense = reverseIndex * 2;
    return Math.round(baseDelta + acePenalty + underdogDefense);
  }

  // 🥈 2등 팀 (중위권)
  return Math.round(baseDelta + (reverseIndex - totalTeamSize / 2) * 2);
}

export default function ResultPage() {
  const [attendees, setAttendees] = useState<Attendee[]>([]);

  // 기본 대진 설정
  const [matches, setMatches] = useState<Match[]>([
    { id: 1, team1: "A팀", team2: "B팀", winner: "" },
    { id: 2, team1: "A팀", team2: "C팀", winner: "" }, // 1경기 승자로 자동 업데이트
    { id: 3, team1: "B팀", team2: "C팀", winner: "" },
  ]);

  const [laundryPerson, setLaundryPerson] = useState<string>("");
  const [saved, setSaved] = useState<boolean>(false);

  useEffect(() => {
    fetchAttendees();
  }, []);

  const fetchAttendees = async () => {
    const { data } = await supabase
      .from("session_attendees")
      .select(`id, user_id, users ( id, name )`);
    if (data) setAttendees(data as unknown as Attendee[]);
  };

  // 1경기 승자에 따라 2경기 대진을 바꾸고, 3경기 이후 대진을 체력 안배 룰로 조정
  const handleMatchWinner = (id: number, winner: string) => {
    const newMatches = [...matches];
    newMatches[id - 1].winner = winner;

    // 1경기의 승패가 결정되었을 때 2경기 대진 자동 업데이트
    if (id === 1 && winner) {
      const firstWinner = winner === "무승부" ? "A팀" : winner;
      const firstLoser = firstWinner === "A팀" ? "B팀" : "A팀";

      // 2경기: 1경기 승자 vs C팀
      newMatches[1] = { ...newMatches[1], team1: firstWinner, team2: "C팀" };
      // 3경기: 1경기 패자 vs C팀
      newMatches[2] = { ...newMatches[2], team1: firstLoser, team2: "C팀" };
    }

    setMatches(newMatches);
  };

  // ➕ 다음 경기 추가하기 (연속 2경기 뛴 팀 쉬게 하고 로테이션)
  const addMatch = () => {
    const allTeams = ["A팀", "B팀", "C팀"];
    const lastMatch = matches[matches.length - 1]; // 바로 전 경기 (예: 3경기)
    const prevMatch = matches[matches.length - 2]; // 전전 경기 (예: 2경기)

    // 바로 전 경기에 들어간 두 팀
    const currentPlayingTeams = [lastMatch.team1, lastMatch.team2];

    // 이전 경기에서 쉬고 있었던 팀 찾기
    const restingTeam = allTeams.find((t) => !currentPlayingTeams.includes(t))!;

    // 연속 2경기를 뛰어서 이번에 쉬어야 할 팀 찾기
    // (전전 경기와 전 경기에 모두 참여한 팀이 연속 2경기 뛴 팀임)
    const prevPlayingTeams = [prevMatch.team1, prevMatch.team2];
    const continuousTeam = currentPlayingTeams.find((t) =>
      prevPlayingTeams.includes(t)
    )!;

    // 다음 경기에 뛸 팀 = (전 경기 뛰었던 팀 중 연속 2경기가 아닌 팀) vs (쉬고 있던 팀)
    const stayTeam = currentPlayingTeams.find((t) => t !== continuousTeam)!;

    setMatches([
      ...matches,
      {
        id: matches.length + 1,
        team1: stayTeam,
        team2: restingTeam,
        winner: "",
      },
    ]);
  };

  // 승점 계산 로직 (승리 3점, 무승부 1점)
  const teamRecords: Record<string, TeamData> = {
    A팀: { wins: 0, draws: 0, losses: 0, points: 0 },
    B팀: { wins: 0, draws: 0, losses: 0, points: 0 },
    C팀: { wins: 0, draws: 0, losses: 0, points: 0 },
  };

  matches.forEach((m) => {
    if (!m.winner) return;
    if (m.winner === "무승부") {
      teamRecords[m.team1].draws++;
      teamRecords[m.team1].points += 1;
      teamRecords[m.team2].draws++;
      teamRecords[m.team2].points += 1;
    } else {
      const loser = m.team1 === m.winner ? m.team2 : m.team1;
      teamRecords[m.winner].wins++;
      teamRecords[m.winner].points += 3;
      teamRecords[loser].losses++;
    }
  });

  const sortedTeams = Object.entries(teamRecords).sort(
    (a, b) => b[1].points - a[1].points
  );

  const saveLaundryDuty = async () => {
    if (!laundryPerson) {
      alert("오늘의 빨래 당번을 선택해주세요!");
      return;
    }

    try {
      const { data: sessionData } = await supabase
        .from("sessions")
        .select("id")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (!sessionData) {
        alert("진행 중인 경기 세션이 없습니다!");
        return;
      }

      const sessionId = sessionData.id;
      console.log("📌 현재 세션 ID:", sessionId);

      // 1. 빨래 당번 유저 찾기
      const selectedUser = attendees.find(
        (a) => a.users?.name === laundryPerson
      );
      console.log("📌 선택된 빨래 당번 유저:", selectedUser);

      if (selectedUser) {
        await supabase
          .from("sessions")
          .update({ laundry_person_id: selectedUser.user_id })
          .eq("id", sessionId);
      }

      // 2. 팀 정보 가져오기
      const { data: teamData } = await supabase
        .from("teams")
        .select("id, team_name")
        .eq("session_id", sessionId);

      console.log("📌 DB에서 가져온 팀 목록:", teamData);

      if (teamData && teamData.length > 0) {
        const teamMap: Record<string, string> = {};
        teamData.forEach((t) => {
          teamMap[t.team_name] = t.id;
        });

        // 3. 매치 결과 저장
        for (let i = 0; i < matches.length; i++) {
          const m = matches[i];
          if (!m.winner) continue;

          let winnerTeamId = null;
          if (m.winner !== "무승부") {
            winnerTeamId = teamMap[m.winner] || null;
          }

          await supabase.from("matches").insert({
            session_id: sessionId,
            team1_id: teamMap[m.team1],
            team2_id: teamMap[m.team2],
            winner_team_id: winnerTeamId,
            match_order: m.id,
          });
        }

        // 4. 팀별 최종 순위(rankMap) 생성 및 teams 테이블 rank 저장
        const rankMap: Record<string, number> = {};
        sortedTeams.forEach(([teamName], idx) => {
          rankMap[teamName] = idx + 1; // 1등, 2등, 3등
        });

        console.log("📌 계산된 순위 맵(rankMap):", rankMap);

        for (const [teamName, rank] of Object.entries(rankMap)) {
          const teamId = teamMap[teamName];
          if (teamId) {
            const { error: rankError } = await supabase
              .from("teams")
              .update({ rank })
              .eq("id", teamId);
            if (rankError)
              console.error(`팀 ${teamName} rank 업데이트 에러:`, rankError);
          }
        }

        // 5. 각 팀 멤버들의 픽 순서 보정 레이팅 및 빨래 횟수 자동 업데이트
        for (const t of teamData) {
          const teamRank = rankMap[t.team_name] || 2;

          const { data: teamMembers, error: memberError } = await supabase
            .from("team_members")
            .select("user_id, pick_order")
            .eq("team_id", t.id)
            .order("pick_order", { ascending: true });

          console.log(
            `📌 팀 [${t.team_name}]의 멤버 조회 결과:`,
            teamMembers,
            "에러:",
            memberError
          );

          if (!teamMembers || teamMembers.length === 0) continue;
          const totalTeamSize = teamMembers.length;

          for (const member of teamMembers) {
            if (!member.user_id) {
              console.warn("⚠️ member.user_id가 존재하지 않습니다!", member);
              continue;
            }

            const ratingChange = calculateInternalRatingChange(
              teamRank,
              member.pick_order,
              totalTeamSize
            );

            const { data: userData, error: userFetchError } = await supabase
              .from("users")
              .select("rating, total_games, total_wins, laundry_count")
              .eq("id", member.user_id)
              .single();

            console.log(
              `📌 유저 ID(${member.user_id}) 조회 결과:`,
              userData,
              "에러:",
              userFetchError
            );

            if (userData) {
              const newRating = Math.max(
                1000,
                (userData.rating || 1500) + ratingChange
              );
              const isWin = teamRank === 1 ? 1 : 0;
              const isLaundry =
                selectedUser && selectedUser.user_id === member.user_id ? 1 : 0;

              const { error: userUpdateError } = await supabase
                .from("users")
                .update({
                  rating: newRating,
                  total_games: (userData.total_games || 0) + 1,
                  total_wins: (userData.total_wins || 0) + isWin,
                  laundry_count: (userData.laundry_count || 0) + isLaundry,
                })
                .eq("id", member.user_id);

              console.log(
                `📌 유저 ID(${member.user_id}) 업데이트 에러 여부:`,
                userUpdateError
              );
            }
          }
        }
      }

      setSaved(true);
      alert(
        `오늘의 경기 결과와 빨래 당번 [${laundryPerson}] 님이 DB에 완벽히 저장되었으며, 콘솔창에 디버깅 로그가 출력되었습니다!`
      );
    } catch (error) {
      console.error("결과 저장 중 에러 발생:", error);
      alert("저장 중 오류가 발생했습니다. 콘솔을 확인해주세요.");
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 p-4 max-w-md mx-auto pb-24">
      <div className="bg-emerald-600 text-white p-5 rounded-2xl shadow-md mb-6 text-center">
        <h1 className="text-xl font-bold">🏆 경기 결과 & 빨래 당번 기록</h1>
        <p className="text-emerald-100 text-xs mt-1">
          승패를 기록하고 오늘의 빨래 당번을 박제하세요!
        </p>
      </div>
      {/* 경기 결과 입력 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm mb-6">
        <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2 text-sm">
          <Trophy size={18} className="text-emerald-600" />
          라운드별 경기 결과 입력
        </h2>
        <div className="space-y-3 mb-3">
          {matches.map((m, index) => (
            <div
              key={m.id}
              className="bg-gray-50 p-3 rounded-xl border border-gray-100"
            >
              <div className="text-xs font-semibold text-gray-500 mb-2">
                {index + 1}경기: {m.team1} vs {m.team2}
                {index === 1 && (
                  <span className="ml-2 text-[10px] text-emerald-600 font-normal">
                    (1경기 승자 진출)
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-1">
                <button
                  onClick={() => handleMatchWinner(m.id, m.team1)}
                  className={`py-2 text-xs font-bold rounded-lg transition-all ${
                    m.winner === m.team1
                      ? "bg-emerald-600 text-white shadow"
                      : "bg-white border text-gray-700"
                  }`}
                >
                  {m.team1} 승
                </button>
                <button
                  onClick={() => handleMatchWinner(m.id, "무승부")}
                  className={`py-2 text-xs font-bold rounded-lg transition-all ${
                    m.winner === "무승부"
                      ? "bg-amber-500 text-white shadow"
                      : "bg-white border text-gray-700"
                  }`}
                >
                  무승부
                </button>
                <button
                  onClick={() => handleMatchWinner(m.id, m.team2)}
                  className={`py-2 text-xs font-bold rounded-lg transition-all ${
                    m.winner === m.team2
                      ? "bg-emerald-600 text-white shadow"
                      : "bg-white border text-gray-700"
                  }`}
                >
                  {m.team2} 승
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* 경기 추가 버튼 */}
        <button
          onClick={addMatch}
          className="w-full py-3 bg-gray-50 hover:bg-emerald-50 text-emerald-700 font-bold rounded-xl text-xs transition-all border border-dashed border-emerald-300 flex items-center justify-center gap-1 shadow-sm"
        >
          ➕ 다음 경기 추가하기 (연속 2경기 후 교대)
        </button>
      </div>
      {/* 실시간 순위표 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm mb-6">
        <h2 className="font-bold text-gray-800 mb-3 text-sm">
          실시간 팀 순위 & 승점
        </h2>
        <div className="space-y-2">
          {sortedTeams.map(([teamName, data], idx) => (
            <div
              key={teamName}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-xl text-xs font-semibold"
            >
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 bg-emerald-100 text-emerald-800 rounded-full flex items-center justify-center font-bold">
                  {idx + 1}
                </span>
                <span className="text-gray-800">{teamName}</span>
              </div>
              <div className="text-gray-600">
                {data.wins}승 {data.draws}무 {data.losses}패 (
                <span className="text-emerald-600 font-bold">
                  {data.points}점
                </span>
                )
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* 빨래 당번 지정 & 결과 공유 카드 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <h2 className="font-bold text-gray-800 mb-2 flex items-center gap-2 text-sm">
          <Award size={18} className="text-emerald-600" />
          오늘의 빨래 당번 (골대 맞추기 꼴찌)
        </h2>
        <p className="text-xs text-gray-400 mb-4">
          당번이 된 멤버를 선택하고 기록을 저장하세요!
        </p>

        {!saved ? (
          <>
            <select
              value={laundryPerson}
              onChange={(e) => setLaundryPerson(e.target.value)}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700 font-medium mb-4 focus:outline-none focus:border-emerald-500"
            >
              <option value="">-- 빨래 당번 선택하기 --</option>
              {attendees.map((item) => (
                <option key={item.id} value={item.users?.name}>
                  {item.users?.name}
                </option>
              ))}
            </select>

            <button
              onClick={saveLaundryDuty}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-2xl text-sm shadow-md transition-all flex items-center justify-center gap-2"
            >
              <CheckCircle size={16} />
              경기 결과 & 빨래 당번 최종 저장 🧺
            </button>
          </>
        ) : (
          /* 저장이 완료된 후 등장하는 완벽한 마무리 버튼들! */
          <div className="space-y-2.5">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center mb-3">
              <span className="text-xs text-emerald-800 font-bold">
                🎉 모든 결과가 데이터베이스에 성공적으로 저장되었습니다!
              </span>
            </div>

            {/* 1. 단톡방 공유용 최종 요약 복사 버튼 */}
            <button
              onClick={() => {
                let text = `⚽ [오늘의 풋살 경기 최종 요약] ⚽\n\n`;
                text += `🏆 [팀별 최종 성적]\n`;
                sortedTeams.forEach(([teamName, data], idx) => {
                  text += `${idx + 1}위 ${teamName}: ${data.wins}승 ${
                    data.draws
                  }무 ${data.losses}패 (승점 ${data.points}점)\n`;
                });

                text += `\n👕 [오늘의 빨래 당번]\n`;
                text += `👉 ${laundryPerson} 님 (축하합니다! 🎉)\n\n`;

                text += `모두 수고하셨습니다! 다음 주 화요일에 뵙겠습니다 ⚽`;

                navigator.clipboard.writeText(text);
                alert(
                  "단톡방 공유용 최종 요약 텍스트가 복사되었습니다! 카톡에 붙여넣으세요 📋"
                );
              }}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-xl shadow transition-all text-sm flex items-center justify-center gap-2"
            >
              📋 단톡방 최종 결과 공유하기 (텍스트 복사)
            </button>

            {/* 2. 메인 홈으로 가기 버튼 */}
            <button
              onClick={() => (window.location.href = "/")}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 rounded-xl transition-all text-sm"
            >
              🏠 메인 홈으로 돌아가기
            </button>
          </div>
        )}
      </div>{" "}
    </main>
  );
}
