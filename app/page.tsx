"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart
 
} from "recharts";

// type define
interface DataRow {
  time: string;
  voltage: number;
  current: number;
  power: number;
  mode: string;
}

interface Telemetry {
  v: number;
  i: number;
  p: number;
  batt?: number;
  mode?: string;
  warn?: string;
  sys?: string;
}


function solveCurrentGivenV(
  V: number,
  IL: number,
  I0: number,
  Rs: number,
  Rsh: number,
  n: number,
  Vt: number
): number {
  let I = Math.max(0, IL - V / (Rsh + 1e-12));
  // Newton-Raphson method for I
  for (let iter = 0; iter < 60; iter++) {
    const expoArg = (V + I * Rs) / (n * Vt);
    const expTerm = Math.exp(Math.min(700, expoArg)); // Min 700 to prevent overflow

    // The main equation: f(I) = I - IL + I0 * (exp(q(V+IRs)/nkT) - 1) + (V + I*Rs)/Rsh = 0
    const f = I - IL + I0 * (expTerm - 1) + (V + I * Rs) / (Rsh + 1e-12);

    // Derivative: df/dI
    const df = 1 + I0 * expTerm * (Rs / (n * Vt + 1e-12)) + Rs / (Rsh + 1e-12);
    const delta = f / (df + 1e-12);
    I -= delta;
    if (Math.abs(delta) < 1e-7) break;
    if (!Number.isFinite(I)) {
      I = 0;
      break;
    }
  }
  return Math.max(0, I);
}

// compute iv/pv curve
function computeIVCurve(
  irradiance: number,
  tempC: number,
  params: {
    cellCount: number;
    IL_stc: number;
    I0_stc: number;
    Rs: number;
    Rsh: number;
    n: number;
  }
) {
  const k = 1.380649e-23; // Boltzmann constant
  const q = 1.602176634e-19; // Elementary charge
  const T = tempC + 273.15; // Kelvin temperature
  const Vt_cell = (k * T) / q; // Thermal voltage of one cell
  const Vt = Vt_cell * params.cellCount; // Thermal voltage of the module (N_series * V_t_cell)

  // Adjust I_L and I_0 for current conditions
  const IL = params.IL_stc * (irradiance / 1000);
  // Reverse Saturation Current (I_0) is highly temp-dependent
  const I0 = params.I0_stc * Math.pow(T / 298.15, 3) * Math.exp(-1.2 / Vt_cell); 

  // Estimate Open Circuit Voltage (Voc) for curve range
  const Voc = params.cellCount * (0.6 + -0.002 * (tempC - 25)); 
  
  const steps = 80;
  const pts: { V: number; I: number; P: number }[] = [];
  for (let s = 0; s <= steps; s++) {
    const V = (Voc * s) / steps;
    const I = solveCurrentGivenV(V, IL, I0, params.Rs, params.Rsh, params.n, Vt);
    pts.push({ V, I, P: V * I });
  }
  return { pts, Voc, IL };
}
// 

/* ---------------- Battery (Simple Model) ---------------- */
class SimpleBattery {
  capacityAh: number;
  Rint: number;
  soc: number;

  constructor(capacityAh = 100, initialSoc = 0.5, Rint = 0.04) {
    this.capacityAh = capacityAh;
    this.soc = Math.max(0, Math.min(1, initialSoc));
    this.Rint = Rint; 
  }

  
  ocvFromSoc(soc: number): number {
    const s = Math.max(0, Math.min(1, soc));
    
    return 12.0 + (14.4 - 12.0) * (0.05 + 0.95 * Math.pow(s, 0.9));
  }


  step(powerW: number, dt: number) {
    const ocv = this.ocvFromSoc(this.soc);
    // (I = P/OCV)
    const I = powerW / (ocv + 1e-9); 
    const dAh = (I * dt) / 3600; 
    
    // Update State of Charge 
    this.soc += dAh / this.capacityAh;
    this.soc = Math.max(0, Math.min(1, this.soc));
    
    // Calculate Terminal Voltage: V_term = OCV + I*Rint 
    const Vterm = ocv + Math.sign(I) * I * this.Rint; 
    return { soc: this.soc, volt: Vterm, I };
  }
}

/*MPPT Controller (Perturb and Observe) */
class MPPTController {
  duty: number; 
  stepSize: number;
  prevPower: number;
  direction: number; 

