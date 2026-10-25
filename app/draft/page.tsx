// "use client";
// import { useState, useEffect } from "react";
// import { createClient } from "@supabase/supabase-js";
// import { Users, CheckCircle2 } from "lucide-react";

// const supabase = createClient(
//   process.env.NEXT_PUBLIC_SUPABASE_URL!,
//   process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
// );

// interface User {
//   id: string;
//   name: string;
//   phone?: string;
// }

// interface Attendee {
//   id: string;
//   user_id: string;
//   users: User;
// }

// type TeamKey = "A" | "B" | "C";

// export default function DraftPage() {
//   const [attendees, setAttendees] = useState<Attendee[]>([]);
//   const [captains, setCaptains] = useState<Attendee[]>([]);
//   const [teams, setTeams] = useState<Record<TeamKey, Attendee[]>>({
//     A: [],
//     B: [],
//     C: [],
//   });
//   const [currentCaptainIdx, setCurrentCaptainIdx] = useState<number>(0);
//   const [draftStep, setDraftStep] = useState<
//     "SELECT_CAPTAINS" | "DRAFTING" | "DONE"
//   >("SELECT_CAPTAINS");

//   // 👈 픽 취소(Undo)를 위한 히스토리 상태 추가
//   const [pickHistory, setPickHistory] = useState<
//     { teamKey: TeamKey; attendee: Attendee; prevCaptainIdx: number }[]
//   >([]);

//   useEffect(() => {
//     fetchAttendees();
//   }, []);

//   const fetchAttendees = async () => {
//     const { data, error } = await supabase
//       .from("session_attendees")
//       .select(`id, user_id, users ( id, name, phone )`);

//     if (error) {
//       console.error("참가자 불러오기 실패:", error);
//     } else if (data) {
//       setAttendees(data as unknown as Attendee[]);
//     }
//   };

//   const toggleCaptainSelection = (attendee: Attendee) => {
//     if (captains.find((c) => c.user_id === attendee.user_id)) {
//       setCaptains(captains.filter((c) => c.user_id !== attendee.user_id));
//     } else {
//       if (captains.length >= 3) {
//         alert("주장은 총 3명만 지정할 수 있습니다!");
//         return;
//       }
//       setCaptains([...captains, attendee]);
//     }
//   };

//   const startDraft = () => {
//     if (captains.length !== 3) {
//       alert("주장 3명을 선택해주세요!");
//       return;
//     }
//     setTeams({
//       A: [captains[0]],
//       B: [captains[1]],
//       C: [captains[2]],
//     });
//     setDraftStep("DRAFTING");
//     setPickHistory([]); // 초기화
//   };

//   // 멤버 픽 (히스토리 기록 추가)
//   const pickPlayer = (attendee: Attendee) => {
//     const teamKeys: TeamKey[] = ["A", "B", "C"];
//     const activeTeamKey = teamKeys[currentCaptainIdx];

//     setPickHistory((prev) => [
//       ...prev,
//       { teamKey: activeTeamKey, attendee, prevCaptainIdx: currentCaptainIdx },
//     ]);

//     setTeams((prev) => ({
//       ...prev,
//       [activeTeamKey]: [...prev[activeTeamKey], attendee],
//     }));

//     if (currentCaptainIdx < 2) {
//       setCurrentCaptainIdx(currentCaptainIdx + 1);
//     } else {
//       setCurrentCaptainIdx(0);
//     }
//   };

//   // 👈 픽 취소(Undo) 함수
//   const undoLastPick = () => {
//     if (pickHistory.length === 0) return;

//     const lastPick = pickHistory[pickHistory.length - 1];
//     const { teamKey, attendee, prevCaptainIdx } = lastPick;

//     setTeams((prev) => ({
//       ...prev,
//       [teamKey]: prev[teamKey].filter((m) => m.user_id !== attendee.user_id),
//     }));

//     setCurrentCaptainIdx(prevCaptainIdx);
//     setPickHistory((prev) => prev.slice(0, -1));
//   };

//   const draftedUserIds = new Set(
//     Object.values(teams)
//       .flat()
//       .map((item) => item.user_id)
//   );
//   const remainingAttendees = attendees.filter(
//     (item) => !draftedUserIds.has(item.user_id)
//   );

