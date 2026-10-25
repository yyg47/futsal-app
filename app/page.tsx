// "use client";
// import { useState, useEffect } from "react";
// import { createClient } from "@supabase/supabase-js";
// import {
//   Users,
//   Shuffle,
//   Copy,
//   Check,
//   ArrowLeft,
//   RefreshCw,
// } from "lucide-react";
// import Link from "next/link";

// const supabase = createClient(
//   process.env.NEXT_PUBLIC_SUPABASE_URL!,
//   process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
// );

// interface User {
//   id: string;
//   name: string;
// }

// interface Attendee {
//   id: string;
//   user_id: string;
//   users: User;
// }

// interface Team {
//   id: string;
//   team_name: string;
//   captain_id: string;
// }

// export default function DraftPage() {
//   const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
//   const [attendees, setAttendees] = useState<Attendee[]>(); // 대기 중인 선수들
//   const [teams, setTeams] = useState<Team[]>([]); // 생성된 팀들 (주장 목록)
//   const [draftState, setDraftState] = useState<
//     "READY" | "DRAFTING" | "FINISHED"
//   >("READY");

//   // 스네이크 드래프트 관리를 위한 상태
//   const [currentPickIndex, setCurrentPickIndex] = useState<number>(0);
//   const [roundNumber, setRoundNumber] = useState<number>(1);
//   const [picksLog, setPicksLog] = useState<
//     { teamId: string; playerId: string; order: number }[]
//   >([]);
//   const [teamMembers, setTeamMembers] = useState<{
//     [teamId: string]: Attendee[];
//   }>({});

//   const [copied, setCopied] = useState(false);
//   const [loading, setLoading] = useState(true);

//   useEffect(() => {
//     initDraftSession();
//   }, []);

//   // 1. 가장 최근 세션과 참가자 목록 가져오기
//   const initDraftSession = async () => {
//     setLoading(true);
//     const { data: sessionData } = await supabase
//       .from("sessions")
//       .select("id")
//       .order("date", { ascending: false })
//       .limit(1)
//       .single();

//     if (sessionData) {
//       setCurrentSessionId(sessionData.id);

//       // 참가 신청자 목록 불러오기
//       const { data: attendeesData } = await supabase
//         .from("session_attendees")
//         .select(`id, user_id, users ( id, name )`)
//         .eq("session_id", sessionData.id);

//       setAttendees((attendeesData as unknown as Attendee[]) || []);

//       // 이미 생성된 팀(주장들)이 있는지 확인
//       const { data: teamsData } = await supabase
//         .from("teams")
//         .select("*")
//         .eq("session_id", sessionData.id);

//       if (teamsData && teamsData.length > 0) {
//         setTeams(teamsData);
//       }
//     }
//     setLoading(false);
//   };

//   // 2. 임의로 주장 3명을 골라 팀(A, B, C팀) 자동 생성하기 (참가자 중 랜덤 3명)
//   const handleAutoSetupTeams = async () => {
//     if (!currentSessionId || !attendees || attendees.length < 3) {
//       alert("참가자가 최소 3명 이상이어야 팀을 구성할 수 있습니다!");
//       return;
//     }

//     // 기존 팀 삭제 후 재생성
//     await supabase.from("teams").delete().eq("session_id", currentSessionId);

//     // 랜덤으로 3명 뽑아서 주장으로 임명
//     const shuffled = [...attendees].sort(() => 0.5 - Math.random());
//     const selectedCaptains = shuffled.slice(0, 3); // 3팀 기준

//     const newTeamsData = [
//       {
//         session_id: currentSessionId,
//         team_name: "A팀",
//         captain_id: selectedCaptains[0].user_id,
//       },
//       {
//         session_id: currentSessionId,
//         team_name: "B팀",
//         captain_id: selectedCaptains[1].user_id,
//       },
//       {
//         session_id: currentSessionId,
//         team_name: "C팀",
//         captain_id: selectedCaptains[2].user_id,
//       },
//     ];

//     const { data, error } = await supabase
//       .from("teams")
//       .insert(newTeamsData)
//       .select();

