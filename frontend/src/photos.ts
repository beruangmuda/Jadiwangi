import { Platform, Alert, Linking } from "react-native";
import * as ImagePicker from "expo-image-picker";

export type UploadablePhoto = Pick<ImagePicker.ImagePickerAsset, "uri"> & { fileName?: string | null; mimeType?: string | null };

const BASE = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`;

function settingsPrompt(what: string) {
  Alert.alert(
    `Izin ${what} dibutuhkan`,
    `Aktifkan izin ${what} di Pengaturan agar bisa menyertakan foto pakaian.`,
    [
      { text: "Nanti", style: "cancel" },
      { text: "Buka Pengaturan", onPress: () => Linking.openSettings() },
    ],
  );
}

/** Minta izin kontekstual; hormati canAskAgain lalu arahkan ke Pengaturan. */
async function ensurePermission(kind: "camera" | "library"): Promise<boolean> {
  if (Platform.OS === "web") return true;
  const get = kind === "camera" ? ImagePicker.getCameraPermissionsAsync : ImagePicker.getMediaLibraryPermissionsAsync;
  const ask = kind === "camera" ? ImagePicker.requestCameraPermissionsAsync : ImagePicker.requestMediaLibraryPermissionsAsync;
  const label = kind === "camera" ? "kamera" : "galeri foto";

  const current = await get();
  if (current.granted) return true;
  if (!current.canAskAgain) {
    settingsPrompt(label);
    return false;
  }
  const res = await ask();
  if (res.granted) return true;
  if (!res.canAskAgain) settingsPrompt(label);
  return false;
}

export async function pickPhoto(source: "camera" | "library"): Promise<ImagePicker.ImagePickerAsset | null> {
  const ok = await ensurePermission(source === "camera" ? "camera" : "library");
  if (!ok) return null;
  const opts: ImagePicker.ImagePickerOptions = { quality: 0.6, mediaTypes: ["images"], allowsEditing: false };
  const res = source === "camera"
    ? await ImagePicker.launchCameraAsync(opts)
    : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled || !res.assets?.length) return null;
  return res.assets[0];
}

/** Unggah ke Emergent Object Storage lewat backend; mengembalikan URL publik. */
export async function uploadPhoto(asset: UploadablePhoto, folder = "orders"): Promise<string> {
  const name = asset.fileName || `foto-${Date.now()}.jpg`;
  const type = asset.mimeType || "image/jpeg";
  const form = new FormData();
  if (Platform.OS === "web") {
    const blob = await (await fetch(asset.uri)).blob();
    form.append("file", blob, name);
  } else {
    form.append("file", { uri: asset.uri, name, type } as any);
  }
  form.append("folder", folder);

  const res = await fetch(`${BASE}/upload`, { method: "POST", body: form });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Gagal mengunggah foto");
  }
  const json = await res.json();
  return json.url as string;
}

/** URL absolut untuk menampilkan foto yang tersimpan. */
export function photoUrl(url: string): string {
  if (!url) return "";
  return url.startsWith("http") ? url : `${process.env.EXPO_PUBLIC_BACKEND_URL}${url}`;
}