//   const saveDraftToDatabase = async () => {
//     try {
//       const { data: sessionData } = await supabase
//         .from("sessions")
//         .select("id")
//         .order("created_at", { ascending: false })
//         .limit(1)
//         .single();

//       if (!sessionData) {
//         alert(
//           "진행 중인 경기 세션이 없습니다! 방장 화면에서 세션을 먼저 생성해주세요."
//         );
//         return;
//       }

//       const sessionId = sessionData.id;
//       const teamKeys: TeamKey[] = ["A", "B", "C"];
//       const teamIdMap: Record<string, string> = {};

//       for (const key of teamKeys) {
//         const { data: teamData, error: teamError } = await supabase
//           .from("teams")
//           .insert({ session_id: sessionId, team_name: `${key}팀` })
//           .select("id")
//           .single();

//         if (teamError) throw teamError;
//         teamIdMap[key] = teamData.id;
//       }

//       let globalPickOrder = 1;

//       for (const key of teamKeys) {
//         const teamMembers = teams[key];
//         for (let i = 0; i < teamMembers.length; i++) {
//           const member = teamMembers[i];
//           const isCaptain = i === 0;
//           const pickOrderValue = isCaptain ? 0 : globalPickOrder++;

//           const { error: memberError } = await supabase
//             .from("team_members")
//             .insert({
//               team_id: teamIdMap[key],
//               user_id: member.user_id,
//               pick_order: pickOrderValue,
//             });

//           if (memberError) throw memberError;
//         }
//       }

//       setDraftStep("DONE");
//     } catch (error) {
//       console.error("드래프트 저장 중 에러 발생:", error);
//       alert("저장 중 문제가 발생했습니다. 콘솔을 확인해주세요.");
//     }
//   };

//   return (
//     <main className="min-h-screen bg-gray-50 p-4 max-w-md mx-auto pb-24">
//       <div className="bg-emerald-600 text-white p-5 rounded-2xl shadow-md mb-6 text-center">
//         <h1 className="text-xl font-bold">⚡ 스마트 디지털 드래프트</h1>
//         <p className="text-emerald-100 text-xs mt-1">
//           가위바위보 대신 앱으로 1분 만에 팀 완성!
//         </p>
//       </div>

//       {draftStep === "SELECT_CAPTAINS" && (
//         <div className="bg-white rounded-2xl p-4 shadow-sm">
//           <h2 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
//             <Users size={18} className="text-emerald-600" />
//             오늘의 주장 3명을 선택해주세요 ({captains.length}/3)
//           </h2>
//           <p className="text-xs text-gray-400 mb-4">
//             참가자 중 에이스나 팀장을 3명 터치하세요.
//           </p>

//           <div className="space-y-2 mb-6">
//             {attendees.map((item) => {
//               const isSelected = captains.find(
//                 (c) => c.user_id === item.user_id
//               );
//               return (
//                 <div
//                   key={item.id}
//                   onClick={() => toggleCaptainSelection(item)}
//                   className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
//                     isSelected
//                       ? "bg-emerald-50 border-emerald-500 text-emerald-900 font-bold"
//                       : "bg-gray-50 border-gray-100 text-gray-700"
//                   }`}
//                 >
//                   <span>{item.users?.name}</span>
//                   {isSelected && (
//                     <CheckCircle2 size={18} className="text-emerald-600" />
//                   )}
//                 </div>
//               );
//             })}
//           </div>

//           <button
//             onClick={startDraft}
//             disabled={captains.length !== 3}
//             className={`w-full py-3.5 rounded-2xl font-bold shadow-md transition-all ${
//               captains.length === 3
//                 ? "bg-emerald-600 text-white hover:bg-emerald-700"
//                 : "bg-gray-200 text-gray-400 cursor-not-allowed"
//             }`}
//           >
//             주장 선정 완료 & 드래프트 시작하기 🚀
//           </button>
//         </div>
//       )}

