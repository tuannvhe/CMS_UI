import { useMemo, useState } from 'react'
import { Button, Popover, Tooltip } from 'antd'
import { ClockCircleOutlined, SmileOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'

/**
 * Bảng chọn biểu tượng cảm xúc cho ô nhập tin (không cần thư viện): ~560 emoji chia nhóm + mục "Dùng gần đây" lưu trên trình duyệt.
 * Chỉ dùng emoji có từ bản Unicode cũ để máy Windows 10 / điện thoại đời cũ trong xưởng vẫn hiện được.
 */
const CATS: { key: string; icon: string; list: string[] }[] = [
  { key: 'smile', icon: '😀', list: "😀 😃 😄 😁 😆 😅 🤣 😂 🙂 🙃 😉 😊 😇 🥰 😍 🤩 😘 😗 😚 😙 😋 😛 😜 🤪 😝 🤑 🤗 🤭 🤫 🤔 🤐 🤨 😐 😑 😶 😏 😒 🙄 😬 🤥 😌 😔 😪 🤤 😴 😷 🤒 🤕 🤢 🤮 🤧 🥵 🥶 🥴 😵 🤯 🤠 🥳 😎 🤓 🧐 😕 😟 🙁 ☹️ 😮 😯 😲 😳 🥺 😦 😧 😨 😰 😥 😢 😭 😱 😖 😣 😞 😓 😩 😫 🥱 😤 😡 😠 🤬 😈 👿 💀 🤡 👻 👽 🤖 😺 😸 😹 😻 😼 😽 🙀 😿 😾 🙈 🙉 🙊".split(' ') },
  { key: 'hand', icon: '👍', list: "👍 👎 👌 🤌 🤏 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ ✋ 🤚 🖐️ 🖖 👋 👏 🙌 👐 🤲 🤝 🙏 ✍️ 💅 💪 🦾 🦵 🦶 👂 👃 🧠 👀 👁️ 👅 👄 👶 🧒 👦 👧 🧑 👨 👩 🧓 👴 👵 🙋 🙆 🙅 🤷 🤦 🙇 💁 🙎 🙍 👮 👷 💂 🕵️ 👩‍⚕️ 👨‍⚕️ 👩‍🏭 👨‍🏭 👩‍💼 👨‍💼 👩‍💻 👨‍💻 👩‍🔧 👨‍🔧 🧑‍🤝‍🧑 👪".split(' ') },
  { key: 'heart', icon: '❤️', list: "❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 💟 💌 💋 💯 💢 💥 💫 💦 💨 🕳️ 💬 💭 💤 ✨ 🌟 ⭐ 🔥 🎉 🎊 🎈 🎁 🏆 🥇 🥈 🥉 🏅 🎖️".split(' ') },
  { key: 'work', icon: '💼', list: "💼 📁 📂 🗂️ 📄 📃 📑 📊 📈 📉 📋 📌 📍 📎 🖇️ 📏 📐 ✂️ 🗃️ 🗄️ 🗑️ 🔒 🔓 🔑 🗝️ 🔨 🛠️ 🔧 🔩 ⚙️ 🏭 🏢 🏬 🏥 🏦 🏫 💻 🖥️ 🖨️ ⌨️ 🖱️ 💾 💿 📱 📲 ☎️ 📞 📟 📠 📧 📨 📩 📤 📥 📦 📫 📮 📝 ✏️ 🖊️ 🖋️ ✒️ 🖍️ 📅 📆 🗓️ ⏰ ⏱️ ⏲️ 🕐 ⌛ ⏳ 💰 💵 💴 💶 💷 💳 🧾 💸 🪙 🏷️ 🔖 🔍 🔎 💡 🔦 🧯 🦺 ⛑️ 🚧 🚚 🚛 🚌 🚐 🚗 🛵 🚲 ✈️".split(' ') },
  { key: 'food', icon: '☕', list: "☕ 🍵 🧃 🥤 🧋 🍺 🍻 🥂 🍷 🥛 🍼 🍚 🍜 🍲 🍛 🍝 🍞 🥖 🥐 🥪 🍔 🍟 🍕 🌭 🌮 🥗 🍣 🍱 🥟 🍤 🍗 🍖 🥩 🍳 🥚 🧀 🍰 🎂 🧁 🍩 🍪 🍫 🍬 🍭 🍦 🍨 🍧 🍎 🍏 🍐 🍊 🍋 🍌 🍉 🍇 🍓 🍈 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🥑 🥦 🥬 🥒 🌶️ 🌽 🥕 🧄 🧅 🥔".split(' ') },
  { key: 'nature', icon: '☀️', list: "☀️ 🌤️ ⛅ 🌥️ ☁️ 🌦️ 🌧️ ⛈️ 🌩️ ❄️ ☃️ ⛄ 🌬️ 🌪️ 🌫️ 🌈 ☔ ⚡ 🌙 🌛 🌝 🌞 🌍 🌏 🌱 🌿 ☘️ 🍀 🌵 🌴 🌳 🌲 🍁 🍂 🍃 🌸 🌼 🌻 🌺 🌹 🌷 💐 🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🐔 🐧 🐦 🐤 🦆 🦉 🐝 🦋 🐌 🐞 🐢 🐍 🐟 🐠 🐬 🐳".split(' ') },
  { key: 'symbol', icon: '✅', list: "✅ ☑️ ✔️ ❌ ❎ ➕ ➖ ✖️ ➗ ❓ ❔ ❗ ❕ ‼️ ⁉️ ⚠️ 🚫 ⛔ 📛 🔴 🟠 🟡 🟢 🔵 🟣 ⚫ ⚪ 🟥 🟧 🟨 🟩 🟦 🟪 ⬛ ⬜ 🔶 🔷 🔸 🔹 🔺 🔻 ⬆️ ⬇️ ⬅️ ➡️ ↗️ ↘️ ↙️ ↖️ ↩️ ↪️ 🔄 🔃 🔁 ▶️ ⏸️ ⏹️ ⏩ ⏪ 🔔 🔕 📢 📣 🆗 🆕 🆓 🆒 🆘 🔝 🔜 ℹ️ ©️ ®️ ™️ #️⃣ 0️⃣ 1️⃣ 2️⃣ 3️⃣ 4️⃣ 5️⃣ 6️⃣ 7️⃣ 8️⃣ 9️⃣ 🔟 💲 ♻️ 🇻🇳 🇰🇷".split(' ') },
]

const RECENT_KEY = 'cmsvn:emoji-recent'
const RECENT_MAX = 32
const readRecent = (): string[] => { try { const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]'); return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, RECENT_MAX) : [] } catch { return [] } }

export function EmojiPicker({ onPick, className }: { onPick: (emoji: string) => void; className?: string }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [recent, setRecent] = useState<string[]>(readRecent)
  const [tab, setTab] = useState<string>(() => (readRecent().length ? 'recent' : CATS[0].key))
  const list = useMemo(() => (tab === 'recent' ? recent : CATS.find((c) => c.key === tab)?.list ?? []), [tab, recent])
  const pick = (e: string) => {
    onPick(e)
    const next = [e, ...recent.filter((x) => x !== e)].slice(0, RECENT_MAX)
    setRecent(next)
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)) } catch { /* không lưu được thì thôi */ }
  }
  const label = t('qa.emoji')
  return (
    <Popover open={open} onOpenChange={setOpen} trigger="click" placement="topLeft" arrow={false} content={(
      <div className="emoji-pick">
        <div className="ep-tabs" role="tablist" aria-label={label}>
          <Tooltip title={t('qa.emojiCat.recent')}><button type="button" role="tab" aria-selected={tab === 'recent'} aria-label={t('qa.emojiCat.recent')} className={tab === 'recent' ? 'on' : ''} onClick={() => setTab('recent')}><ClockCircleOutlined /></button></Tooltip>
          {CATS.map((c) => (
            <Tooltip key={c.key} title={t(`qa.emojiCat.${c.key}`)}><button type="button" role="tab" aria-selected={tab === c.key} aria-label={t(`qa.emojiCat.${c.key}`)} className={tab === c.key ? 'on' : ''} onClick={() => setTab(c.key)}>{c.icon}</button></Tooltip>
          ))}
        </div>
        <div className="ep-title">{t(`qa.emojiCat.${tab}`)}</div>
        <div className="ep-grid" role="listbox" aria-label={t(`qa.emojiCat.${tab}`)}>
          {list.length === 0 ? <div className="ep-empty">{t('qa.emojiNone')}</div> : list.map((e) => (
            <button key={e} type="button" role="option" aria-selected={false} onClick={() => pick(e)}>{e}</button>
          ))}
        </div>
      </div>
    )}>
      <Tooltip title={open ? undefined : label}><Button type="text" shape="circle" className={className} icon={<SmileOutlined />} aria-label={label} /></Tooltip>
    </Popover>
  )
}