//     if (error) {
//       alert("팀 생성 중 오류가 발생했습니다.");
//       console.error(error);
//     } else if (data) {
//       setTeams(data);
//       // 주장은 대기 명단에서 제외하고 각 팀의 첫 번째 멤버로 자동 편입
//       const initialMembers: { [key: string]: Attendee[] } = {};
//       const remainingAttendees = [...attendees];

//       data.forEach((team, idx) => {
//         const captainAttendee = remainingAttendees.find(
//           (a) => a.user_id === team.captain_id
//         );
//         if (captainAttendee) {
//           initialMembers[team.id] = [captainAttendee];
//           // 대기 명단에서 제거
//           const targetIdx = remainingAttendees.findIndex(
//             (a) => a.user_id === team.captain_id
//           );
//           if (targetIdx > -1) remainingAttendees.splice(targetIdx, 1);
//         }
//       });

//       setTeamMembers(initialMembers);
//       setAttendees(remainingAttendees);
//       setDraftState("DRAFTING");
//       setCurrentPickIndex(0);
//       setRoundNumber(1);
//       setPicksLog([]);
//     }
//   };

//   // 💡 3. 스네이크 순서 계산 함수 (홀수 라운드: 0->1->2, 짝수 라운드: 2->1->0)
//   const getSnakeOrder = (round: number, totalTeams: number) => {
//     const indices = Array.from({ length: totalTeams }, (_, i) => i);
//     return round % 2 === 1 ? indices : indices.reverse();
//   };

//   // 현재 차례인 팀 객체 구하기
//   const snakeIndices =
//     teams.length > 0 ? getSnakeOrder(roundNumber, teams.length) : [];
//   const currentTeamIndex = snakeIndices[currentPickIndex];
//   const currentTurnTeam = teams[currentTeamIndex];

//   // 4. 선수 지명 처리 (스네이크 로직 반영)
//   const handlePickPlayer = async (player: Attendee) => {
//     if (!currentTurnTeam) return;

//     const newOrder = picksLog.length + 1;

//     // DB의 team_members에 기록
//     await supabase.from("team_members").insert({
//       team_id: currentTurnTeam.id,
//       user_id: player.user_id,
//       pick_order: newOrder,
//     });

//     // 로컬 상태 업데이트
//     setTeamMembers((prev) => ({
//       ...prev,
//       [currentTurnTeam.id]: [...(prev[currentTurnTeam.id] || []), player],
//     }));

//     setAttendees((prev) => prev?.filter((a) => a.id !== player.id));
//     setPicksLog((prev) => [
//       ...prev,
//       { teamId: currentTurnTeam.id, playerId: player.user_id, order: newOrder },
//     ]);

//     // 다음 차례 계산
//     if (currentPickIndex + 1 < teams.length) {
//       setCurrentPickIndex((prev) => prev + 1);
//     } else {
//       // 라운드 종료 ➔ 다음 라운드로 전환 및 스네이크 방향 반전
//       setCurrentPickIndex(0);
//       setRoundNumber((prev) => prev + 1);
//     }

//     // 대기 선수가 더 이상 없으면 드래프트 종료
//     if (attendees && attendees.length <= 1) {
//       setDraftState("FINISHED");
//     }
//   };

//   // 5. 단톡방 공유 텍스트 복사하기
//   const handleCopyResult = () => {
//     let text = "⚽ [화요일 풋살 팀 드래프트 결과] ⚽\n\n";
//     teams.forEach((team) => {
//       text += `📌 ${team.team_name}\n`;
//       teamMembers[team.id]?.forEach((m, idx) => {
//         text += `  - ${m.users.name}\n`;
//       });
//       text += "\n";
//     });

//     navigator.clipboard.writeText(text);
//     setCopied(true);
//     setTimeout(() => setCopied(false), 2000);
//   };

//   if (loading) {
//     return (
//       <div className="min-h-screen flex items-center justify-center text-gray-500">
//         불러오는 중...
//       </div>
//     );
//   }

