import React, { useMemo, useState } from "react";
import { View, Text, Pressable, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import dayjs, { Dayjs } from "dayjs";

import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Icon } from "@/src/components/Icon";
import { PrimaryButton } from "@/src/components/ui";

const DOW = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

export function DateRangeSheet({
  visible,
  initialFrm,
  initialTo,
  onClose,
  onApply,
}: {
  visible: boolean;
  initialFrm?: string;
  initialTo?: string;
  onClose: () => void;
  onApply: (frm: string, to: string) => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [month, setMonth] = useState<Dayjs>(dayjs(initialTo || undefined).startOf("month"));
  const [start, setStart] = useState<string | null>(initialFrm || null);
  const [end, setEnd] = useState<string | null>(initialTo || null);

  const days = useMemo(() => {
    const first = month.startOf("month");
    const startOffset = (first.day() + 6) % 7; // Monday-first
    const total = month.daysInMonth();
    const cells: (Dayjs | null)[] = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= total; d++) cells.push(first.date(d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [month]);

  const tapDay = (d: Dayjs) => {
    const iso = d.format("YYYY-MM-DD");
    if (!start || (start && end)) {
      setStart(iso);
      setEnd(null);
    } else {
      if (dayjs(iso).isBefore(dayjs(start))) {
        setEnd(start);
        setStart(iso);
      } else {
        setEnd(iso);
      }
    }
  };

  const inRange = (iso: string) => start && end && iso > start && iso < end;
  const today = dayjs().format("YYYY-MM-DD");

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={styles.grabber} />
          <Text style={styles.title}>Pilih Rentang Tanggal</Text>

          <View style={styles.monthNav}>
            <Pressable testID="cal-prev" onPress={() => setMonth(month.subtract(1, "month"))} hitSlop={10} style={styles.navBtn}>
              <Icon name="chevron-left" size={22} color={colors.brand} />
            </Pressable>
            <Text style={styles.monthLabel}>{month.format("MMMM YYYY")}</Text>
            <Pressable testID="cal-next" onPress={() => setMonth(month.add(1, "month"))} hitSlop={10} style={styles.navBtn}>
              <Icon name="chevron-right" size={22} color={colors.brand} />
            </Pressable>
          </View>

          <View style={styles.dowRow}>
            {DOW.map((d) => (
              <Text key={d} style={styles.dow}>{d}</Text>
            ))}
          </View>

          <View style={styles.grid}>
            {days.map((d, i) => {
              if (!d) return <View key={i} style={styles.cell} />;
              const iso = d.format("YYYY-MM-DD");
              const isStart = iso === start;
              const isEnd = iso === end;
              const isEdge = isStart || isEnd;
              const future = iso > today;
              return (
                <Pressable
                  key={i}
                  testID={`cal-day-${iso}`}
                  disabled={future}
                  onPress={() => tapDay(d)}
                  style={[styles.cell, inRange(iso) && styles.cellRange]}
                >
                  <View style={[styles.dayInner, isEdge && { backgroundColor: colors.brandPrimary }]}>
                    <Text style={[styles.dayText, future && { color: colors.border }, isEdge && { color: colors.onBrandPrimary }]}>
                      {d.date()}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.selInfo}>
            {start ? dayjs(start).format("DD MMM YYYY") : "Mulai"} — {end ? dayjs(end).format("DD MMM YYYY") : "Selesai"}
          </Text>

          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <Pressable style={styles.cancel} onPress={onClose}><Text style={styles.cancelText}>Batal</Text></Pressable>
            <PrimaryButton
              label="Terapkan"
              testID="cal-apply"
              disabled={!start || !end}
              onPress={() => { if (start && end) onApply(start, end); }}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((c) => ({
  overlay: { flex: 1, backgroundColor: "rgba(30,26,52,0.45)", justifyContent: "flex-end" },
  sheet: { backgroundColor: c.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.xl, gap: spacing.md },
  grabber: { width: 44, height: 5, borderRadius: 3, backgroundColor: c.border, alignSelf: "center" },
  title: { fontFamily: fonts.displayBold, fontSize: 18, color: c.onSurface, textAlign: "center" },
  monthNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  navBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  monthLabel: { fontFamily: fonts.displayBold, fontSize: 16, color: c.onSurface },
  dowRow: { flexDirection: "row" },
  dow: { flex: 1, textAlign: "center", fontFamily: fonts.bodyBold, fontSize: 12, color: c.muted },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: "center", justifyContent: "center" },
  cellRange: { backgroundColor: c.brandTertiary },
  dayInner: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  dayText: { fontFamily: fonts.bodySemi, fontSize: 14, color: c.onSurface },
  selInfo: { fontFamily: fonts.bodyBold, fontSize: 13, color: c.brand, textAlign: "center" },
  cancel: { paddingVertical: 15, paddingHorizontal: 20, borderRadius: radius.md, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  cancelText: { fontFamily: fonts.bodyBold, fontSize: 15, color: c.onSurfaceSecondary },
}));
