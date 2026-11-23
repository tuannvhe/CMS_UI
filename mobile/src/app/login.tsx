/* 2026-11-23 [Truong] - Mobile app: login (+ admin OTP step) */
import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthProvider'
import { errorCode } from '../api/client'
import type { MobileOtpChallenge } from '../api/mobileAuth'
import { MOBILE_LANGS, setMobileLanguage } from '../i18n'
import { Button, C, Card, s } from '../ui'

export default function LoginScreen() {
  const { t, i18n } = useTranslation()
  const { signIn, verifyOtp } = useAuth()
  const [userId, setUserId] = useState('')
  const [password, setPassword] = useState('')
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

  return (
    <SafeAreaView style={s.screen}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[s.content, { flexGrow: 1, justifyContent: 'center' }]} keyboardShouldPersistTaps="handled">
          <View style={{ alignItems: 'center', gap: 4, marginBottom: 12 }}>
            <Text style={[s.h1, { color: C.brand }]}>VINATECH CMS</Text>
            <Text style={s.muted}>{otp ? t('mobile.login.otpTitle') : t('mobile.login.title')}</Text>
          </View>
          <Card style={{ gap: 12 }}>
            {!otp ? (
              <>
                <TextInput style={s.input} placeholder={t('mobile.login.userId')} value={userId} onChangeText={setUserId}
                  autoCapitalize="characters" autoCorrect={false} textContentType="username" returnKeyType="next" editable={!busy} />
                <TextInput style={s.input} placeholder={t('mobile.login.password')} value={password} onChangeText={setPassword}
                  secureTextEntry textContentType="password" returnKeyType="go" onSubmitEditing={submit} editable={!busy} />
                <Button title={t('mobile.login.submit')} onPress={submit} disabled={busy} />
              </>
            ) : otp.otpSetup ? (
              <>
                <Text style={s.body}>{t('mobile.login.otpSetup')}</Text>
                <Button title={t('mobile.login.back')} kind="ghost" onPress={() => { setOtp(null); setCode('') }} />
              </>
            ) : (
              <>
                <Text style={s.muted}>{t('mobile.login.otpHint')}</Text>
                <TextInput style={s.input} placeholder="000000" value={code} onChangeText={setCode} keyboardType="number-pad"
                  maxLength={6} textContentType="oneTimeCode" autoFocus editable={!busy} onSubmitEditing={submitOtp} />
                <Button title={t('mobile.login.verify')} onPress={submitOtp} disabled={busy} />
                <Button title={t('mobile.login.back')} kind="ghost" onPress={() => { setOtp(null); setCode('') }} />
              </>
            )}
            {error && <Text style={s.error}>{t(`mobile.err.${error}`, t('mobile.err.generic'))}</Text>}
          </Card>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 8 }}>
            {MOBILE_LANGS.map((l) => (
              <Pressable key={l} onPress={() => void setMobileLanguage(l)} hitSlop={8}>
                <Text style={[s.muted, i18n.language === l && { color: C.brand, fontWeight: '700' }]}>{l.toUpperCase()}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