//   return (
//     <main className="min-h-screen bg-gray-50 p-4 max-w-md mx-auto pb-28">
//       {/* 상단 네비게이션 */}
//       <div className="flex items-center justify-between mb-6">
//         <Link
//           href="/"
//           className="bg-white border border-gray-200 p-2 rounded-xl text-gray-600 hover:bg-gray-100 flex items-center gap-1 text-xs font-bold"
//         >
//           <ArrowLeft size={16} /> 홈으로
//         </Link>
//         <h1 className="text-lg font-bold text-gray-800">디지털 드래프트 ⚡</h1>
//         <div className="w-16"></div>
//       </div>

//       {/* 상태별 화면 분기 */}
//       {draftState === "READY" && (
//         <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
//           <Users size={48} className="mx-auto text-emerald-600 mb-3" />
//           <h2 className="text-xl font-bold text-gray-800 mb-1">
//             스네이크 드래프트 준비
//           </h2>
//           <p className="text-gray-500 text-sm mb-6">
//             현재 참가 신청 인원:{" "}
//             <span className="font-bold text-emerald-600">
//               {attendees?.length || 0}명
//             </span>
//           </p>
//           <button
//             onClick={handleAutoSetupTeams}
//             className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
//           >
//             <Shuffle size={18} /> 주장을 뽑고 드래프트 시작하기 🚀
//           </button>
//         </div>
//       )}

//       {(draftState === "DRAFTING" || draftState === "FINISHED") && (
//         <div className="space-y-6">
//           {/* 현재 턴 안내 배너 */}
//           {draftState === "DRAFTING" && currentTurnTeam && (
//             <div className="bg-emerald-600 text-white p-4 rounded-2xl shadow-md text-center animate-pulse">
//               <span className="text-xs bg-emerald-500 px-2.5 py-1 rounded-full font-semibold">
//                 라운드 {roundNumber} (스네이크 🐍)
//               </span>
//               <h2 className="text-2xl font-black mt-2">
//                 🔥 {currentTurnTeam.team_name} 지명 차례!
//               </h2>
//             </div>
//           )}

//           {draftState === "FINISHED" && (
//             <div className="bg-amber-500 text-white p-4 rounded-2xl shadow-md text-center">
//               <h2 className="text-xl font-bold">
//                 🎉 드래프트가 완료되었습니다!
//               </h2>
//               <button
//                 onClick={handleCopyResult}
//                 className="mt-3 bg-white text-amber-950 font-bold px-4 py-2 rounded-xl text-sm flex items-center gap-2 mx-auto shadow"
//               >
//                 {copied ? (
//                   <Check size={16} className="text-emerald-600" />
//                 ) : (
//                   <Copy size={16} />
//                 )}
//                 {copied ? "클립보드 복사 완료!" : "단톡방 공유 텍스트 복사 📋"}
//               </button>
//             </div>
//           )}

//           {/* 팀별 현재 멤버 현황 */}
//           <div className="grid grid-cols-3 gap-2">
//             {teams.map((team, idx) => {
//               const isMyTurn =
//                 draftState === "DRAFTING" && currentTurnTeam?.id === team.id;
//               return (
//                 <div
//                   key={team.id}
//                   className={`bg-white rounded-2xl p-3 shadow-sm border-2 transition-all ${
//                     isMyTurn
//                       ? "border-emerald-500 shadow-md ring-2 ring-emerald-200"
//                       : "border-gray-100"
//                   }`}
//                 >
//                   <div className="font-bold text-gray-800 text-sm border-b pb-1 mb-2 flex justify-between items-center">
//                     <span>{team.team_name}</span>
//                     {isMyTurn && (
//                       <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
//                     )}
//                   </div>
//                   <div className="space-y-1 min-h-[100px]">
//                     {teamMembers[team.id]?.map((m, mIdx) => (
//                       <div
//                         key={m.id}
//                         className="text-xs bg-gray-50 px-2 py-1 rounded text-gray-700 font-medium truncate"
//                       >
//                         {mIdx === 0 ? `👑 ${m.users.name}` : m.users.name}
//                       </div>
//                     ))}
//                   </div>
//                 </div>
//               );
//             })}
//           </div>

