import hubClient from "../api/hubClient.ts";

const localization_strings = {
  voiceRooms: {
    general: {
      roomName: {
        en: "{username}'s room",
        ru: "Комната {username}",
        uk: "Кімната {username}",
      },
      joinToCreateName: {
        en: "➕ Join to Create",
        ru: "➕ Зайти чтобы создать",
        uk: "➕ Увійти щоб створити",
      },
      waitingRoomName: {
        en: "🕒 Waiting — {name}",
        ru: "🕒 Ожидание — {name}",
        uk: "🕒 Очікування — {name}",
      },
      setupSuccess: {
        en: "Voice rooms are ready. Join-to-create channel: {channel}.",
        ru: "Голосовые комнаты готовы. Канал создания: {channel}.",
        uk: "Голосові кімнати готові. Канал створення: {channel}.",
      },
      updated: {
        en: "Voice room updated.",
        ru: "Голосовая комната обновлена.",
        uk: "Голосова кімната оновлена.",
      },
      setupError: {
        en: "Unable to configure voice rooms.",
        ru: "Не удалось настроить голосовые комнаты.",
        uk: "Не вдалося налаштувати голосові кімнати.",
      },
    },
    panel: {
      title: {
        en: "Voice Room",
        ru: "Голосовая комната",
        uk: "Голосова кімната",
      },
      owner: {
        en: "Owner",
        ru: "Владелец",
        uk: "Власник",
      },
      members: {
        en: "Members",
        ru: "Участники",
        uk: "Учасники",
      },
      memberList: {
        en: "In Channel",
        ru: "В канале",
        uk: "У каналі",
      },
      limit: {
        en: "User limit",
        ru: "Лимит",
        uk: "Ліміт",
      },
      limitNone: {
        en: "Unlimited",
        ru: "Без лимита",
        uk: "Без ліміту",
      },
      bitrate: {
        en: "Bitrate",
        ru: "Битрейт",
        uk: "Бітрейт",
      },
      region: {
        en: "Region",
        ru: "Регион",
        uk: "Регіон",
      },
      regionAuto: {
        en: "Auto",
        ru: "Авто",
        uk: "Авто",
      },
    },
    status: {
      locked: {
        en: "Locked",
        ru: "Закрыта",
        uk: "Закрита",
      },
      unlocked: {
        en: "Open",
        ru: "Открыта",
        uk: "Відкрита",
      },
      hidden: {
        en: "Hidden",
        ru: "Скрыта",
        uk: "Прихована",
      },
      visible: {
        en: "Visible",
        ru: "Видима",
        uk: "Видима",
      },
    },
    buttons: {
      lock: {
        en: "Lock",
        ru: "Закрыть",
        uk: "Закрити",
      },
      unlock: {
        en: "Unlock",
        ru: "Открыть",
        uk: "Відкрити",
      },
      hide: {
        en: "Hide",
        ru: "Скрыть",
        uk: "Сховати",
      },
      show: {
        en: "Show",
        ru: "Показать",
        uk: "Показати",
      },
      waitingEnable: {
        en: "Enable waiting",
        ru: "Включить ожидание",
        uk: "Увімкнути очікування",
      },
      waitingDisable: {
        en: "Disable waiting",
        ru: "Выключить ожидание",
        uk: "Вимкнути очікування",
      },
      waitingAccept: {
        en: "Accept",
        ru: "Принять",
        uk: "Прийняти",
      },
      waitingDecline: {
        en: "Decline",
        ru: "Отклонить",
        uk: "Відхилити",
      },
      limit: {
        en: "Limit",
        ru: "Лимит",
        uk: "Ліміт",
      },
      rename: {
        en: "Rename",
        ru: "Переименовать",
        uk: "Перейменувати",
      },
      kick: {
        en: "Kick",
        ru: "Кик",
        uk: "Кік",
      },
      ban: {
        en: "Ban",
        ru: "Бан",
        uk: "Бан",
      },
      bitrate: {
        en: "Bitrate",
        ru: "Битрейт",
        uk: "Бітрейт",
      },
      claim: {
        en: "Claim ownership",
        ru: "Забрать комнату",
        uk: "Забрати кімнату",
      },
    },
    bitrate: {
      low: {
        en: "Low (64 kbps)",
        ru: "Низкий (64 кбит/с)",
        uk: "Низький (64 кбіт/с)",
      },
      medium: {
        en: "Medium (96 kbps)",
        ru: "Средний (96 кбит/с)",
        uk: "Середній (96 кбіт/с)",
      },
      high: {
        en: "High (128 kbps)",
        ru: "Высокий (128 кбит/с)",
        uk: "Високий (128 кбіт/с)",
      },
    },
    modal: {
      limitTitle: {
        en: "Set user limit",
        ru: "Установить лимит",
        uk: "Встановити ліміт",
      },
      limitLabel: {
        en: "Number of users (0 for unlimited)",
        ru: "Количество пользователей (0 - без лимита)",
        uk: "Кількість користувачів (0 - без ліміту)",
      },
      renameTitle: {
        en: "Rename room",
        ru: "Переименовать комнату",
        uk: "Перейменувати кімнату",
      },
      renameLabel: {
        en: "New room name",
        ru: "Новое название",
        uk: "Нова назва",
      },
    },
    errors: {
      notOwner: {
        en: "Only the room owner can manage this room.",
        ru: "Только владелец может управлять комнатой.",
        uk: "Тільки власник може керувати кімнатою.",
      },
      roomMissing: {
        en: "This voice room could not be found.",
        ru: "Эта голосовая комната не найдена.",
        uk: "Цю голосову кімнату не знайдено.",
      },
      invalidLimit: {
        en: "User limit must be between 0 and 99.",
        ru: "Лимит должен быть от 0 до 99.",
        uk: "Ліміт має бути від 0 до 99.",
      },
      claimUnavailable: {
        en: "Ownership can only be claimed when the owner is not in the room.",
        ru: "Нельзя забрать комнату пока владелец в комнате.",
        uk: "Не можна забрати кімнату поки власник у кімнаті.",
      },
      waitingRequiresLock: {
        en: "Hide the room before turning on waiting room.",
        ru: "Сначала скройте комнату, чтобы включить ожидание.",
        uk: "Спочатку сховайте кімнату, щоб увімкнути очікування.",
      },
      waitingNotAvailable: {
        en: "Waiting rooms are not enabled on this server.",
        ru: "Комнаты ожидания не включены на этом сервере.",
        uk: "Кімнати очікування не увімкнені на цьому сервері.",
      },
      waitingRequestExpired: {
        en: "Request expired or member is no longer waiting.",
        ru: "Запрос устарел или пользователь уже не в ожидании.",
        uk: "Запит застарів або користувач вже не в очікуванні.",
      },
      waitingOnlyOwner: {
        en: "Only the room owner can respond to waiting requests.",
        ru: "Только владелец комнаты может отвечать на запросы ожидания.",
        uk: "Лише власник кімнати може відповідати на запити очікування.",
      },
      cannotTargetOwner: {
        en: "You cannot target the room owner.",
        ru: "Нельзя выбрать владельца комнаты.",
        uk: "Не можна вибрати власника кімнати.",
      },
    },
    waiting: {
      request: {
        en: "{owner}, {member} is waiting to join your room.",
        ru: "{owner}, пользователь {member} ожидает входа в вашу комнату.",
        uk: "{owner}, користувач {member} очікує входу до вашої кімнати.",
      },
      accepted: {
        en: "{member} was moved to your room.",
        ru: "{member} перемещен в вашу комнату.",
        uk: "{member} переміщено до вашої кімнати.",
      },
      declined: {
        en: "Request declined.",
        ru: "Запрос отклонен.",
        uk: "Запит відхилено.",
      },
    },
  },
} as const;

type LocalizationCategory = keyof typeof localization_strings;

type LocalizationComponent<C extends LocalizationCategory> =
  keyof (typeof localization_strings)[C];

(async () => {
  (Object.keys(localization_strings) as LocalizationCategory[]).forEach(
    (category) => {
      (Object.keys(
        localization_strings[category]
      ) as LocalizationComponent<typeof category>[]).forEach((component) => {
        hubClient.registerLocalizations(
          category,
          component as string,
          localization_strings[category][component],
          true
        );
      });
    }
  );
})();

export default localization_strings;
