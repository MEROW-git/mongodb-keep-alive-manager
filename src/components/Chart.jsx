import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { Activity, PieChart as PieIcon, BarChart3 } from 'lucide-react';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const fullTime = payload[0]?.payload?.fullTime;
    return (
      <div className="bg-[#111827] border border-gray-700/80 p-2.5 rounded-xl shadow-2xl text-xs font-mono">
        <p className="text-gray-400 mb-1">{fullTime || label}</p>
        {payload.map((entry, index) => (
          <p key={index} className="font-semibold" style={{ color: entry.color || '#00ED64' }}>
            {entry.name}: {entry.value} {entry.dataKey === 'latency' ? 'ms' : ''}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function Chart({ type = 'latency', data = [], title, subtitle }) {
  if (type === 'latency') {
    return (
      <div className="glass-panel rounded-2xl p-5 bg-cardBg/90 border border-gray-800/80">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
              <Activity className="w-4 h-4 text-mongo" />
              <span>{title || 'Ping Response Time History'}</span>
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {subtitle || 'Latency trend for recent ping keep-alive checks (ms)'}
            </p>
          </div>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-mongo/10 text-mongo border border-mongo/30">
            Realtime
          </span>
        </div>

        <div className="h-64 w-full">
          {data.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-gray-500 font-mono">
              Waiting for ping data...
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="mongoGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00ED64" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#00ED64" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" vertical={false} />
                <XAxis
                  dataKey="time"
                  stroke="#6B7280"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#1F2937' }}
                />
                <YAxis
                  stroke="#6B7280"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#1F2937' }}
                  unit="ms"
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="latency"
                  name="Latency"
                  stroke="#00ED64"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#mongoGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    );
  }

  if (type === 'distribution') {
    const total = data.reduce((acc, curr) => acc + (curr.value || 0), 0);
    const successRate = total > 0 ? (((data[0]?.value || 0) / total) * 100).toFixed(1) : 100;

    return (
      <div className="glass-panel rounded-2xl p-5 bg-cardBg/90 border border-gray-800/80 flex flex-col justify-between">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
              <PieIcon className="w-4 h-4 text-mongo" />
              <span>{title || 'Successful vs Failed Ping'}</span>
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">Reliability ratio</p>
          </div>
          <span className="text-xs font-mono font-bold text-mongo">{successRate}% Uptime</span>
        </div>

        <div className="h-56 w-full relative flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                innerRadius={55}
                outerRadius={75}
                paddingAngle={4}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color || (index === 0 ? '#00ED64' : '#EF4444')} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          {/* Centered stat */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-xl font-bold font-mono text-white">{total.toLocaleString()}</span>
            <span className="text-[10px] text-gray-400 uppercase">Total Pings</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-800/80 text-xs">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-mongo" />
            <span className="text-gray-400">Success:</span>
            <span className="font-mono font-semibold text-white">{data[0]?.value || 0}</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <span className="text-gray-400">Failed:</span>
            <span className="font-mono font-semibold text-white">{data[1]?.value || 0}</span>
          </div>
        </div>
      </div>
    );
  }

  if (type === 'daily') {
    return (
      <div className="glass-panel rounded-2xl p-5 bg-cardBg/90 border border-gray-800/80">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
              <BarChart3 className="w-4 h-4 text-mongo" />
              <span>{title || 'Daily Activity'}</span>
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">Keep-alive operations over the past 7 days</p>
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" vertical={false} />
              <XAxis
                dataKey="date"
                stroke="#6B7280"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#1F2937' }}
              />
              <YAxis
                stroke="#6B7280"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#1F2937' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
              <Bar dataKey="successful" name="Success" fill="#00ED64" radius={[4, 4, 0, 0]} />
              <Bar dataKey="failed" name="Failed" fill="#EF4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  return null;
}
