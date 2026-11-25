/* 2026-11-23 [Truong] - Mobile app: login (+ admin OTP step)
 * 2026-11-25: nền gradient thương hiệu, logo, ô nhập có icon, hiện / ẩn mật khẩu. */
import { useState } from 'react'
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View, type TextInputProps } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { StatusBar } from 'expo-status-bar'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthProvider'
import { errorCode } from '../api/client'
import type { MobileOtpChallenge } from '../api/mobileAuth'
import { MOBILE_LANGS, setMobileLanguage } from '../i18n'
import { Button, C, GRAD, type IconName, s, shadow } from '../ui'

/** Logo VINATECH dùng chung với web (CMS_UI/src/assets). */
const LOGO = require('../../../src/assets/logo1.png')

function Field({ icon, right, ...props }: TextInputProps & { icon: IconName; right?: React.ReactNode }) {
  const [focus, setFocus] = useState(false)
  return (
    <View style={[s.input, { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 0 }, focus && { borderColor: C.brand, backgroundColor: C.card }]}>
      <Ionicons name={icon} size={20} color={focus ? C.brand : C.faint} />
      <TextInput {...props} placeholderTextColor={C.faint} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
        style={{ flex: 1, paddingVertical: 14, fontSize: 16, color: C.text }} />
      {right}
    </View>
  )
}

export default function LoginScreen() {
  const { t, i18n } = useTranslation()
  const { signIn, verifyOtp } = useAuth()
  const [userId, setUserId] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [code, setCode] = useState('')
  const [otp, setOtp] = useState<MobileOtpChallenge | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async (work: () => Promise<void>) => {
    setBusy(true); setError(null)
    try { await work() } catch (e) { setError(errorCode(e)) } finally { setBusy(false) }
  }

  const submit = () => {
    if (!userId.trim() || !password) { setError('invalid_input'); return }
    void run(async () => { setOtp(await signIn(userId, password)) })
  }
  const submitOtp = () => {
    if (!otp || !/^\d{6}$/.test(code.trim())) { setError('invalid_otp'); return }
    void run(() => verifyOtp(otp.ticket, code))
  }
  const back = () => { setOtp(null); setCode(''); setError(null) }

  return (
    <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }}>
      <StatusBar style="light" />
      {/* Vòng tròn trang trí như banner web */}
      <View pointerEvents="none" style={{ position: 'absolute', width: 420, height: 420, borderRadius: 210, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.10)', top: -160, right: -140 }} />
      <View pointerEvents="none" style={{ position: 'absolute', width: 300, height: 300, borderRadius: 150, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)', bottom: -90, left: -110 }} />
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20, gap: 20 }} keyboardShouldPersistTaps="handled">
            <View style={{ alignItems: 'center', gap: 12 }}>
              <View style={{ width: 84, height: 84, borderRadius: 24, backgroundColor: '#fff', padding: 12, ...shadow, shadowOpacity: 0.25 }}>
                <Image source={LOGO} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
              </View>
              <View style={{ alignItems: 'center', gap: 2 }}>
                <Text style={{ color: '#fff', fontSize: 28, fontWeight: '800', letterSpacing: 0.5 }}>VINATECH CMS</Text>
                <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14 }}>{otp ? t('mobile.login.otpTitle') : t('login.welcome', { defaultValue: t('mobile.login.title') })}</Text>
              </View>
            </View>

            <View style={{ backgroundColor: C.card, borderRadius: 24, padding: 20, gap: 14, ...shadow, shadowOpacity: 0.18, shadowRadius: 24 }}>
              <Text style={s.h1}>{otp ? t('mobile.login.otpTitle') : t('mobile.login.title')}</Text>
              {!otp ? (
                <>
                  <Field icon="person-outline" placeholder={t('mobile.login.userId')} value={userId} onChangeText={setUserId}
                    autoCapitalize="characters" autoCorrect={false} textContentType="username" returnKeyType="next" editable={!busy} />
                  <Field icon="lock-closed-outline" placeholder={t('mobile.login.password')} value={password} onChangeText={setPassword}
                    secureTextEntry={!showPw} textContentType="password" returnKeyType="go" onSubmitEditing={submit} editable={!busy}
                    right={(
                      <Pressable onPress={() => setShowPw((v) => !v)} hitSlop={10} accessibilityLabel="toggle password">
                        <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={20} color={C.faint} />
                      </Pressable>
                    )} />
                  <Button title={t('mobile.login.submit')} onPress={submit} disabled={busy} icon="log-in-outline" />
                </>
              ) : otp.otpSetup ? (
                <>
                  <Text style={s.body}>{t('mobile.login.otpSetup')}</Text>
                  <Button title={t('mobile.login.back')} kind="ghost" icon="arrow-back" onPress={back} />
                </>
              ) : (
                <>
                  <Text style={s.muted}>{t('mobile.login.otpHint')}</Text>
                  <Field icon="keypad-outline" placeholder="000000" value={code} onChangeText={setCode} keyboardType="number-pad"
                    maxLength={6} textContentType="oneTimeCode" autoFocus editable={!busy} onSubmitEditing={submitOtp} />
                  <Button title={t('mobile.login.verify')} onPress={submitOtp} disabled={busy} icon="shield-checkmark-outline" />
                  <Button title={t('mobile.login.back')} kind="ghost" icon="arrow-back" onPress={back} />
                </>
              )}
              {error && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.dangerSoft, borderRadius: 12, padding: 12 }}>
                  <Ionicons name="alert-circle" size={18} color={C.danger} />
                  <Text style={{ flex: 1, color: C.danger, fontSize: 14 }}>{t(`mobile.err.${error}`, t('mobile.err.generic'))}</Text>
                </View>
              )}
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
              {MOBILE_LANGS.map((l) => {
                const on = i18n.language === l
                return (
                  <Pressable key={l} onPress={() => void setMobileLanguage(l)} hitSlop={6}
                    style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: on ? '#fff' : 'rgba(255,255,255,0.14)' }}>
                    <Text style={{ color: on ? C.brand : '#fff', fontWeight: '700', fontSize: 13 }}>{l.toUpperCase()}</Text>
                  </Pressable>
                )
              })}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  )
}