//           {/* 남은 선수(대기 명단) 목록 - 내 차례일 때 클릭해서 지명 */}
//           {draftState === "DRAFTING" && (
//             <div className="bg-white rounded-2xl p-4 shadow-sm">
//               <h3 className="font-bold text-gray-800 text-sm mb-3 flex items-center justify-between">
//                 <span>남은 선수 명단 ({attendees?.length || 0}명)</span>
//                 <span className="text-xs text-emerald-600 font-semibold">
//                   선수를 눌러 영입하세요 👇
//                 </span>
//               </h3>
//               <div className="grid grid-cols-2 gap-2">
//                 {attendees?.map((player) => (
//                   <button
//                     key={player.id}
//                     onClick={() => handlePickPlayer(player)}
//                     className="bg-gray-50 hover:bg-emerald-50 hover:border-emerald-300 border border-gray-200 p-2.5 rounded-xl text-left font-semibold text-gray-700 text-xs transition-all flex items-center justify-between group"
//                   >
//                     <span>{player.users.name}</span>
//                     <span className="text-emerald-600 opacity-0 group-hover:opacity-100 font-bold">
//                       지명 ➔
//                     </span>
//                   </button>
//                 ))}
//               </div>
//             </div>
//           )}
//         </div>
//       )}
//     </main>
//   );
// }

// // 깃헙 버전
// "use client";
// import { useState, useEffect } from "react";
// import { createClient } from "@supabase/supabase-js";
// import {
//   Users,
//   CheckCircle,
//   Clock,
//   ShieldCheck,
//   Play,
//   Award,
//   Settings,
//   LogIn,
//   LogOut,
// } from "lucide-react";
// import Link from "next/link";

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
//   payment_status: "PAID" | "PENDING";
//   user_id: string;
//   users: User;
// }

// export default function FutsalHome() {
//   const [attendees, setAttendees] = useState<Attendee[]>([]);
//   const [currentUser, setCurrentUser] = useState<any>(null);
//   const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
//   const [loading, setLoading] = useState<boolean>(true);
//   const [isAdmin, setIsAdmin] = useState<boolean>(true);

//   useEffect(() => {
//     // 1. 초기 세션 확인
//     checkUserAndSession();

//     // 2. 카카오 로그인 후 돌아왔을 때 세션 변화를 실시간 감지하여 화면 업데이트
//     const {
//       data: { subscription },
//     } = supabase.auth.onAuthStateChange((_event, session) => {
//       setCurrentUser(session?.user ?? null);
//       if (session?.user && currentSessionId) {
//         fetchAttendees(currentSessionId);
//       }
//     });

//     return () => {
//       subscription.unsubscribe();
//     };
//   }, [currentSessionId]);

//   // 1. 현재 로그인한 유저 정보 및 최신 세션 ID 가져오기
//   const checkUserAndSession = async () => {
//     setLoading(true);

//     const { data, error } = await supabase.auth.getSession();

//     setCurrentUser(data.session?.user ?? null);

//     const { data: sessionData } = await supabase
//       .from("sessions")
//       .select("id")
//       .order("date", { ascending: false })
//       .limit(1)
//       .single();

//     if (sessionData) {
//       setCurrentSessionId(sessionData.id);
//       fetchAttendees(sessionData.id);
//     }
//     setLoading(false);
//   };

//   // 2. 해당 세션의 참가 신청 명단 불러오기
//   const fetchAttendees = async (sessionId: string) => {
//     const { data, error } = await supabase
//       .from("session_attendees")
//       .select(`id, payment_status, user_id, users ( id, name, phone )`)
//       .eq("session_id", sessionId);

//     if (!error) {
//       setAttendees((data as unknown as Attendee[]) || []);
//     }
//   };

//   // 3. 카카오 소셜 로그인 실행
//   const handleKakaoLogin = async () => {
//     await supabase.auth.signInWithOAuth({
//       provider: "kakao",
//       options: {
//         redirectTo: `${window.location.origin}`,
//         queryParams: {
//           scope: "profile_nickname", // 이메일과 프로필 이미지를 제외하고 닉네임만 요청
//         },
//       },
//     });
//   };

