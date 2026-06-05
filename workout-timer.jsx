import { useState, useEffect, useRef, useCallback } from "react";

const EXERCISES = [
  {
    name: "맨몸 스쿼트",
    emoji: "🦵",
    reps: 20,
    sets: 4,
    type: "reps",
    rest: 45,
    target: "허벅지 근육 강화",
    tip: "무릎이 발끝을 넘지 않게, 허벅지가 바닥과 평행할 때까지",
    downTime: 2000,
    upTime: 1500,
    downCmd: "내려가세요",
    upCmd: "올라가세요",
  },
  {
    name: "무릎 대고 푸쉬업",
    emoji: "💪",
    reps: 12,
    sets: 4,
    type: "reps",
    rest: 45,
    target: "가슴, 팔 근육 강화",
    tip: "팔꿈치를 45도로 벌리고, 가슴이 바닥에 닿을 듯이",
    downTime: 2000,
    upTime: 1500,
    downCmd: "내려가세요",
    upCmd: "올라가세요",
  },
  {
    name: "플랭크",
    emoji: "🧘",
    reps: 60,
    sets: 3,
    type: "timed",
    rest: 30,
    target: "코어 강화",
    tip: "엉덩이를 너무 올리거나 내리지 말고 일직선 유지",
  },
];

const C = {
  bg: "#0a0a0f",
  card: "#14141f",
  accent: "#ff6b35",
  accentGlow: "rgba(255,107,53,0.3)",
  green: "#22c55e",
  greenGlow: "rgba(34,197,94,0.15)",
  blue: "#3b82f6",
  blueGlow: "rgba(59,130,246,0.15)",
  text: "#f0f0f5",
  dim: "#6b6b80",
  border: "#1e1e2e",
  rest: "#a855f7",
  restGlow: "rgba(168,85,247,0.15)",
  down: "#3b82f6",
  up: "#22c55e",
};

function speak(text, rate = 1.0) {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) { resolve(); return; }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ko-KR";
    u.rate = rate;
    u.pitch = 1.0;
    u.volume = 1.0;
    u.onend = resolve;
    u.onerror = resolve;
    window.speechSynthesis.speak(u);
  });
}

function beep(freq = 800, dur = 150, vol = 0.3) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value = freq; g.gain.value = vol;
    o.start(); o.stop(ctx.currentTime + dur / 1000);
  } catch (e) {}
}

function vibrate(ms = 80) {
  try { navigator.vibrate?.(ms); } catch (e) {}
}

function formatTime(s) {
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

const Ring = ({ size = 220, progress = 0, color, children }) => {
  const sw = 10;
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.border} strokeWidth={sw} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color}
          strokeWidth={sw} strokeDasharray={circ}
          strokeDashoffset={circ * (1 - progress)} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.4s ease" }}
        />
      </svg>
      <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column",
        alignItems:"center", justifyContent:"center" }}>
        {children}
      </div>
    </div>
  );
};

