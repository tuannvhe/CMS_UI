/*
 * 2026-11-26 - Mobile app: sign in with fingerprint / Face ID
 * When turned on, opening the app (or coming back after a while in the background) shows the lock screen and asks for the
 * fingerprint / face instead of the password. The session itself stays the refresh token in SecureStore; the flag is per account.
 * 2026-11-26: "Ghi nhớ đăng nhập" + đăng nhập lại bằng vân tay / Face ID cả sau khi đã đăng xuất hoặc phiên hết hạn:
 * khi người dùng chọn "Dùng vân tay lần sau" lúc đăng nhập, mã + mật khẩu được cất trong SecureStore (Keychain / Android Keystore, mã hoá
 * bởi hệ điều hành, chỉ app này đọc được) và chỉ được dùng sau khi xác thực vân tay / khuôn mặt thành công. Tắt ở Cài đặt / đổi tài khoản là xoá.
 */
import * as LocalAuthentication from 'expo-local-authentication'
import * as SecureStore from 'expo-secure-store'

const FLAG = 'cms.bioLogin'          // = mã tài khoản đã bật
const ASKED = 'cms.bioLoginAsked'    // = mã tài khoản đã được hỏi bật sau khi đăng nhập
const CRED = 'cms.bioCred'           // { userId, password } để đăng nhập lại bằng vân tay khi không còn phiên
const REMEMBER = 'cms.remember'      // '1' = giữ phiên khi tắt mở app (mặc định), '0' = mở lại app phải đăng nhập
const LAST = 'cms.lastUser'          // { userId, fullName } người đăng nhập gần nhất (điền sẵn, lời chào)

export type BioKind = 'face' | 'finger' | 'iris' | 'other'

/** Loại sinh trắc học máy hỗ trợ và đã đăng ký; null: máy không có / chưa đăng ký vân tay hay khuôn mặt. */
export async function bioLoginKind(): Promise<BioKind | null> {
  try {
    if (!(await LocalAuthentication.hasHardwareAsync()) || !(await LocalAuthentication.isEnrolledAsync())) return null
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync()
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return 'face'
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return 'finger'
    if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) return 'iris'
    return 'other'
  } catch { return null }
}

const norm = (id: string) => id.trim().toLowerCase()

export async function bioLoginEnabled(userId: string | undefined | null) {
  if (!userId) return false
  try { return (await SecureStore.getItemAsync(FLAG)) === norm(userId) } catch { return false }
}

export async function setBioLogin(userId: string, on: boolean) {
  try {
    if (on) await SecureStore.setItemAsync(FLAG, norm(userId))
    else await SecureStore.deleteItemAsync(FLAG)
  } catch { /* bỏ qua */ }
}

/** Đã hỏi bật đăng nhập sinh trắc học cho tài khoản này chưa (chỉ hỏi một lần sau lần đăng nhập đầu). */
export async function bioLoginAsked(userId: string) {
  try { return (await SecureStore.getItemAsync(ASKED)) === norm(userId) } catch { return true }
}
export async function markBioLoginAsked(userId: string) {
  try { await SecureStore.setItemAsync(ASKED, norm(userId)) } catch { /* bỏ qua */ }
}

/** Hỏi vân tay / khuôn mặt (máy cho dùng mật mã máy làm dự phòng). true: đúng người. */
export async function bioAuthenticate(prompt: string, cancelLabel: string) {
  try {
    const r = await LocalAuthentication.authenticateAsync({ promptMessage: prompt, cancelLabel, disableDeviceFallback: false })
    return r.success
  } catch { return false }
}

export interface SavedLogin { userId: string; fullName: string }

export async function saveBioCred(userId: string, password: string) {
  try { await SecureStore.setItemAsync(CRED, JSON.stringify({ userId: userId.trim(), password })) } catch { /* bỏ qua */ }
}
export async function loadBioCred(): Promise<{ userId: string; password: string } | null> {
  try { const v = await SecureStore.getItemAsync(CRED); return v ? JSON.parse(v) : null } catch { return null }
}
export async function clearBioCred() {
  try { await SecureStore.deleteItemAsync(CRED) } catch { /* bỏ qua */ }
}

/** Ghi nhớ đăng nhập (mặc định bật; máy chưa từng chọn = bật). */
export async function rememberLogin() {
  try { return (await SecureStore.getItemAsync(REMEMBER)) !== '0' } catch { return true }
}
export async function setRememberLogin(on: boolean) {
  try { await SecureStore.setItemAsync(REMEMBER, on ? '1' : '0') } catch { /* bỏ qua */ }
}

export async function loadLastUser(): Promise<SavedLogin | null> {
  try { const v = await SecureStore.getItemAsync(LAST); return v ? JSON.parse(v) : null } catch { return null }
}
export async function saveLastUser(u: SavedLogin | null) {
  try { if (u) await SecureStore.setItemAsync(LAST, JSON.stringify(u)); else await SecureStore.deleteItemAsync(LAST) } catch { /* bỏ qua */ }
}
