import {
   ActionPanel,
   Action,
   Icon,
   List,
   Form,
   LocalStorage,
   showToast,
   Toast,
   useNavigation,
} from "@raycast/api";
import { useEffect, useState } from "react";
import { loadFullSshConfig, SshHostEntry } from "./utils/ssh-config-parser";
import { tmux } from "./utils/exec";

/** Тип для действительно активного туннеля (запущенного в tmux) */
type TunnelInfo = {
   sessionName: string;
   host: string;
   localPort: number;
   remotePort: number;
   createdAt: number;
};

/** Тип для "последних" туннелей (храним минимальную инфу, чтобы быстро создать заново) */
type RecentTunnel = {
   host: string;
   localPort: number;
   remotePort: number;
   lastUsedAt: number;
};

export default function SSHTunnelManager() {
   const [activeTunnels, setActiveTunnels] = useState<TunnelInfo[]>([]);
   const [recentTunnels, setRecentTunnels] = useState<RecentTunnel[]>([]);
   const [loading, setLoading] = useState(true);
   const [error, setError] = useState<string | null>(null);
   const { push } = useNavigation();

   useEffect(() => {
      (async () => {
         try {
            // 1) Загрузка активных туннелей
            const rawData = await LocalStorage.getItem<string>("sshTunnels");


            let storedTunnels: TunnelInfo[] = [];
            if (rawData) {
               storedTunnels = JSON.parse(rawData);
            }

            console.log({ storageStoredTunnels: storedTunnels })

            const runningSessions = await listTmuxSessions();

            console.log({ runningSessions })


            const filtered = storedTunnels.filter((t) => runningSessions.includes(t.sessionName));

            if (filtered.length !== storedTunnels.length) {
               await LocalStorage.setItem("sshTunnels", JSON.stringify(filtered));
            }
            setActiveTunnels(filtered);

            // 2) Загрузка последних 10 запросов
            const recentRaw = await LocalStorage.getItem<string>("recentTunnels");
            if (recentRaw) {
               const list: RecentTunnel[] = JSON.parse(recentRaw);
               setRecentTunnels(list);
            }
         } catch (e) {
            setError(String(e));
         } finally {
            setLoading(false);
         }
      })();
   }, []);

   async function listTmuxSessions(): Promise<string[]> {
      try {
         const { stdout } = await tmux("list-sessions -F '#S'");
         return stdout.split("\n").filter(Boolean);
      } catch {
         return [];
      }
   }

   /** Убиваем tmux-сессию и снимаем туннель из LocalStorage. */
   async function killTunnel(tunnel: TunnelInfo) {
      try {
         await tmux(`kill-session -t ${tunnel.sessionName}`);
         const newTunnels = activeTunnels.filter((t) => t.sessionName !== tunnel.sessionName);
         setActiveTunnels(newTunnels);
         await LocalStorage.setItem("sshTunnels", JSON.stringify(newTunnels));
         showToast(Toast.Style.Success, `Туннель к ${tunnel.host} остановлен`);
      } catch (err) {
         showToast(Toast.Style.Failure, "Не удалось остановить туннель", String(err));
      }
   }

   /** Отобразить форму создания нового туннеля. */
   function openNewTunnelForm() {
      push(
         <NewTunnelForm
            onTunnelCreated={(newTunnel) => setActiveTunnels([...activeTunnels, newTunnel])}
            onRecentTunnelsUpdate={setRecentTunnels}
         />
      );
   }

   /** Быстрый запуск туннеля из "недавних" (RecentTunnel). */
   async function quickLaunch(t: RecentTunnel) {
      try {
         // Генерируем имя сессии (можно сделать уникальное, но пусть будет = host)
         const sessionName = t.host + "_" + t.localPort;
         // Проверяем, не запущен ли уже такой
         const runningSessions = await listTmuxSessions();
         if (runningSessions.includes(sessionName)) {
            showToast(Toast.Style.Failure, `Сессия с именем "${sessionName}" уже активна!`);
            return;
         }

         // Запускаем tmux
         const cmd = `new-session -d -s ${sessionName} "ssh -L ${t.localPort}:127.0.0.1:${t.remotePort} ${t.host} -N > ~/my-vpn.log 2>&1"`;

         await tmux(cmd);

         // Добавляем в активные туннели
         const newTunnel: TunnelInfo = {
            sessionName,
            host: sessionName,
            localPort: t.localPort,
            remotePort: t.remotePort,
            createdAt: Date.now(),
         };
         const rawData = await LocalStorage.getItem<string>("sshTunnels");
         let storedTunnels: TunnelInfo[] = [];
         if (rawData) {
            storedTunnels = JSON.parse(rawData);
         }
         storedTunnels.push(newTunnel);
         await LocalStorage.setItem("sshTunnels", JSON.stringify(storedTunnels));

         // Обновим список активных (UI)
         setActiveTunnels((prev) => [...prev, newTunnel]);

         // И обновим "recentTunnels" (принцип LRU: поднимаем наверх)
         updateRecentTunnels(t.host, t.localPort, t.remotePort, setRecentTunnels);

         showToast(Toast.Style.Success, `Туннель к ${t.host} запущен`);
      } catch (err) {
         showToast(Toast.Style.Failure, "Ошибка при запуске SSH-туннеля", String(err));
      }
   }

   return (
      <List isLoading={loading} searchBarPlaceholder="Управление SSH-туннелями">
         {error && (
            <List.EmptyView
               icon={Icon.ExclamationMark}
               title="Ошибка"
               description={error}
            />
         )}

         {/* Блок недавних туннелей */}
         {!error && recentTunnels.length > 0 && (
            <List.Section title="Недавние подключения (быстрый запуск)">
               {recentTunnels.map((rt, idx) => (
                  <List.Item
                     key={`recent-${idx}-${rt.host}`}
                     icon={Icon.ArrowClockwise}
                     title={rt.host}
                     subtitle={`Лок: ${rt.localPort} → Удал: ${rt.remotePort}`}
                     actions={
                        <ActionPanel>
                           <Action
                              icon={Icon.Play}
                              title="Быстрый Запуск"
                              onAction={() => quickLaunch(rt)}
                           />
                        </ActionPanel>
                     }
                  />
               ))}
            </List.Section>
         )}

         {/* Блок активных туннелей */}
         {!error && activeTunnels.length > 0 && (
            <List.Section title="Активные туннели">
               {activeTunnels.map((t) => (
                  <List.Item
                     key={t.sessionName}
                     title={t.host}
                     subtitle={`Лок: ${t.localPort} → Удал: ${t.remotePort}`}
                     accessories={[{ text: new Date(t.createdAt).toLocaleString() }]}
                     actions={
                        <ActionPanel>
                           <Action
                              icon={Icon.Trash}
                              style={Action.Style.Destructive}
                              title="Остановить Туннель"
                              onAction={() => killTunnel(t)}
                           />
                        </ActionPanel>
                     }
                  />
               ))}
            </List.Section>
         )}

         {/* Кнопка создания нового туннеля */}
         {!error && (
            <List.Item
               key="new-tunnel"
               icon={Icon.Plus}
               title="Добавить новый SSH-туннель"
               subtitle="Создать новое соединение"
               actions={
                  <ActionPanel>
                     <Action
                        title="Открыть Форму"
                        icon={Icon.Plus}
                        onAction={openNewTunnelForm}
                     />
                  </ActionPanel>
               }
            />
         )}
      </List>
   );
}

