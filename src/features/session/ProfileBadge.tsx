import { useState } from 'react'

// Профиль пользователя сверху: фото из Telegram + никнейм. Фото может отсутствовать
// или протухать (URL Telegram временные) — тогда показываем букву-инициал.
export default function ProfileBadge({
  name,
  photoUrl,
  size = 34,
}: {
  name: string
  photoUrl?: string
  size?: number
}) {
  const [broken, setBroken] = useState(false)
  const initial = name.trim().charAt(0).toUpperCase() || '?'
  const showPhoto = !!photoUrl && !broken
  return (
    <div className="profile">
      {showPhoto ? (
        <img
          className="profile__avatar"
          src={photoUrl}
          alt={name}
          width={size}
          height={size}
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
        />
      ) : (
        <div className="profile__avatar profile__avatar--initial" style={{ width: size, height: size }}>
          {initial}
        </div>
      )}
      <span className="profile__name">{name}</span>
    </div>
  )
}