//       {draftStep === "DRAFTING" && (
//         <div>
//           {/* 현재 픽 차례 안내 */}
//           <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl mb-4 text-center">
//             <span className="text-xs font-semibold text-amber-800 bg-amber-100 px-2.5 py-1 rounded-full">
//               현재 픽 차례
//             </span>
//             <h3 className="text-lg font-bold text-amber-900 mt-2">
//               주장 {["A팀", "B팀", "C팀"][currentCaptainIdx]} 님의 차례입니다!
//             </h3>
//             <p className="text-xs text-amber-700 mt-1">
//               아래 대기자 명단에서 팀원을 탭하세요.
//             </p>
//           </div>

//           <div className="grid grid-cols-3 gap-2 mb-6">
//             {(["A", "B", "C"] as TeamKey[]).map((teamKey, idx) => (
//               <div
//                 key={teamKey}
//                 className={`p-3 rounded-2xl border ${
//                   currentCaptainIdx === idx
//                     ? "bg-emerald-50 border-emerald-500 ring-2 ring-emerald-400"
//                     : "bg-white border-gray-200"
//                 }`}
//               >
//                 <h4 className="font-bold text-sm text-gray-800 mb-2 border-b pb-1">
//                   {teamKey}팀
//                 </h4>
//                 <div className="space-y-1 text-xs">
//                   {teams[teamKey].map((member, i) => (
//                     <div key={i} className="text-gray-700 font-medium">
//                       • {member.users?.name}{" "}
//                       {i === 0 && (
//                         <span className="text-[10px] bg-emerald-200 text-emerald-800 px-1 rounded">
//                           주장
//                         </span>
//                       )}
//                     </div>
//                   ))}
//                 </div>
//               </div>
//             ))}
//           </div>

//           {/* 남은 대기자 리스트 */}
//           <div className="bg-white rounded-2xl p-4 shadow-sm">
//             {/* 대기자 타이틀 + 픽 취소 버튼 배치 */}
//             <div className="flex items-center justify-between mb-3 border-b pb-2">
//               <h3 className="font-bold text-gray-800 text-sm">
//                 대기 중인 멤버
//               </h3>

//               {/* 👈 손가락 동선에 맞춘 픽 취소 버튼 */}
//               <button
//                 onClick={undoLastPick}
//                 disabled={pickHistory.length === 0}
//                 className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
//                   pickHistory.length > 0
//                     ? "bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 shadow-sm"
//                     : "bg-gray-100 text-gray-300 border border-gray-100 cursor-not-allowed"
//                 }`}
//               >
//                 ↩️ 마지막 픽 취소
//               </button>
//             </div>

//             {remainingAttendees.length === 0 ? (
//               <div className="text-center py-6">
//                 <p className="text-gray-500 font-medium mb-4">
//                   모든 팀원이 배정되었습니다! 🎉
//                 </p>
//                 <button
//                   onClick={saveDraftToDatabase}
//                   className="w-full bg-emerald-600 text-white font-bold py-3 rounded-xl shadow hover:bg-emerald-700 transition-all"
//                 >
//                   드래프트 최종 확정하기
//                 </button>
//               </div>
//             ) : (
//               <div className="grid grid-cols-2 gap-2">
//                 {remainingAttendees.map((item) => (
//                   <button
//                     key={item.id}
//                     onClick={() => pickPlayer(item)}
//                     className="p-3 bg-gray-50 hover:bg-emerald-50 border border-gray-200 hover:border-emerald-400 rounded-xl text-left font-semibold text-gray-700 transition-all flex items-center justify-between"
//                   >
//                     <span>{item.users?.name}</span>
//                     <span className="text-xs text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">
//                       + 픽
//                     </span>
//                   </button>
//                 ))}
//               </div>
//             )}
//           </div>
//         </div>
//       )}

//       {/* STEP 3: 드래프트 완료 화면 */}
//       {draftStep === "DONE" && (
//         <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
//           <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
//             ⚽
//           </div>
//           <h2 className="text-xl font-bold text-gray-800 mb-2">
//             팀 편성이 완료되었습니다!
//           </h2>

