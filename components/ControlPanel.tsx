"use client";
import { Dispatch, SetStateAction } from "react";

interface ControlProps {
  wsRef: React.RefObject<WebSocket | null>;
  mode: "a" | "m" | undefined;
}

export default function ControlPanel({ wsRef, mode }: ControlProps) {
  const sendCmd = (cmd: string) => {
    wsRef.current?.send(cmd);
  };

  return (
    <div className="my-6 p-4 bg-slate-800 rounded-xl shadow-md flex flex-col md:flex-row gap-4">
      <button className={`px-4 py-2 rounded-md ${mode==="a"?"bg-green-500":"bg-gray-600"}`} onClick={()=>sendCmd("a")}>AUTO</button>
      <button className={`px-4 py-2 rounded-md ${mode==="m"?"bg-yellow-400":"bg-gray-600"}`} onClick={()=>sendCmd("m")}>MANUAL</button>
      <div className="flex gap-2">
        {[1,2,3,4,5].map((lvl)=>(
          <button key={lvl} className="px-3 py-1 bg-gray-700 rounded-md hover:bg-gray-600" onClick={()=>sendCmd(lvl.toString())}>{lvl}</button>
        ))}
      </div>
    </div>
  );
}
