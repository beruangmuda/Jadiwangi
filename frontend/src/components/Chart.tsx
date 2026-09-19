import React from "react";
import { View, Text } from "react-native";
import Svg, { Defs, LinearGradient, Stop, Path, Line, Circle } from "react-native-svg";
import { fonts, useTheme } from "@/src/theme";

type Point = { day: number; omzet: number; pendapatan: number };

// Smooth area + line chart for monthly revenue trend.
export function TrendChart({ data, width, height = 180 }: { data: Point[]; width: number; height?: number }) {
  const { colors } = useTheme();
  const padX = 6;
  const padTop = 12;
  const padBottom = 22;
  const w = Math.max(width, 40);
  const h = height;
  const pts = data.length ? data : [{ day: 1, omzet: 0, pendapatan: 0 }];
  const maxV = Math.max(1, ...pts.map((p) => Math.max(p.omzet, p.pendapatan)));

  const xFor = (i: number) => padX + (i * (w - padX * 2)) / Math.max(1, pts.length - 1);
  const yFor = (v: number) => padTop + (h - padTop - padBottom) * (1 - v / maxV);

  const buildLine = (key: "omzet" | "pendapatan") => {
    return pts
      .map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(i).toFixed(1)} ${yFor(p[key]).toFixed(1)}`)
      .join(" ");
  };
  const areaPath = `${buildLine("omzet")} L ${xFor(pts.length - 1).toFixed(1)} ${h - padBottom} L ${xFor(0).toFixed(1)} ${h - padBottom} Z`;

  const gridY = [0.25, 0.5, 0.75, 1].map((f) => padTop + (h - padTop - padBottom) * (1 - f));

  const omzetColor = colors.error;        // merah
  const pendapatanColor = colors.brandPrimary; // biru

  return (
    <View>
      <Svg width={w} height={h}>
        <Defs>
          <LinearGradient id="omzetFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={omzetColor} stopOpacity={0.22} />
            <Stop offset="1" stopColor={omzetColor} stopOpacity={0.02} />
          </LinearGradient>
        </Defs>
        {gridY.map((gy, i) => (
          <Line key={i} x1={padX} y1={gy} x2={w - padX} y2={gy} stroke={colors.divider} strokeWidth={1} />
        ))}
        <Path d={areaPath} fill="url(#omzetFill)" />
        <Path d={buildLine("pendapatan")} stroke={pendapatanColor} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
        <Path d={buildLine("omzet")} stroke={omzetColor} strokeWidth={3} fill="none" strokeLinejoin="round" strokeLinecap="round" />
        {pts.length <= 16 && pts.map((p, i) => (
          <React.Fragment key={i}>
            <Circle cx={xFor(i)} cy={yFor(p.pendapatan)} r={2.5} fill={pendapatanColor} />
            <Circle cx={xFor(i)} cy={yFor(p.omzet)} r={3} fill={omzetColor} />
          </React.Fragment>
        ))}
      </Svg>
      <View style={{ flexDirection: "row", gap: 20, marginTop: 8, paddingHorizontal: padX }}>
        <Legend color={omzetColor} label="Omzet" />
        <Legend color={pendapatanColor} label="Pendapatan" />
      </View>
    </View>
  );
}

function Legend({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View style={{ width: 16, height: 3, borderRadius: 2, backgroundColor: color, opacity: dashed ? 0.7 : 1 }} />
      <Text style={{ fontFamily: fonts.bodySemi, fontSize: 12, color: colors.muted }}>{label}</Text>
    </View>
  );
}

// Simple bar chart for report breakdowns.
export function BarChart({
  data,
  width,
  height = 150,
  color,
}: {
  data: { label: string; value: number }[];
  width: number;
  height?: number;
  color?: string;
}) {
  const { colors } = useTheme();
  const barColor = color || colors.brand;
  const w = Math.max(width, 40);
  const padBottom = 26;
  const maxV = Math.max(1, ...data.map((d) => d.value));
  const gap = 10;
  const bw = (w - gap * (data.length + 1)) / Math.max(1, data.length);
  return (
    <Svg width={w} height={height}>
      {data.map((d, i) => {
        const bh = (height - padBottom) * (d.value / maxV);
        const x = gap + i * (bw + gap);
        const y = height - padBottom - bh;
        return (
          <React.Fragment key={i}>
            <Path d={roundedBar(x, y, bw, bh, 6)} fill={barColor} opacity={0.85} />
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

function roundedBar(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h);
  return `M ${x} ${y + h} L ${x} ${y + rr} Q ${x} ${y} ${x + rr} ${y} L ${x + w - rr} ${y} Q ${x + w} ${y} ${x + w} ${y + rr} L ${x + w} ${y + h} Z`;
}