//           <div className="space-y-4 text-left mb-6">
//             {(["A", "B", "C"] as TeamKey[]).map((teamKey) => (
//               <div key={teamKey} className="bg-gray-50 p-4 rounded-xl">
//                 <h4 className="font-bold text-sm text-emerald-700 mb-1">
//                   {teamKey}팀 멤버
//                 </h4>
//                 <p className="text-sm text-gray-700">
//                   {teams[teamKey].map((m) => m.users?.name).join(", ")}
//                 </p>
//               </div>
//             ))}
//           </div>

//           {/* 1. 단톡방 공유용 텍스트 복사 버튼 */}
//           <button
//             onClick={() => {
//               let text = "⚽ [이번 주 화요일 풋살 팀 편성 결과] ⚽\n\n";
//               (["A", "B", "C"] as TeamKey[]).forEach((key) => {
//                 const members = teams[key].map((m) => m.users?.name).join(", ");
//                 text += `🔹 ${key}팀: ${members}\n`;
//               });
//               navigator.clipboard.writeText(text);
//               alert(
//                 "단톡방 공유용 텍스트가 복사되었습니다! 카톡에 붙여넣으세요 📋"
//               );
//             }}
//             className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-xl shadow transition-all text-sm mb-2.5 flex items-center justify-center gap-2"
//           >
//             📋 단톡방 공유용 텍스트 복사하기
//           </button>

//           {/* 2. 경기 결과 입력 페이지로 바로 가는 버튼 */}
//           <button
//             onClick={() => (window.location.href = "/result")}
//             className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl shadow transition-all text-sm mb-2.5"
//           >
//             🏆 경기 결과 입력하러 가기
//           </button>

//           {/* 3. 메인 홈으로 가기 버튼 */}
//           <button
//             onClick={() => (window.location.href = "/")}
//             className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 rounded-xl transition-all text-sm"
//           >
//             🏠 메인 홈으로 가기
//           </button>
//         </div>
//       )}
//     </main>
//   );
// }
"use client";
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Users,
  Shuffle,
  Copy,
  Check,
  ArrowLeft,
  Lock,
  RefreshCw,
  Crown,
} from "lucide-react";
import Link from "next/link";

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

interface Team {
  id: string;
  team_name: string;
  captain_id: string;
}