export default function WorkoutTimer() {
  const [phase, setPhase] = useState("ready");
  const [exIdx, setExIdx] = useState(0);
  const [setNum, setSetNum] = useState(1);
  const [repCount, setRepCount] = useState(0);
  const [repPhase, setRepPhase] = useState(""); // "down" | "up" | ""
  const [timer, setTimer] = useState(0);
  const [restTimer, setRestTimer] = useState(0);
  const [totalElapsed, setTotalElapsed] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const cancelRef = useRef(false);
  const pauseRef = useRef(false);
  const phaseRef = useRef(phase);

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { pauseRef.current = isPaused; }, [isPaused]);

  const ex = EXERCISES[exIdx];
  const totalSets = EXERCISES.reduce((a, e) => a + e.sets, 0);
  const completedSets = EXERCISES.slice(0, exIdx).reduce((a, e) => a + e.sets, 0) + (setNum - 1);

  // Total timer
  useEffect(() => {
    if (phase !== "ready" && phase !== "done" && !isPaused) {
      const iv = setInterval(() => setTotalElapsed(t => t + 1), 1000);
      return () => clearInterval(iv);
    }
  }, [phase, isPaused]);

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  const waitWhilePaused = async () => {
    while (pauseRef.current && !cancelRef.current) {
      await sleep(100);
    }
  };

  // Rep-based exercise loop
  const runRepExercise = useCallback(async (exercise, onComplete) => {
    for (let i = 1; i <= exercise.reps; i++) {
      if (cancelRef.current) return;
      await waitWhilePaused();
      if (cancelRef.current) return;

      // DOWN
      setRepPhase("down");
      setRepCount(i - 0.5); // halfway
      speak(i === 1 ? exercise.downCmd : exercise.downCmd, 1.1);
      vibrate(50);

      await sleep(exercise.downTime);
      if (cancelRef.current) return;
      await waitWhilePaused();
      if (cancelRef.current) return;

      // UP
      setRepPhase("up");
      setRepCount(i);
      speak(exercise.upCmd, 1.1);
      vibrate(50);

      // Announce count every 5 reps or last rep
      if (i % 5 === 0 || i === exercise.reps) {
        setTimeout(() => {
          if (!cancelRef.current) speak(`${i}회`, 1.2);
        }, 600);
      }

      await sleep(exercise.upTime);
      if (cancelRef.current) return;
      await waitWhilePaused();
    }
    setRepPhase("");
    if (!cancelRef.current) onComplete();
  }, []);

  // Timed exercise (plank)
  const runTimedExercise = useCallback(async (exercise, onComplete) => {
    setTimer(exercise.reps);
    speak("시작", 1.0);

    for (let t = exercise.reps; t > 0; t--) {
      if (cancelRef.current) return;
      await waitWhilePaused();
      if (cancelRef.current) return;

      setTimer(t);

      if (t === Math.floor(exercise.reps / 2)) {
        speak("절반 지났습니다. 힘내세요!", 1.0);
      } else if (t === 10) {
        speak("10초 남았습니다!", 1.0);
      } else if (t <= 3) {
        beep(600, 80, 0.2);
      }

      await sleep(1000);
    }
    setTimer(0);
    if (!cancelRef.current) {
      beep(1000, 300, 0.4);
      vibrate([100, 50, 100]);
      onComplete();
    }
  }, []);

  // Rest period
  const runRest = useCallback(async (duration, onComplete) => {
    setRestTimer(duration);
    speak("쉬세요", 1.0);

    for (let t = duration; t > 0; t--) {
      if (cancelRef.current) return;
      await waitWhilePaused();
      if (cancelRef.current) return;

      setRestTimer(t);

      if (t === 5) speak("5초 뒤 시작합니다", 1.0);
      else if (t <= 3) beep(500, 60, 0.15);

      await sleep(1000);
    }
    setRestTimer(0);
    if (!cancelRef.current) {
      beep(1000, 100, 0.4);
      setTimeout(() => beep(1200, 200, 0.5), 150);
      vibrate([100, 50, 100]);
      onComplete();
    }
  }, []);

  // Countdown before exercise
  const runCountdown = useCallback(async () => {
    for (let t = 3; t > 0; t--) {
      if (cancelRef.current) return;
      setCountdown(t);
      beep(600 + (3 - t) * 200, 100, 0.3);
      await sleep(1000);
    }
    setCountdown(0);
    beep(1000, 200, 0.4);
  }, []);

  // Main workout loop
  const runWorkout = useCallback(async () => {
    cancelRef.current = false;

    for (let ei = 0; ei < EXERCISES.length; ei++) {
      const exercise = EXERCISES[ei];

      for (let si = 1; si <= exercise.sets; si++) {
        if (cancelRef.current) return;

        setExIdx(ei);
        setSetNum(si);
        setRepCount(0);
        setRepPhase("");
        setPhase("exercise");

        // Announce
        await speak(`${exercise.name}, ${si}세트 시작합니다`, 1.0);
        await runCountdown();
        if (cancelRef.current) return;

        // Execute
        await new Promise((resolve) => {
          if (exercise.type === "reps") {
            runRepExercise(exercise, resolve);
          } else {
            runTimedExercise(exercise, resolve);
          }
        });
        if (cancelRef.current) return;

        // Check if done
        const isLastSet = si >= exercise.sets;
        const isLastEx = ei >= EXERCISES.length - 1;

        if (isLastSet && isLastEx) {
          await speak("운동 완료! 수고했습니다!", 1.0);
          setPhase("done");
          return;
        }

        // Rest
        const restDur = isLastSet ? 60 : exercise.rest;
        setPhase("rest");

        if (isLastSet) {
          await speak(`${EXERCISES[ei + 1].name}으로 넘어갑니다. ${restDur}초 쉬세요`, 1.0);
        } else {
          await speak(`${si}세트 완료. ${restDur}초 쉬세요`, 1.0);
        }

        await new Promise((resolve) => {
          runRest(restDur, resolve);
        });
      }
    }
  }, [runRepExercise, runTimedExercise, runRest, runCountdown]);

  const startWorkout = async () => {
    // Initialize audio context & TTS with user gesture
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      g.gain.value = 0.01; o.start(); o.stop(ctx.currentTime + 0.01);
    } catch(e) {}

    await speak("준비", 1.0);
    setTotalElapsed(0);
    runWorkout();
  };

  const resetWorkout = () => {
    cancelRef.current = true;
    window.speechSynthesis?.cancel();
    setPhase("ready");
    setExIdx(0);
    setSetNum(1);
    setRepCount(0);
    setRepPhase("");
    setTimer(0);
    setRestTimer(0);
    setTotalElapsed(0);
    setIsPaused(false);
    setCountdown(0);
  };

  const skipRest = () => {
    cancelRef.current = true;
    window.speechSynthesis?.cancel();
    setTimeout(() => {
      cancelRef.current = false;
      // figure out next
      const isLastSet = setNum >= ex.sets;
      if (isLastSet) {
        setExIdx(i => {
          const next = i + 1;
          // restart from next exercise
          setSetNum(1);
          setRepCount(0);
          setRepPhase("");
          setPhase("exercise");
          // re-run from that point
          setTimeout(() => {
            cancelRef.current = false;
            // We need to re-trigger the loop - simplify by just restarting
          }, 0);
          return next;
        });
      }
      // For simplicity, just let them tap start again or auto-advance
    }, 100);
  };

  const progress = phase === "exercise"
    ? ex?.type === "reps"
      ? repCount / (ex?.reps || 1)
      : ex?.type === "timed"
        ? 1 - timer / (ex?.reps || 1)
        : 0
    : 0;

  const restProgress = phase === "rest"
    ? 1 - restTimer / (setNum > ex?.sets ? 60 : ex?.rest || 45)
    : 0;

  const currentColor = repPhase === "down" ? C.down : repPhase === "up" ? C.up
    : ex?.type === "timed" ? C.blue : C.green;

  return (
    <div style={{
      minHeight: "100vh", background: C.bg, color: C.text,
      fontFamily: "'SF Pro Display', -apple-system, sans-serif",
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: 0, userSelect: "none", WebkitUserSelect: "none",
    }}>
      {/* Header */}
      <div style={{
        width: "100%", padding: "16px 20px 8px", display: "flex",
        justifyContent: "space-between", alignItems: "center", maxWidth: 420,
      }}>
        <div style={{ fontSize: 13, color: C.dim }}>🏠 홈트 15분</div>
        <div style={{
          fontSize: 16, fontWeight: 600, fontVariantNumeric: "tabular-nums",
          color: phase === "done" ? C.green : C.dim,
        }}>
          {formatTime(totalElapsed)}
        </div>
      </div>

      {/* Progress bar */}
      {phase !== "ready" && (
        <div style={{
          width: "calc(100% - 40px)", maxWidth: 400, height: 4,
          background: C.border, borderRadius: 2, margin: "4px 0 12px", overflow: "hidden",
        }}>
          <div style={{
            height: "100%", width: `${(completedSets / totalSets) * 100}%`,
            background: `linear-gradient(90deg, ${C.accent}, ${C.green})`,
            borderRadius: 2, transition: "width 0.5s ease",
          }} />
        </div>
      )}

      {/* ═══ READY ═══ */}
      {phase === "ready" && (
        <div style={{
          flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", padding: 20, gap: 24, maxWidth: 400,
        }}>
          <div style={{ fontSize: 48 }}>🔥</div>
          <div style={{ fontSize: 22, fontWeight: 700, textAlign: "center" }}>
            홈트레이닝 루틴
          </div>
          <div style={{ fontSize: 13, color: C.dim, textAlign: "center", lineHeight: 1.6 }}>
            음성 가이드로 페이스 조절 · 약 15분
          </div>

          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
            {EXERCISES.map((e, i) => (
              <div key={i} style={{
                background: C.card, border: `1px solid ${C.border}`,
                borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center", gap: 14,
              }}>
                <div style={{ fontSize: 28 }}>{e.emoji}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{e.name}</div>
                  <div style={{ fontSize: 12, color: C.dim, marginTop: 2 }}>
                    {e.type === "timed" ? `${e.reps}초` : `${e.reps}회`} × {e.sets}세트 · {e.target}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{
            background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
            padding: "12px 16px", width: "100%",
          }}>
            <div style={{ fontSize: 12, color: C.accent, fontWeight: 600, marginBottom: 4 }}>
              🔊 음성 가이드 안내
            </div>
            <div style={{ fontSize: 12, color: C.dim, lineHeight: 1.6 }}>
              "내려가세요 / 올라가세요" 음성에 맞춰 운동하세요.
              5회마다 횟수를 알려드립니다. 무음 모드를 해제하세요!
            </div>
          </div>

          <button onClick={startWorkout} style={{
            width: "100%", padding: 18, fontSize: 18, fontWeight: 700,
            background: `linear-gradient(135deg, ${C.accent}, #ff8c5a)`,
            color: "#fff", border: "none", borderRadius: 16, cursor: "pointer",
            marginTop: 12, boxShadow: `0 4px 24px ${C.accentGlow}`,
          }}>
            운동 시작 ▶
          </button>
        </div>
      )}

      {/* ═══ EXERCISE ═══ */}
      {phase === "exercise" && (
        <div style={{
          flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
          padding: "8px 20px 20px", gap: 10, maxWidth: 420, width: "100%",
        }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 2 }}>{ex.emoji}</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{ex.name}</div>
            <div style={{ fontSize: 13, color: C.accent, fontWeight: 600, marginTop: 4 }}>
              세트 {setNum} / {ex.sets}
            </div>
          </div>

          {/* Countdown overlay */}
          {countdown > 0 && (
            <div style={{
              position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)",
              display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", zIndex: 100,
            }}>
              <div style={{
                fontSize: 120, fontWeight: 900, color: C.accent,
                animation: "countPop 0.5s ease",
              }}>
                {countdown}
              </div>
              <div style={{ fontSize: 16, color: C.dim, marginTop: 12 }}>준비하세요</div>
            </div>
          )}

          {/* Ring */}
          <Ring size={220} progress={progress} color={currentColor}>
            {ex.type === "reps" ? (
              <>
                <div style={{
                  fontSize: 52, fontWeight: 800, lineHeight: 1,
                  color: currentColor, fontVariantNumeric: "tabular-nums",
                  transition: "color 0.3s",
                }}>
                  {Math.ceil(repCount)}
                </div>
                <div style={{ fontSize: 13, color: C.dim, marginTop: 4 }}>/ {ex.reps}회</div>
              </>
            ) : (
              <>
                <div style={{
                  fontSize: 52, fontWeight: 800, lineHeight: 1,
                  color: C.blue, fontVariantNumeric: "tabular-nums",
                }}>
                  {timer}
                </div>
                <div style={{ fontSize: 13, color: C.dim, marginTop: 4 }}>초 남음</div>
              </>
            )}
          </Ring>

          {/* Voice command display */}
          {ex.type === "reps" && repPhase && (
            <div style={{
              fontSize: 22, fontWeight: 800, letterSpacing: "0.05em",
              color: repPhase === "down" ? C.down : C.up,
              background: repPhase === "down" ? C.blueGlow : C.greenGlow,
              padding: "12px 32px", borderRadius: 24,
              transition: "all 0.3s ease",
              animation: "fadeSlide 0.3s ease",
            }}>
              {repPhase === "down" ? "⬇ 내려가세요" : "⬆ 올라가세요"}
            </div>
          )}

          {ex.type === "timed" && (
            <div style={{
              fontSize: 16, color: C.blue, fontWeight: 600,
              background: C.blueGlow, padding: "8px 20px", borderRadius: 20,
            }}>
              🧘 자세를 유지하세요
            </div>
          )}

          {/* Tip */}
          <div style={{
            background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
            padding: "10px 14px", width: "100%", marginTop: 4,
          }}>
            <div style={{ fontSize: 11, color: C.dim, fontWeight: 600, marginBottom: 2 }}>💡 자세 팁</div>
            <div style={{ fontSize: 12, color: C.text, lineHeight: 1.5 }}>{ex.tip}</div>
          </div>

          {/* Controls */}
          <div style={{ display:"flex", gap:12, width:"100%", marginTop:"auto", paddingTop:8 }}>
            <button onClick={() => setIsPaused(!isPaused)} style={{
              flex: 1, padding: 14, fontSize: 15, fontWeight: 600,
              background: isPaused ? C.accent : C.card,
              color: isPaused ? "#fff" : C.text,
              border: `1px solid ${isPaused ? C.accent : C.border}`,
              borderRadius: 14, cursor: "pointer",
            }}>
              {isPaused ? "▶ 계속" : "⏸ 일시정지"}
            </button>
            <button onClick={resetWorkout} style={{
              padding: "14px 18px", fontSize: 15, fontWeight: 600,
              background: C.card, color: "#ef4444",
              border: `1px solid ${C.border}`, borderRadius: 14, cursor: "pointer",
            }}>
              ✕ 중단
            </button>
          </div>
        </div>
      )}

      {/* ═══ REST ═══ */}
      {phase === "rest" && (
        <div style={{
          flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", padding: 20, gap: 20, maxWidth: 420, width: "100%",
        }}>
          <div style={{
            fontSize: 14, color: C.rest, fontWeight: 700, letterSpacing: "0.1em",
          }}>
            ☕ 쉬는 시간
          </div>

          <Ring size={220} progress={restProgress} color={C.rest}>
            <div style={{
              fontSize: 60, fontWeight: 800, color: C.rest,
              lineHeight: 1, fontVariantNumeric: "tabular-nums",
            }}>
              {restTimer}
            </div>
            <div style={{ fontSize: 13, color: C.dim, marginTop: 6 }}>초</div>
          </Ring>

          {/* Next up */}
          <div style={{
            background: C.card, border: `1px solid ${C.border}`, borderRadius: 14,
            padding: "14px 18px", width: "100%", textAlign: "center",
          }}>
            <div style={{ fontSize: 11, color: C.dim, marginBottom: 6, fontWeight: 600 }}>다음</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>
              {setNum >= ex.sets
                ? `${EXERCISES[exIdx + 1]?.emoji || ""} ${EXERCISES[exIdx + 1]?.name || ""} · 세트 1`
                : `${ex.emoji} ${ex.name} · 세트 ${setNum + 1}`}
            </div>
          </div>

          <div style={{ display:"flex", gap:12, width:"100%", marginTop:8 }}>
            <button onClick={() => setIsPaused(!isPaused)} style={{
              flex: 1, padding: 14, fontSize: 15, fontWeight: 600,
              background: isPaused ? C.accent : C.card,
              color: isPaused ? "#fff" : C.text,
              border: `1px solid ${isPaused ? C.accent : C.border}`,
              borderRadius: 14, cursor: "pointer",
            }}>
              {isPaused ? "▶ 계속" : "⏸ 일시정지"}
            </button>
            <button onClick={resetWorkout} style={{
              padding: "14px 18px", fontSize: 15, fontWeight: 600,
              background: C.card, color: "#ef4444",
              border: `1px solid ${C.border}`, borderRadius: 14, cursor: "pointer",
            }}>
              ✕ 중단
            </button>
          </div>
        </div>
      )}

      {/* ═══ DONE ═══ */}
      {phase === "done" && (
        <div style={{
          flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", padding: 20, gap: 20, maxWidth: 420,
        }}>
          <div style={{ fontSize: 64 }}>🎉</div>
          <div style={{ fontSize: 24, fontWeight: 800 }}>운동 완료!</div>
          <div style={{ fontSize: 14, color: C.dim, textAlign: "center", lineHeight: 1.6 }}>
            총 소요 시간: {formatTime(totalElapsed)}<br />
            이제 러닝 나가자! 🏃‍♂️
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, width: "100%" }}>
            {EXERCISES.map((e, i) => (
              <div key={i} style={{
                background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
                padding: "14px 8px", textAlign: "center",
              }}>
                <div style={{ fontSize: 24, marginBottom: 4 }}>{e.emoji}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.green }}>✓ 완료</div>
                <div style={{ fontSize: 10, color: C.dim, marginTop: 2 }}>
                  {e.type === "timed" ? `${e.reps}초` : `${e.reps}회`} × {e.sets}세트
                </div>
              </div>
            ))}
          </div>

          <button onClick={resetWorkout} style={{
            width: "100%", padding: 16, fontSize: 16, fontWeight: 700,
            background: `linear-gradient(135deg, ${C.accent}, #ff8c5a)`,
            color: "#fff", border: "none", borderRadius: 14, cursor: "pointer",
            marginTop: 12, boxShadow: `0 4px 24px ${C.accentGlow}`,
          }}>
            처음으로 🔄
          </button>
        </div>
      )}

      <style>{`
        @keyframes fadeSlide {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes countPop {
          from { transform: scale(1.5); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        button:active { transform: scale(0.97); }
      `}</style>
    </div>
  );
}