//   // 4. 로그아웃
//   const handleLogout = async () => {
//     await supabase.auth.signOut();
//     setCurrentUser(null);
//     window.location.reload();
//   };

//   // 5. 👈 핵심: 셀프 참가 신청하기 (선착순 15명 제한)
//   // 5. 👈 수정된 셀프 참가 신청하기 (users 테이블 자동 동기화 포함)
//   const handleApplySession = async () => {
//     if (!currentUser) {
//       alert("로그인이 필요합니다!");
//       handleKakaoLogin();
//       return;
//     }

//     if (!currentSessionId) {
//       alert("현재 진행 중인 경기 세션이 없습니다!");
//       return;
//     }

//     if (attendees.length >= 15) {
//       alert("아쉽지만 선착순 15명이 마감되었습니다!");
//       return;
//     }

//     // 이미 신청했는지 체크
//     const alreadyApplied = attendees.some((a) => a.user_id === currentUser.id);
//     if (alreadyApplied) {
//       alert("이미 참가 신청이 완료되었습니다!");
//       return;
//     }

//     // 💡 핵심: public.users 테이블에 내 유저 정보가 없으면 자동 등록 (Upsert)
//     const kakaoName =
//       currentUser.user_metadata?.name ||
//       currentUser.user_metadata?.full_name ||
//       currentUser.user_metadata?.preferred_username ||
//       "카카오 유저";

//     const { error: userError } = await supabase.from("users").upsert(
//       {
//         id: currentUser.id,
//         name: kakaoName,
//       },
//       { onConflict: "id" }
//     );

//     if (userError) {
//       console.error("유저 프로필 동기화 에러:", userError);
//       alert("유저 프로필을 생성하는 중 문제가 발생했습니다.");
//       return;
//     }

//     // session_attendees 테이블에 참가 신청 insert
//     const { error } = await supabase.from("session_attendees").insert({
//       session_id: currentSessionId,
//       user_id: currentUser.id,
//       payment_status: "PENDING", // 기본 미입금 상태
//     });

//     if (error) {
//       console.error("신청 에러:", error);
//       alert("참가 신청 중 오류가 발생했습니다.");
//     } else {
//       alert("참가 신청이 성공적으로 완료되었습니다! 🎉 (입금을 진행해주세요)");
//       fetchAttendees(currentSessionId);
//     }
//   };

//   // 방장용 입금 상태 토글
//   const togglePayment = async (id: string, currentStatus: string) => {
//     const newStatus = currentStatus === "PAID" ? "PENDING" : "PAID";
//     const { error } = await supabase
//       .from("session_attendees")
//       .update({ payment_status: newStatus })
//       .eq("id", id);

//     if (!error && currentSessionId) {
//       fetchAttendees(currentSessionId);
//     }
//   };

//   return (
//     <main className="min-h-screen bg-gray-50 p-4 max-w-md mx-auto pb-28">
//       {/* 상단 모임 정보 카드 */}
//       <div className="bg-emerald-600 text-white p-5 rounded-2xl shadow-md mb-6 relative">
//         <div className="flex items-center justify-between">
//           <span className="bg-emerald-500 text-xs px-2.5 py-1 rounded-full font-semibold">
//             매주 화요일 정기 풋살
//           </span>

//           <div className="flex items-center gap-2">
//             <Link
//               href="/admin"
//               className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs px-2.5 py-1 rounded-full font-bold flex items-center gap-1 transition-all"
//             >
//               <Settings size={12} /> 관리자 센터
//             </Link>
//             {currentUser ? (
//               <button
//                 onClick={handleLogout}
//                 className="bg-rose-600 text-white text-xs px-2 py-1 rounded-full font-bold flex items-center gap-1"
//               >
//                 <LogOut size={12} /> 로그아웃
//               </button>
//             ) : (
//               <button
//                 onClick={handleKakaoLogin}
//                 className="bg-amber-400 text-amber-950 text-xs px-2.5 py-1 rounded-full font-bold flex items-center gap-1"
//               >
//                 <LogIn size={12} /> 카카오 로그인
//               </button>
//             )}
//           </div>
//         </div>