export default function DraftPage() {
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);

  const [draftState, setDraftState] = useState<
    "READY" | "DRAFTING" | "FINISHED"
  >("READY");

  // 수동으로 선택할 주장들의 user_id
  const [captainA, setCaptainA] = useState<string>("");
  const [captainB, setCaptainB] = useState<string>("");
  const [captainC, setCaptainC] = useState<string>("");

  const [isAdmin] = useState<boolean>(true);

  const [currentPickIndex, setCurrentPickIndex] = useState<number>(0);
  const [roundNumber, setRoundNumber] = useState<number>(1);
  const [picksLog, setPicksLog] = useState<
    { teamId: string; playerId: string; order: number }[]
  >([]);
  const [teamMembers, setTeamMembers] = useState<{
    [teamId: string]: Attendee[];
  }>({});

  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initDraftSession();
  }, []);

  const initDraftSession = async () => {
    setLoading(true);
    const { data: sessionData } = await supabase
      .from("sessions")
      .select("id, draft_status")
      .order("date", { ascending: false })
      .limit(1)
      .single();

    if (sessionData) {
      setCurrentSessionId(sessionData.id);

      const { data: attendeesData } = await supabase
        .from("session_attendees")
        .select(`id, user_id, users ( id, name )`)
        .eq("session_id", sessionData.id);

      const allAttendees = (attendeesData as unknown as Attendee[]) || [];

      const { data: teamsData } = await supabase
        .from("teams")
        .select("*")
        .eq("session_id", sessionData.id);

      if (teamsData && teamsData.length > 0) {
        setTeams(teamsData);

        const { data: membersData } = await supabase
          .from("team_members")
          .select("team_id, user_id")
          .in(
            "team_id",
            teamsData.map((t) => t.id)
          );

        const membersByTeam: { [key: string]: Attendee[] } = {};
        const pickedUserIds = new Set<string>();

        teamsData.forEach((team) => {
          const captain = allAttendees.find(
            (a) => a.user_id === team.captain_id
          );
          if (captain) {
            membersByTeam[team.id] = [captain];
            pickedUserIds.add(captain.user_id);
          } else {
            membersByTeam[team.id] = [];
          }
        });

        if (membersData) {
          membersData.forEach((m) => {
            const player = allAttendees.find((a) => a.user_id === m.user_id);
            if (
              player &&
              !membersByTeam[m.team_id]?.some(
                (p) => p.user_id === player.user_id
              )
            ) {
              membersByTeam[m.team_id].push(player);
              pickedUserIds.add(player.user_id);
            }
          });
        }

        setTeamMembers(membersByTeam);
        const remaining = allAttendees.filter(
          (a) => !pickedUserIds.has(a.user_id)
        );
        setAttendees(remaining);

        if (sessionData.draft_status === "FINISHED" || remaining.length === 0) {
          setDraftState("FINISHED");
        } else {
          setDraftState("DRAFTING");
        }
      } else {
        setAttendees(allAttendees);
        setDraftState("READY");
      }
    }
    setLoading(false);
  };

  // 수동으로 선택한 주장들로 드래프트 시작
  const handleStartDraftWithCaptains = async () => {
    if (!isAdmin) {
      alert("드래프트는 방장만 시작할 수 있습니다!");
      return;
    }

    if (!captainA || !captainB || !captainC) {
      alert("A팀, B팀, C팀 주장을 모두 선택해 주세요!");
      return;
    }

    if (
      captainA === captainB ||
      captainA === captainC ||
      captainB === captainC
    ) {
      alert("서로 다른 참가자를 각각 다른 팀의 주장에 지정해 주세요!");
      return;
    }

    if (!currentSessionId) return;

    await supabase.from("teams").delete().eq("session_id", currentSessionId);

    const newTeamsData = [
      { session_id: currentSessionId, team_name: "A팀", captain_id: captainA },
      { session_id: currentSessionId, team_name: "B팀", captain_id: captainB },
      { session_id: currentSessionId, team_name: "C팀", captain_id: captainC },
    ];

    const { data, error } = await supabase
      .from("teams")
      .insert(newTeamsData)
      .select();

    if (error) {
      alert("팀 생성 중 오류가 발생했습니다: " + error.message);
    } else if (data) {
      await supabase
        .from("sessions")
        .update({ draft_status: "DRAFTING" })
        .eq("id", currentSessionId);

      setTeams(data);
      const initialMembers: { [key: string]: Attendee[] } = {};
      const captainIds = new Set([captainA, captainB, captainC]);
      const remainingAttendees = attendees.filter(
        (a) => !captainIds.has(a.user_id)
      );

      data.forEach((team) => {
        const captainAttendee = attendees.find(
          (a) => a.user_id === team.captain_id
        );
        if (captainAttendee) {
          initialMembers[team.id] = [captainAttendee];
        }
      });

      setTeamMembers(initialMembers);
      setAttendees(remainingAttendees);
      setDraftState("DRAFTING");
      setCurrentPickIndex(0);
      setRoundNumber(1);
      setPicksLog([]);
    }
  };

  const getSnakeOrder = (round: number, totalTeams: number) => {
    const indices = Array.from({ length: totalTeams }, (_, i) => i);
    return round % 2 === 1 ? indices : indices.reverse();
  };

  const snakeIndices =
    teams.length > 0 ? getSnakeOrder(roundNumber, teams.length) : [];
  const currentTeamIndex = snakeIndices[currentPickIndex];
  const currentTurnTeam = teams[currentTeamIndex];

  const handlePickPlayer = async (player: Attendee) => {
    if (!isAdmin) {
      alert("지명 권한은 방장에게 있습니다!");
      return;
    }

    if (!currentTurnTeam) return;

    const newOrder = picksLog.length + 1;

    await supabase.from("team_members").insert({
      team_id: currentTurnTeam.id,
      user_id: player.user_id,
      pick_order: newOrder,
    });

    setTeamMembers((prev) => ({
      ...prev,
      [currentTurnTeam.id]: [...(prev[currentTurnTeam.id] || []), player],
    }));

    const updatedAttendees = attendees.filter((a) => a.id !== player.id);
    setAttendees(updatedAttendees);
    setPicksLog((prev) => [
      ...prev,
      { teamId: currentTurnTeam.id, playerId: player.user_id, order: newOrder },
    ]);

    if (currentPickIndex + 1 < teams.length) {
      setCurrentPickIndex((prev) => prev + 1);
    } else {
      setCurrentPickIndex(0);
      setRoundNumber((prev) => prev + 1);
    }

    if (updatedAttendees.length === 0) {
      setDraftState("FINISHED");
      if (currentSessionId) {
        await supabase
          .from("sessions")
          .update({ draft_status: "FINISHED" })
          .eq("id", currentSessionId);
      }
    }
  };

  const handleResetDraft = async () => {
    if (!confirm("정말 이번 세션 드래프트를 처음부터 다시 시작하시겠습니까?"))
      return;
    if (currentSessionId) {
      await supabase.from("teams").delete().eq("session_id", currentSessionId);
      await supabase
        .from("sessions")
        .update({ draft_status: "NOT_STARTED" })
        .eq("id", currentSessionId);
      initDraftSession();
    }
  };

  const handleCopyResult = () => {
    let text = "⚽ [화요일 풋살 팀 드래프트 결과] ⚽\n\n";
    teams.forEach((team) => {
      text += `📌 ${team.team_name}\n`;
      teamMembers[team.id]?.forEach((m) => {
        text += `  - ${m.users.name}\n`;
      });
      text += "\n";
    });

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        불러오는 중...
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
        <h1 className="text-lg font-bold text-gray-800">디지털 드래프트 ⚡</h1>
        <div className="w-16"></div>
      </div>

      {/* 1. 드래프트 준비 및 수동 주장 지정 화면 */}
      {draftState === "READY" && (
        <div className="bg-white rounded-2xl p-6 shadow-sm space-y-4">
          <div className="text-center">
            <Users size={40} className="mx-auto text-emerald-600 mb-2" />
            <h2 className="text-xl font-bold text-gray-800 mb-1">
              스네이크 드래프트 준비
            </h2>
            <p className="text-gray-500 text-xs">
              현재 참가 신청 인원:{" "}
              <span className="font-bold text-emerald-600">
                {attendees?.length || 0}명
              </span>
            </p>
          </div>

          {isAdmin ? (
            <div className="space-y-3 pt-2">
              <p className="text-xs font-bold text-gray-700 flex items-center gap-1">
                <Crown size={14} className="text-amber-500" /> 주장을 직접
                선택해주세요
              </p>

              {/* A팀 주장 선택 */}
              <div>
                <label className="text-xs text-gray-500 font-semibold block mb-1">
                  A팀 주장
                </label>
                <select
                  value={captainA}
                  onChange={(e) => setCaptainA(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs font-bold text-gray-800 focus:outline-none focus:border-emerald-500"
                >
                  <option value="">-- A팀 주장 선택 --</option>
                  {attendees?.map((a) => (
                    <option key={a.user_id} value={a.user_id}>
                      {a.users.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* B팀 주장 선택 */}
              <div>
                <label className="text-xs text-gray-500 font-semibold block mb-1">
                  B팀 주장
                </label>
                <select
                  value={captainB}
                  onChange={(e) => setCaptainB(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs font-bold text-gray-800 focus:outline-none focus:border-emerald-500"
                >
                  <option value="">-- B팀 주장 선택 --</option>
                  {attendees?.map((a) => (
                    <option key={a.user_id} value={a.user_id}>
                      {a.users.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* C팀 주장 선택 */}
              <div>
                <label className="text-xs text-gray-500 font-semibold block mb-1">
                  C팀 주장
                </label>
                <select
                  value={captainC}
                  onChange={(e) => setCaptainC(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs font-bold text-gray-800 focus:outline-none focus:border-emerald-500"
                >
                  <option value="">-- C팀 주장 선택 --</option>
                  {attendees?.map((a) => (
                    <option key={a.user_id} value={a.user_id}>
                      {a.users.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleStartDraftWithCaptains}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl shadow-md transition-all mt-4 flex items-center justify-center gap-2 text-sm"
              >
                주장 확정하고 드래프트 시작하기 🚀
              </button>
            </div>
          ) : (
            <div className="bg-gray-100 text-gray-500 p-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1">
              <Lock size={14} /> 드래프트 진행은 방장만 가능합니다.
            </div>
          )}
        </div>
      )}

      {/* 2. 지명 진행 중 (DRAFTING) 또는 완료 (FINISHED) */}
      {(draftState === "DRAFTING" || draftState === "FINISHED") && (
        <div className="space-y-6">
          {draftState === "DRAFTING" && currentTurnTeam && (
            <div className="bg-emerald-600 text-white p-4 rounded-2xl shadow-md text-center animate-pulse">
              <span className="text-xs bg-emerald-500 px-2.5 py-1 rounded-full font-semibold">
                라운드 {roundNumber} (스네이크 🐍)
              </span>
              <h2 className="text-2xl font-black mt-2">
                🔥 {currentTurnTeam.team_name} 지명 차례!
              </h2>
            </div>
          )}

          {draftState === "FINISHED" && (
            <div className="bg-amber-500 text-white p-6 rounded-2xl shadow-md text-center space-y-3">
              <h2 className="text-xl font-bold">🎉 이번 세션 드래프트 완료!</h2>
              <button
                onClick={handleCopyResult}
                className="w-full bg-white text-amber-950 font-bold px-4 py-3 rounded-xl text-sm flex items-center justify-center gap-2 shadow mx-auto"
              >
                {copied ? (
                  <Check size={16} className="text-emerald-600" />
                ) : (
                  <Copy size={16} />
                )}
                {copied ? "클립보드 복사 완료!" : "단톡방 공유 텍스트 복사 📋"}
              </button>

              <Link
                href="/result"
                className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-4 py-3 rounded-xl text-sm flex items-center justify-center gap-2 shadow transition-all block"
              >
                경기 결과 기록하러 가기 ➔
              </Link>

              {isAdmin && (
                <button
                  onClick={handleResetDraft}
                  className="text-xs text-amber-100 underline hover:text-white pt-2 flex items-center justify-center gap-1 mx-auto"
                >
                  <RefreshCw size={12} /> 방장이 주장부터 다시 뽑기 (재시작)
                </button>
              )}
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            {teams.map((team) => {
              const isMyTurn =
                draftState === "DRAFTING" && currentTurnTeam?.id === team.id;
              return (
                <div
                  key={team.id}
                  className={`bg-white rounded-2xl p-3 shadow-sm border-2 transition-all ${
                    isMyTurn
                      ? "border-emerald-500 shadow-md ring-2 ring-emerald-200"
                      : "border-gray-100"
                  }`}
                >
                  <div className="font-bold text-gray-800 text-sm border-b pb-1 mb-2 flex justify-between items-center">
                    <span>{team.team_name}</span>
                    {isMyTurn && (
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                    )}
                  </div>
                  <div className="space-y-1 min-h-[100px]">
                    {teamMembers[team.id]?.map((m, mIdx) => (
                      <div
                        key={m.id}
                        className="text-xs bg-gray-50 px-2 py-1 rounded text-gray-700 font-medium truncate"
                      >
                        {mIdx === 0 ? `👑 ${m.users.name}` : m.users.name}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {draftState === "DRAFTING" && (
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <h3 className="font-bold text-gray-800 text-sm mb-3 flex items-center justify-between">
                <span>남은 선수 명단 ({attendees?.length || 0}명)</span>
                <span className="text-xs text-emerald-600 font-semibold">
                  선수를 눌러 영입하세요 👇
                </span>
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {attendees?.map((player) => (
                  <button
                    key={player.id}
                    onClick={() => handlePickPlayer(player)}
                    className="bg-gray-50 hover:bg-emerald-50 hover:border-emerald-300 border border-gray-200 p-2.5 rounded-xl text-left font-semibold text-gray-700 text-xs transition-all flex items-center justify-between group"
                  >
                    <span>{player.users.name}</span>
                    <span className="text-emerald-600 opacity-0 group-hover:opacity-100 font-bold">
                      지명 ➔
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
