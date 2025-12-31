
// "use client";

// import { useEffect, useState, useRef } from "react";
// import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";

// interface MPPTData {
//   mode: string;
//   mainV: number;
//   mpptV: number;
//   targetV?: number;
//   current: number;
//   power: number;
//   pwm: number;
//   time?: string; // for chart x-axis
// }

// export default function Dashboard() {
//   const [data, setData] = useState<MPPTData | null>(null);
//   const [history, setHistory] = useState<MPPTData[]>([]);
//   const [sliderValue, setSliderValue] = useState(150); // PWM slider
//   const wsRef = useRef<WebSocket | null>(null);

//   // WebSocket connection
//   useEffect(() => {
//     const socket = new WebSocket("ws://localhost:8080");
//     wsRef.current = socket;

//     socket.onopen = () => console.log("WebSocket connected");
//     socket.onerror = (err) => console.error("WebSocket error", err);

//     socket.onmessage = (msg) => {
//       try {
//         const parsed: MPPTData = JSON.parse(msg.data);

//         // Add timestamp for chart
//         const timestamped = { ...parsed, time: new Date().toLocaleTimeString() };

//         setData(timestamped);
//         setHistory((prev) => [...prev.slice(-29), timestamped]); // keep last 30 points
//       } catch (e) {
//         console.error("Failed to parse data", e);
//       }
//     };

//     return () => socket.close();
//   }, []);

//   // Handle manual slider change
//   const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
//     const val = parseInt(e.target.value);
//     setSliderValue(val);
//     wsRef.current?.send(val.toString()); // send PWM value to backend
//   };

//   // Reset to AUTO
//   const resetToAuto = () => {
//     wsRef.current?.send("a");
//   };

//   // Calculate target voltage dynamically for manual mode if undefined
//   const targetV =
//     data?.targetV ??
//     (data?.mode === "m" && data?.mpptV ? data.mpptV * 1.05 : undefined);

//   // Calculate error %
//   const error =
//     targetV !== undefined && data
//       ? ((targetV - data.mpptV) / targetV) * 100
//       : undefined;

//   // Helper to show value or "-"
//   const showValue = (val: number | undefined, unit?: string) =>
//     val !== undefined ? `${val.toFixed(2)}${unit ? " " + unit : ""}` : "-";

//   return (
//     <div className="min-h-screen p-6 bg-gray-900 text-white font-sans">
//       <h1 className="text-3xl font-bold mb-6 text-center">MPPT Digital Twin</h1>

//       {/* Mode & Control */}
//       <div className="flex flex-col md:flex-row justify-between mb-6 gap-4">
//         <div className="bg-gray-800 p-4 rounded-lg shadow-md flex-1">
//           <h2 className="text-xl font-semibold mb-2">Mode</h2>
//           <p
//             className={`text-2xl font-bold ${
//               data?.mode === "a" ? "text-green-400" : "text-yellow-400"
//             }`}
//           >
//             {data?.mode === "a" ? "AUTO" : "MANUAL"}
//           </p>

//           {data?.mode === "m" && (
//             <>
//               <h3 className="mt-4">PWM Control</h3>
//               <input
//                 type="range"
//                 min={60}
//                 max={255}
//                 value={sliderValue}
//                 onChange={handleSliderChange}
//                 className="w-full mt-2"
//               />
//               <p>Value: {sliderValue}</p>
//               <button
//                 className="mt-4 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
//                 onClick={resetToAuto}
//               >
//                 Reset to Auto
//               </button>
//             </>
//           )}
//         </div>

//         {/* Summary Boxes */}
//         <div className="flex flex-wrap flex-1 gap-4">
//           <Card title="Main Voltage" value={showValue(data?.mainV, "V")} />
//           <Card title="MPPT Voltage" value={showValue(data?.mpptV, "V")} />
//           <Card title="Target Voltage" value={showValue(targetV, "V")} />
//           <Card
//             title="Error %"
//             value={error !== undefined ? `${error.toFixed(2)} %` : "-"}
//             color={error !== undefined && Math.abs(error) < 2 ? "green" : "red"}
//           />
//           <Card title="Current" value={showValue(data?.current, "mA")} />
//           <Card title="Power" value={showValue(data?.power, "W")} />
//           <Card title="PWM" value={data?.pwm !== undefined ? data.pwm.toString() : "-"} />
//         </div>
//       </div>

//       {/* Graphs */}
//       <div className="bg-gray-800 p-4 rounded-lg shadow-md">
//         <h2 className="text-xl font-semibold mb-4">Trends</h2>
//         <ResponsiveContainer width="100%" height={300}>
//           <LineChart data={history}>
//             <XAxis dataKey="time" />
//             <YAxis />
//             <Tooltip />
//             <Legend />
//             <Line
//               type="monotone"
//               dataKey="mpptV"
//               name="MPPT Voltage"
//               stroke="#4ade80"
//               dot={false}
//             />
//             <Line
//               type="monotone"
//               dataKey="targetV"
//               name="Target Voltage"
//               stroke="#facc15"
//               dot={false}
//             />
//             <Line
//               type="monotone"
//               dataKey="current"
//               name="Current (mA)"
//               stroke="#60a5fa"
//               dot={false}
//             />
//             <Line
//               type="monotone"
//               dataKey="power"
//               name="Power (W)"
//               stroke="#f87171"
//               dot={false}
//             />
//           </LineChart>
//         </ResponsiveContainer>
//       </div>
//     </div>
//   );
// }

