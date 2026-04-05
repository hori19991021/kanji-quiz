"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { initializeApp, getApps } from "firebase/app";
import { getAuth, onAuthStateChanged, signInAnonymously } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBUIhfkQhtH6RsRbByK7BwNQo8AE0FE8",
  authDomain: "kanji-kuizu.firebaseapp.com",
  projectId: "kanji-kuizu",
  storageBucket: "kanji-kuizu.firebasestorage.app",
  messagingSenderId: "229442525728",
  appId: "1:229442525728:web:f4db16cb2dac1ff95dfa45",
};

const isFirebaseConfigured = !Object.values(firebaseConfig).some((value) =>
  String(value).includes("YOUR_")
);

const firebaseApp = isFirebaseConfigured
  ? getApps().length > 0
    ? getApps()[0]
    : initializeApp(firebaseConfig)
  : null;

const auth = firebaseApp ? getAuth(firebaseApp) : null;
const db = firebaseApp ? getFirestore(firebaseApp) : null;

function randomId(length = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function normalizeName(name: string) {
  return name.trim();
}

function getUrlParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    mode: params.get("mode") || "",
    room: (params.get("room") || "").toUpperCase(),
    code: (params.get("code") || "").toUpperCase(),
  };
}

function buildRoleUrl(role: "host" | "guest", roomId: string, passcode = "") {
  const url = new URL(window.location.href);
  url.searchParams.set("mode", role);
  url.searchParams.set("room", roomId);
  if (role === "host" && passcode) {
    url.searchParams.set("code", passcode);
  } else {
    url.searchParams.delete("code");
  }
  return url.toString();
}

function dataUrlFromCanvas(canvas: HTMLCanvasElement) {
  return canvas.toDataURL("image/png");
}

type Submission = {
  id: string;
  createdBy: string;
  createdByUid?: string;
  left: string;
  right: string;
  correctSide: "left" | "right";
  status: "pending" | "approved" | "rejected";
  createdAt?: unknown;
};

type Problem = {
  id: string;
  createdBy: string;
  createdByUid?: string;
  left: string;
  right: string;
  correctSide: "left" | "right";
  approvedAt?: unknown;
  playId?: string;
};

type RoomData = {
  id: string;
  roomId: string;
  hostName: string;
  hostUid: string;
  hostPasscode: string;
};

function DrawingPad({
  title,
  onChange,
  resetKey,
}: {
  title: string;
  onChange: (value: string) => void;
  resetKey: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const drawingRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;

    const resize = () => {
      const rect = wrapper.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      const old = document.createElement("canvas");
      old.width = canvas.width || 1;
      old.height = canvas.height || 1;
      const oldCtx = old.getContext("2d");
      if (oldCtx) oldCtx.drawImage(canvas, 0, 0);

      canvas.width = Math.max(1, rect.width * ratio);
      canvas.height = 260 * ratio;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = "260px";

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(ratio, ratio);
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, rect.width, 260);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "black";
      ctx.lineWidth = 8;
      ctx.drawImage(old, 0, 0, rect.width, 260);
      onChange(dataUrlFromCanvas(canvas));
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [onChange]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    if (!ctx) return;
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.strokeStyle = "black";
    ctx.lineWidth = 8;
    onChange(dataUrlFromCanvas(canvas));
  }, [resetKey, onChange]);

  const getPoint = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e && e.touches[0]) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return {
      x: (e as React.MouseEvent<HTMLCanvasElement>).clientX - rect.left,
      y: (e as React.MouseEvent<HTMLCanvasElement>).clientY - rect.top,
    };
  };

  const start = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;
    const p = getPoint(e);
    drawingRef.current = true;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };

  const move = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;
    const p = getPoint(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    onChange(dataUrlFromCanvas(canvas));
  };

  const end = () => {
    drawingRef.current = false;
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const rect = canvas?.getBoundingClientRect();
    if (!ctx || !rect || !canvas) return;
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.strokeStyle = "black";
    ctx.lineWidth = 8;
    onChange(dataUrlFromCanvas(canvas));
  };

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong>{title}</strong>
        <button onClick={clear} style={styles.subtleButton}>消す</button>
      </div>
      <div ref={wrapperRef} style={styles.canvasWrap}>
        <canvas
          ref={canvasRef}
          style={{ width: "100%", display: "block", touchAction: "none" }}
          onMouseDown={start}
          onMouseMove={move}
          onMouseUp={end}
          onMouseLeave={end}
          onTouchStart={start}
          onTouchMove={move}
          onTouchEnd={end}
        />
      </div>
    </div>
  );
}

