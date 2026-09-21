import { Platform } from "react-native";
import { normalizeWhatsAppPhone } from "@/src/whatsapp";

export type ContactSaveResult = "saved" | "denied" | "unsupported" | "failed";

export async function saveCustomerDeviceContact(name: string, phone: string, address?: string): Promise<ContactSaveResult> {
  if (Platform.OS !== "android" && Platform.OS !== "ios") return "unsupported";
  try {
    const Contacts = await import("expo-contacts");
    const permission = await Contacts.requestPermissionsAsync();
    if (!permission.granted) return "denied";
    const normalized = normalizeWhatsAppPhone(phone);
    if (!normalized) return "failed";
    const contact = await Contacts.Contact.create({
      givenName: name.trim(),
      phones: [{ label: "mobile", number: `+${normalized}` }],
      ...(address?.trim() ? { addresses: [{ label: "home", street: address.trim(), country: "Indonesia" }] } : {}),
    });
    return contact.id ? "saved" : "failed";
  } catch {
    return "failed";
  }
}