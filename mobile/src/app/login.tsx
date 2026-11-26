/* 2026-11-23 [Truong] - Mobile app: login (+ admin OTP step)
 * 2026-11-26: thiết kế lại (dải màu thương hiệu phía trên + tấm nhập liệu), màu theo theme,
 * màn khoá đăng nhập bằng vân tay / Face ID (tự hỏi khi mở; có thể nhập mật khẩu hoặc đổi tài khoản).
 * 2026-11-26: ô "Ghi nhớ đăng nhập" + "Dùng vân tay / Face ID lần sau"; đã bật thì lần sau (kể cả sau khi đăng xuất) bấm vân tay là vào, điền sẵn mã người dùng. */
import { useEffect, useRef, useState } from 'react'
import { Image, Pressable, ScrollView, Text, TextInput, View, type TextInputProps } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { StatusBar } from 'expo-status-bar'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useTranslation } from 'react-i18next'
import { bioLabel, useAuth } from '../auth/AuthProvider'
import { errorCode } from '../api/client'
import type { MobileOtpChallenge } from '../api/mobileAuth'
import { MOBILE_LANGS, setMobileLanguage } from '../i18n'
import { KeyboardView } from '../keyboard'
import { Avatar, Button, type IconName, useTheme } from '../ui'

/** Logo VINATECH dùng chung với web (CMS_UI/src/assets). */
const LOGO = require('../../../src/assets/logo1.png')

function Field({ icon, right, label, ...props }: TextInputProps & { icon: IconName; label: string; right?: React.ReactNode }) {
  const { C, s } = useTheme()
  const [focus, setFocus] = useState(false)
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: C.muted, fontSize: 13, fontWeight: '600' }}>{label}</Text>
      <View style={[s.input, { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 0, minHeight: 52 }, focus && { borderColor: C.brand, borderWidth: 1.5 }]}>
        <Ionicons name={icon} size={20} color={focus ? C.brand : C.faint} />
        <TextInput {...props} accessibilityLabel={label} placeholderTextColor={C.faint} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
          style={{ flex: 1, minWidth: 0, paddingVertical: 14, fontSize: 16, color: C.text }} />
        {right}
      </View>
    </View>
  )
}

/** Ô chọn có nhãn (ghi nhớ đăng nhập, vân tay lần sau). */
function Check({ on, onToggle, label, icon }: { on: boolean; onToggle: () => void; label: string; icon?: IconName }) {
  const { C } = useTheme()
  return (
    <Pressable onPress={onToggle} hitSlop={6} accessibilityRole="checkbox" accessibilityState={{ checked: on }}
      style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 40 }, pressed && { opacity: 0.7 }]}>
      <View style={{ width: 22, height: 22, borderRadius: 7, borderWidth: 2, borderColor: on ? C.brand : C.faint, backgroundColor: on ? C.brand : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
        {on && <Ionicons name="checkmark" size={16} color={C.onBrand} />}
      </View>
      {icon && <Ionicons name={icon} size={18} color={C.muted} />}
      <Text style={{ flex: 1, color: C.text, fontSize: 15 }}>{label}</Text>
    </Pressable>
  )
}

