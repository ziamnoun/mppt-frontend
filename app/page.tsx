"use client";
import { useEffect, useRef, useState } from "react";
import Dashboard from "../components/Dashboard";
import ControlPanel from "../components/ControlPanel";
import { MPPTData } from "../types/mppt";

export default function Home() {
  const wsRef = useRef<WebSocket | null>(null);
  const [data, setData] = useState<MPPTData | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket = new WebSocket("ws://localhost:8080");
    wsRef.current = socket;

    socket.onopen = () => setConnected(true);
    socket.onclose = () => setConnected(false);
    socket.onerror = () => setConnected(false);

    socket.onmessage = (e) => {
      try {
        const parsed: MPPTData = JSON.parse(e.data);
        setData(parsed);
      } catch {}
    };

    return () => socket.close();
  }, []);

  return (
    <main className="p-6 max-w-6xl mx-auto">
      <h1 className="text-4xl font-bold mb-4 text-white">MPPT Real Time Controll and Monitor</h1>
      <p className={`font-semibold mb-6 ${connected?"text-green-400":"text-red-500"}`}>
        {connected ? "Connected ✅" : "Not connected ❌"}
      </p>

      
      <ControlPanel wsRef={wsRef} mode={data?.mode} />
      <Dashboard  />
    </main>
  );
}