function ProblemCard({
  problem,
  onChoose,
  revealResult,
}: {
  problem: Problem;
  onChoose: (isCorrect: boolean) => void;
  revealResult: boolean;
}) {
  const [selected, setSelected] = useState<"left" | "right" | null>(null);

  const choose = (side: "left" | "right") => {
    if (selected) return;
    setSelected(side);
    onChoose(side === problem.correctSide);
  };

  return (
    <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
      {(["left", "right"] as const).map((side, idx) => {
        const chosen = selected === side;
        const correct = problem.correctSide === side;
        return (
          <button
            key={side}
            onClick={() => choose(side)}
            style={{
              ...styles.card,
              cursor: "pointer",
              border: chosen ? "2px solid #111827" : "1px solid #d1d5db",
              textAlign: "left",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={styles.badge}>{idx === 0 ? "左" : "右"}</span>
              {revealResult && correct && <strong>○</strong>}
              {revealResult && chosen && !correct && <strong>×</strong>}
            </div>
            <div style={styles.imageBox}>
              <img src={problem[side]} alt={side} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            </div>
          </button>
        );
      })}
    </div>
  );
}

export default function Page() {
  const [authReady, setAuthReady] = useState(!isFirebaseConfigured);
  const [authError, setAuthError] = useState("");
  const [user, setUser] = useState<{ uid: string } | null>(null);
  const [screen, setScreen] = useState<"top" | "room" | "play" | "gameover" | "clear">("top");
  const [playerName, setPlayerName] = useState("");
  const [currentRoomId, setCurrentRoomId] = useState("");
  const [hostPasscodeInput, setHostPasscodeInput] = useState("");
  const [role, setRole] = useState<"host" | "guest" | null>(null);
  const [room, setRoom] = useState<RoomData | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [approvedProblems, setApprovedProblems] = useState<Problem[]>([]);
  const [leftImage, setLeftImage] = useState("");
  const [rightImage, setRightImage] = useState("");
  const [correctSide, setCorrectSide] = useState<"left" | "right">("left");
  const [submitMessage, setSubmitMessage] = useState("");
  const [playCount, setPlayCount] = useState(10);
  const [playSet, setPlaySet] = useState<Problem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [resultState, setResultState] = useState<"correct" | "wrong" | null>(null);
  const [solved, setSolved] = useState(0);
  const [hostShareUrl, setHostShareUrl] = useState("");
  const [guestShareUrl, setGuestShareUrl] = useState("");
  const [drawResetKey, setDrawResetKey] = useState(0);

  useEffect(() => {
    if (!auth) return;

    const timeout = setTimeout(() => {
      setAuthError("Firebase認証が完了しません。Firebase の Authentication で Anonymous が ON か確認してください。");
      setAuthReady(true);
    }, 8000);

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        clearTimeout(timeout);
        setAuthError("");
        setUser({ uid: currentUser.uid });
        setAuthReady(true);
        return;
      }
      try {
        await signInAnonymously(auth);
      } catch (error: any) {
        clearTimeout(timeout);
        setAuthError(`Firebase認証でエラー: ${error?.code || "unknown"}`);
        setAuthReady(true);
      }
    });

    return () => {
      clearTimeout(timeout);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!db) return;
    const { room: roomId, code, mode } = getUrlParams();
    if (!roomId || !mode) return;

    const run = async () => {
      const snap = await getDoc(doc(db, "rooms", roomId));
      if (!snap.exists()) return;
      const data = snap.data() as RoomData;
      setCurrentRoomId(roomId);
      setHostPasscodeInput(code || "");
      setHostShareUrl(buildRoleUrl("host", roomId, data.hostPasscode));
      setGuestShareUrl(buildRoleUrl("guest", roomId));
      if (mode === "host" && code && code === data.hostPasscode) {
        setRole("host");
        setScreen("room");
      } else if (mode === "guest") {
        setRole("guest");
        setScreen("room");
      }
    };

    run();
  }, []);

  useEffect(() => {
    if (!db || !currentRoomId || screen !== "room") return;

    const roomRef = doc(db, "rooms", currentRoomId);
    const unsubRoom = onSnapshot(roomRef, (snap) => {
      if (!snap.exists()) {
        setRoom(null);
        return;
      }
      setRoom({ id: snap.id, ...(snap.data() as Omit<RoomData, "id">) });
    });

    const submissionsRef = query(collection(db, "rooms", currentRoomId, "submissions"), orderBy("createdAt", "desc"));
    const unsubSubmissions = onSnapshot(submissionsRef, (snap) => {
      setSubmissions(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Submission, "id">) })));
    });

    const problemsRef = query(collection(db, "rooms", currentRoomId, "problems"), orderBy("approvedAt", "desc"));
    const unsubProblems = onSnapshot(problemsRef, (snap) => {
      setApprovedProblems(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Problem, "id">) })));
    });

    return () => {
      unsubRoom();
      unsubSubmissions();
      unsubProblems();
    };
  }, [currentRoomId, screen]);

  const createRoom = async () => {
    if (!db || !user) return;
    const host = normalizeName(playerName) || "ホスト";
    const roomId = randomId();
    const hostPasscode = randomId(8);

    await setDoc(doc(db, "rooms", roomId), {
      roomId,
      hostName: host,
      hostUid: user.uid,
      hostPasscode,
      createdAt: serverTimestamp(),
    });

    setPlayerName(host);
    setCurrentRoomId(roomId);
    setHostPasscodeInput(hostPasscode);
    setHostShareUrl(buildRoleUrl("host", roomId, hostPasscode));
    setGuestShareUrl(buildRoleUrl("guest", roomId));
    setRole("host");
    setScreen("room");
    window.history.replaceState({}, "", buildRoleUrl("host", roomId, hostPasscode));
  };

  const joinRoom = async () => {
    if (!db) return;
    const roomId = currentRoomId.trim().toUpperCase();
    if (!roomId) return;

    const snap = await getDoc(doc(db, "rooms", roomId));
    if (!snap.exists()) {
      alert("その部屋IDは見つかりません。");
      return;
    }

    const data = snap.data() as RoomData;
    const normalizedPasscode = hostPasscodeInput.trim().toUpperCase();
    const isHost = normalizedPasscode !== "" && normalizedPasscode === data.hostPasscode;

    setCurrentRoomId(roomId);
    setHostShareUrl(buildRoleUrl("host", roomId, data.hostPasscode));
    setGuestShareUrl(buildRoleUrl("guest", roomId));
    setRole(isHost ? "host" : "guest");
    setScreen("room");
    window.history.replaceState({}, "", isHost ? buildRoleUrl("host", roomId, data.hostPasscode) : buildRoleUrl("guest", roomId));
  };

  const submitProblem = async () => {
    if (!db || !room) return;
    if (!leftImage || !rightImage) {
      alert("正解と間違いの両方を書いてください。");
      return;
    }

    await addDoc(collection(db, "rooms", currentRoomId, "submissions"), {
      createdBy: normalizeName(playerName) || (role === "host" ? "ホスト" : "ゲスト"),
      createdByUid: user?.uid || "",
      left: leftImage,
      right: rightImage,
      correctSide,
      status: "pending",
      createdAt: serverTimestamp(),
    });

    setCorrectSide("left");
    setSubmitMessage("送信しました。ホストの承認を待っています。");
    setLeftImage("");
    setRightImage("");
    setDrawResetKey((v) => v + 1);
    setTimeout(() => setSubmitMessage(""), 2500);
  };

  const approveSubmission = async (submission: Submission) => {
    if (!db) return;
    await updateDoc(doc(db, "rooms", currentRoomId, "submissions", submission.id), {
      status: "approved",
    });
    await setDoc(doc(db, "rooms", currentRoomId, "problems", submission.id), {
      createdBy: submission.createdBy,
      createdByUid: submission.createdByUid || "",
      left: submission.left,
      right: submission.right,
      correctSide: submission.correctSide,
      approvedAt: serverTimestamp(),
    });
  };

  const rejectSubmission = async (submissionId: string) => {
    if (!db) return;
    await updateDoc(doc(db, "rooms", currentRoomId, "submissions", submissionId), {
      status: "rejected",
    });
  };

  const deleteApproved = async (problemId: string) => {
    if (!db) return;
    await deleteDoc(doc(db, "rooms", currentRoomId, "problems", problemId));
  };

  const startGame = (count: number) => {
    if (!approvedProblems.length) {
      alert("承認済みの問題がまだありません。");
      return;
    }
    const pool = [...approvedProblems];
    const picks: Problem[] = [];
    while (picks.length < count) {
      const item = pool[Math.floor(Math.random() * pool.length)];
      const shouldSwap = Math.random() < 0.5;
      const left = shouldSwap ? item.right : item.left;
      const right = shouldSwap ? item.left : item.right;
      const swappedCorrectSide = shouldSwap ? (item.correctSide === "left" ? "right" : "left") : item.correctSide;
      picks.push({ ...item, left, right, correctSide: swappedCorrectSide, playId: `${item.id}-${picks.length}-${Math.random()}` });
    }
    setPlayCount(count);
    setPlaySet(picks);
    setCurrentIndex(0);
    setSolved(0);
    setResultState(null);
    setScreen("play");
  };

  const currentProblem = playSet[currentIndex];

  const handleChoose = (isCorrect: boolean) => {
    setResultState(isCorrect ? "correct" : "wrong");
    if (isCorrect) {
      const nextSolved = solved + 1;
      setSolved(nextSolved);
      setTimeout(() => {
        if (currentIndex + 1 >= playSet.length) {
          setScreen("clear");
        } else {
          setCurrentIndex((index) => index + 1);
          setResultState(null);
        }
      }, 900);
    } else {
      setTimeout(() => setScreen("gameover"), 900);
    }
  };

  const leaveRoom = () => {
    setScreen("top");
    setRole(null);
    setRoom(null);
    setSubmissions([]);
    setApprovedProblems([]);
    setLeftImage("");
    setRightImage("");
    setCorrectSide("left");
    setSubmitMessage("");
    setPlaySet([]);
    setCurrentIndex(0);
    setResultState(null);
    setSolved(0);
    setHostShareUrl("");
    setGuestShareUrl("");
    setDrawResetKey((v) => v + 1);
    window.history.replaceState({}, "", window.location.pathname);
  };

  const pendingSubmissions = useMemo(
    () => submissions.filter((submission) => submission.status === "pending"),
    [submissions]
  );

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alert("コピーしました。");
    } catch {
      alert("コピーできませんでした。");
    }
  };

  if (!authReady) {
    return <div style={styles.centerScreen}>Firebase に接続しています...</div>;
  }

  if (authError) {
    return (
      <div style={styles.page}>
        <div style={styles.panel}>
          <h2>Firebase認証で止まっています</h2>
          <p>{authError}</p>
        </div>
      </div>
    );
  }

  if (screen === "top") {
    return (
      <div style={styles.page}>
        <div style={styles.heroWrap}>
          <div style={styles.heroText}>
            <div style={styles.badge}>漢字クイズゲーム Firebase版</div>
            <h1 style={{ margin: 0, fontSize: 44 }}>みんなで作って、みんなで解く。</h1>
            <p>ホストとゲストが別端末で同じ部屋に入り、問題の投稿・承認・出題を共有できます。</p>
          </div>
          <div style={styles.panel}>
            <h2 style={{ marginTop: 0 }}>はじめる</h2>
            <div style={styles.field}>
              <label>名前</label>
              <input style={styles.input} value={playerName} onChange={(e) => setPlayerName(e.target.value)} placeholder="例：りんたろう" />
            </div>
            <button style={styles.primaryButton} onClick={createRoom}>ホストとして部屋を作る</button>
            <div style={styles.separator} />
            <div style={styles.field}>
              <label>部屋ID</label>
              <input style={styles.input} value={currentRoomId} onChange={(e) => setCurrentRoomId(e.target.value.toUpperCase())} placeholder="例：AB12CD" />
            </div>
            <div style={styles.field}>
              <label>ホスト用パスコード（ホスト復帰時のみ）</label>
              <input style={styles.input} value={hostPasscodeInput} onChange={(e) => setHostPasscodeInput(e.target.value.toUpperCase())} placeholder="ゲストは空欄でOK" />
            </div>
            <button style={styles.secondaryButton} onClick={joinRoom}>入る</button>
          </div>
        </div>
      </div>
    );
  }

  if (!room) {
    return <div style={styles.centerScreen}>部屋が見つかりませんでした。</div>;
  }

  if (screen === "room") {
    return (
      <div style={styles.page}>
        <div style={{ ...styles.panel, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 16, flexWrap: "wrap" }}>
            <div>
              <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                <span style={styles.badge}>部屋ID: {room.roomId}</span>
                <span style={styles.badge}>{role === "host" ? "ホスト" : "ゲスト"}</span>
              </div>
              <h2 style={{ margin: 0 }}>{room.hostName} の部屋</h2>
              <p>承認済み問題 {approvedProblems.length} 件 / 申請中 {pendingSubmissions.length} 件</p>
            </div>
            <button style={styles.subtleButton} onClick={leaveRoom}>部屋を出る</button>
          </div>

          {role === "host" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12, marginTop: 16 }}>
              <div style={styles.box}>
                <div style={{ marginBottom: 8, fontWeight: 700 }}>ホスト用URL</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input style={styles.input} readOnly value={hostShareUrl || buildRoleUrl("host", room.roomId, room.hostPasscode)} />
                  <button style={styles.subtleButton} onClick={() => copyText(hostShareUrl || buildRoleUrl("host", room.roomId, room.hostPasscode))}>コピー</button>
                </div>
              </div>
              <div style={styles.box}>
                <div style={{ marginBottom: 8, fontWeight: 700 }}>ゲスト用URL</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input style={styles.input} readOnly value={guestShareUrl || buildRoleUrl("guest", room.roomId)} />
                  <button style={styles.subtleButton} onClick={() => copyText(guestShareUrl || buildRoleUrl("guest", room.roomId))}>コピー</button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <button style={styles.tabButton} onClick={() => setScreen("room")}>問題を作る / 解く</button>
        </div>

        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "minmax(0, 1.2fr) minmax(280px, 0.8fr)" }}>
          <div style={styles.panel}>
            <h3>問題を作る</h3>
            <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
              <DrawingPad title="正解の漢字" onChange={setLeftImage} resetKey={drawResetKey} />
              <DrawingPad title="間違いの漢字" onChange={setRightImage} resetKey={drawResetKey} />
            </div>

            <div style={{ ...styles.box, marginTop: 16 }}>
              <strong>どちらが正解かを指定</strong>
              <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
                <label><input type="radio" checked={correctSide === "left"} onChange={() => setCorrectSide("left")} /> 左が正解</label>
                <label><input type="radio" checked={correctSide === "right"} onChange={() => setCorrectSide("right")} /> 右が正解</label>
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginTop: 16 }}>
              <button style={styles.primaryButton} onClick={submitProblem}>問題を送信する</button>
              {submitMessage && <span>{submitMessage}</span>}
            </div>

            <div style={{ ...styles.box, marginTop: 24 }}>
              <h3>問題を解く</h3>
              <p>10問・30問・50問から選択します。間違えるとその時点で終了です。</p>
              <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
                {[10, 30, 50].map((count) => (
                  <button key={count} style={styles.primaryButton} onClick={() => startGame(count)}>{count}問</button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gap: 16 }}>
            {role === "host" && (
              <div style={styles.panel}>
                <h3>申請された問題の承認</h3>
                {pendingSubmissions.length === 0 && <p>まだ申請はありません。</p>}
                <div style={{ display: "grid", gap: 12 }}>
                  {pendingSubmissions.map((submission) => (
                    <div key={submission.id} style={styles.box}>
                      <div style={{ marginBottom: 8 }}>
                        <strong>投稿者: {submission.createdBy}</strong><br />
                        <span>正解: {submission.correctSide === "left" ? "左" : "右"}</span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <img src={submission.left} alt="左" style={styles.thumb} />
                        <img src={submission.right} alt="右" style={styles.thumb} />
                      </div>
                      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                        <button style={styles.primaryButton} onClick={() => approveSubmission(submission)}>許可</button>
                        <button style={styles.dangerButton} onClick={() => rejectSubmission(submission.id)}>否認</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {role === "host" && (
              <div style={styles.panel}>
                <h3>承認済みの問題</h3>
                {approvedProblems.length === 0 && <p>まだ承認済み問題はありません。</p>}
                <div style={{ display: "grid", gap: 12 }}>
                  {approvedProblems.map((problem) => (
                    <div key={problem.id} style={styles.box}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginBottom: 8 }}>
                        <div>
                          <strong>作成者: {problem.createdBy}</strong><br />
                          <span>正解: {problem.correctSide === "left" ? "左" : "右"}</span>
                        </div>
                        <button style={styles.subtleButton} onClick={() => deleteApproved(problem.id)}>削除</button>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <img src={problem.left} alt="左" style={styles.thumb} />
                        <img src={problem.right} alt="右" style={styles.thumb} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (screen === "play" && currentProblem) {
    return (
      <div style={styles.page}>
        <div style={styles.panel}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
            <div>
              <div>{playCount}問モード</div>
              <h2 style={{ margin: 0 }}>第 {currentIndex + 1} 問</h2>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span style={styles.badge}>正解数 {solved}</span>
              <span style={styles.badge}>残り {playSet.length - currentIndex}</span>
            </div>
          </div>

          <div style={styles.box}>
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <h3>正しい漢字をえらんでください</h3>
              <p>問題作成者: {currentProblem.createdBy}</p>
            </div>
            <ProblemCard key={currentProblem.playId} problem={currentProblem} onChoose={handleChoose} revealResult={!!resultState} />
            {resultState && (
              <div style={{ textAlign: "center", marginTop: 16, fontSize: 24, fontWeight: 700 }}>
                {resultState === "correct" ? "○ 正解" : "× 不正解"}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (screen === "gameover") {
    return (
      <div style={styles.centerScreen}>
        <div style={styles.panel}>
          <h2>ゲーム終了</h2>
          <p>解けた問題数: {solved}</p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <button style={styles.primaryButton} onClick={() => setScreen("room")}>部屋へ戻る</button>
            <button style={styles.subtleButton} onClick={() => startGame(playCount)}>もう一度挑戦</button>
          </div>
        </div>
      </div>
    );
  }

  if (screen === "clear") {
    return (
      <div style={styles.centerScreen}>
        <div style={styles.panel}>
          <h2>クリア！</h2>
          <p>{playCount}問すべて正解しました。</p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <button style={styles.primaryButton} onClick={() => setScreen("room")}>部屋へ戻る</button>
            <button style={styles.subtleButton} onClick={() => startGame(playCount)}>もう一度遊ぶ</button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f8fafc",
    padding: 24,
    fontFamily: "Arial, sans-serif",
    color: "#111827",
  },
  centerScreen: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    background: "#f8fafc",
    padding: 24,
    fontFamily: "Arial, sans-serif",
  },
  heroWrap: {
    maxWidth: 1200,
    margin: "0 auto",
    display: "grid",
    gap: 24,
    gridTemplateColumns: "minmax(0, 1.2fr) minmax(320px, 0.8fr)",
  },
  heroText: {
    background: "white",
    borderRadius: 24,
    padding: 32,
    boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
    display: "grid",
    gap: 16,
  },
  panel: {
    background: "white",
    borderRadius: 24,
    padding: 24,
    boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
  },
  box: {
    border: "1px solid #d1d5db",
    borderRadius: 16,
    padding: 16,
    background: "#fff",
  },
  badge: {
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: 999,
    background: "#e5e7eb",
    fontSize: 14,
  },
  field: {
    display: "grid",
    gap: 6,
    marginBottom: 12,
  },
  input: {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    fontSize: 16,
    boxSizing: "border-box",
  },
  primaryButton: {
    padding: "12px 16px",
    borderRadius: 14,
    border: "none",
    background: "#111827",
    color: "white",
    fontSize: 16,
    cursor: "pointer",
  },
  secondaryButton: {
    padding: "12px 16px",
    borderRadius: 14,
    border: "none",
    background: "#475569",
    color: "white",
    fontSize: 16,
    cursor: "pointer",
    width: "100%",
  },
  subtleButton: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    background: "white",
    cursor: "pointer",
  },
  dangerButton: {
    padding: "12px 16px",
    borderRadius: 14,
    border: "none",
    background: "#dc2626",
    color: "white",
    fontSize: 16,
    cursor: "pointer",
  },
  separator: {
    height: 1,
    background: "#e5e7eb",
    margin: "16px 0",
  },
  canvasWrap: {
    border: "1px solid #d1d5db",
    borderRadius: 16,
    overflow: "hidden",
    background: "white",
  },
  imageBox: {
    width: "100%",
    aspectRatio: "1 / 1",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    overflow: "hidden",
    background: "#f8fafc",
  },
  thumb: {
    width: "100%",
    aspectRatio: "1 / 1",
    objectFit: "contain",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    background: "#f8fafc",
  },
  tabButton: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    background: "white",
    cursor: "pointer",
  },
};