//         <h1 className="text-2xl font-bold mt-2">이번 주 화요일 풋살 ⚽</h1>
//         <p className="text-emerald-100 text-sm mt-1">
//           장소: 실내 풋살장 / 시간: 20:00 ~ 22:00
//         </p>
//         <div className="mt-4 flex items-center justify-between text-sm border-t border-emerald-500 pt-3">
//           <span>신청 인원</span>
//           <span className="font-bold text-lg">{attendees.length} / 15명</span>
//         </div>
//       </div>

//       {/* 빠른 이동 네비게이션 */}
//       <div className="grid grid-cols-2 gap-2 mb-6">
//         <Link
//           href="/draft"
//           className="bg-white hover:bg-emerald-50 border border-emerald-200 p-3 rounded-2xl shadow-sm text-center flex flex-col items-center justify-center transition-all"
//         >
//           <Play size={20} className="text-emerald-600 mb-1" />
//           <span className="font-bold text-xs text-gray-800">
//             디지털 드래프트 ⚡
//           </span>
//         </Link>
//         <Link
//           href="/result"
//           className="bg-white hover:bg-emerald-50 border border-emerald-200 p-3 rounded-2xl shadow-sm text-center flex flex-col items-center justify-center transition-all"
//         >
//           <Award size={20} className="text-emerald-600 mb-1" />
//           <span className="font-bold text-xs text-gray-800">
//             경기 결과 & 빨래 🏆
//           </span>
//         </Link>
//       </div>

//       {/* 참가 신청 명단 리스트 */}
//       <div className="bg-white rounded-2xl p-4 shadow-sm mb-6">
//         <div className="flex items-center justify-between mb-4">
//           <h2 className="font-bold text-gray-800 flex items-center gap-2">
//             <Users size={18} className="text-emerald-600" />
//             참가 신청 명단 (선착순 15명)
//           </h2>
//           {isAdmin && (
//             <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-medium flex items-center gap-1">
//               <ShieldCheck size={12} /> 방장 모드
//             </span>
//           )}
//         </div>

//         {loading ? (
//           <p className="text-center text-gray-400 py-6">불러오는 중...</p>
//         ) : attendees.length === 0 ? (
//           <p className="text-center text-gray-400 py-6">
//             아직 신청자가 없습니다. 첫 주자가 되어보세요!
//           </p>
//         ) : (
//           <div className="space-y-2">
//             {attendees.map((item, index) => (
//               <div
//                 key={item.id}
//                 className="flex items-center justify-between p-3 bg-gray-50 rounded-xl"
//               >
//                 <div className="flex items-center gap-3">
//                   <span className="font-bold text-gray-400 text-sm w-5">
//                     {index + 1}
//                   </span>
//                   <span className="font-semibold text-gray-700">
//                     {item.users?.name || "카카오 유저"}
//                   </span>
//                 </div>

//                 <div className="flex items-center gap-2">
//                   <button
//                     onClick={() =>
//                       isAdmin && togglePayment(item.id, item.payment_status)
//                     }
//                     className={`text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1 transition-colors ${
//                       item.payment_status === "PAID"
//                         ? "bg-emerald-100 text-emerald-700"
//                         : "bg-orange-100 text-orange-700"
//                     }`}
//                   >
//                     {item.payment_status === "PAID" ? (
//                       <CheckCircle size={12} />
//                     ) : (
//                       <Clock size={12} />
//                     )}
//                     {item.payment_status === "PAID" ? "입금완료" : "미입금"}
//                   </button>
//                 </div>
//               </div>
//             ))}
//           </div>
//         )}
//       </div>

//       {/* 하단 셀프 참가 신청 버튼 */}
//       <div className="fixed bottom-4 left-4 right-4 max-w-md mx-auto">
//         <button
//           onClick={handleApplySession}
//           className={`w-full font-bold py-3.5 rounded-2xl shadow-lg transition-all ${
//             attendees.length >= 15
//               ? "bg-gray-300 text-gray-600 cursor-not-allowed"
//               : "bg-emerald-600 hover:bg-emerald-700 text-white"
//           }`}
//         >
//           {attendees.length >= 15
//             ? "선착순 마감되었습니다 🚫"
//             : "참가 신청하기 (셀프 선착순 ⚽)"}
//         </button>
//       </div>
//     </main>
//   );
// }

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

