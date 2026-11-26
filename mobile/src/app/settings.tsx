/*
 * 2026-11-26 - Mobile app: settings (opened from the avatar on every tab)
 * Profile, display mode (light / dark / system), color theme (same palettes as the web Settings › Appearance),
 * sign in with fingerprint / Face ID, language, sign out.
 * 2026-11-26: trạng thái thông báo đẩy trên máy này (vì sao chưa nhận được) + nút bật lại.
 */
import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, Switch, Text, View } from 'react-native'
import { Stack } from 'expo-router'
import Constants from 'expo-constants'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useTranslation } from 'react-i18next'
import { PALETTES } from '@web/theme/tokens'
import { bioLabel, useAuth } from '../auth/AuthProvider'
import { MOBILE_LANGS, setMobileLanguage } from '../i18n'
import { registerPush, type PushState } from '../push'
import { PALETTE_KEYS, type ThemeMode } from '../theme'
import { Avatar, Button, Card, IconBadge, Segmented, SectionTitle, useMyAvatar, useTheme } from '../ui'

const LANG_NAME: Record<string, string> = { vi: 'Tiếng Việt', en: 'English', ko: '한국어' }

export default function SettingsScreen() {
  const { t, i18n } = useTranslation()
  const { C, s, palette, setPalette, mode, setMode } = useTheme()
  const { user, signOut, bioKind, bioOn, setBioOn } = useAuth()
  const myAvatar = useMyAvatar()
  const bioName = bioLabel(bioKind)

  const askLogout = () => Alert.alert(user?.fullName ?? t('mobile.logout'), t('mobile.logoutAsk'), [
    { text: t('mobile.cancel'), style: 'cancel' },
    { text: t('mobile.logout'), style: 'destructive', onPress: () => void signOut() },
  ])

  // Đăng ký lại push token mỗi lần mở Cài đặt (không hại gì) để biết chắc máy này đang nhận được thông báo chưa
  const [push, setPush] = useState<PushState | null>(null)
  const [pushBusy, setPushBusy] = useState(false)
  const retryPush = async () => { setPushBusy(true); setPush(await registerPush()); setPushBusy(false) }
  useEffect(() => { void retryPush() }, [])

  const toggleBio = async (v: boolean) => {
    const ok = await setBioOn(v)
    if (!ok && v) Alert.alert(t('mobile.bioLogin.failed', { name: bioName }))
  }

  return (
    <>
      <Stack.Screen options={{ title: t('mobile.settings.title') }} />
      <ScrollView style={s.screen} contentContainerStyle={[s.content, { paddingTop: 12 }]}>
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Avatar name={user?.fullName} size={56} uri={myAvatar} />
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text style={[s.h2, { fontSize: 18 }]} numberOfLines={1}>{user?.fullName}</Text>
            <Text style={s.muted} numberOfLines={1}>{[user?.employeeId || user?.userId, user?.groupName].filter(Boolean).join(' · ')}</Text>
          </View>
        </Card>

        <SectionTitle title={t('settings.theme')} />
        <Card style={{ gap: 12 }}>
          <Segmented<ThemeMode> value={mode} onChange={setMode} items={[
            { key: 'light', label: t('mobile.settings.light'), icon: 'sunny-outline' },
            { key: 'dark', label: t('mobile.settings.dark'), icon: 'moon-outline' },
            { key: 'system', label: t('mobile.settings.system'), icon: 'phone-portrait-outline' },
          ]} />
        </Card>

        <SectionTitle title={t('settings.palette')} />
        <Card style={{ gap: 4 }}>
          <Text style={[s.muted, { marginBottom: 8 }]}>{t('settings.paletteDesc')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 14 }}>
            {PALETTE_KEYS.map((k) => {
              const p = PALETTES[k]
              const on = k === palette
              return (
                <Pressable key={k} onPress={() => setPalette(k)} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={t(`settings.palettes.${k}`)}
                  style={({ pressed }) => [{ width: '33.33%', alignItems: 'center', gap: 6 }, pressed && { opacity: 0.7 }]}>
                  <View style={{ width: 52, height: 52, borderRadius: 26, padding: 3, borderWidth: 2, borderColor: on ? p.primary : 'transparent' }}>
                    <View style={{ flex: 1, borderRadius: 23, overflow: 'hidden', flexDirection: 'row' }}>
                      <View style={{ flex: 1, backgroundColor: p.primary }} />
                      <View style={{ flex: 1, backgroundColor: p.accent }} />
                    </View>
                    {on && (
                      <View style={{ position: 'absolute', right: -2, bottom: -2, width: 20, height: 20, borderRadius: 10, backgroundColor: p.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.card }}>
                        <Ionicons name="checkmark" size={12} color="#fff" />
                      </View>
                    )}
                  </View>
                  <Text style={{ fontSize: 13, color: on ? C.text : C.muted, fontWeight: on ? '700' : '500' }} numberOfLines={1}>{t(`settings.palettes.${k}`)}</Text>
                </Pressable>
              )
            })}
          </View>
        </Card>

        <SectionTitle title={t('mobile.settings.security')} />
        <Card style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <IconBadge name={bioKind === 'face' ? 'scan-outline' : 'finger-print'} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={s.body}>{t('mobile.bioLogin.toggle', { name: bioName })}</Text>
              <Text style={s.muted}>{bioKind ? t('mobile.bioLogin.toggleHint') : t('mobile.bioLogin.unavailable')}</Text>
            </View>
            <Switch value={bioOn} disabled={!bioKind} onValueChange={(v) => void toggleBio(v)}
              trackColor={{ true: C.brand, false: C.border }} thumbColor="#fff" accessibilityLabel={t('mobile.bioLogin.toggle', { name: bioName })} />
          </View>
        </Card>

        <SectionTitle title={t('mobile.push.title')} />
        <Card style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <IconBadge name={push === 'on' ? 'notifications' : 'notifications-off-outline'} color={push === 'on' ? C.brand : push ? C.warn : C.muted} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={s.body}>{push === 'on' ? t('mobile.push.on') : t('mobile.push.off')}</Text>
              {push && push !== 'on' && <Text style={s.muted}>{t(`mobile.push.${push}`)}</Text>}
            </View>
            {pushBusy ? <ActivityIndicator color={C.brand} /> : null}
          </View>
          {push === 'denied' && <Button title={t('mobile.push.openSettings')} kind="outline" small icon="settings-outline" onPress={() => void Linking.openSettings()} />}
          {push && push !== 'on' && push !== 'denied' && !pushBusy && <Button title={t('mobile.retry')} kind="ghost" small icon="refresh" onPress={() => void retryPush()} />}
        </Card>

        <SectionTitle title={t('settings.language', { defaultValue: t('mobile.settings.language') })} />
        <Card style={{ paddingVertical: 4 }}>
          {MOBILE_LANGS.map((l, i) => {
            const on = i18n.language === l
            return (
              <Pressable key={l} onPress={() => void setMobileLanguage(l)} accessibilityRole="radio" accessibilityState={{ checked: on }}
                style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', minHeight: 50, gap: 12 }, i > 0 && { borderTopWidth: 1, borderColor: C.border }, pressed && { opacity: 0.7 }]}>
                <Text style={[s.body, { flex: 1 }, on && { fontWeight: '700' }]}>{LANG_NAME[l]}</Text>
                {on && <Ionicons name="checkmark-circle" size={22} color={C.brand} />}
              </Pressable>
            )
          })}
        </Card>

        <View style={{ marginTop: 8 }}>
          <Button kind="danger" icon="log-out-outline" title={t('mobile.logout')} onPress={askLogout} />
        </View>
        <Text style={[s.muted, { textAlign: 'center', fontSize: 12 }]}>VINATECH CMS · {Constants.expoConfig?.version ?? ''}</Text>
      </ScrollView>
    </>
  )
}
