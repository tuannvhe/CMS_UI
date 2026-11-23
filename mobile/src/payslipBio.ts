/*
 * 2026-11-23 [Truong] - Mobile app: unlock the payslip with fingerprint / Face ID
 * The 4-digit PIN is kept in SecureStore behind biometric authentication (Keychain / Android Keystore) and is still verified by the server
 * (/payslip/pin/verify), so wrong-attempt counting and lockout stay on the server. Biometric changes on the device invalidate the stored PIN.
 */
import * as LocalAuthentication from 'expo-local-authentication'
import * as SecureStore from 'expo-secure-store'

/** Khoá theo tài khoản: máy dùng chung không mở phiếu lương của người khác. Chỉ chữ / số / . - _ (giới hạn của SecureStore). */
const key = (userId: string) => `cms.payslipPin.${userId.replace(/[^A-Za-z0-9._-]/g, '_')}`

/** Máy có cảm biến và đã đăng ký vân tay / khuôn mặt. */
export async function bioAvailable() {
  try { return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync()) } catch { return false }
}

/** Đã bật mở bằng sinh trắc học cho tài khoản này chưa (không hỏi vân tay). */
export async function bioEnabled(userId: string) {
  try { return (await SecureStore.getItemAsync(`${key(userId)}.on`)) === '1' } catch { return false }
}

/** Lưu mã PIN sau khi máy chủ đã xác nhận đúng. Lỗi (Expo Go, người dùng huỷ…): false. */
export async function bioEnable(userId: string, pin: string, prompt: string) {
  try {
    await SecureStore.setItemAsync(key(userId), pin, { requireAuthentication: true, authenticationPrompt: prompt, keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY })
    await SecureStore.setItemAsync(`${key(userId)}.on`, '1')
    return true
  } catch { await bioDisable(userId); return false }
}

/** Hỏi vân tay / Face ID rồi trả về mã PIN; người dùng huỷ hoặc khoá sinh trắc học đã đổi: null. */
export async function bioReadPin(userId: string, prompt: string): Promise<string | null> {
  try {
    const pin = await SecureStore.getItemAsync(key(userId), { requireAuthentication: true, authenticationPrompt: prompt })
    return pin && /^\d{4}$/.test(pin) ? pin : null
  } catch { return null }
}

export async function bioDisable(userId: string) {
  await SecureStore.deleteItemAsync(key(userId)).catch(() => undefined)
  await SecureStore.deleteItemAsync(`${key(userId)}.on`).catch(() => undefined)
}
