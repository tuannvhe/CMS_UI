/*
 * 2026-11-26 - Mobile app: một chủ đề Hỏi đáp (kiểu Messenger, cùng API với web QaWorkspace mode "mine")
 * Không có group = soạn câu hỏi mới: tin đầu tiên tự tạo chủ đề (tiêu đề lấy từ dòng đầu), rồi mở luôn chủ đề đó.
 * 2026-11-26: gửi ảnh (thư viện / máy ảnh, tối đa 4 ảnh, 10 MB), xem ảnh toàn màn hình, ảnh đại diện nhân sự,
 *   bảng emoji + mặt cười gõ chữ (":)" → 🙂) như web, tin chỉ có 1–3 emoji hiện to. Tin mới đến tức thì qua realtime.ts (SignalR).
 */
import { useEffect, useRef, useState, type ComponentRef } from 'react'
import { ActivityIndicator, Alert, Image, Keyboard, Linking, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { Stack, router, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import * as ImagePicker from 'expo-image-picker'
import Ionicons from '@expo/vector-icons/Ionicons'
import { qa, QA_DEFAULT_CHANNEL, type QaChannel, type QaImage, type QaPost } from '@web/api/qa'
import { apiErrorCode } from '@web/api/requests'
import { emojify, isJumboEmoji } from '@web/utils/emoticons'
import { absUrl, api, errorCode } from '../api/client'
import { EMOJI_CATS } from '../emojiData'
import { Avatar, Card, IconBadge, QueryState, useTheme } from '../ui'
import { KeyboardView } from '../keyboard'

const MAX_IMAGES = 4
const MAX_BYTES = 10 * 1024 * 1024

/** Tải một ảnh lên máy chủ (POST /qa/images, trường "file"), trả key để gửi kèm tin. */
async function uploadImage(a: ImagePicker.ImagePickerAsset): Promise<QaImage> {
  const fd = new FormData()
  const name = a.fileName || `photo-${Date.now()}.jpg`
  fd.append('file', { uri: a.uri, name, type: a.mimeType || 'image/jpeg' } as unknown as Blob)
  const r = await api.post<QaImage>('/qa/images', fd, { timeout: 120000, headers: { 'Content-Type': 'multipart/form-data' } })
  return r.data
}

/** Như web: tiêu đề = dòng đầu tiên (tối đa 80 ký tự); quá ngắn thì thêm ngày giờ. */
function autoTitle(text: string) {
  const line = (text.split('\n').find((l) => l.trim()) ?? '').replace(/\s+/g, ' ').trim()
  const s = line.length > 80 ? `${line.slice(0, 79)}…` : line
  if (s.length >= 3) return s
  const d = new Date()
  const at = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  return `${s || '…'} ${at}`.trim()
}

const timeText = (v: string) => {
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return ''
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  return d.toDateString() === new Date().toDateString() ? hm : `${hm} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function QaThreadScreen() {
  const { t } = useTranslation()
  const { C, s } = useTheme()
  const insets = useSafeAreaInsets()
  const qc = useQueryClient()
  const p = useLocalSearchParams<{ channel?: string; group?: string }>()
  const channel: QaChannel = p.channel === 'salary' ? 'salary' : QA_DEFAULT_CHANNEL
  const group = p.group ?? ''
  const isNew = !group
  const [draft, setDraft] = useState('')
  const [images, setImages] = useState<QaImage[]>([])
  const [uploading, setUploading] = useState(0)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [emojiCat, setEmojiCat] = useState(EMOJI_CATS[0].key)
  const [viewer, setViewer] = useState<string | null>(null)
  const sel = useRef({ start: 0, end: 0 })
  const input = useRef<ComponentRef<typeof TextInput>>(null)
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null)

  const conv = useQuery({
    queryKey: ['qa', 'mine', 'conv', channel, group],
    queryFn: () => qa.conversation('mine', channel, group),
    enabled: !isNew,
    refetchInterval: 30_000,   // dự phòng; tin mới đến ngay qua SignalR (realtime.ts)
  })
  const posts = conv.data?.posts ?? []
  useEffect(() => { setTimeout(() => scroller.current?.scrollToEnd({ animated: false }), 50) }, [posts.length, emojiOpen, images.length])

  const errText = (e: unknown) => {
    if (errorCode(e) === 'network') return t('mobile.err.network')
    const { code, detail } = apiErrorCode(e)
    return t(`qa.err.${code === 'too_many' ? (detail ? `too_many_${detail}` : 'too_many') : detail || code}`, { defaultValue: t('mobile.err.generic') })
  }
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['qa', 'mine'] }) }
  const done = () => { setDraft(''); setImages([]); refresh() }
  const keys = () => (images.length ? images.map((x) => x.key) : undefined)
  const ask = useMutation({
    mutationFn: () => qa.ask(QA_DEFAULT_CHANNEL, { title: autoTitle(draft), content: draft.trim(), images: keys() }),
    onSuccess: (r) => { done(); router.setParams({ channel: QA_DEFAULT_CHANNEL, group: r.groupId }) },
    onError: (e) => Alert.alert(t('qa.panel'), errText(e)),
  })
  const reply = useMutation({
    mutationFn: () => qa.reply('mine', conv.data?.thread.channel ?? channel, group, draft.trim(), keys()),
    onSuccess: done,
    onError: (e) => Alert.alert(t('qa.panel'), errText(e)),
  })
  const busy = ask.isPending || reply.isPending
  const len = draft.trim().length
  const canSend = !busy && uploading === 0 && (images.length > 0 ? len <= 4000 : len >= 2)
  const send = () => { if (canSend) (isNew ? ask : reply).mutate() }

  /** Chèn emoji vào đúng chỗ con trỏ. */
  const insertEmoji = (e: string) => {
    const { start, end } = sel.current
    const a = Math.min(start, draft.length), b = Math.min(Math.max(end, a), draft.length)
    setDraft(draft.slice(0, a) + e + draft.slice(b))
    sel.current = { start: a + e.length, end: a + e.length }
  }
  const toggleEmoji = () => {
    if (emojiOpen) { setEmojiOpen(false); input.current?.focus(); return }
    Keyboard.dismiss(); setEmojiOpen(true)
  }

  const pick = async (camera: boolean) => {
    const room = MAX_IMAGES - images.length - uploading
    if (room <= 0) { Alert.alert(t('qa.panel'), t('mobile.chat.maxImages', { n: MAX_IMAGES })); return }
    const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      Alert.alert(t('qa.panel'), t('mobile.chat.noPerm'), [{ text: t('mobile.cancel'), style: 'cancel' }, { text: t('mobile.push.openSettings'), onPress: () => void Linking.openSettings() }])
      return
    }
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.8, allowsMultipleSelection: !camera && room > 1, selectionLimit: room }
    const r = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts)
    if (r.canceled) return
    const list = r.assets.slice(0, room)
    if (list.some((a) => (a.fileSize ?? 0) > MAX_BYTES)) Alert.alert(t('qa.panel'), t('mobile.chat.tooLarge'))
    const ok = list.filter((a) => (a.fileSize ?? 0) <= MAX_BYTES)
    setUploading((n) => n + ok.length)
    for (const a of ok) {
      try {
        const img = await uploadImage(a)
        setImages((cur) => (cur.length < MAX_IMAGES ? [...cur, img] : cur))
      } catch (e) {
        Alert.alert(t('qa.panel'), errText(e))
      } finally {
        setUploading((n) => n - 1)
      }
    }
  }
  const choose = () => {
    Keyboard.dismiss(); setEmojiOpen(false)
    Alert.alert(t('mobile.chat.photo'), undefined, [
      { text: t('mobile.chat.camera'), onPress: () => void pick(true) },
      { text: t('mobile.chat.photo'), onPress: () => void pick(false) },
      { text: t('mobile.cancel'), style: 'cancel' },
    ])
  }

  const cat = EMOJI_CATS.find((c) => c.key === emojiCat) ?? EMOJI_CATS[0]
  const bottomPad = emojiOpen ? 8 : Math.max(insets.bottom, 10)

  return (
    <KeyboardView style={s.screen} bottomInset={Math.max(insets.bottom, 10)}>
      <Stack.Screen options={{ title: isNew ? t('qa.newAsk') : conv.data?.thread.title ?? t('qa.panel') }} />
      <ScrollView ref={scroller} style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 10 }} keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: false })}>
        {isNew ? (
          <Card style={{ gap: 10, alignItems: 'center', paddingVertical: 24 }}>
            <IconBadge name="chatbubbles" size={56} />
            <Text style={[s.h2, { textAlign: 'center' }]}>{t('qa.newChatTitle')}</Text>
            <Text style={[s.muted, { textAlign: 'center' }]}>{t('qa.newChatSub')}</Text>
            <Text style={[s.muted, { textAlign: 'center', fontSize: 12 }]}>{t('qa.contentHint')}</Text>
          </Card>
        ) : (
          <>
            <QueryState loading={conv.isLoading} error={conv.error} onRetry={() => void conv.refetch()} />
            {posts.map((post, i) => <Bubble key={post.id} post={post} first={i === 0 || posts[i - 1].isAsker !== post.isAsker || posts[i - 1].employeeId !== post.employeeId} onImage={setViewer} />)}
            {conv.data && conv.data.thread.awaitingStaff && (
              <Text style={[s.muted, { textAlign: 'center', fontSize: 12, marginTop: 4 }]}>{t('qa.waitingHr')}…</Text>
            )}
          </>
        )}
      </ScrollView>

      {/* Ảnh chờ gửi */}
      {(images.length > 0 || uploading > 0) && (
        <ScrollView horizontal keyboardShouldPersistTaps="handled" style={{ flexGrow: 0, backgroundColor: C.card, borderTopWidth: 1, borderColor: C.border }}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 12, paddingVertical: 8 }}>
          {images.map((img) => (
            <View key={img.key}>
              <Pressable onPress={() => setViewer(img.url)}>
                <Image source={{ uri: absUrl(img.url) }} style={{ width: 64, height: 64, borderRadius: 10, backgroundColor: C.cardAlt }} />
              </Pressable>
              <Pressable onPress={() => setImages((cur) => cur.filter((x) => x.key !== img.key))} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('mobile.chat.removeImage')}
                style={{ position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: C.text, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="close" size={14} color={C.card} />
              </Pressable>
            </View>
          ))}
          {Array.from({ length: uploading }, (_, i) => (
            <View key={`up${i}`} accessibilityLabel={t('mobile.chat.uploading')} style={{ width: 64, height: 64, borderRadius: 10, backgroundColor: C.cardAlt, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color={C.brand} />
            </View>
          ))}
        </ScrollView>
      )}

      {/* Ô soạn tin */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, paddingHorizontal: 8, paddingTop: 8, paddingBottom: bottomPad, borderTopWidth: images.length || uploading ? 0 : 1, borderColor: C.border, backgroundColor: C.card }}>
        <Pressable onPress={choose} hitSlop={4} accessibilityRole="button" accessibilityLabel={t('mobile.chat.photo')}
          style={({ pressed }) => [{ width: 40, height: 46, alignItems: 'center', justifyContent: 'center' }, pressed && { opacity: 0.6 }]}>
          <Ionicons name="image-outline" size={25} color={C.brand} />
        </Pressable>
        <View style={[s.input, { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'flex-end', paddingVertical: 0, paddingRight: 4, borderRadius: 22 }]}>
          <TextInput ref={input} value={draft} onChangeText={setDraft} multiline maxLength={4000} placeholder={isNew ? t('qa.newChatHint') : t('qa.replyMine')} placeholderTextColor={C.faint}
            onSelectionChange={(e) => { sel.current = e.nativeEvent.selection }} onFocus={() => setEmojiOpen(false)}
            style={{ flex: 1, minWidth: 0, maxHeight: 140, paddingVertical: 11, fontSize: 16, color: C.text }} />
          <Pressable onPress={toggleEmoji} hitSlop={6} accessibilityRole="button" accessibilityLabel={emojiOpen ? t('mobile.chat.keyboard') : t('qa.emoji')}
            style={({ pressed }) => [{ width: 36, height: 44, alignItems: 'center', justifyContent: 'center' }, pressed && { opacity: 0.6 }]}>
            <Ionicons name={emojiOpen ? 'keypad-outline' : 'happy-outline'} size={24} color={emojiOpen ? C.brand : C.faint} />
          </Pressable>
        </View>
        <Pressable onPress={send} disabled={!canSend} accessibilityRole="button" accessibilityLabel={t('qa.send')}
          style={({ pressed }) => [{ width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: canSend ? C.brand : C.border }, pressed && { opacity: 0.8 }]}>
          {busy ? <ActivityIndicator color={C.onBrand} /> : <Ionicons name="send" size={20} color={canSend ? C.onBrand : C.faint} />}
        </Pressable>
      </View>

      {/* Bảng emoji (thay chỗ bàn phím) */}
      {emojiOpen && (
        <View style={{ height: 280, backgroundColor: C.card, borderTopWidth: 1, borderColor: C.border, paddingBottom: insets.bottom }}>
          <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderColor: C.border }}>
            {EMOJI_CATS.map((c) => (
              <Pressable key={c.key} onPress={() => setEmojiCat(c.key)} accessibilityRole="tab" accessibilityLabel={t(`qa.emojiCat.${c.key}`)} accessibilityState={{ selected: c.key === emojiCat }}
                style={{ flex: 1, alignItems: 'center', paddingVertical: 8, borderBottomWidth: 2, borderColor: c.key === emojiCat ? C.brand : 'transparent' }}>
                <Text style={{ fontSize: 20 }}>{c.icon}</Text>
              </Pressable>
            ))}
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 6, paddingVertical: 6 }}>
            {cat.list.map((e, i) => (
              <Pressable key={`${e}${i}`} onPress={() => insertEmoji(e)} style={({ pressed }) => [{ width: '12.5%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 8 }, pressed && { backgroundColor: C.cardAlt }]}>
                <Text style={{ fontSize: 26 }}>{e}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      <ImageViewer url={viewer} onClose={() => setViewer(null)} />
    </KeyboardView>
  )
}

/** Xem ảnh toàn màn hình, chạm để đóng. */
function ImageViewer({ url, onClose }: { url: string | null; onClose: () => void }) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  return (
    <Modal visible={!!url} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' }}>
        {url && <Image source={{ uri: absUrl(url) }} style={{ width: '100%', height: '80%' }} resizeMode="contain" />}
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t('mobile.chat.close')} hitSlop={10}
          style={{ position: 'absolute', top: insets.top + 12, right: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="close" size={24} color="#fff" />
        </Pressable>
      </Pressable>
    </Modal>
  )
}

/** Tin của mình bên phải (màu thương hiệu), tin nhân sự bên trái kèm ảnh đại diện. Tin chỉ 1–3 emoji hiện to, không khung. */
function Bubble({ post, first, onImage }: { post: QaPost; first: boolean; onImage: (u: string) => void }) {
  const { C, s } = useTheme()
  const mine = post.isAsker
  const text = emojify(post.content.trim())
  const jumbo = !post.images?.length && isJumboEmoji(text)
  const content = (
    <View style={{ alignItems: mine ? 'flex-end' : 'flex-start', gap: 3, flexShrink: 1, maxWidth: '100%' }}>
      {!mine && first && <Text style={[s.muted, { fontSize: 12, marginLeft: 6 }]}>{post.name}</Text>}
      {jumbo ? (
        <Text style={{ fontSize: 44, lineHeight: 54 }} selectable>{text}</Text>
      ) : (
        <View style={{
          paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, gap: 8,
          backgroundColor: mine ? C.brand : C.card, borderWidth: mine ? 0 : 1, borderColor: C.border,
          borderBottomRightRadius: mine ? 6 : 18, borderBottomLeftRadius: mine ? 18 : 6,
        }}>
          {!!text && <Text style={[s.body, { color: mine ? C.onBrand : C.text }]} selectable>{text}</Text>}
          {!!post.images?.length && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {post.images.map((u) => (
                <Pressable key={u} onPress={() => onImage(u)} accessibilityRole="imagebutton">
                  <Image source={{ uri: absUrl(u) }} style={{ width: post.images!.length === 1 ? 200 : 110, height: post.images!.length === 1 ? 200 : 110, borderRadius: 10, backgroundColor: C.cardAlt }} />
                </Pressable>
              ))}
            </View>
          )}
        </View>
      )}
      <Text style={[s.muted, { fontSize: 11, marginHorizontal: 6 }]}>{timeText(post.createdAt)}</Text>
    </View>
  )
  if (mine) return <View style={{ alignItems: 'flex-end', paddingLeft: 48 }}>{content}</View>
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingRight: 40 }}>
      <View style={{ width: 32, marginBottom: 18 }}>{first ? <Avatar name={post.name} uri={post.avatarUrl} size={32} /> : null}</View>
      {content}
    </View>
  )
}