  constructor(initDuty = 0.5) {
    this.duty = initDuty;
    this.stepSize = 0.008; 
    this.prevPower = 0;
    this.direction = 1;
  }

 
  update(pvV: number, pvP: number): number {
    const dP = pvP - this.prevPower; 
    
    if (dP > 1e-4) {
     
      this.duty += this.direction * this.stepSize;
    } else {
      
      this.direction *= -1;
      this.duty += this.direction * this.stepSize;
    }
    
    this.duty = Math.max(0.05, Math.min(0.95, this.duty)); 
    this.prevPower = pvP;
    return this.duty;
  }
  // 
}

// dashboard
export default function Dashboard() {
  const [connected, setConnected] = useState(false);
  const [latest, setLatest] = useState<Telemetry | null>(null);
  const [batteryReadV, setBatteryReadV] = useState(12.5);
  const [alarm, setAlarm] = useState("");
  const [activeMode, setActiveMode] = useState("OFF");
  const [log, setLog] = useState<DataRow[]>([]);
  const [simMode, setSimMode] = useState(false);
  
  // Simulation Inputs
  const [irradiance, setIrradiance] = useState(800);
  const [tempC, setTempC] = useState(25);
  const [autoSun, setAutoSun] = useState(false);

  // Inside render
const statusText = simMode
  ? "SIMULATION"
  : connected
  ? "CONNECTED"
  : "DISCONNECTED";

const statusClass = simMode
  ? "text-yellow-300 font-semibold"
  : connected
  ? "text-green-400 font-semibold"
  : "text-red-500 font-semibold";

  
  // Simulation Outputs
  const [ivCurve, setIvCurve] = useState<{ V: number; I: number; P: number }[]>([]);
  const [pvPoint, setPvPoint] = useState({ V: 0, I: 0, P: 0, duty: 0.5 });
  const [batterySoc, setBatterySoc] = useState(0.6);

  // Refs for persistent objects in simulation
  const moduleParamsRef = useRef({
    cellCount: 36,
    IL_stc: 5.5,
    I0_stc: 1e-9,
    Rs: 0.25,
    Rsh: 200,
    n: 1.3,
  });
  const batteryRef = useRef(new SimpleBattery(100, 0.6, 0.03));
  const mpptRef = useRef(new MPPTController(0.5));
  const ws = useRef<WebSocket | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);


const applyTelemetry = useCallback((data: Telemetry) => {
  setLatest(data);
  setBatteryReadV(data.batt ?? 0); 
  setActiveMode(data.mode ?? "OFF"); 

  const row: DataRow = {
    time: new Date().toLocaleTimeString(),
    voltage: Number(data.v ?? 0),
    current: Number(data.i ?? 0),
    power: Number(data.p ?? 0),
    mode: data.mode ?? "SIM",
  };

  setLog((prev) => [row, ...prev.slice(0, 200)]);
}, []); 



useEffect(() => {
  if (simMode) {
    const id = setTimeout(() => setConnected(false), 0);
    return () => clearTimeout(id);
  }
}, [simMode]);
useEffect(() => {
  if (simMode) return;

  
  setTimeout(() => setConnected(false), 0);

  const socket = new WebSocket("ws://localhost:3001");
  ws.current = socket;

  socket.onopen = () => {
    console.log("WS Connected");
    setConnected(true);
  };

  socket.onclose = () => {
    console.log("WS Disconnected");
    setConnected(false);
  };

  socket.onerror = (err) => {
    console.log("WS Error", err);
    setConnected(false);
  };

  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      applyTelemetry(data);
    } catch (err) {
      console.log("Telemetry parse error", err);
    }
  };

  return () => {
    socket.close();
  };
}, [simMode, applyTelemetry]);