export default function LoginScreen() {
  const { t, i18n } = useTranslation()
  const { C, s, grad } = useTheme()
  const insets = useSafeAreaInsets()
  const { status, user, signIn, verifyOtp, signOut, unlock, bioKind, savedLogin, bioSignInReady, bioSignIn, remember } = useAuth()
  const locked = status === 'locked' && !!user
  const [usePassword, setUsePassword] = useState(false)
  const [userId, setUserId] = useState(savedLogin?.userId ?? '')
  const [rememberMe, setRememberMe] = useState(remember)
  const [bioNext, setBioNext] = useState(true)
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [code, setCode] = useState('')
  const [otp, setOtp] = useState<MobileOtpChallenge | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const asked = useRef(false)

  const run = async (work: () => Promise<void>) => {
    setBusy(true); setError(null)
    try { await work() } catch (e) { setError(errorCode(e)) } finally { setBusy(false) }
  }

  const tryBio = async () => {
    setError(null)
    if (!(await unlock())) setError('bio_failed')
  }
  // Không còn phiên nhưng đã bật vân tay lần trước: hỏi vân tay rồi đăng nhập bằng thông tin đã cất
  const quickBio = bioSignInReady && !!bioKind && !locked
  const tryBioSignIn = () => void run(async () => {
    const r = await bioSignIn()
    if (r.result === 'otp' && r.otp) setOtp(r.otp)
    else if (r.result === 'cancel') setError('bio_failed')
    else if (r.result === 'stale') setError('bio_stale')
    else if (r.result !== 'ok') setError(r.result)
  })
  // Màn khoá / đăng nhập nhanh: tự hỏi vân tay / Face ID một lần khi mở
  useEffect(() => {
    if (asked.current) return
    if (locked) { asked.current = true; void tryBio() }
    else if (quickBio) { asked.current = true; tryBioSignIn() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked, quickBio])
  useEffect(() => { if (!userId && savedLogin?.userId) setUserId(savedLogin.userId) }, [savedLogin, userId])

  const id = locked ? user.userId : userId
  const submit = () => {
    if (!id.trim() || !password) { setError('invalid_input'); return }
    // Màn khoá nhập lại mật khẩu: giữ nguyên lựa chọn cũ; màn đăng nhập: theo hai ô bên dưới
    void run(async () => { setOtp(await signIn(id, password, locked ? undefined : { remember: rememberMe, bio: bioNext && !!bioKind })) })
  }
  const submitOtp = () => {
    if (!otp || !/^\d{6}$/.test(code.trim())) { setError('invalid_otp'); return }
    void run(() => verifyOtp(otp.ticket, code))
  }
  const back = () => { setOtp(null); setCode(''); setError(null) }
  const switchAccount = () => void run(async () => { setUsePassword(false); setPassword(''); setUserId(''); await signOut(true) })

  const bioName = bioLabel(bioKind)
  const bioIcon: IconName = bioKind === 'face' ? 'scan-outline' : 'finger-print'

  const passwordField = (
    <Field icon="lock-closed-outline" label={t('mobile.login.password')} placeholder="••••••" value={password} onChangeText={setPassword}
      secureTextEntry={!showPw} textContentType="password" returnKeyType="go" onSubmitEditing={submit} editable={!busy} autoFocus={locked}
      right={(
        <Pressable onPress={() => setShowPw((v) => !v)} hitSlop={12} accessibilityRole="button" accessibilityLabel={t(showPw ? 'mobile.login.hidePw' : 'mobile.login.showPw')}>
          <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={20} color={C.faint} />
        </Pressable>
      )} />
  )

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar style="light" />
      <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 320 }}>
        <View pointerEvents="none" style={{ position: 'absolute', width: 360, height: 360, borderRadius: 180, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)', top: -170, right: -120 }} />
        <View pointerEvents="none" style={{ position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(255,255,255,0.06)', bottom: -90, left: -70 }} />
      </LinearGradient>
      <KeyboardView bottomInset={insets.bottom + 24}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24, paddingHorizontal: 20, gap: 24 }} keyboardShouldPersistTaps="handled">
          <View style={{ alignItems: 'center', gap: 14 }}>
            <View style={{ width: 76, height: 76, borderRadius: 22, backgroundColor: '#fff', padding: 12 }}>
              <Image source={LOGO} style={{ width: '100%', height: '100%' }} resizeMode="contain" accessibilityLabel="VINATECH" />
            </View>
            <View style={{ alignItems: 'center', gap: 4 }}>
              <Text style={{ color: '#fff', fontSize: 26, fontWeight: '800', letterSpacing: 0.3 }}>VINATECH CMS</Text>
            </View>
          </View>

          <View style={[s.card, { borderRadius: 24, padding: 20, gap: 16 }]}>
            {locked && !otp ? (
              <>
                <View style={{ alignItems: 'center', gap: 10, paddingTop: 4 }}>
                  <Avatar name={user.fullName} size={64} />
                  <View style={{ alignItems: 'center' }}>
                    <Text style={[s.muted, { fontSize: 14 }]}>{t('mobile.bioLogin.hello')}</Text>
                    <Text style={[s.h2, { fontSize: 20 }]} numberOfLines={1}>{user.fullName}</Text>
                    <Text style={s.muted}>{user.employeeId || user.userId}</Text>
                  </View>
                </View>
                {!usePassword ? (
                  <>
                    <Pressable onPress={() => void tryBio()} accessibilityRole="button" accessibilityLabel={t('mobile.bioLogin.useBio', { name: bioName })}
                      style={({ pressed }) => [{ alignSelf: 'center', width: 96, height: 96, borderRadius: 48, backgroundColor: C.brandSoft, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.brand }, pressed && { opacity: 0.7 }]}>
                      <Ionicons name={bioIcon} size={48} color={C.brand} />
                    </Pressable>
                    <Text style={[s.body, { textAlign: 'center', color: C.muted }]}>{t('mobile.bioLogin.tapToUse', { name: bioName })}</Text>
                    <Button kind="ghost" icon="key-outline" title={t('mobile.bioLogin.usePassword')} onPress={() => { setError(null); setUsePassword(true) }} />
                  </>
                ) : (
                  <>
                    {passwordField}
                    <Button title={t('mobile.login.submit')} onPress={submit} loading={busy} icon="log-in-outline" />
                    {!!bioKind && <Button kind="ghost" icon={bioIcon} title={t('mobile.bioLogin.useBio', { name: bioName })} onPress={() => { setUsePassword(false); void tryBio() }} />}
                  </>
                )}
                <Pressable onPress={switchAccount} disabled={busy} hitSlop={8} style={{ alignSelf: 'center', padding: 6 }} accessibilityRole="button">
                  <Text style={{ color: C.brand, fontWeight: '700', fontSize: 14 }}>{t('mobile.bioLogin.switch')}</Text>
                </Pressable>
              </>
            ) : !otp ? (
              <>
                <Text style={[s.h1, { fontSize: 22 }]}>{savedLogin ? t('mobile.login.welcomeBack', { name: savedLogin.fullName }) : t('mobile.login.title')}</Text>
                {quickBio && (
                  <>
                    <Pressable onPress={tryBioSignIn} disabled={busy} accessibilityRole="button" accessibilityLabel={t('mobile.bioLogin.useBio', { name: bioName })}
                      style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 18, backgroundColor: C.brandSoft, borderWidth: 1.5, borderColor: C.brand }, pressed && { opacity: 0.75 }]}>
                      <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name={bioIcon} size={28} color={C.onBrand} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: C.brand, fontWeight: '800', fontSize: 16 }}>{t('mobile.bioLogin.useBio', { name: bioName })}</Text>
                        <Text style={[s.muted]} numberOfLines={1}>{savedLogin?.userId}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color={C.brand} />
                    </Pressable>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View style={[s.divider, { flex: 1 }]} />
                      <Text style={[s.muted, { fontSize: 12 }]}>{t('mobile.login.orPassword')}</Text>
                      <View style={[s.divider, { flex: 1 }]} />
                    </View>
                  </>
                )}
                <Field icon="person-outline" label={t('mobile.login.userId')} placeholder={t('mobile.login.userIdHint')} value={userId} onChangeText={setUserId}
                  autoCapitalize="characters" autoCorrect={false} textContentType="username" returnKeyType="next" editable={!busy} />
                {passwordField}
                <View style={{ gap: 2 }}>
                  <Check on={rememberMe} onToggle={() => setRememberMe((v) => !v)} label={t('mobile.login.remember')} />
                  {!!bioKind && <Check on={bioNext} onToggle={() => setBioNext((v) => !v)} icon={bioIcon} label={t('mobile.login.bioNext', { name: bioName })} />}
                </View>
                <Button title={t('mobile.login.submit')} onPress={submit} loading={busy} icon="log-in-outline" />
                {!!savedLogin && (
                  <Pressable onPress={switchAccount} disabled={busy} hitSlop={8} style={{ alignSelf: 'center', padding: 4 }} accessibilityRole="button">
                    <Text style={{ color: C.brand, fontWeight: '700', fontSize: 14 }}>{t('mobile.bioLogin.switch')}</Text>
                  </Pressable>
                )}
              </>
            ) : otp.otpSetup ? (
              <>
                <Text style={[s.h1, { fontSize: 22 }]}>{t('mobile.login.otpTitle')}</Text>
                <Text style={s.body}>{t('mobile.login.otpSetup')}</Text>
                <Button title={t('mobile.login.back')} kind="ghost" icon="arrow-back" onPress={back} />
              </>
            ) : (
              <>
                <Text style={[s.h1, { fontSize: 22 }]}>{t('mobile.login.otpTitle')}</Text>
                <Text style={s.muted}>{t('mobile.login.otpHint')}</Text>
                <Field icon="keypad-outline" label="OTP" placeholder="000000" value={code} onChangeText={setCode} keyboardType="number-pad"
                  maxLength={6} textContentType="oneTimeCode" autoFocus editable={!busy} onSubmitEditing={submitOtp} />
                <Button title={t('mobile.login.verify')} onPress={submitOtp} loading={busy} icon="shield-checkmark-outline" />
                <Button title={t('mobile.login.back')} kind="ghost" icon="arrow-back" onPress={back} />
              </>
            )}
            {error && (
              <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.dangerSoft, borderRadius: 12, padding: 12 }}>
                <Ionicons name="alert-circle" size={18} color={C.danger} />
                <Text style={{ flex: 1, color: C.danger, fontSize: 14 }}>
                  {error === 'bio_failed' ? t('mobile.bioLogin.failed', { name: bioName }) : error === 'bio_stale' ? t('mobile.bioLogin.stale', { name: bioName }) : t(`mobile.err.${error}`, t('mobile.err.generic'))}
                </Text>
              </View>
            )}
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 'auto' }}>
            {MOBILE_LANGS.map((l) => {
              const on = i18n.language === l
              return (
                <Pressable key={l} onPress={() => void setMobileLanguage(l)} hitSlop={6} accessibilityRole="button" accessibilityState={{ selected: on }}
                  style={{ minWidth: 48, alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: on ? C.brand : C.card, borderWidth: 1, borderColor: on ? C.brand : C.border }}>
                  <Text style={{ color: on ? C.onBrand : C.muted, fontWeight: '700', fontSize: 13 }}>{l.toUpperCase()}</Text>
                </Pressable>
              )
            })}
          </View>
        </ScrollView>
      </KeyboardView>
    </View>
  )
}