// 💡 방장 유저 ID 목록 (본인의 Supabase User ID 지정)
const ADMIN_USER_IDS = [
  "1e749510-834a-48c3-afba-e373a992eef2",
  "643e4072-716f-4b98-96b2-139c0c7835b6",
];

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
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  useEffect(() => {
    checkUserAndSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;
      setCurrentUser(user);
      setIsAdmin(!!user && ADMIN_USER_IDS.includes(user.id));

      if (user && currentSessionId) {
        fetchAttendees(currentSessionId);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [currentSessionId]);

  // 💡 실시간 명단 동기화 (방장이 명단을 지우거나 추가할 때 자동 업데이트)
  useEffect(() => {
    if (!currentSessionId) return;

    fetchAttendees(currentSessionId);

    const channel = supabase
      .channel("session_attendees_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "session_attendees",
          filter: `session_id=eq.${currentSessionId}`,
        },
        () => {
          fetchAttendees(currentSessionId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentSessionId]);

  const checkUserAndSession = async () => {
    setLoading(true);
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user ?? null;
    setCurrentUser(user);

    // 로그인한 유저가 방장 명단에 있는지 체크
    if (user && ADMIN_USER_IDS.includes(user.id)) {
      setIsAdmin(true);
    } else {
      setIsAdmin(false);
    }

    // 가장 최근 세션 가져오기
    const { data: sessionData } = await supabase
      .from("sessions")
      .select("id")
      .order("date", { ascending: false })
      .limit(1)
      .single();

    if (sessionData) {
      setCurrentSessionId(sessionData.id);
    }
    setLoading(false);
  };

  const fetchAttendees = async (sessionId: string) => {
    const { data, error } = await supabase
      .from("session_attendees")
      .select(`id, payment_status, user_id, users ( id, name, phone )`)
      .eq("session_id", sessionId);

    if (!error && data) {
      setAttendees(data as unknown as Attendee[]);
    }
  };

  const handleKakaoLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "kakao",
      options: {
        redirectTo: `${window.location.origin}`,
        queryParams: { scope: "profile_nickname" },
      },
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setIsAdmin(false);
    window.location.reload();
  };

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

    const alreadyApplied = attendees.some((a) => a.user_id === currentUser.id);
    if (alreadyApplied) {
      alert("이미 참가 신청이 완료되었습니다!");
      return;
    }

    const kakaoName =
      currentUser.user_metadata?.name ||
      currentUser.user_metadata?.full_name ||
      currentUser.user_metadata?.preferred_username ||
      "카카오 유저";

    await supabase
      .from("users")
      .upsert({ id: currentUser.id, name: kakaoName }, { onConflict: "id" });

    const { error } = await supabase.from("session_attendees").insert({
      session_id: currentSessionId,
      user_id: currentUser.id,
      payment_status: "PENDING",
    });

    if (error) {
      alert("참가 신청 중 오류가 발생했습니다: " + error.message);
    } else {
      alert("참가 신청이 완료되었습니다! 🎉");
      fetchAttendees(currentSessionId);
    }
  };

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
            {isAdmin && (
              <Link
                href="/admin"
                className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs px-2.5 py-1 rounded-full font-bold flex items-center gap-1 transition-all"
              >
                <Settings size={12} /> 관리자 센터
              </Link>
            )}
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
        <p className="text-emerald-100 text-sm mt-1">시간: 20:00 ~ 22:00</p>
        <div className="mt-4 flex items-center justify-between text-sm border-t border-emerald-500 pt-3">
          <span>신청 인원</span>
          <span className="font-bold text-lg">{attendees.length} / 15명</span>
        </div>
      </div>

      {/* 네비게이션 */}
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

      {/* 참가 신청 명단 */}
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
                    {item.users?.name || "유저"}
                  </span>
                </div>
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
            ))}
          </div>
        )}
      </div>

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