// // Card Component
// function Card({
//   title,
//   value,
//   color,
// }: {
//   title: string;
//   value: string;
//   color?: string;
// }) {
//   return (
//     <div className={`bg-gray-700 p-4 rounded-lg shadow flex-1 min-w-[120px]`}>
//       <h3 className="text-md font-medium">{title}</h3>
//       <p
//         className={`text-xl font-bold mt-2 ${
//           color === "red"
//             ? "text-red-400"
//             : color === "green"
//             ? "text-green-400"
//             : "text-white"
//         }`}
//       >
//         {value}
//       </p>
//     </div>
//   );
// }


"use client";

import { useEffect, useState, useRef } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface MPPTData {
  mode: string;
  mainV: number;
  mpptV: number;
  targetV: number;
  current: number;
  power: number;
  pwm: number;
  time: string;
}

export default function Dashboard() {
  const [data, setData] = useState<MPPTData | null>(null);
  const [history, setHistory] = useState<MPPTData[]>([]);
  const [sliderValue, setSliderValue] = useState(150);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const socket = new WebSocket("ws://localhost:8080");
    wsRef.current = socket;

    socket.onopen = () => console.log("WebSocket connected");
    socket.onerror = (err) => console.error("WebSocket error", err);

    socket.onmessage = (msg) => {
      try {
        const parsed = JSON.parse(msg.data);

        const timestamped: MPPTData = {
          mode: parsed.mode ?? "a",
          mainV: parsed.mainV ?? 0,
          mpptV: parsed.mpptV ?? 0,
          targetV: parsed.targetV ?? 0,
          current: parsed.current ?? 0,
          power: parsed.power ?? 0,
          pwm: parsed.pwm ?? 0,
          time: new Date().toLocaleTimeString(),
        };

        setData(timestamped);
        setHistory((prev) => [...prev.slice(-29), timestamped]);
      } catch (e) {
        console.error("Failed to parse data", e);
      }
    };

    return () => socket.close();
  }, []);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    setSliderValue(val);
    wsRef.current?.send(val.toString());
  };

  const resetToAuto = () => {
    wsRef.current?.send("a");
  };

  const showValue = (val: number | undefined, unit?: string) =>
    val !== undefined ? `${val.toFixed(2)}${unit ? " " + unit : ""}` : "-";

  return (
    <div className="min-h-screen p-6 bg-gray-900 text-white font-sans">
      <h1 className="text-3xl font-bold mb-6 text-center">MPPT Digital Twin</h1>

      {/* Mode & Control */}
      <div className="flex flex-col md:flex-row justify-between mb-6 gap-4">
        <div className="bg-gray-800 p-4 rounded-lg shadow-md flex-1">
          <h2 className="text-xl font-semibold mb-2">Mode</h2>
          <p
            className={`text-2xl font-bold ${
              data?.mode === "a" ? "text-green-400" : "text-yellow-400"
            }`}
          >
            {data?.mode === "a" ? "AUTO" : "MANUAL"}
          </p>

          {data?.mode === "m" && (
            <>
              <h3 className="mt-4">PWM Control</h3>
              <input
                type="range"
                min={60}
                max={255}
                value={sliderValue}
                onChange={handleSliderChange}
                className="w-full mt-2"
              />
              <p>Value: {sliderValue}</p>
              <button
                className="mt-4 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
                onClick={resetToAuto}
              >
                Reset to Auto
              </button>
            </>
          )}
        </div>

        {/* Summary Boxes */}
        <div className="flex flex-wrap flex-1 gap-4">
          <Card title="Main Voltage" value={showValue(data?.mainV, "V")} />
          <Card title="MPPT Voltage" value={showValue(data?.mpptV, "V")} />
          <Card title="Target Voltage" value={showValue(data?.targetV, "V")} />
          <Card
            title="Error %"
            value={
              data
                ? `${((data.targetV - data.mpptV) / data.targetV * 100).toFixed(
                    2
                  )} %`
                : "-"
            }
            color={
              data &&
              Math.abs((data.targetV - data.mpptV) / data.targetV * 100) < 2
                ? "green"
                : "red"
            }
          />
          <Card title="Current" value={showValue(data?.current, "mA")} />
          <Card title="Power" value={showValue(data?.power, "W")} />
          <Card title="PWM" value={data?.pwm?.toString() ?? "-"} />
        </div>
      </div>

      {/* Current Graph */}
      <div className="bg-gray-800 p-4 rounded-lg shadow-md mb-6">
        <h2 className="text-xl font-semibold mb-4">Current Trend (mA)</h2>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={history}>
            <XAxis dataKey="time" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="current"
              name="Current (mA)"
              stroke="#60a5fa"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Other Graphs: MPPT Voltage, Target Voltage, Power */}
      <div className="bg-gray-800 p-4 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4">MPPT & Power Trends</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={history}>
            <XAxis dataKey="time" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="mpptV"
              name="MPPT Voltage"
              stroke="#4ade80"
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="targetV"
              name="Target Voltage"
              stroke="#facc15"
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="power"
              name="Power (W)"
              stroke="#f87171"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function Card({ title, value, color }: { title: string; value: string; color?: string }) {
  return (
    <div className={`bg-gray-700 p-4 rounded-lg shadow flex-1 min-w-[120px]`}>
      <h3 className="text-md font-medium">{title}</h3>
      <p
        className={`text-xl font-bold mt-2 ${
          color === "red"
            ? "text-red-400"
            : color === "green"
            ? "text-green-400"
            : "text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