/**
 * Форма создания нового туннеля
 */
function NewTunnelForm(props: {
   onTunnelCreated: (tunnel: TunnelInfo) => void;
   onRecentTunnelsUpdate: React.Dispatch<React.SetStateAction<RecentTunnel[]>>;
}) {
   const { onTunnelCreated, onRecentTunnelsUpdate } = props;
   const [hosts, setHosts] = useState<SshHostEntry[]>([]);
   const [selectedHost, setSelectedHost] = useState("");
   const [localPort, setLocalPort] = useState("5432");
   const [remotePort, setRemotePort] = useState("5432");
   const [info, setInfo] = useState<string | null>(null);

   useEffect(() => {
      try {
         const allHosts = loadFullSshConfig();
         if (!allHosts.length) {
            setInfo("Не найдено ни одного Host (возможно, всё закомментировано или wildcard).");
         }
         setHosts(allHosts);
      } catch (err) {
         setInfo(`Ошибка чтения ~/.ssh/config: ${err}`);
      }
   }, []);

   async function handleSubmit() {
      if (!selectedHost) {
         showToast(Toast.Style.Failure, "Выберите хост из списка");
         return;
      }
      if (!localPort || !remotePort) {
         showToast(Toast.Style.Failure, "Укажите локальный и удалённый порт");
         return;
      }

      const sessionName = selectedHost; // Можно доработать, чтобы имена не дублировались
      const lPortNum = parseInt(localPort, 10);
      const rPortNum = parseInt(remotePort, 10);

      try {
         const runningSessions = await listTmuxSessions();
         if (runningSessions.includes(sessionName)) {
            showToast(Toast.Style.Failure, `Сессия "${sessionName}" уже активна!`);
            return;
         }

         // Команда tmux для запуска ssh-туннеля
         const cmd = `new-session -d -s ${sessionName} "ssh -L ${lPortNum}:127.0.0.1:${rPortNum} ${sessionName} -N"`;
         await tmux(cmd);

         // Создаём структуру туннеля
         const newTunnel: TunnelInfo = {
            sessionName,
            host: sessionName,
            localPort: lPortNum,
            remotePort: rPortNum,
            createdAt: Date.now(),
         };

         // Сохраняем в список активных туннелей
         const rawData = await LocalStorage.getItem<string>("sshTunnels");
         const storedTunnels: TunnelInfo[] = rawData ? JSON.parse(rawData) : [];
         storedTunnels.push(newTunnel);
         await LocalStorage.setItem("sshTunnels", JSON.stringify(storedTunnels));

         // Обновляем UI
         onTunnelCreated(newTunnel);

         // Сохраняем в "последних 10" (RecentTunnel)
         updateRecentTunnels(sessionName, lPortNum, rPortNum, onRecentTunnelsUpdate);

         showToast(Toast.Style.Success, `Туннель к ${sessionName} успешно создан`);
      } catch (err) {
         showToast(Toast.Style.Failure, "Ошибка при запуске SSH-туннеля", String(err));
      }
   }

   // Получаем список tmux-сессий (почти дубликат, что и вверху, но чтобы не разносить сильно)
   async function listTmuxSessions(): Promise<string[]> {
      try {
         const { stdout } = await tmux("list-sessions -F '#S'");
         return stdout.split("\n").filter(Boolean);
      } catch {
         return [];
      }
   }

   return (
      <Form
         actions={
            <ActionPanel>
               <Action.SubmitForm title="Создать Туннель" onSubmit={handleSubmit} />
            </ActionPanel>
         }
      >
         {info && <Form.Description title="Информация" text={info} />}

         <Form.Dropdown
            id="sshHost"
            title="Хост из ~/.ssh/config"
            value={selectedHost}
            onChange={setSelectedHost}
         >
            {hosts.map((h) => (
               <Form.Dropdown.Item
                  key={h.host}
                  value={h.host}
                  title={h.host}
               />
            ))}
         </Form.Dropdown>

         <Form.TextField
            id="localPort"
            title="Локальный порт"
            value={localPort}
            onChange={setLocalPort}
            placeholder="Например, 10800"
         />

         <Form.TextField
            id="remotePort"
            title="Удалённый порт"
            value={remotePort}
            onChange={setRemotePort}
            placeholder="Например, 80"
         />
      </Form>
   );
}

/**
 * Обновляет список "recentTunnels" в LocalStorage и в useState,
 * сохраняя последние 10, поднимая повторяющиеся записи наверх.
 */
async function updateRecentTunnels(
   host: string,
   localPort: number,
   remotePort: number,
   setRecentState: React.Dispatch<React.SetStateAction<RecentTunnel[]>>
) {
   const raw = await LocalStorage.getItem<string>("recentTunnels");
   let list: RecentTunnel[] = raw ? JSON.parse(raw) : [];

   // Проверяем, есть ли уже такая запись. Если есть, удалим из массива, чтобы вставить в начало
   list = list.filter(
      (x) => !(x.host === host && x.localPort === localPort && x.remotePort === remotePort)
   );

   // Добавляем «свежую» запись в начало
   const newRec: RecentTunnel = {
      host,
      localPort,
      remotePort,
      lastUsedAt: Date.now(),
   };
   list.unshift(newRec);

   // Обрежем список до 10
   if (list.length > 10) {
      list.splice(10);
   }

   // Сохраним
   await LocalStorage.setItem("recentTunnels", JSON.stringify(list));
   // Обновим стейт, чтобы отобразилось в UI
   setRecentState(list);
}