//  simulation
  useEffect(() => {
    if (!simMode) return;

    const dtMs = 500; // Simulation time 
    let t = 0; // Simulation time counter

    const tick = () => {
      t += dtMs;
      
      // 1. Environmental Input
      const effIrr =
        autoSun
          ? Math.max(0, Math.min(1000, irradiance * (0.5 + 0.5 * Math.sin((t / 1000) * 0.12))))
          : irradiance;

      // 2. PV Model Calculation (I-V, P-V Curves)
      const { pts, Voc, IL } = computeIVCurve(effIrr, tempC, moduleParamsRef.current);
      setIvCurve(pts);

      // 3. MPPT/Converter Interaction
      const currDuty = mpptRef.current.duty;
      // Convert duty cycle to an operating voltage on the PV array
      const targetV = Math.max(0.01, Math.min(Voc * 0.98, currDuty * Voc));

      // Find the closest point on the I-V curve to the target voltage
      let measured = pts[0];
      for (const p of pts) if (Math.abs(p.V - targetV) < Math.abs(measured.V - targetV)) measured = p;

      const Vpv = measured.V;
      const Ipv = measured.I;
      const Ppv = measured.P;

      // 4. MPPT Algorithm Update 
      const newDuty = mpptRef.current.update(Vpv, Ppv);

      // 5. Battery Model
      const smallLoadW = 3 + Math.max(0, Math.sin((t / 1000) * 0.45) * 2); // Simulated load
      const converterEff = 0.94; // Power conversion efficiency
      const netToBatteryW = Math.max(-10000, (Ppv - smallLoadW) * converterEff); // Power available for battery charging

      const battRes = batteryRef.current.step(netToBatteryW, dtMs / 1000); // Step battery state
      setBatterySoc(battRes.soc);
      setBatteryReadV(battRes.volt);

      // 6. Update State
      setPvPoint({ V: Vpv, I: Ipv, P: Ppv, duty: newDuty });

      // 7. Generate Telemetry
      const telemetry: Telemetry = {
        v: Vpv,
        i: Ipv,
        p: Ppv,
        batt: battRes.volt,
        mode: "SIM_MPPT",
        warn: Ppv < 0.5 && effIrr < 50 ? "LOW_POWER" : "OK",
        sys: `Duty=${newDuty.toFixed(2)} Voc=${Voc.toFixed(2)} IL=${IL.toFixed(2)}`,
      };
      applyTelemetry(telemetry);

      timerRef.current = setTimeout(tick, dtMs);
    };

    tick(); // start simulation

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [simMode, irradiance, tempC, autoSun,applyTelemetry]);

  // command by own
  const AVAILABLE_COMMANDS = ["BUCK_ON", "BOOST_ON", "ALL_OFF", "AUTO", "MANUAL"];
  const sendCommand = (cmd: string) => {
    // Command handling in SIMULATION mode 
    if (simMode) {
      if (cmd === "ALL_OFF") mpptRef.current.duty = 0.05; 
      else if (cmd === "BUCK_ON") mpptRef.current.duty = Math.max(0.05, mpptRef.current.duty - 0.05);
      else if (cmd === "BOOST_ON") mpptRef.current.duty = Math.min(0.95, mpptRef.current.duty + 0.05);
      // AUTO/MANUAL can be implemented to toggle the MPPT P&O loop
      return;
    }
    // Command handling in REAL mode (via WebSocket)
    if (ws.current && connected && ws.current.readyState === WebSocket.OPEN) ws.current.send(cmd);
  };

  /* ---------------- Metric Card Renderer ---------------- */
  const metricCard = (title: string, value: string, extra?: string) => (
    <div className="bg-linear-to-br from-gray-900 to-gray-800 p-5 rounded-xl border border-gray-700 shadow-xl hover:scale-105 transform transition-all">
      <h2 className="text-gray-400 text-sm mb-2">{title}</h2>
      <p className="text-3xl font-bold text-green-400">{value}</p>
      {extra && <p className="text-xs text-gray-500 mt-1">{extra}</p>}
    </div>
  );

 
  return (
    <div className="min-h-screen bg-[#050505] text-white p-6">

      <h1 className="text-4xl font-extrabold mb-6 text-center text-gradient-to-r from-green-400 to-blue-400">
        🔋 MPPT Solar Charge Controller
      </h1>

      {/* mode toggle */}
      <div className="flex justify-center gap-4 mb-4">
        <button
          onClick={() => setSimMode(false)}
          className={`px-4 py-2 rounded-lg font-semibold ${!simMode ? "bg-green-600" : "bg-gray-700"}`}
        >
          Real Mode
        </button>
        <button
          onClick={() => setSimMode(true)}
          className={`px-4 py-2 rounded-lg font-semibold ${simMode ? "bg-blue-600" : "bg-gray-700"}`}
        >
          Simulation Mode
        </button>
      </div>

      <p className="text-center mb-3 text-sm">
        
        {/* <span className={simMode ? "text-yellow-300 font-semibold" : connected ? "text-green-400 font-semibold" : "text-red-500 font-semibold"}>
          {simMode ? "SIMULATION" : connected ? "CONNECTED" : "DISCONNECTED"}
        </span> */}
        <span className="text-center mb-3 text-sm">
  Status: <span className={statusClass}>{statusText}</span>
</span>
      </p>

      {alarm && <p className="text-center text-red-500 font-bold mb-5 text-lg">{alarm}</p>}

      {/* top metrics */}
      <div className="grid md:grid-cols-5 gap-6 mb-10">
        {metricCard("Voltage (Vpv)", latest?.v ? `${latest.v.toFixed(2)} V` : "--")}
        {metricCard("Current (Ipv)", latest?.i ? `${latest.i.toFixed(2)} A` : "--")}
        {metricCard("Power (Ppv)", latest?.p ? `${latest.p.toFixed(2)} W` : "--")}
        {metricCard("Battery", `${Math.round(batterySoc * 100)}%`, `${batteryReadV.toFixed(2)} V`)}
        {metricCard("Mode", latest?.mode || "OFF", latest?.sys || "")}
      </div>

      {/* simulation controls when simMode */}
      {simMode && (
        <div className="bg-[#121212] p-6 rounded-xl border border-gray-700 shadow-md mb-10">
          <h2 className="mb-4 text-xl font-bold text-yellow-400">Simulation Settings</h2>

          <div className="grid md:grid-cols-3 gap-4 items-center">
            <div>
              <label className="text-sm text-gray-300">Irradiance: {irradiance} W/m²</label>
              <input
                type="range"
                min={0}
                max={1000}
                step={1}
                value={irradiance}
                onChange={(e) => setIrradiance(Number(e.target.value))}
                className="w-full"
              />
              <div className="text-xs text-gray-400 mt-1">0 = night, 1000 = 1 sun</div>
            </div>

            <div>
              <label className="text-sm text-gray-300">Temperature: {tempC} °C</label>
              <input
                type="range"
                min={-10}
                max={75}
                step={1}
                value={tempC}
                onChange={(e) => setTempC(Number(e.target.value))}
                className="w-full"
              />
              <div className="text-xs text-gray-400 mt-1">Module temperature</div>
            </div>

            <div>
              <label className="text-sm text-gray-300">Auto Sun Profile</label>
              <div className="flex items-center gap-3 mt-2">
                <button onClick={() => setAutoSun(!autoSun)} className={`px-4 py-2 rounded-md font-semibold ${autoSun ? "bg-green-600" : "bg-gray-700"}`}>
                  {autoSun ? "ON" : "OFF"}
                </button>
                <div className="text-xs text-gray-400">Enable slow day/night fluctuation</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* live graph */}
      <div className="bg-[#0f0f0f] p-6 rounded-xl border border-gray-700 shadow-lg mb-10">
        <h2 className="mb-3 font-bold text-green-400 text-xl">Live Power Graph (W)</h2>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={log.slice(0, 120).reverse()}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis dataKey="time" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Line type="monotone" dataKey="power" stroke="#4ade80" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* system controls (only active in real mode) */}
      <div className="bg-[#121212] p-6 rounded-xl border border-gray-700 shadow-md mb-10">
        <h2 className="mb-4 text-xl font-bold text-blue-400">System Controls</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {AVAILABLE_COMMANDS.map((cmd, i) => (
            <button
              key={i}
              disabled={simMode ? (cmd === "AUTO" || cmd === "MANUAL") : !connected} // Disable AUTO/MANUAL in this simple sim
              onClick={() => sendCommand(cmd)}
              className={`py-3 rounded-lg font-semibold transition-all duration-200
                ${simMode ? "bg-indigo-600 hover:scale-105" : connected ? "bg-blue-600 hover:scale-105" : "bg-gray-700 cursor-not-allowed"}
                ${cmd === "ALL_OFF" ? "bg-red-600 hover:scale-105" : ""}
                ${(cmd === "AUTO" || cmd === "MANUAL") && simMode ? "bg-gray-800 text-gray-500 cursor-not-allowed" : ""}`}
            >
              {cmd}
            </button>
          ))}
        </div>
      </div>

      {/* IV/PV charts & PV point */}
      <div className="grid md:grid-cols-3 gap-6 mb-6">
        <div className="bg-[#0f0f0f] p-4 rounded-xl border border-gray-700 shadow-lg col-span-2">
          <h3 className="font-bold text-green-400 mb-2">Live Power</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={log.slice(0, 80).reverse()}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey="time" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Line type="monotone" dataKey="power" stroke="#4ade80" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-[#0f0f0f] p-4 rounded-xl border border-gray-700 shadow-lg">
          <h3 className="font-bold text-blue-400 mb-2">PV Operating Point</h3>
          <div className="text-lg font-semibold mb-1">{pvPoint.P.toFixed(2)} W</div>
          <div className="text-sm text-gray-400">
            V: {pvPoint.V.toFixed(2)} V · I: {pvPoint.I.toFixed(2)} A
          </div>
          <div className="mt-3">
            <div className="text-xs text-gray-400">Battery SOC</div>
            <div className="w-full bg-gray-800 rounded-full h-3 mt-1 overflow-hidden">
              <div 
                style={{ width: `${Math.round(batterySoc * 100)}%` }} 
                className="h-3 bg-gradient-to-r from-green-400 to-blue-500" // Changed bg-linear--to-r to bg-gradient-to-r
              />
            </div>
            <div className="text-xs text-gray-300 mt-1">{(batterySoc * 100).toFixed(1)}%</div>
          </div>
        </div>
      </div>

      {/* I-V and P-V charts */}
     {/* I-V and P-V charts */}
<div className="grid md:grid-cols-2 gap-6 mb-6">

  {/* I-V Curve */}
  <div className="bg-[#0f0f0f] p-4 rounded-xl border border-gray-700 shadow-lg">
    <h3 className="font-bold text-purple-400 mb-2">I–V Curve</h3>
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={ivCurve}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
        <XAxis dataKey="V" tick={{ fontSize: 10 }} />
        <YAxis yAxisId="left" dataKey="I" tick={{ fontSize: 10 }} />
        <Tooltip />
        {/* I-V curve line */}
        <Line yAxisId="left" type="monotone" dataKey="I" stroke="#60a5fa" dot={false} strokeWidth={2} />
        {/* Operating point */}
        {pvPoint.V > 0 && (
          <Line
            yAxisId="left"
            data={[{ V: pvPoint.V, I: pvPoint.I }]}
            dataKey="I"
            stroke="#f472b6"
            dot={{ r: 4 }}
            strokeWidth={0}
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  </div>

  {/* P-V Curve */}
  <div className="bg-[#0f0f0f] p-4 rounded-xl border border-gray-700 shadow-lg">
    <h3 className="font-bold text-indigo-400 mb-2">P–V Curve</h3>
   
    <ResponsiveContainer width="100%" height={220}>
  <AreaChart data={ivCurve.map(p => ({ V: p.V, P: p.P }))}>
    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
    <XAxis dataKey="V" tick={{ fontSize: 10 }} />
    <YAxis tick={{ fontSize: 10 }} />
    <Tooltip />
    {/* P-V curve line */}
    <Area type="monotone" dataKey="P" stroke="#34d399" fillOpacity={0.12} fill="#34d399" dot={false} />
    {/* Operating point */}
    {pvPoint.V > 0 && (
      <Line
        type="monotone"
        data={[{ V: pvPoint.V, P: pvPoint.P }]}
        dataKey="P"
        stroke="#fb923c"
        dot={{ r: 4 }}
        strokeWidth={0}
      />
    )}
  </AreaChart>
</ResponsiveContainer>

  </div>

</div>

      {/* Log table */}
      <div className="bg-[#0d0d0d] p-6 rounded-xl border border-gray-700 shadow-lg">
        <h2 className="mb-4 text-xl font-bold text-purple-400">Log History</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400">
                <th className="p-2 text-left">Time</th>
                <th className="p-2 text-right">Volt</th>
                <th className="p-2 text-right">Curr</th>
                <th className="p-2 text-right">Power</th>
                <th className="p-2 text-center">Mode</th>
              </tr>
            </thead>
            <tbody>
              {log.map((row, i) => (
                <tr key={i} className={`border-b border-gray-800 text-center ${i % 2 === 0 ? "bg-gray-900/30" : ""}`}>
                  <td className="text-left">{row.time}</td>
                  <td>{typeof row.voltage === "number" ? row.voltage.toFixed(2) : "--"}</td>
                  <td>{typeof row.current === "number" ? row.current.toFixed(2) : "--"}</td>
                  <td>{typeof row.power === "number" ? row.power.toFixed(2) : "--"}</td>
                  <td>{row.mode}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-center text-xs mt-6 text-gray-500">Developed by Ziam — Integrated MPPT Simulator & Controller</p>
    </div>
  );
}










