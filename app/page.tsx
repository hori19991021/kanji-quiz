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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, XCircle, Users, Pencil, PlayCircle, ShieldCheck, Send, Trash2, RotateCcw, Copy } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Firebase 本番版
 * 1. Firebase コンソールで Web アプリを追加
 * 2. 下の firebaseConfig を自分の値に置き換える
 * 3. Authentication で Anonymous を有効化
 * 4. Firestore Database を作成
 */
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

function normalizeName(name) {
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

function buildRoleUrl(role, roomId, passcode = "") {
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

function dataUrlFromCanvas(canvas) {
  return canvas.toDataURL("image/png");
}

function DrawingPad({ title, onChange, resetKey }) {
  const canvasRef = useRef(null);
  const wrapperRef = useRef(null);
  const drawingRef = useRef(false);
  const [hasDrawn, setHasDrawn] = useState(false);

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
      oldCtx?.drawImage(canvas, 0, 0);

      canvas.width = rect.width * ratio;
      canvas.height = 260 * ratio;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `260px`;

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
      onChange?.(dataUrlFromCanvas(canvas));
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
    setHasDrawn(false);
    onChange?.(dataUrlFromCanvas(canvas));
  }, [resetKey, onChange]);

  const getPoint = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e && e.touches[0]) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const start = (e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;
    const p = getPoint(e);
    drawingRef.current = true;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };

  const move = (e) => {
    if (!drawingRef.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;
    const p = getPoint(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    setHasDrawn(true);
    onChange?.(dataUrlFromCanvas(canvas));
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
    setHasDrawn(false);
    onChange?.(dataUrlFromCanvas(canvas));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">{title}</Label>
        <Button variant="outline" size="sm" onClick={clear}>
          <RotateCcw className="mr-2 h-4 w-4" /> 消す
        </Button>
      </div>
      <div ref={wrapperRef} className="rounded-2xl border bg-white shadow-sm overflow-hidden touch-none">
        <canvas
          ref={canvasRef}
          className="block w-full touch-none"
          onMouseDown={start}
          onMouseMove={move}
          onMouseUp={end}
          onMouseLeave={end}
          onTouchStart={start}
          onTouchMove={move}
          onTouchEnd={end}
        />
      </div>
      <p className="text-sm text-muted-foreground">
        {hasDrawn ? "書き込み済み" : "ここに漢字を書いてください"}
      </p>
    </div>
  );
}

function ProblemCard({ problem, onChoose, revealResult }) {
  const [selected, setSelected] = useState(null);

  const choose = (side) => {
    if (selected) return;
    setSelected(side);
    onChoose(side === problem.correctSide);
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {["left", "right"].map((side, idx) => {
        const image = problem[side];
        const chosen = selected === side;
        const correct = problem.correctSide === side;
        const showCorrect = revealResult && correct;
        const showWrong = revealResult && chosen && !correct;

        return (
          <motion.button
            key={side}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className={`relative overflow-hidden rounded-2xl border bg-white p-3 shadow-sm transition ${
              chosen ? "ring-2 ring-black" : ""
            }`}
            onClick={() => choose(side)}
          >
            <div className="mb-2 flex items-center justify-between">
              <Badge variant="secondary">{idx === 0 ? "左" : "右"}</Badge>
              {showCorrect && <CheckCircle2 className="h-6 w-6" />}
              {showWrong && <XCircle className="h-6 w-6" />}
            </div>
            <div className="aspect-square w-full overflow-hidden rounded-xl border bg-slate-50">
              <img src={image} alt={`${idx === 0 ? "左" : "右"}の漢字`} className="h-full w-full object-contain" />
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}

export default function KanjiQuizGamePrototype() {
  const [authReady, setAuthReady] = useState(!isFirebaseConfigured);
  const [authError, setAuthError] = useState("");
  const [user, setUser] = useState(null);
  const [screen, setScreen] = useState("top");
  const [playerName, setPlayerName] = useState("");
  const [currentRoomId, setCurrentRoomId] = useState("");
  const [hostPasscodeInput, setHostPasscodeInput] = useState("");
  const [role, setRole] = useState(null);
  const [room, setRoom] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [approvedProblems, setApprovedProblems] = useState([]);
  const [leftImage, setLeftImage] = useState("");
  const [rightImage, setRightImage] = useState("");
  const [correctSide, setCorrectSide] = useState("left");
  const [submitMessage, setSubmitMessage] = useState("");
  const [playCount, setPlayCount] = useState(10);
  const [playSet, setPlaySet] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [resultState, setResultState] = useState(null);
  const [solved, setSolved] = useState(0);
  const [hostShareUrl, setHostShareUrl] = useState("");
  const [guestShareUrl, setGuestShareUrl] = useState("");
  const [drawResetKey, setDrawResetKey] = useState(0);

  useEffect(() => {
    if (!auth) return;

    const timeout = setTimeout(() => {
      setAuthError("Firebase認証が完了しません。ChatGPTのプレビュー上では認証ドメイン制限で動かないことがあります。公開URLやローカル環境で開いて試してください。");
      setAuthReady(true);
    }, 8000);

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        clearTimeout(timeout);
        setAuthError("");
        setUser(currentUser);
        setAuthReady(true);
        return;
      }
      try {
        await signInAnonymously(auth);
      } catch (error) {
        console.error(error);
        clearTimeout(timeout);
        setAuthError(
          `Firebase認証でエラーが出ました: ${error?.code || "unknown"}。ChatGPTのプレビュー上では認証ドメイン制限で動かないことがあります。公開URLやローカル環境で試してください。`
        );
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

    const tryJoinFromUrl = async () => {
      const snap = await getDoc(doc(db, "rooms", roomId));
      if (!snap.exists()) return;
      const data = snap.data();
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

    tryJoinFromUrl();
  }, []);

  useEffect(() => {
    if (!db || !currentRoomId || screen !== "room") return;

    const roomRef = doc(db, "rooms", currentRoomId);
    const unsubscribeRoom = onSnapshot(roomRef, (snap) => {
      if (!snap.exists()) {
        setRoom(null);
        return;
      }
      setRoom({ id: snap.id, ...snap.data() });
    });

    const submissionsRef = query(
      collection(db, "rooms", currentRoomId, "submissions"),
      orderBy("createdAt", "desc")
    );
    const unsubscribeSubmissions = onSnapshot(submissionsRef, (snap) => {
      setSubmissions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    const problemsRef = query(
      collection(db, "rooms", currentRoomId, "problems"),
      orderBy("approvedAt", "desc")
    );
    const unsubscribeProblems = onSnapshot(problemsRef, (snap) => {
      setApprovedProblems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubscribeRoom();
      unsubscribeSubmissions();
      unsubscribeProblems();
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

    const data = snap.data();
    const normalizedPasscode = hostPasscodeInput.trim().toUpperCase();
    const isHost = normalizedPasscode !== "" && normalizedPasscode === data.hostPasscode;

    setCurrentRoomId(roomId);
    setHostShareUrl(buildRoleUrl("host", roomId, data.hostPasscode));
    setGuestShareUrl(buildRoleUrl("guest", roomId));
    setRole(isHost ? "host" : "guest");
    setScreen("room");
    window.history.replaceState(
      {},
      "",
      isHost ? buildRoleUrl("host", roomId, data.hostPasscode) : buildRoleUrl("guest", roomId)
    );
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

  const approveSubmission = async (submission) => {
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

  const rejectSubmission = async (submissionId) => {
    if (!db) return;
    await updateDoc(doc(db, "rooms", currentRoomId, "submissions", submissionId), {
      status: "rejected",
    });
  };

  const deleteApproved = async (problemId) => {
    if (!db) return;
    await deleteDoc(doc(db, "rooms", currentRoomId, "problems", problemId));
  };

  const startGame = (count) => {
    if (!approvedProblems.length) {
      alert("承認済みの問題がまだありません。");
      return;
    }

    const pool = [...approvedProblems];
    const picks = [];
    while (picks.length < count) {
      const item = pool[Math.floor(Math.random() * pool.length)];
      const shouldSwap = Math.random() < 0.5;
      const left = shouldSwap ? item.right : item.left;
      const right = shouldSwap ? item.left : item.right;
      const swappedCorrectSide = shouldSwap
        ? item.correctSide === "left"
          ? "right"
          : "left"
        : item.correctSide;

      picks.push({
        ...item,
        left,
        right,
        correctSide: swappedCorrectSide,
        playId: `${item.id}-${picks.length}-${Math.random()}`,
      });
    }

    setPlayCount(count);
    setPlaySet(picks);
    setCurrentIndex(0);
    setSolved(0);
    setResultState(null);
    setScreen("play");
  };

  const currentProblem = playSet[currentIndex];

  const handleChoose = (isCorrect) => {
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

  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      alert("コピーしました。");
    } catch {
      alert("コピーできませんでした。");
    }
  };

  if (!isFirebaseConfigured) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 md:p-8">
        <div className="mx-auto max-w-4xl">
          <Card className="rounded-3xl shadow-xl">
            <CardHeader>
              <CardTitle>Firebase 設定を入れると本番版になります</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-7">
              <p>コード先頭の <code>firebaseConfig</code> を、自分の Firebase コンソールで取得した値に置き換えてください。</p>
              <div className="rounded-2xl border bg-white p-4 font-mono text-xs overflow-auto">
                {`const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "...",
};`}
              </div>
              <p>そのうえで、Authentication の Anonymous を ON、Firestore Database を作成すると、別端末どうしで同じ部屋を共有できます。</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!authReady) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-50 p-6">
        <Card className="rounded-3xl shadow-xl">
          <CardContent className="p-8 text-center">Firebase に接続しています...</CardContent>
        </Card>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 md:p-8">
        <div className="mx-auto max-w-3xl">
          <Card className="rounded-3xl shadow-xl">
            <CardHeader>
              <CardTitle>Firebase認証で止まっています</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-7">
              <p>{authError}</p>
              <div className="rounded-2xl border bg-white p-4">
                <p className="font-medium">次のどちらかで進めてください</p>
                <p>1. Vercelなどに公開して、そのURLで開く</p>
                <p>2. 自分のPCでローカル起動してブラウザで開く</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (screen === "top") {
    return (
      <div className="min-h-screen bg-slate-50 p-4 md:p-8">
        <div className="mx-auto max-w-5xl space-y-6">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="rounded-3xl border-0 shadow-xl">
              <CardContent className="grid gap-6 p-6 md:grid-cols-[1.2fr_0.8fr] md:p-10">
                <div className="space-y-4">
                  <Badge className="rounded-full px-3 py-1 text-sm">漢字クイズゲーム Firebase版</Badge>
                  <h1 className="text-3xl font-bold tracking-tight md:text-5xl">みんなで作って、みんなで解く。</h1>
                  <p className="text-base text-muted-foreground md:text-lg">
                    ホストとゲストが別端末で同じ部屋に入り、問題の投稿・承認・出題がリアルタイムで同期します。
                  </p>
                  <p className="text-sm text-muted-foreground">
                    ホスト用URLとゲスト用URLを分けています。ゲストは承認済み問題一覧を見られません。
                  </p>
                </div>

                <Card className="rounded-3xl shadow-md">
                  <CardHeader>
                    <CardTitle>はじめる</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="space-y-2">
                      <Label>名前</Label>
                      <Input value={playerName} onChange={(e) => setPlayerName(e.target.value)} placeholder="例：りんたろう" />
                    </div>

                    <Separator />

                    <div className="space-y-3">
                      <Button className="w-full rounded-2xl" size="lg" onClick={createRoom}>
                        <Users className="mr-2 h-5 w-5" />
                        ホストとして部屋を作る
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <Label>部屋IDを入力して参加</Label>
                      <Input
                        value={currentRoomId}
                        onChange={(e) => setCurrentRoomId(e.target.value.toUpperCase())}
                        placeholder="例：AB12CD"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>ホスト用パスコード（ホスト復帰時のみ）</Label>
                      <Input
                        value={hostPasscodeInput}
                        onChange={(e) => setHostPasscodeInput(e.target.value.toUpperCase())}
                        placeholder="ゲストは空欄のままでOK"
                      />
                      <Button variant="secondary" className="w-full rounded-2xl" onClick={joinRoom}>
                        入る
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen grid place-items-center p-6 bg-slate-50">
        <Card className="max-w-md rounded-3xl">
          <CardContent className="space-y-4 p-6 text-center">
            <p>部屋が見つかりませんでした。</p>
            <Button onClick={() => setScreen("top")}>トップへ戻る</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (screen === "room") {
    return (
      <div className="min-h-screen bg-slate-50 p-4 md:p-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <Card className="rounded-3xl shadow-lg">
            <CardContent className="flex flex-col gap-4 p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <Badge variant="outline">部屋ID: {room.roomId}</Badge>
                    <Badge>{role === "host" ? "ホスト" : "ゲスト"}</Badge>
                  </div>
                  <h2 className="text-2xl font-bold">{room.hostName} の部屋</h2>
                  <p className="text-muted-foreground">承認済み問題 {approvedProblems.length} 件 / 申請中 {pendingSubmissions.length} 件</p>
                </div>
                <Button variant="outline" className="rounded-2xl" onClick={leaveRoom}>
                  部屋を出る
                </Button>
              </div>

              {role === "host" && (
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border bg-white p-3">
                    <p className="mb-1 text-sm font-medium">ホスト用URL</p>
                    <div className="flex gap-2">
                      <Input readOnly value={hostShareUrl || buildRoleUrl("host", room.roomId, room.hostPasscode)} />
                      <Button variant="outline" onClick={() => copyText(hostShareUrl || buildRoleUrl("host", room.roomId, room.hostPasscode))}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="rounded-2xl border bg-white p-3">
                    <p className="mb-1 text-sm font-medium">ゲスト用URL</p>
                    <div className="flex gap-2">
                      <Input readOnly value={guestShareUrl || buildRoleUrl("guest", room.roomId)} />
                      <Button variant="outline" onClick={() => copyText(guestShareUrl || buildRoleUrl("guest", room.roomId))}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Tabs defaultValue="create" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2 rounded-2xl h-12">
              <TabsTrigger value="create" className="rounded-xl">
                <Pencil className="mr-2 h-4 w-4" /> 問題を作る
              </TabsTrigger>
              <TabsTrigger value="solve" className="rounded-xl">
                <PlayCircle className="mr-2 h-4 w-4" /> 問題を解く
              </TabsTrigger>
            </TabsList>

            <TabsContent value="create" className="space-y-6">
              <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                <Card className="rounded-3xl shadow-md">
                  <CardHeader>
                    <CardTitle>問題を作る</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid gap-6 lg:grid-cols-2">
                      <DrawingPad title="正解の漢字" onChange={setLeftImage} resetKey={drawResetKey} />
                      <DrawingPad title="間違いの漢字" onChange={setRightImage} resetKey={drawResetKey} />
                    </div>

                    <div className="space-y-3 rounded-2xl border p-4">
                      <Label className="text-base font-semibold">どちらが正解かを指定</Label>
                      <RadioGroup value={correctSide} onValueChange={setCorrectSide} className="flex gap-6">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="left" id="left" />
                          <Label htmlFor="left">左が正解</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="right" id="right" />
                          <Label htmlFor="right">右が正解</Label>
                        </div>
                      </RadioGroup>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <Button className="rounded-2xl" onClick={submitProblem}>
                        <Send className="mr-2 h-4 w-4" /> 問題を送信する
                      </Button>
                      {submitMessage && <span className="text-sm text-muted-foreground">{submitMessage}</span>}
                    </div>
                  </CardContent>
                </Card>

                <div className="space-y-6">
                  {role === "host" && (
                    <Card className="rounded-3xl shadow-md">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <ShieldCheck className="h-5 w-5" /> 申請された問題の承認
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {pendingSubmissions.length === 0 && <p className="text-sm text-muted-foreground">まだ申請はありません。</p>}
                        {pendingSubmissions.map((submission) => (
                          <div key={submission.id} className="space-y-3 rounded-2xl border p-3">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="font-medium">投稿者: {submission.createdBy}</p>
                                <p className="text-sm text-muted-foreground">正解: {submission.correctSide === "left" ? "左" : "右"}</p>
                              </div>
                              <Badge>申請中</Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <img src={submission.left} alt="左" className="aspect-square rounded-xl border bg-white object-contain" />
                              <img src={submission.right} alt="右" className="aspect-square rounded-xl border bg-white object-contain" />
                            </div>
                            <div className="flex gap-2">
                              <Button className="rounded-2xl" onClick={() => approveSubmission(submission)}>
                                許可
                              </Button>
                              <Button variant="destructive" className="rounded-2xl" onClick={() => rejectSubmission(submission.id)}>
                                否認
                              </Button>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {role === "host" && (
                    <Card className="rounded-3xl shadow-md">
                      <CardHeader>
                        <CardTitle>承認済みの問題</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {approvedProblems.length === 0 && <p className="text-sm text-muted-foreground">まだ承認済み問題はありません。</p>}
                        {approvedProblems.map((problem) => (
                          <div key={problem.id} className="rounded-2xl border p-3">
                            <div className="mb-3 flex items-center justify-between">
                              <div>
                                <p className="font-medium">作成者: {problem.createdBy}</p>
                                <p className="text-sm text-muted-foreground">正解: {problem.correctSide === "left" ? "左" : "右"}</p>
                              </div>
                              <Button variant="outline" size="sm" onClick={() => deleteApproved(problem.id)}>
                                <Trash2 className="mr-2 h-4 w-4" /> 削除
                              </Button>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <img src={problem.left} alt="左" className="aspect-square rounded-xl border bg-white object-contain" />
                              <img src={problem.right} alt="右" className="aspect-square rounded-xl border bg-white object-contain" />
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="solve">
              <Card className="rounded-3xl shadow-md">
                <CardHeader>
                  <CardTitle>問題を解く</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <p className="text-muted-foreground">10問・30問・50問から選択します。間違えるとその時点で終了です。</p>
                  <div className="grid gap-4 sm:grid-cols-3">
                    {[10, 30, 50].map((count) => (
                      <Button key={count} className="h-16 rounded-2xl text-lg" onClick={() => startGame(count)}>
                        {count}問
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    );
  }

  if (screen === "play" && currentProblem) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 md:p-8">
        <div className="mx-auto max-w-5xl space-y-6">
          <Card className="rounded-3xl shadow-lg">
            <CardContent className="flex flex-col gap-3 p-6 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{playCount}問モード</p>
                <h2 className="text-2xl font-bold">第 {currentIndex + 1} 問</h2>
              </div>
              <div className="flex gap-2">
                <Badge variant="secondary">正解数 {solved}</Badge>
                <Badge variant="outline">残り {playSet.length - currentIndex}</Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl shadow-md">
            <CardContent className="space-y-6 p-6">
              <div className="space-y-2 text-center">
                <h3 className="text-xl font-semibold">正しい漢字をえらんでください</h3>
                <p className="text-sm text-muted-foreground">問題作成者: {currentProblem.createdBy}</p>
              </div>
              <ProblemCard key={currentProblem.playId} problem={currentProblem} onChoose={handleChoose} revealResult={!!resultState} />
              <AnimatePresence>
                {resultState && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-center"
                  >
                    <div className={`inline-flex items-center gap-2 rounded-full px-5 py-3 text-xl font-bold ${
                      resultState === "correct" ? "bg-emerald-100" : "bg-rose-100"
                    }`}>
                      {resultState === "correct" ? <CheckCircle2 /> : <XCircle />}
                      {resultState === "correct" ? "○ 正解" : "× 不正解"}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (screen === "gameover") {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-50 p-4">
        <Card className="w-full max-w-xl rounded-3xl shadow-xl">
          <CardContent className="space-y-5 p-8 text-center">
            <XCircle className="mx-auto h-16 w-16" />
            <h2 className="text-3xl font-bold">ゲーム終了</h2>
            <p className="text-lg">解けた問題数: <span className="font-bold">{solved}</span></p>
            <div className="flex justify-center gap-3">
              <Button className="rounded-2xl" onClick={() => setScreen("room")}>部屋へ戻る</Button>
              <Button variant="outline" className="rounded-2xl" onClick={() => startGame(playCount)}>もう一度挑戦</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (screen === "clear") {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-50 p-4">
        <Card className="w-full max-w-xl rounded-3xl shadow-xl">
          <CardContent className="space-y-5 p-8 text-center">
            <CheckCircle2 className="mx-auto h-16 w-16" />
            <h2 className="text-3xl font-bold">クリア！</h2>
            <p className="text-lg"><span className="font-bold">{playCount}問</span> すべて正解しました。</p>
            <div className="flex justify-center gap-3">
              <Button className="rounded-2xl" onClick={() => setScreen("room")}>部屋へ戻る</Button>
              <Button variant="outline" className="rounded-2xl" onClick={() => startGame(playCount)}>もう一度遊ぶ</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}
