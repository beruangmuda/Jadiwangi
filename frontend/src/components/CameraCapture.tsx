import React, { useEffect, useRef, useState } from "react";
import { Modal, Platform, Pressable, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";

import { Icon } from "@/src/components/Icon";
import { fonts, makeStyles, radius, spacing } from "@/src/theme";

export type CapturedPhoto = { uri: string; fileName?: string; mimeType?: string };

export function CameraCapture({ visible, onClose, onCaptured }: { visible: boolean; onClose: () => void; onCaptured: (photo: CapturedPhoto) => Promise<void> }) {
  const styles = useStyles();
  const ref = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<"back" | "front">("back");
  const [taking, setTaking] = useState(false);
  const [cameraError, setCameraError] = useState("");

  useEffect(() => { if (visible) setCameraError(""); }, [visible]);

  const capture = async () => {
    if (!ref.current || taking) return;
    setTaking(true);
    try {
      const picture = await ref.current.takePictureAsync({ quality: 0.65 });
      if (picture?.uri) {
        const uri = Platform.OS === "web" && !picture.uri.startsWith("data:") ? `data:image/jpeg;base64,${picture.uri}` : picture.uri;
        await onCaptured({ uri, fileName: `foto-laundry-${Date.now()}.jpg`, mimeType: "image/jpeg" });
      }
    } finally { setTaking(false); }
  };

  return <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
    <View style={styles.page}>
      <View style={styles.header}><Pressable testID="camera-capture-close" onPress={onClose} style={styles.iconBtn}><Icon name="close" size={24} color="#fff" /></Pressable><Text style={styles.title}>Ambil Foto Pakaian</Text><View style={styles.iconBtn} /></View>
      {!permission ? <View style={styles.center}><Text style={styles.help}>Menyiapkan kamera…</Text></View> : !permission.granted ? <View style={styles.center}><Icon name="camera-off" size={48} color="#fff" /><Text style={styles.title}>Izin kamera diperlukan</Text><Text style={styles.help}>Izinkan kamera untuk mengambil bukti pakaian pelanggan.</Text><Pressable testID="request-camera-permission" onPress={requestPermission} style={styles.permissionBtn}><Text style={styles.permissionText}>Izinkan Kamera</Text></Pressable></View> : cameraError ? <View style={styles.center}><Icon name="camera-alert" size={48} color="#fff" /><Text style={styles.title}>Kamera tidak tersedia</Text><Text testID="camera-error" style={styles.help}>{cameraError}</Text><Pressable testID="camera-error-close" onPress={onClose} style={styles.permissionBtn}><Text style={styles.permissionText}>Kembali</Text></Pressable></View> : <><CameraView ref={ref} style={styles.camera} facing={facing} onMountError={(event) => setCameraError(event.nativeEvent.message || "Periksa izin kamera perangkat.")} /><View style={styles.controls}><Pressable testID="camera-flip" onPress={() => setFacing((v) => v === "back" ? "front" : "back")} style={styles.controlBtn}><Icon name="camera-flip" size={25} color="#fff" /></Pressable><Pressable testID="camera-capture-button" onPress={capture} disabled={taking} style={[styles.captureBtn, taking && { opacity: 0.55 }]}><View style={styles.captureInner} /></Pressable><View style={styles.controlBtn} /></View></>}
    </View>
  </Modal>;
}

const useStyles = makeStyles((c) => ({
  page: { flex: 1, backgroundColor: "#111" }, header: { minHeight: 62, paddingHorizontal: spacing.lg, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#111" }, title: { fontFamily: fonts.displayBold, fontSize: 17, color: "#fff", textAlign: "center" }, iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" }, camera: { flex: 1 }, controls: { minHeight: 120, flexDirection: "row", alignItems: "center", justifyContent: "space-around", backgroundColor: "#111", paddingHorizontal: spacing.xl }, controlBtn: { width: 48, height: 48, alignItems: "center", justifyContent: "center" }, captureBtn: { width: 70, height: 70, borderRadius: 35, borderWidth: 4, borderColor: "#fff", alignItems: "center", justifyContent: "center" }, captureInner: { width: 54, height: 54, borderRadius: 27, backgroundColor: "#fff" }, center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xl }, help: { fontFamily: fonts.body, fontSize: 14, color: "#E5E7EB", lineHeight: 20, textAlign: "center" }, permissionBtn: { minHeight: 48, paddingHorizontal: spacing.lg, alignItems: "center", justifyContent: "center", borderRadius: radius.md, backgroundColor: c.brandPrimary }, permissionText: { fontFamily: fonts.bodyBold, fontSize: 14, color: c.onBrandPrimary },
}));